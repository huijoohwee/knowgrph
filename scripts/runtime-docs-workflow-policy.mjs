import fs from 'node:fs/promises'
import path from 'node:path'
import { repoRoot } from './collaboration-contract.mjs'

const workflowFilePattern = /\.ya?ml$/i
const agenticCanvasOsMarker = 'agentic-canvas-os'

export const workflowsRoot = path.resolve(repoRoot, '.github', 'workflows')

export const listWorkflowSources = async () => {
  const entries = await fs.readdir(workflowsRoot, { withFileTypes: true })
  const workflowEntries = entries
    .filter(entry => entry.isFile() && workflowFilePattern.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name))

  return Promise.all(workflowEntries.map(async entry => ({
    workflowPath: path.posix.join('.github/workflows', entry.name),
    source: await fs.readFile(path.resolve(workflowsRoot, entry.name), 'utf8'),
  })))
}

const requireWorkflowSource = (condition, workflowPath, message) => {
  if (!condition) throw new Error(`${workflowPath}: ${message}`)
}

export const validateRuntimeDocsWorkflowConsumer = ({ workflowPath, source }) => {
  const orderedMarkers = [
    'name: Install dependencies',
    'name: Resolve Agentic Canvas OS docs dependency',
    'name: Checkout Agentic Canvas OS docs SSOT',
  ]
  let previousIndex = -1

  for (const marker of orderedMarkers) {
    const markerIndex = source.indexOf(marker)
    requireWorkflowSource(
      markerIndex > previousIndex,
      workflowPath,
      `required ordered step is missing or misplaced: ${marker}`,
    )
    previousIndex = markerIndex
  }

  const requiredPatterns = [
    [/id: agentic_canvas_os_docs/, 'resolver step id'],
    [/npm run --silent runtime:docs-dependency:resolve -- --github-output/, 'silent contract resolver command'],
    [/repository: \$\{\{ steps\.agentic_canvas_os_docs\.outputs\.repository \}\}/, 'contract-derived checkout repository'],
    [/ref: \$\{\{ steps\.agentic_canvas_os_docs\.outputs\.ref \}\}/, 'contract-derived checkout ref'],
  ]
  for (const [pattern, label] of requiredPatterns) {
    requireWorkflowSource(pattern.test(source), workflowPath, `missing ${label}`)
  }

  requireWorkflowSource(
    !/ref: [0-9a-f]{40}/.test(source),
    workflowPath,
    'must not copy an immutable checkout ref into workflow YAML',
  )
}

export const validateRuntimeDocsWorkflowPolicy = workflowSources => {
  const consumers = workflowSources.filter(workflow => workflow.source.includes(agenticCanvasOsMarker))
  if (consumers.length === 0) {
    throw new Error('expected at least one Agentic Canvas OS workflow consumer')
  }
  consumers.forEach(validateRuntimeDocsWorkflowConsumer)
  return consumers
}

export const checkRuntimeDocsWorkflowPolicy = async () => (
  validateRuntimeDocsWorkflowPolicy(await listWorkflowSources())
)
