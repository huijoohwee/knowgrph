import assert from 'node:assert/strict'
import test from 'node:test'
import { isIgnoredRelativePath } from '../check-conflict-compliance.mjs'

test('machine path scanning excludes generated output roots only', () => {
  assert.equal(isIgnoredRelativePath('canvas/dist/assets/index.js'), true)
  assert.equal(isIgnoredRelativePath('data/outputs/workflow-preview/result.json'), true)
  assert.equal(isIgnoredRelativePath('docs/documents/runtime.md'), false)
  assert.equal(isIgnoredRelativePath('canvas/src/main.tsx'), false)
})
