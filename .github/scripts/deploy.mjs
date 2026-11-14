import { pathToFileURL } from 'node:url';

const pendingRender = new Set(['created', 'queued', 'build_in_progress', 'update_in_progress', 'pre_deploy_in_progress']);
const pendingVercel = new Set(['QUEUED', 'INITIALIZING', 'BUILDING']);

export function readConfig(env, { requireDatabase = false } = {}) {
  const required = [
    'RENDER_API_TOKEN', 'RENDER_SERVICE_ID', 'VERCEL_TOKEN', 'VERCEL_PROJECT_ID', 'VERCEL_PROJECT_NAME',
    'GITHUB_SHA', 'GITHUB_REPOSITORY', 'PRODUCTION_WEB_URL', 'PRODUCTION_API_URL',
  ];
  if (requireDatabase) required.push('PRODUCTION_DATABASE_URL');
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  if (!/^srv-[a-zA-Z0-9]+$/.test(env.RENDER_SERVICE_ID)) throw new Error('RENDER_SERVICE_ID must be a Render web service ID (srv-...).');
  if (!/^[a-f0-9]{40}$/i.test(env.GITHUB_SHA)) throw new Error('GITHUB_SHA must be a full commit SHA.');
  const parts = env.GITHUB_REPOSITORY.split('/');
  if (parts.length !== 2 || parts.some((part) => !part)) throw new Error('Invalid GITHUB_REPOSITORY.');
  const webUrl = new URL(env.PRODUCTION_WEB_URL);
  if (webUrl.protocol !== 'https:') throw new Error('PRODUCTION_WEB_URL must use HTTPS.');
  if (new URL(env.PRODUCTION_API_URL).protocol !== 'https:') throw new Error('PRODUCTION_API_URL must use HTTPS.');
  return { ...env, owner: parts[0], repo: parts[1], webHost: webUrl.hostname };
}

async function request(fetchFn, url, token, body) {
  const response = await fetchFn(url, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Deployment API request failed: HTTP ${response.status}`);
  return response.json();
}

export async function validateProviders(config, fetchFn = fetch) {
  const service = await request(fetchFn, `https://api.render.com/v1/services/${encodeURIComponent(config.RENDER_SERVICE_ID)}`, config.RENDER_API_TOKEN);
  if (service.id !== config.RENDER_SERVICE_ID || service.type !== 'web_service') throw new Error('Render service ID is not a web service.');
  if (service.serviceDetails?.url?.replace(/\/$/, '') !== config.PRODUCTION_API_URL.replace(/\/$/, '')) throw new Error('Render service URL does not match the production API.');
  if (service.autoDeployTrigger ? service.autoDeployTrigger !== 'off' : service.autoDeploy !== 'no') {
    throw new Error('Disable Render auto-deploy before using this pipeline.');
  }
  if (service.branch !== 'main' || service.repo?.replace(/\.git$/, '').toLowerCase() !== `https://github.com/${config.owner}/${config.repo}`.toLowerCase()) {
    throw new Error('Render service must be linked to the main branch of this repository.');
  }
  const query = new URLSearchParams();
  if (config.VERCEL_TEAM_ID) query.set('teamId', config.VERCEL_TEAM_ID);
  const project = await request(fetchFn, `https://api.vercel.com/v9/projects/${encodeURIComponent(config.VERCEL_PROJECT_ID)}?${query}`, config.VERCEL_TOKEN);
  if (project.id !== config.VERCEL_PROJECT_ID || project.name !== config.VERCEL_PROJECT_NAME) throw new Error('Vercel project ID or name does not match.');
  if (project.rootDirectory !== 'apps/web') throw new Error('Vercel project Root Directory must be apps/web.');
  console.log('Render service and Vercel project configuration verified.');
}

async function waitForDeploy({ get, check, sleep, attempts, provider }) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const result = check(await get());
    if (result === 'done') return;
    if (result !== 'pending') throw new Error(`${provider} deployment failed or returned an unexpected status: ${result}`);
    if (attempt + 1 < attempts) await sleep(10000);
  }
  throw new Error(`${provider} deployment timed out; inspect the provider dashboard before retrying.`);
}

export async function deploy(config, { fetchFn = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), attempts = 180 } = {}) {
  const renderBase = `https://api.render.com/v1/services/${encodeURIComponent(config.RENDER_SERVICE_ID)}/deploys`;
  const render = await request(fetchFn, renderBase, config.RENDER_API_TOKEN, { commitId: config.GITHUB_SHA });
  if (!render.id) throw new Error('Render did not return a deployment ID; inspect its dashboard before retrying.');
  console.log(`Render deployment ${render.id} started.`);
  await waitForDeploy({
    provider: 'Render', attempts, sleep,
    get: () => request(fetchFn, `${renderBase}/${encodeURIComponent(render.id)}`, config.RENDER_API_TOKEN),
    check: (data) => {
      if (data.status === 'live') {
        if (data.commit?.id !== config.GITHUB_SHA) throw new Error('Render deployed a different or unverifiable commit.');
        return 'done';
      }
      return pendingRender.has(data.status) ? 'pending' : String(data.status);
    },
  });
  console.log('Render deployment is live with the requested commit.');

  const query = new URLSearchParams({ forceNew: '1' });
  if (config.VERCEL_TEAM_ID) query.set('teamId', config.VERCEL_TEAM_ID);
  const vercelBase = 'https://api.vercel.com/v13/deployments';
  const vercel = await request(fetchFn, `${vercelBase}?${query}`, config.VERCEL_TOKEN, {
    name: config.VERCEL_PROJECT_NAME,
    project: config.VERCEL_PROJECT_ID,
    target: 'production',
    gitSource: { type: 'github', org: config.owner, repo: config.repo, ref: 'main', sha: config.GITHUB_SHA },
  });
  if (!vercel.id) throw new Error('Vercel did not return a deployment ID; inspect its dashboard before retrying.');
  console.log(`Vercel deployment ${vercel.id} started.`);
  const lookup = new URLSearchParams({ withGitRepoInfo: 'true' });
  if (config.VERCEL_TEAM_ID) lookup.set('teamId', config.VERCEL_TEAM_ID);
  await waitForDeploy({
    provider: 'Vercel', attempts, sleep,
    get: () => request(fetchFn, `${vercelBase}/${encodeURIComponent(vercel.id)}?${lookup}`, config.VERCEL_TOKEN),
    check: (data) => {
      if (data.readyState === 'READY') {
        if (data.gitSource?.sha !== config.GITHUB_SHA) throw new Error('Vercel deployed a different or unverifiable commit.');
        if (data.target !== 'production') throw new Error('Vercel deployment is not a production deployment.');
        if (data.aliasError) throw new Error('Vercel failed to assign the production domain.');
        if (data.aliasAssigned !== true || !data.alias?.includes(config.webHost)) return 'pending';
        return 'done';
      }
      return pendingVercel.has(data.readyState) ? 'pending' : String(data.readyState);
    },
  });
  console.log('Vercel deployment is ready with the requested commit and production domain.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = readConfig(process.env, { requireDatabase: process.argv[2] === '--check' });
    if (process.argv[2] === '--check') await validateProviders(config);
    else await deploy(config);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Deployment failed.');
    process.exitCode = 1;
  }
}
