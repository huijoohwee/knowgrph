import assert from 'node:assert/strict'
import test from 'node:test'
import { readContract } from '../collaboration-contract.mjs'
import { evaluateDevSourceConsistency } from '../dev-source-consistency.mjs'

const SHA_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const SHA_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

test('canonical Dev source accepts only a clean checkout at the fetched origin main SHA', async () => {
  const contract = await readContract()
  const result = evaluateDevSourceConsistency({
    branch: 'main',
    headSha: SHA_A,
    canonicalSha: SHA_A,
    status: '',
  }, contract, 'canonical')

  assert.equal(result.canonical, true)
  assert.match(result.message, /origin\/main@aaaaaaaaaaaa/)
})

test('canonical Dev source rejects stale and dirty checkouts before a port can serve them', async () => {
  const contract = await readContract()
  assert.throws(() => evaluateDevSourceConsistency({
    branch: 'main',
    headSha: SHA_A,
    canonicalSha: SHA_B,
    status: '',
  }, contract, 'canonical'), /HEAD a{40} != origin\/main b{40}/)
  assert.throws(() => evaluateDevSourceConsistency({
    branch: 'main',
    headSha: SHA_A,
    canonicalSha: SHA_A,
    status: ' M package.json',
  }, contract, 'canonical'), /requires a clean worktree/)
})

test('task source divergence requires explicit task mode and a contract-valid branch', async () => {
  const contract = await readContract()
  const result = evaluateDevSourceConsistency({
    branch: 'agent/macbook/dev-source-consistency',
    headSha: SHA_B,
    canonicalSha: SHA_A,
    status: ' M package.json',
  }, contract, 'task')

  assert.equal(result.canonical, false)
  assert.match(result.message, /task source agent\/macbook\/dev-source-consistency@bbbbbbbbbbbb/)
  assert.throws(() => evaluateDevSourceConsistency({
    branch: 'feature/dev-source-consistency',
    headSha: SHA_B,
    canonicalSha: SHA_A,
    status: '',
  }, contract, 'task'), /branch must satisfy/)
})

test('unknown source modes fail closed', async () => {
  const contract = await readContract()
  assert.throws(() => evaluateDevSourceConsistency({
    branch: 'main',
    headSha: SHA_A,
    canonicalSha: SHA_A,
    status: '',
  }, contract, 'loose'), /must be canonical or task/)
})
