import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { readContract, repoRoot } from '../collaboration-contract.mjs'
import {
  checkWorktreePolicy,
  countRegisteredWorktrees,
  evaluateWorktreePolicy,
} from '../worktree-policy.mjs'

const canonicalStates = [
  { id: 'knowgrph', worktreeCount: 1 },
  { id: 'agentic-canvas-os-docs', worktreeCount: 1 },
]

test('porcelain worktree records are counted without path parsing', () => {
  assert.equal(countRegisteredWorktrees(`worktree /repo\nHEAD a\nbranch refs/heads/main\n`), 1)
  assert.equal(countRegisteredWorktrees([
    'worktree /repo',
    'HEAD a',
    'branch refs/heads/main',
    '',
    'worktree /repo-task',
    'HEAD b',
    'branch refs/heads/agent/device/task',
  ].join('\n')), 2)
})

test('contract worktree policy accepts one source checkout and rejects zero or multiple', async () => {
  const contract = await readContract()
  const result = evaluateWorktreePolicy(canonicalStates, contract)
  assert.equal(result.message, (
    'single-device-single-worktree sources knowgrph=1; agentic-canvas-os-docs=1'
  ))
  assert.throws(() => evaluateWorktreePolicy([
    { id: 'knowgrph', worktreeCount: 2 },
    canonicalStates[1],
  ], contract), /requires exactly 1 registered worktree/)
  assert.throws(() => evaluateWorktreePolicy([
    { id: 'knowgrph', worktreeCount: 0 },
    canonicalStates[1],
  ], contract), /requires exactly 1 registered worktree/)
})

test('standalone preflight checks every canonical source without fetching or starting Dev', async () => {
  const calls = []
  const result = await checkWorktreePolicy({
    git: (args, cwd) => {
      calls.push({ args, cwd })
      return `worktree ${cwd}\nHEAD a\nbranch refs/heads/main`
    },
  })

  assert.equal(result.sources.length, 2)
  assert.deepEqual(calls, [
    { args: ['worktree', 'list', '--porcelain'], cwd: repoRoot },
    {
      args: ['worktree', 'list', '--porcelain'],
      cwd: path.resolve(repoRoot, '../agentic-canvas-os'),
    },
  ])
})

test('Git pre-push integration runs the standalone policy before expensive validation', () => {
  const packageJson = JSON.parse(readFileSync(path.resolve(repoRoot, 'package.json'), 'utf8'))
  const prePushHook = readFileSync(path.resolve(repoRoot, '.githooks/pre-push'), 'utf8')
  assert.equal(packageJson.scripts['worktree:check'], 'node ./scripts/check-worktree-policy.mjs')
  assert.ok(packageJson.scripts['ci:integration'].startsWith('npm run worktree:check &&'))
  assert.match(prePushHook, /npm run ci:integration/)
})
