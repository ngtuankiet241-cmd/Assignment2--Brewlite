import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploy, readConfig, validateProviders } from '../.github/scripts/deploy.mjs';

const sha = 'a'.repeat(40);
const env = {
  PRODUCTION_DATABASE_URL: 'postgresql://example',
  RENDER_API_TOKEN: 'render-secret',
  RENDER_SERVICE_ID: 'srv-123',
  VERCEL_TOKEN: 'vercel-secret',
  VERCEL_PROJECT_ID: 'prj-123',
  VERCEL_PROJECT_NAME: 'brewlite',
  VERCEL_TEAM_ID: 'team-123',
  GITHUB_SHA: sha,
  GITHUB_REPOSITORY: 'owner/repo',
  PRODUCTION_WEB_URL: 'https://example.vercel.app',
  PRODUCTION_API_URL: 'https://example.onrender.com',
};
const readyRender = { id: 'dep-1', status: 'live', commit: { id: sha } };
const readyVercel = {
  id: 'dpl-1', readyState: 'READY', gitSource: { sha }, target: 'production',
  aliasAssigned: true, alias: ['example.vercel.app'],
};

function fakeFetch(responses, calls = []) {
  return async (url, options) => {
    calls.push({ url, options });
    const next = responses.shift();
    assert.ok(next, `Unexpected request: ${url}`);
    const status = typeof next.status === 'number' ? next.status : 200;
    return { ok: status < 400, status, json: async () => next.body ?? next };
  };
}
const immediate = { sleep: async () => {}, attempts: 2 };

test('requires configuration and distinguishes a web service from a database ID', () => {
  assert.throws(() => readConfig({ ...env, PRODUCTION_DATABASE_URL: '' }, { requireDatabase: true }), /PRODUCTION_DATABASE_URL/);
  assert.throws(() => readConfig({ ...env, RENDER_SERVICE_ID: 'dpg-123' }), /web service ID/);
  assert.throws(() => readConfig({ ...env, GITHUB_SHA: 'main' }), /full commit SHA/);
});

test('preflight checks providers and rejects direct Render auto-deploy', async () => {
  const service = {
    id: 'srv-123', type: 'web_service', branch: 'main',
    repo: 'https://github.com/owner/repo', autoDeployTrigger: 'off',
    serviceDetails: { url: 'https://example.onrender.com' },
  };
  const project = { id: 'prj-123', name: 'brewlite', rootDirectory: 'apps/web' };
  await validateProviders(readConfig(env), fakeFetch([service, project]));
  await assert.rejects(validateProviders(readConfig(env), fakeFetch([{ ...service, autoDeployTrigger: 'commit' }])), /Disable Render auto-deploy/);
  await assert.rejects(validateProviders(readConfig(env), fakeFetch([{ ...service, serviceDetails: { url: 'https://wrong.onrender.com' } }])), /production API/);
  await assert.rejects(validateProviders(readConfig(env), fakeFetch([service, { ...project, rootDirectory: null }])), /Root Directory/);
});

test('deploys the exact commit, waits for Render, and verifies Vercel production alias', async () => {
  const calls = [];
  const fetchFn = fakeFetch([
    { id: 'dep-1' }, { status: 'build_in_progress' }, readyRender,
    { id: 'dpl-1' }, { ...readyVercel, aliasAssigned: false }, readyVercel,
  ], calls);
  await deploy(readConfig(env), { fetchFn, ...immediate });
  assert.equal(JSON.parse(calls[0].options.body).commitId, sha);
  assert.equal(calls[3].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[3].options.body).gitSource, {
    type: 'github', org: 'owner', repo: 'repo', ref: 'main', sha,
  });
  assert.match(calls[3].url, /teamId=team-123/);
});

test('fails without proceeding to Vercel when Render fails or deploys another commit', async () => {
  for (const result of [{ status: 'build_failed' }, { ...readyRender, commit: { id: 'b'.repeat(40) } }]) {
    const calls = [];
    await assert.rejects(deploy(readConfig(env), { fetchFn: fakeFetch([{ id: 'dep-1' }, result], calls), ...immediate }));
    assert.equal(calls.length, 2);
  }
});

test('rejects mismatched Vercel commits and unsuccessful deployment states', async () => {
  for (const result of [
    { ...readyVercel, gitSource: { sha: 'b'.repeat(40) } },
    { ...readyVercel, target: 'preview' },
    { ...readyVercel, aliasError: { code: 'error' } },
    { readyState: 'ERROR' },
  ]) {
    await assert.rejects(deploy(readConfig(env), {
      fetchFn: fakeFetch([{ id: 'dep-1' }, readyRender, { id: 'dpl-1' }, result]), ...immediate,
    }));
  }
});

test('fails on API errors, missing IDs, and a production alias that never becomes ready', async () => {
  await assert.rejects(deploy(readConfig(env), { fetchFn: fakeFetch([{ status: 401 }]), ...immediate }), /HTTP 401/);
  await assert.rejects(deploy(readConfig(env), { fetchFn: fakeFetch([{}]), ...immediate }), /deployment ID/);
  const noAlias = { ...readyVercel, alias: [] };
  await assert.rejects(deploy(readConfig(env), {
    fetchFn: fakeFetch([{ id: 'dep-1' }, readyRender, { id: 'dpl-1' }, noAlias, noAlias]), ...immediate,
  }), /timed out/);
});
