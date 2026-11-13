import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

// src/ and dist/ share the same depth under apps/api. Resolve independently of cwd.
// Node preserves existing environment values, including those injected by Docker.
const environmentPath = resolve(__dirname, '../../../.env');
if (existsSync(environmentPath)) loadEnvFile(environmentPath);
