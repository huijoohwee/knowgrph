import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const repoRoot = path.resolve(scriptsDir, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const skipBrowser = process.argv.includes('--skip-browser');

const runStep = ({ name, command, args, cwd }) => {
  process.stdout.write(`\n[collaboration-readiness] ${name}\n`);
  process.stdout.write(`$ ${[command, ...args].join(' ')}\n`);
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
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
  runStep({
    name: 'authenticated room browser smoke',
    command: npmCommand,
    args: ['--prefix', 'canvas', 'run', 'validate:multi-user-collaboration:e2e'],
    cwd: repoRoot,
  });
}

process.stdout.write('\n[collaboration-readiness] ok\n');
