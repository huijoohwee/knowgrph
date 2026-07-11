import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const repoRoot = path.resolve(scriptsDir, '..');
const canvasRoot = path.join(repoRoot, 'canvas');
const viteCliPath = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const skipBrowser = process.argv.includes('--skip-browser');
const ownerAppUrl = process.env.KG_COLLABORATION_E2E_OWNER_URL || 'http://127.0.0.1:5173/';
const guestAppUrl = process.env.KG_COLLABORATION_E2E_GUEST_URL || 'http://127.0.0.1:5174/';
const workerUrl = process.env.KG_COLLABORATION_E2E_WORKER_URL || 'http://127.0.0.1:8787';
const DEFAULT_OWNER_APP_URL = 'http://127.0.0.1:5173/';
const DEFAULT_GUEST_APP_URL = 'http://127.0.0.1:5174/';
const DEFAULT_WORKER_URL = 'http://127.0.0.1:8787';
const DEFAULT_WORKSPACE_ID = 'kgws:test-room';
const DEFAULT_OWNER_TOKEN = 'kg_collaboration_owner_local_token';
const DEFAULT_GUEST_TOKEN = 'kg_collaboration_guest_local_token';
const collaborationWorkspaceId = process.env.KG_COLLABORATION_E2E_WORKSPACE_ID || DEFAULT_WORKSPACE_ID;
const ownerSessionToken = process.env.KG_COLLABORATION_E2E_OWNER_TOKEN || DEFAULT_OWNER_TOKEN;
const guestSessionToken = process.env.KG_COLLABORATION_E2E_GUEST_TOKEN || DEFAULT_GUEST_TOKEN;
const normalizedWorkerBaseUrl = workerUrl.replace(/\/+$/, '');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runStep = ({ name, command, args, cwd, env = process.env }) => {
  process.stdout.write(`\n[collaboration-readiness] ${name}\n`);
  process.stdout.write(`$ ${[command, ...args].join(' ')}\n`);
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env,
  });
};

const runCommand = (command, args, cwd) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  child.once('exit', (code) => {
    if (code === 0) {
      resolve();
      return;
    }
    reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'null'}`));
  });
  child.once('error', reject);
});

const terminateProcess = (child) => {
  if (!child || child.killed) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => resolve();
    child.once('exit', finish);
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL');
    }, 2000);
  });
};

const isLocalhost = (hostname) => hostname === '127.0.0.1' || hostname === 'localhost';

const readLocalServiceConfig = (rawUrl, fallbackUrl) => {
  const parsedUrl = new URL(rawUrl || fallbackUrl);
  const fallback = new URL(fallbackUrl);
  const hostname = parsedUrl.hostname || fallback.hostname;
  const port = Number(parsedUrl.port || fallback.port);
  if (!isLocalhost(hostname) || !Number.isFinite(port) || port <= 0) return null;
  return { hostname, port };
};

const browserServices = [
  {
    id: 'owner-app',
    readyUrl: ownerAppUrl,
    envVar: 'KG_COLLABORATION_E2E_OWNER_URL',
    startupCommand: 'npm --prefix canvas run dev:5173',
    kind: 'vite',
    local: readLocalServiceConfig(ownerAppUrl, DEFAULT_OWNER_APP_URL),
  },
  {
    id: 'guest-app',
    readyUrl: guestAppUrl,
    envVar: 'KG_COLLABORATION_E2E_GUEST_URL',
    startupCommand: 'npm --prefix canvas run dev -- --port 5174 --strictPort',
    kind: 'vite',
    local: readLocalServiceConfig(guestAppUrl, DEFAULT_GUEST_APP_URL),
  },
  {
    id: 'storage-worker',
    readyUrl: `${normalizedWorkerBaseUrl}/api/storage/source-files`,
    envVar: 'KG_COLLABORATION_E2E_WORKER_URL',
    startupCommand: 'npm run storage:worker:dev -- --port 8787',
    kind: 'worker',
    local: readLocalServiceConfig(workerUrl, DEFAULT_WORKER_URL),
  },
];

const waitForServerReady = async (url, timeoutMs) => {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.ok || (response.status >= 300 && response.status < 400)) {
        return `ready (${response.status})`;
      }
      lastError = new Error(`unexpected HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(1000);
  }
  throw new Error(lastError instanceof Error ? lastError.message : `timed out waiting for ${url}`);
};

const isServerReady = async (url, timeoutMs) => {
  try {
    const reason = await waitForServerReady(url, timeoutMs);
    return { ok: true, reason };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};

const startBrowserService = (service) => {
  if (!service.local) {
    throw new Error(`${service.id} is not using a local URL and cannot be auto-started`);
  }
  if (service.kind === 'vite') {
    const serviceEnv = {
      ...process.env,
      VITE_KNOWGRPH_STORAGE_BASE_URL: normalizedWorkerBaseUrl,
      VITE_KNOWGRPH_STORAGE_WORKSPACE_ID: collaborationWorkspaceId,
      VITE_KNOWGRPH_STORAGE_CHAT_SESSION_TOKEN: service.id === 'owner-app' ? ownerSessionToken : guestSessionToken,
    };
    return spawn(process.execPath, [
      viteCliPath,
      '--configLoader',
      'runner',
      '--host',
      service.local.hostname,
      '--port',
      String(service.local.port),
      '--strictPort',
    ], {
      cwd: canvasRoot,
      stdio: 'inherit',
      env: serviceEnv,
    });
  }
  return spawn(npmCommand, [
    'run',
    'storage:worker:dev',
    '--',
    '--port',
    String(service.local.port),
  ], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
};

const waitForStartedService = (service, child, timeoutMs) => Promise.race([
  waitForServerReady(service.readyUrl, timeoutMs),
  new Promise((_, reject) => {
    child.once('exit', (code) => reject(new Error(`${service.id} exited before ready with code ${code ?? 'null'}`)));
    child.once('error', reject);
  }),
]);

const formatBrowserStackError = (results) => {
  const failures = results.filter((result) => !result.ok);
  const lines = [
    '[collaboration-readiness] browser smoke stack failed',
    'The authenticated browser smoke could not reuse or start the full local collaboration stack.',
    '',
    ...failures.map((result) => `- ${result.id}: ${result.readyUrl} (${result.reason})`),
    '',
    'Default local startup commands:',
    ...browserServices.map((service, index) => `${index + 1}. ${service.startupCommand}`),
    '',
    'Override these env vars only when you want to point the browser smoke at an already-running non-default stack:',
    ...browserServices.map((service) => `- ${service.envVar}`),
    '',
    'Then rerun: npm run collaboration:readiness:check',
  ];
  return new Error(lines.join('\n'));
};

const hashToken = (value) => createHash('sha256').update(String(value || '')).digest('hex');

const escapeSqlString = (value) => String(value || '').replace(/'/g, "''");

const buildLocalCollaborationSeedSql = () => {
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const workspaceId = escapeSqlString(collaborationWorkspaceId);
  const ownerTokenHash = escapeSqlString(hashToken(ownerSessionToken));
  const guestTokenHash = escapeSqlString(hashToken(guestSessionToken));
  return [
    `insert or replace into workspaces (id, slug, title, visibility, created_at, updated_at) values ('${workspaceId}', 'test-room', 'Knowgrph Collaboration E2E', 'private', '${nowIso}', '${nowIso}');`,
    `insert or replace into users (id, email, display_name, status, created_at, updated_at) values ('user:collab-owner-local', 'owner.local@knowgrph.test', 'Owner Local', 'active', '${nowIso}', '${nowIso}');`,
    `insert or replace into users (id, email, display_name, status, created_at, updated_at) values ('user:collab-guest-local', 'guest.local@knowgrph.test', 'Guest Local', 'active', '${nowIso}', '${nowIso}');`,
    `insert or replace into workspace_memberships (id, workspace_id, user_id, role, status, invited_by_user_id, created_at, updated_at) values ('membership:collab-owner-local', '${workspaceId}', 'user:collab-owner-local', 'owner', 'active', null, '${nowIso}', '${nowIso}');`,
    `insert or replace into workspace_memberships (id, workspace_id, user_id, role, status, invited_by_user_id, created_at, updated_at) values ('membership:collab-guest-local', '${workspaceId}', 'user:collab-guest-local', 'editor', 'active', 'user:collab-owner-local', '${nowIso}', '${nowIso}');`,
    `insert or replace into auth_sessions (id, user_id, session_hash, expires_at, revoked_at, created_at, updated_at) values ('session:collab-owner-local', 'user:collab-owner-local', '${ownerTokenHash}', '${expiresAt}', null, '${nowIso}', '${nowIso}');`,
    `insert or replace into auth_sessions (id, user_id, session_hash, expires_at, revoked_at, created_at, updated_at) values ('session:collab-guest-local', 'user:collab-guest-local', '${guestTokenHash}', '${expiresAt}', null, '${nowIso}', '${nowIso}');`,
  ].join(' ');
};

const bootstrapLocalCollaborationAuth = async () => {
  process.stdout.write('\n[collaboration-readiness] bootstrapping local collaboration auth\n');
  await runCommand('npx', [
    '--yes',
    'wrangler@latest',
    'd1',
    'migrations',
    'apply',
    'knowgrph-storage',
    '--local',
    '--config',
    'cloudflare/workers/knowgrph-storage/wrangler.toml',
  ], repoRoot);
  await runCommand('npx', [
    '--yes',
    'wrangler@latest',
    'd1',
    'execute',
    'knowgrph-storage',
    '--local',
    '--config',
    'cloudflare/workers/knowgrph-storage/wrangler.toml',
    '--command',
    buildLocalCollaborationSeedSql(),
  ], repoRoot);
};

const ensureBrowserSmokeStack = async () => {
  process.stdout.write('\n[collaboration-readiness] browser smoke stack\n');
  const results = await Promise.all(browserServices.map(async (service) => {
    const status = await isServerReady(service.readyUrl, 1500);
    return {
      ...service,
      ok: status.ok,
      reason: status.reason,
      reused: status.ok,
      started: false,
      child: null,
    };
  }));
  for (const result of results) {
    process.stdout.write(`- ${result.id}: ${result.readyUrl} -> ${result.reason}${result.reused ? ' [reused]' : ''}\n`);
  }
  const missingViteServices = results.filter((result) => !result.ok && result.kind === 'vite' && result.local);
  if (missingViteServices.length > 0) {
    process.stdout.write('\n[collaboration-readiness] preparing canvas dev prerequisites\n');
    await runCommand(npmCommand, ['--prefix', 'canvas', 'run', 'predev'], repoRoot);
  }
  if (results.some((result) => !result.ok && result.local)) {
    await bootstrapLocalCollaborationAuth();
  }
  const startedChildren = [];
  for (const result of results) {
    if (result.ok) continue;
    if (!result.local) {
      result.reason = `not auto-startable; configure ${result.envVar} to a running local stack or restore the default local URL`;
      continue;
    }
    process.stdout.write(`[collaboration-readiness] starting ${result.id} with ${result.startupCommand}\n`);
    result.child = startBrowserService(result);
    result.started = true;
    startedChildren.push(result.child);
  }
  for (const result of results) {
    if (!result.started || !result.child) continue;
    try {
      result.reason = await waitForStartedService(result, result.child, 120000);
      result.ok = true;
      process.stdout.write(`- ${result.id}: ${result.readyUrl} -> ${result.reason} [started]\n`);
    } catch (error) {
      result.ok = false;
      result.reason = error instanceof Error ? error.message : String(error);
    }
  }
  if (results.some((result) => !result.ok)) {
    await Promise.all(startedChildren.map((child) => terminateProcess(child)));
    throw formatBrowserStackError(results);
  }
  return startedChildren;
};

runStep({
  name: 'docs guard',
  command: npmCommand,
  args: ['--prefix', 'canvas', 'run', 'test:ci:unit', '--', 'multiUserCollaboration.docs'],
  cwd: repoRoot,
});

runStep({
  name: 'focused collaboration runtime and protocol checks',
  command: npmCommand,
  args: ['--prefix', 'canvas', 'run', 'test:ci:unit', '--', 'collaboration.'],
  cwd: repoRoot,
});

runStep({
  name: 'main panel collaboration UI checks',
  command: npmCommand,
  args: ['--prefix', 'canvas', 'run', 'test:ci:unit', '--', 'ui.mainPanel.collaboration'],
  cwd: repoRoot,
});

if (skipBrowser) {
  process.stdout.write('\n[collaboration-readiness] skipped browser smoke by request\n');
} else {
  const startedChildren = await ensureBrowserSmokeStack();
  try {
    runStep({
      name: 'authenticated room browser smoke',
      command: npmCommand,
      args: ['--prefix', 'canvas', 'run', 'validate:multi-user-collaboration:e2e'],
      cwd: repoRoot,
      env: {
        ...process.env,
        KG_COLLABORATION_E2E_WORKSPACE_ID: collaborationWorkspaceId,
        KG_COLLABORATION_E2E_WORKER_URL: normalizedWorkerBaseUrl,
        KG_COLLABORATION_E2E_OWNER_TOKEN: ownerSessionToken,
        KG_COLLABORATION_E2E_GUEST_TOKEN: guestSessionToken,
      },
    });
  } finally {
    await Promise.all(startedChildren.map((child) => terminateProcess(child)));
  }
}

process.stdout.write('\n[collaboration-readiness] ok\n');
