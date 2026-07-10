import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const repoRoot = path.resolve(scriptsDir, '..');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const runStep = ({ name, command, args, cwd }) => {
  process.stdout.write(`\n[storyboard-readiness] ${name}\n`);
  process.stdout.write(`$ ${[command, ...args].join(' ')}\n`);
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
};

runStep({
  name: 'storyboard source smoke regressions',
  command: npmCommand,
  args: ['--prefix', 'canvas', 'run', 'test:smoke:storyboard-rich-media-drop:source'],
  cwd: repoRoot,
});

runStep({
  name: 'ensure local Playwright Chromium',
  command: 'python3',
  args: ['-m', 'playwright', 'install', 'chromium'],
  cwd: repoRoot,
});

runStep({
  name: 'storyboard rich-media drag browser smoke',
  command: npmCommand,
  args: ['--prefix', 'canvas', 'run', 'test:smoke:storyboard-rich-media-drop:browser'],
  cwd: repoRoot,
});

runStep({
  name: 'mobile keyboard browser smoke',
  command: npmCommand,
  args: ['--prefix', 'canvas', 'run', 'test:smoke:mobile-keyboard:browser'],
  cwd: repoRoot,
});

runStep({
  name: 'publish sync drift check',
  command: npmCommand,
  args: ['run', 'pages:check-sync'],
  cwd: repoRoot,
});

process.stdout.write('\n[storyboard-readiness] ok\n');
