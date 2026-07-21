import assert from 'node:assert/strict'
import test from 'node:test'
import { replaceRuntimeDocsRevision } from '../promote-agentic-canvas-os-revision.mjs'

test('docs promotion replaces only the exact immutable dependency ref', () => {
  const current = 'a'.repeat(40)
  const next = 'b'.repeat(40)
  const source = `docs_dependency:\n  ref: "${current}"\nproof: "${current}"\n`
  const result = replaceRuntimeDocsRevision(source, current, next)
  assert.match(result, new RegExp(`ref: "${next}"`))
  assert.match(result, new RegExp(`proof: "${current}"`))
})

test('docs promotion fails closed when the ref is missing or duplicated', () => {
  const current = 'a'.repeat(40)
  assert.throws(() => replaceRuntimeDocsRevision('missing', current, 'b'.repeat(40)), /not uniquely addressable/)
  const line = `  ref: "${current}"`
  assert.throws(() => replaceRuntimeDocsRevision(`${line}\n${line}\n`, current, 'b'.repeat(40)), /more than once/)
})
