import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const repoRoot = path.resolve(scriptsDir, '..');
const canvasRoot = path.join(repoRoot, 'canvas');
const publishRepoRoot = path.resolve(repoRoot, '../huijoohwee');
const tsxCliPath = path.join(canvasRoot, 'node_modules', 'tsx', 'dist', 'cli.cjs');

const readEnvPresence = (name) => (String(process.env[name] || '').trim() ? 'present' : 'missing');

const runStep = ({ name, command, args, cwd }) => {
  process.stdout.write(`\n[agnes-readiness] ${name}\n`);
  process.stdout.write(`$ ${[command, ...args].join(' ')}\n`);
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
};

const focusedCanvasTestProgram = `
import {
  testOfficialEndpointsNormalizeToProxyPaths,
} from './src/__tests__/chatEndpointProviders.test.ts';
import { testAgnesProviderOptionsReuseSharedChatCompletionsShape } from './src/__tests__/floatingPanelChatProviderOptions.test.ts';
import {
  testIntegrationsHubReusesSettingsEntryList,
  testIntegrationsHubSectionLinksOpenFloatingPanels,
} from './src/__tests__/mainPanelIntegrations.test.tsx';

void (async () => {
  testOfficialEndpointsNormalizeToProxyPaths();
  testAgnesProviderOptionsReuseSharedChatCompletionsShape();
  await testIntegrationsHubReusesSettingsEntryList();
  await testIntegrationsHubSectionLinksOpenFloatingPanels();
  console.log('agnes-focused-tests: ok');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`.trim();

if (!fs.existsSync(tsxCliPath)) {
  throw new Error(`Missing tsx CLI at ${tsxCliPath}. Run npm install in canvas first.`);
}

runStep({
  name: 'canvas focused Agnes checks',
  command: process.execPath,
  args: ['--preserve-symlinks', '--preserve-symlinks-main', tsxCliPath, '-e', focusedCanvasTestProgram],
  cwd: canvasRoot,
});

runStep({
  name: 'publish sync drift check',
  command: process.execPath,
  args: ['./scripts/sync-pages-knowgrph.mjs', '--check'],
  cwd: repoRoot,
});

runStep({
  name: 'production Pages proxy smoke',
  command: process.execPath,
  args: ['./scripts/smoke-test-integrations.mjs'],
  cwd: publishRepoRoot,
});

process.stdout.write('\n[agnes-readiness] env key presence\n');
process.stdout.write(`AGNES_API_KEY=${readEnvPresence('AGNES_API_KEY')}\n`);
process.stdout.write(`KNOWGRPH_CHAT_PROXY_AGNES_API_KEY=${readEnvPresence('KNOWGRPH_CHAT_PROXY_AGNES_API_KEY')}\n`);
process.stdout.write(
  '[agnes-readiness] live deployed BYOK smoke still requires a real Agnes key and a pushed/deployed publish repo.\n',
);
