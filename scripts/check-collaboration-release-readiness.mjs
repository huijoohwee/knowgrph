import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const repoRoot = path.resolve(scriptsDir, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const skipBrowser = process.argv.includes('--skip-browser');
const skipSync = process.argv.includes('--skip-sync');

const runStep = ({ name, command, args, cwd }) => {
  process.stdout.write(`\n[collaboration-release] ${name}\n`);
  process.stdout.write(`$ ${[command, ...args].join(' ')}\n`);
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
};

const collaborationReadinessArgs = ['run', 'collaboration:readiness:check'];
if (skipBrowser) collaborationReadinessArgs.push('--', '--skip-browser');

runStep({
  name: 'collaboration readiness gate',
  command: npmCommand,
  args: collaborationReadinessArgs,
  cwd: repoRoot,
});

if (skipSync) {
  process.stdout.write('\n[collaboration-release] skipped pages:check-sync by request\n');
} else {
  runStep({
    name: 'publish mirror drift gate',
    command: npmCommand,
    args: ['run', 'pages:check-sync'],
    cwd: repoRoot,
  });
}

process.stdout.write('\n[collaboration-release] ok\n');
