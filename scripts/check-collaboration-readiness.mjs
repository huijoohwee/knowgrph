import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  ensureLocalCollaborationStack,
  resolveLocalCollaborationStackConfig,
} from './lib/collaboration-local-stack.js';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const repoRoot = path.resolve(scriptsDir, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const skipBrowser = process.argv.includes('--skip-browser');
const localCollaborationStackConfig = resolveLocalCollaborationStackConfig({
  repoRoot,
  env: process.env,
  npmCommand,
});

const runStep = ({ name, command, args, cwd, env = process.env }) => {
  process.stdout.write(`\n[collaboration-readiness] ${name}\n`);
  process.stdout.write(`$ ${[command, ...args].join(' ')}\n`);
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env,
  });
};

runStep({
  name: 'shared smoke preparation',
  command: npmCommand,
  args: ['run', 'smoke:prepare'],
  cwd: repoRoot,
});

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
  const localCollaborationStack = await ensureLocalCollaborationStack(localCollaborationStackConfig, {
    log: (message) => process.stdout.write(message),
  });
  try {
    runStep({
      name: 'authenticated room browser smoke',
      command: npmCommand,
      args: ['--prefix', 'canvas', 'run', 'validate:multi-user-collaboration:e2e'],
      cwd: repoRoot,
      env: localCollaborationStack.browserEnv,
    });
  } finally {
    await localCollaborationStack.cleanup();
  }
}

process.stdout.write('\n[collaboration-readiness] ok\n');
