import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const repoRoot = path.resolve(scriptsDir, '..');
const canvasRoot = path.join(repoRoot, 'canvas');
const tsxCliCandidates = [
  path.join(canvasRoot, 'node_modules', 'tsx', 'dist', 'cli.cjs'),
  path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.cjs'),
];
const tsxCliPath = tsxCliCandidates.find((candidate) => fs.existsSync(candidate)) || tsxCliCandidates[0];

const PROJECT_NAME = 'joohwee';
const SECRET_NAME = 'MIROMIND_API_KEY';
const DEFAULT_ORIGIN = 'https://joohwee.pages.dev';
const LIVE_ORIGIN = String(process.env.KNOWGRPH_MIROMIND_PAGES_ORIGIN || DEFAULT_ORIGIN).replace(/\/+$/g, '');
const LIVE_MODE = process.argv.includes('--live-only');
const SKIP_LIVE = process.argv.includes('--skip-live');

const runStep = ({ name, command, args, cwd, capture = false }) => {
  process.stdout.write(`\n[miromind-readiness] ${name}\n`);
  process.stdout.write(`$ ${[command, ...args].join(' ')}\n`);
  return execFileSync(command, args, {
    cwd,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: process.env,
    encoding: capture ? 'utf8' : undefined,
  });
};

const focusedCanvasTestProgram = `
import {
  testMiroMindServerManagedProxyEnvNamesStayAligned,
  testOfficialEndpointsNormalizeToProxyPaths,
} from './src/__tests__/chatEndpointProviders.test.ts';
import { testMiroMindProviderOptionsReuseSharedChatCompletionsShape } from './src/__tests__/floatingPanelChatProviderOptions.test.ts';
import { testMainPanelMiroMindApiKeyUsesServerManagedPagesSecretContract } from './src/__tests__/mainPanelMiroMindPagesReadiness.test.tsx';
import {
  testMainPanelRequestedIntegrationsSearchShowsMiroMindApiConfigurableValues,
} from './src/__tests__/mainPanelIntegrations.test.tsx';

void (async () => {
  testOfficialEndpointsNormalizeToProxyPaths();
  testMiroMindServerManagedProxyEnvNamesStayAligned();
  testMiroMindProviderOptionsReuseSharedChatCompletionsShape();
  await testMainPanelRequestedIntegrationsSearchShowsMiroMindApiConfigurableValues();
  await testMainPanelMiroMindApiKeyUsesServerManagedPagesSecretContract();
  console.log('miromind-focused-tests: ok');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`.trim();

const assertSecretListIncludesMiroMind = () => {
  const output = runStep({
    name: 'Cloudflare Pages production secret list',
    command: 'npx',
    args: ['--yes', 'wrangler', 'pages', 'secret', 'list', '--project-name', PROJECT_NAME],
    cwd: repoRoot,
    capture: true,
  });
  process.stdout.write(output);
  if (!output.includes(`${SECRET_NAME}: Value Encrypted`)) {
    throw new Error(`Cloudflare Pages project ${PROJECT_NAME} does not list ${SECRET_NAME} in production secrets.`);
  }
};

const readJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const runLiveSmoke = async () => {
  const endpoint = `${LIVE_ORIGIN}/__chat_proxy/v1/models`;
  process.stdout.write(`\n[miromind-readiness] live Pages proxy smoke\n`);
  process.stdout.write(`GET ${endpoint}\n`);
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-kg-chat-provider': 'miromind',
      'x-client-request-id': 'kg-miromind-pages-env-readiness',
    },
    signal: AbortSignal.timeout(15000),
  });
  const bodyText = await response.text();
  const payload = readJson(bodyText);
  const proxyMissingKey = Boolean(
    payload
    && payload.ok === false
    && /Missing MiroMind API key/i.test(String(payload.error || '')),
  );
  const summary = {
    origin: LIVE_ORIGIN,
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    proxyMissingKey,
    bodyPreview: bodyText.slice(0, 240).replace(/[\r\n]+/g, ' '),
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (proxyMissingKey) {
    throw new Error(
      `${SECRET_NAME} is listed on the Pages project, but the live Pages Function does not see it on context.env. ` +
      `Create a fresh Pages deployment after the secret is configured, then rerun npm run miromind:readiness:check.`,
    );
  }
  if (response.status !== 200) {
    throw new Error(`MiroMind live proxy smoke expected HTTP 200 from ${endpoint}; got ${response.status}.`);
  }
};

if (!fs.existsSync(tsxCliPath)) {
  throw new Error(`Missing tsx CLI. Checked ${tsxCliCandidates.join(', ')}. Run npm install first.`);
}

if (!LIVE_MODE) {
  runStep({
    name: 'canvas focused MiroMind checks',
    command: process.execPath,
    args: ['--preserve-symlinks', '--preserve-symlinks-main', tsxCliPath, '-e', focusedCanvasTestProgram],
    cwd: canvasRoot,
  });
}

assertSecretListIncludesMiroMind();

if (SKIP_LIVE) {
  process.stdout.write('\n[miromind-readiness] skipped live Pages proxy smoke by request\n');
} else {
  await runLiveSmoke();
}

process.stdout.write('\n[miromind-readiness] ok\n');
