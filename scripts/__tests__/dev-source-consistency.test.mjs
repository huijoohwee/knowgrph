import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readContract, repoRoot } from '../collaboration-contract.mjs'
import { checkDevSourceConsistency, evaluateDevSourceConsistency } from '../dev-source-consistency.mjs'

const SHA_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const SHA_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

const sourceStates = ({ application = {}, docs = {} } = {}) => [
  {
    id: 'knowgrph',
    branch: 'main',
    headSha: SHA_A,
    canonicalSha: SHA_A,
    status: '',
    ...application,
  },
  {
    id: 'agentic-canvas-os-docs',
    branch: 'main',
    headSha: SHA_A,
    canonicalSha: SHA_A,
    status: '',
    ...docs,
  },
]

test('canonical Dev source accepts only clean application and docs checkouts at fetched origin main SHAs', async () => {
  const contract = await readContract()
  const result = evaluateDevSourceConsistency(sourceStates(), contract, 'canonical')

  assert.equal(result.canonical, true)
  assert.match(result.message, /knowgrph=origin\/main@aaaaaaaaaaaa/)
  assert.match(result.message, /agentic-canvas-os-docs=origin\/main@aaaaaaaaaaaa/)
})

test('canonical Dev source rejects stale or dirty checkouts before any port can serve them', async () => {
  const contract = await readContract()
  assert.throws(() => evaluateDevSourceConsistency(sourceStates({
    application: { canonicalSha: SHA_B },
  }), contract, 'canonical'), /knowgrph canonical Dev source mismatch/)
  assert.throws(() => evaluateDevSourceConsistency(sourceStates({
    docs: { status: ' M docs\/FACTS.md' },
  }), contract, 'canonical'), /agentic-canvas-os-docs source requires a clean worktree/)
})

test('task mode allows application divergence but keeps Agentic Canvas OS docs canonical', async () => {
  const contract = await readContract()
  const result = evaluateDevSourceConsistency(sourceStates({
    application: {
      branch: 'agent/macbook/dev-source-consistency',
      headSha: SHA_B,
      status: ' M package.json',
    },
  }), contract, 'task')

  assert.equal(result.canonical, false)
  assert.match(result.message, /knowgrph=task:agent\/macbook\/dev-source-consistency@bbbbbbbbbbbb/)
  assert.match(result.message, /agentic-canvas-os-docs=origin\/main@aaaaaaaaaaaa/)
  assert.throws(() => evaluateDevSourceConsistency(sourceStates({
    application: { branch: 'feature/dev-source-consistency' },
  }), contract, 'task'), /branch must satisfy/)
  assert.throws(() => evaluateDevSourceConsistency(sourceStates({
    application: { branch: 'agent/macbook/dev-source-consistency' },
    docs: { canonicalSha: SHA_B },
  }), contract, 'task'), /agentic-canvas-os-docs canonical Dev source mismatch/)
})

test('source collection fetches and identifies both repositories from the shared contract', async () => {
  const calls = []
  const git = (args, cwd) => {
    calls.push({ args, cwd })
    if (args[0] === 'branch') return cwd === repoRoot ? 'main' : 'main'
    if (args[1] === 'HEAD') return SHA_A
    if (args[1]?.startsWith('refs/remotes/')) return SHA_A
    if (args[0] === 'status') return ''
    return ''
  }
  const checkedPaths = []
  const result = await checkDevSourceConsistency({
    environment: {},
    git,
    pathCheck: async targetPath => checkedPaths.push(targetPath),
  })

  const docsRoot = path.resolve(repoRoot, '../agentic-canvas-os')
  assert.equal(result.canonical, true)
  assert.deepEqual(checkedPaths, [repoRoot, path.join(docsRoot, 'docs')])
  assert.deepEqual(calls.filter(call => call.args[0] === 'fetch'), [
    { args: ['fetch', '--quiet', 'origin', 'main'], cwd: repoRoot },
    { args: ['fetch', '--quiet', 'origin', 'main'], cwd: docsRoot },
  ])
})

test('unknown source modes fail closed', async () => {
  const contract = await readContract()
  assert.throws(() => evaluateDevSourceConsistency(sourceStates(), contract, 'loose'), /must be canonical or task/)
})
