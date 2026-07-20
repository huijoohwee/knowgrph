import fs from 'node:fs/promises'
import path from 'node:path'
import { repoRoot } from './collaboration-contract.mjs'

const workflowFilePattern = /\.ya?ml$/i
const agenticCanvasOsMarker = 'agentic-canvas-os'
const orderedStepChecks = [
  { id: 'dependencies-installed', marker: 'name: Install dependencies' },
  { id: 'contract-resolver-after-install', marker: 'name: Resolve Agentic Canvas OS docs dependency' },
  { id: 'checkout-after-resolver', marker: 'name: Checkout Agentic Canvas OS docs SSOT' },
]
const sourcePatternChecks = [
  { id: 'resolver-step-id', pattern: /id: agentic_canvas_os_docs/, label: 'resolver step id' },
  {
    id: 'silent-resolver-command',
    pattern: /npm run --silent runtime:docs-dependency:resolve -- --github-output/,
    label: 'silent contract resolver command',
  },
  {
    id: 'contract-derived-repository',
    pattern: /repository: \$\{\{ steps\.agentic_canvas_os_docs\.outputs\.repository \}\}/,
    label: 'contract-derived checkout repository',
  },
  {
    id: 'contract-derived-ref',
    pattern: /ref: \$\{\{ steps\.agentic_canvas_os_docs\.outputs\.ref \}\}/,
    label: 'contract-derived checkout ref',
  },
]
const noCopiedRefCheckId = 'no-copied-ref'
const fullHistoryCheckoutCheckId = 'full-history-checkout'

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

const readNamedStepSource = (source, marker) => {
  const lines = source.split(/\r?\n/)
  const stepIndex = lines.findIndex(line => line.includes(marker))
  if (stepIndex < 0) return ''
  const indentation = lines[stepIndex].match(/^(\s*)-\s+/)?.[1]
  if (indentation === undefined) return ''
  const nextStepOffset = lines
    .slice(stepIndex + 1)
    .findIndex(line => line.startsWith(`${indentation}- `))
  const endIndex = nextStepOffset < 0 ? lines.length : stepIndex + nextStepOffset + 1
  return lines.slice(stepIndex, endIndex).join('\n')
}

export const validateRuntimeDocsWorkflowConsumer = ({ workflowPath, source }) => {
  let previousIndex = -1

  for (const { marker } of orderedStepChecks) {
    const markerIndex = source.indexOf(marker)
    requireWorkflowSource(
      markerIndex > previousIndex,
      workflowPath,
      `required ordered step is missing or misplaced: ${marker}`,
    )
    previousIndex = markerIndex
  }

  for (const { pattern, label } of sourcePatternChecks) {
    requireWorkflowSource(pattern.test(source), workflowPath, `missing ${label}`)
  }

  const docsCheckoutStep = readNamedStepSource(source, 'name: Checkout Agentic Canvas OS docs SSOT')
  requireWorkflowSource(
    /\n\s+fetch-depth:\s*0\s*(?:\n|$)/.test(docsCheckoutStep),
    workflowPath,
    'Agentic Canvas OS docs checkout must fetch full Git history',
  )

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
  return {
    id: 'runtime-docs-workflow/v1',
    status: 'passed',
    consumerCount: consumers.length,
    consumers: consumers.map(consumer => consumer.workflowPath),
    checks: [
      ...orderedStepChecks.map(check => check.id),
      ...sourcePatternChecks.map(check => check.id),
      fullHistoryCheckoutCheckId,
      noCopiedRefCheckId,
    ],
  }
}

export const checkRuntimeDocsWorkflowPolicy = async () => (
  validateRuntimeDocsWorkflowPolicy(await listWorkflowSources())
)
