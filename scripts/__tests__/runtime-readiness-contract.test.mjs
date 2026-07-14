import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { repoRoot } from '../collaboration-contract.mjs'
import {
  formatGitHubOutput,
  readRuntimeReadinessContract,
  resolveRuntimeDocsDependency,
} from '../runtime-readiness-contract.mjs'
import {
  checkRuntimeDocsWorkflowPolicy,
  validateRuntimeDocsWorkflowPolicy,
} from '../runtime-docs-workflow-policy.mjs'

test('runtime docs dependency resolves one checkout repository and immutable ref', async () => {
  const contract = await readRuntimeReadinessContract()
  const dependency = resolveRuntimeDocsDependency(contract)
  assert.deepEqual(dependency, {
    repository: 'huijoohwee/agentic-canvas-os',
    ref: contract.docs_dependency.ref,
  })
  assert.equal(formatGitHubOutput(dependency), (
    `repository=huijoohwee/agentic-canvas-os\nref=${contract.docs_dependency.ref}\n`
  ))
})

test('runtime docs dependency rejects mutable or non-GitHub sources', () => {
  assert.throws(() => resolveRuntimeDocsDependency({
    docs_dependency: {
      repository: 'https://github.com/huijoohwee/agentic-canvas-os.git',
      ref: 'main',
    },
  }), /exact lowercase 40-character Git commit SHA/)
  assert.throws(() => resolveRuntimeDocsDependency({
    docs_dependency: {
      repository: 'https://example.com/huijoohwee/agentic-canvas-os.git',
      ref: 'a'.repeat(40),
    },
  }), /HTTPS GitHub repository URL/)
})

test('all auto-discovered workflow checkouts satisfy the shared runtime docs policy', async () => {
  const report = await checkRuntimeDocsWorkflowPolicy()
  assert.equal(report.status, 'passed')
  assert.ok(report.consumerCount > 0)
  assert.equal(report.consumers.length, report.consumerCount)
})

test('standalone collaboration checker emits a stable machine-readable policy report', () => {
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (key.startsWith('KNOWGRPH_PR_') || key === 'KNOWGRPH_GITHUB_TOKEN') delete env[key]
  }
  const result = spawnSync(process.execPath, ['scripts/check-collaboration-runtime.mjs', '--json'], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.schema, 'knowgrph.collaboration-runtime-report/v1')
  assert.equal(report.status, 'passed')
  assert.equal(report.policies.deploymentIsolation.status, 'passed')
  assert.equal(report.policies.runtimeDocsWorkflow.status, 'passed')
  assert.ok(report.policies.runtimeDocsWorkflow.consumers.includes('.github/workflows/integration.yml'))
  assert.equal(report.policies.pullRequestCoordination.status, 'not-applicable')
})

test('runtime docs workflow policy fails closed for missing consumers and copied refs', () => {
  assert.throws(
    () => validateRuntimeDocsWorkflowPolicy([]),
    /expected at least one Agentic Canvas OS workflow consumer/,
  )
  assert.throws(
    () => validateRuntimeDocsWorkflowPolicy([{
      workflowPath: '.github/workflows/example.yml',
      source: `
- name: Install dependencies
- name: Resolve Agentic Canvas OS docs dependency
  id: agentic_canvas_os_docs
  run: npm run --silent runtime:docs-dependency:resolve -- --github-output
- name: Checkout Agentic Canvas OS docs SSOT
  with:
    repository: \${{ steps.agentic_canvas_os_docs.outputs.repository }}
    ref: \${{ steps.agentic_canvas_os_docs.outputs.ref }}
    fallback_ref: ${'a'.repeat(40)}
  note: agentic-canvas-os
`,
    }]),
    /must not copy an immutable checkout ref/,
  )
})
