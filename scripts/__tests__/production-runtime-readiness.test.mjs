import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  calculateRuntimeArtifactDigest,
  resolveProductionRuntimeReadinessSchemaPath,
  serializeProductionRuntimeReadiness,
  validateProductionRuntimeReadiness,
} from '../production-runtime-readiness.mjs'
import { fetchKnowgrphStaticAsset } from '../../cloudflare/pages/knowgrph-agent-ready-app-shell.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const workspaceRoot = repoRoot.includes(`${path.sep}.worktrees${path.sep}`)
  ? repoRoot.split(`${path.sep}.worktrees${path.sep}`)[0]
  : path.resolve(repoRoot, '..')
process.env.KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_ROOT ||= path.resolve(workspaceRoot, 'agentic-canvas-os', 'docs')

const sha = character => character.repeat(40)
const digest = character => character.repeat(64)
const validReadiness = {
  schema: 'knowgrph-production-runtime-readiness/v2',
  status: 'verified-build',
  source: { repository: 'huijoohwee/knowgrph', revision: sha('a'), tree: sha('b') },
  agenticCanvasOs: { repository: 'huijoohwee/agentic-canvas-os', revision: sha('c') },
  catalogRevision: sha('c'),
  artifact: { algorithm: 'sha256', digest: digest('d') },
  immutableManifest: { algorithm: 'sha256', digest: digest('e') },
  mirror: { repository: 'huijoohwee/huijoohwee' },
  surfaces: ['/', '/knowgrph'],
}

test('production readiness validates exact runtime identities and rejects drift', async () => {
  assert.equal(await validateProductionRuntimeReadiness(validReadiness), validReadiness)
  await assert.rejects(
    validateProductionRuntimeReadiness({ ...validReadiness, unexpected: true }),
    /must NOT have additional properties/,
  )
  await assert.rejects(
    validateProductionRuntimeReadiness(validReadiness, { sourceRevision: sha('f') }),
    /source revision mismatch/,
  )
  assert.match(serializeProductionRuntimeReadiness(validReadiness), /"surfaces": \[/)
})

test('production readiness resolves Agentic Canvas OS schemas from a linked Knowgrph worktree', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'knowgrph-readiness-root-'))
  const docsRoot = path.join(root, 'agentic-canvas-os', 'docs')
  const taskRoot = path.join(root, '.worktrees', 'knowgrph', 'xr-runtime')
  try {
    await fs.mkdir(docsRoot, { recursive: true })
    await fs.mkdir(taskRoot, { recursive: true })
    await fs.writeFile(path.join(docsRoot, 'FACTS.md'), '# Source marker\n', 'utf8')
    assert.equal(
      resolveProductionRuntimeReadinessSchemaPath({ rootDir: taskRoot, env: {} }),
      path.join(docsRoot, 'schemas', 'production-runtime-readiness.v2.schema.json'),
    )
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('browser artifact digest is path-bound, order-independent, and content-sensitive', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'knowgrph-artifact-'))
  const first = path.resolve(root, 'first.js')
  const second = path.resolve(root, 'second.css')
  await fs.writeFile(first, 'alpha', 'utf8')
  await fs.writeFile(second, 'beta', 'utf8')
  const entries = [
    { relativePath: 'assets/first.js', absolutePath: first },
    { relativePath: 'assets/second.css', absolutePath: second },
  ]
  const expected = await calculateRuntimeArtifactDigest(entries)
  assert.equal(await calculateRuntimeArtifactDigest([...entries].reverse()), expected)
  await fs.writeFile(second, 'changed', 'utf8')
  assert.notEqual(await calculateRuntimeArtifactDigest(entries), expected)
})

test('app readiness route serves the apex marker bytes without an SPA fallback', async () => {
  const body = serializeProductionRuntimeReadiness(validReadiness)
  let fetchedUrl = ''
  const response = await fetchKnowgrphStaticAsset({
    request: new Request('https://airvio.co/knowgrph/.well-known/runtime-readiness.json?stale=1'),
    env: { ASSETS: { fetch: async () => { throw new Error('readiness must use the route continuation') } } },
    next: async request => {
      fetchedUrl = request.url
      return new Response(body, { headers: { 'content-type': 'application/json' } })
    },
  })
  assert.equal(fetchedUrl, 'https://airvio.co/.well-known/runtime-readiness.json?stale=1')
  assert.equal(response.status, 200)
  assert.equal(await response.text(), body)
})

test('app readiness route rejects an HTML asset fallback', async () => {
  const response = await fetchKnowgrphStaticAsset({
    request: new Request('https://airvio.co/knowgrph/.well-known/runtime-readiness.json'),
    env: {},
    next: async () => new Response('<html>fallback</html>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }),
  })
  assert.equal(response.status, 503)
  assert.doesNotMatch(await response.text(), /fallback/)
})
