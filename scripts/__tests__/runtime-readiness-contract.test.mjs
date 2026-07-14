import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { repoRoot } from '../collaboration-contract.mjs'
import {
  formatGitHubOutput,
  readRuntimeReadinessContract,
  resolveRuntimeDocsDependency,
} from '../runtime-readiness-contract.mjs'

const workflowsRoot = path.resolve(repoRoot, '.github', 'workflows')

const discoverAgenticCanvasOsWorkflowSources = () => readdirSync(workflowsRoot, {
  withFileTypes: true,
})
  .filter(entry => entry.isFile() && /\.ya?ml$/.test(entry.name))
  .map(entry => ({
    workflowPath: path.posix.join('.github/workflows', entry.name),
    source: readFileSync(path.resolve(workflowsRoot, entry.name), 'utf8'),
  }))
  .filter(workflow => workflow.source.includes('agentic-canvas-os'))
  .sort((left, right) => left.workflowPath.localeCompare(right.workflowPath))

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

test('all auto-discovered workflow checkouts consume the contract resolver without copied SHAs', () => {
  const workflows = discoverAgenticCanvasOsWorkflowSources()
  assert.ok(workflows.length > 0, 'expected at least one Agentic Canvas OS workflow consumer')

  for (const { workflowPath, source } of workflows) {
    const installIndex = source.indexOf('name: Install dependencies')
    const resolverIndex = source.indexOf('name: Resolve Agentic Canvas OS docs dependency')
    const checkoutIndex = source.indexOf('name: Checkout Agentic Canvas OS docs SSOT')
    assert.ok(installIndex >= 0 && installIndex < resolverIndex, workflowPath)
    assert.ok(resolverIndex < checkoutIndex, workflowPath)
    assert.match(source, /id: agentic_canvas_os_docs/)
    assert.match(source, /npm run --silent runtime:docs-dependency:resolve -- --github-output/)
    assert.match(source, /repository: \$\{\{ steps\.agentic_canvas_os_docs\.outputs\.repository \}\}/)
    assert.match(source, /ref: \$\{\{ steps\.agentic_canvas_os_docs\.outputs\.ref \}\}/)
    assert.doesNotMatch(source, /ref: [0-9a-f]{40}/)
  }
})
