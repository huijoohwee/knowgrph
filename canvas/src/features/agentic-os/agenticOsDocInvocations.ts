export type AgenticOsDocInvocationId =
  | 'agentic-os'
  | 'agentic-os.agents'
  | 'agentic-os.memory'
  | 'agentic-os.dictionary.command'
  | 'agentic-os.dictionary.semantic'
  | 'agentic-os.dictionary.binding'
  | 'agentic-os.prd-tad'
  | 'agentic-os.runtime'
  | 'agentic-os.harness'
  | 'agentic-os.mcp-gateway'
  | 'agentic-os.validation'

export type AgenticOsDocInvocation = {
  id: AgenticOsDocInvocationId
  fileName: string
  label: string
  summary: string
  slashCommand: `/${AgenticOsDocInvocationId}`
  hashToken: `#${AgenticOsDocInvocationId}`
  atToken: `@${AgenticOsDocInvocationId}`
  sourcePath: string
  keywords: readonly string[]
}

export type AgenticOsDictionaryInvocationKind = 'command' | 'semantic' | 'binding'

export type AgenticOsDictionaryInvocation = {
  id: string
  kind: AgenticOsDictionaryInvocationKind
  token: `/${string}` | `#${string}` | `@${string}`
  label: string
  summary: string
  group: string
  sourcePath: string
  dictionaryFileName: 'DICTIONARY-COMMAND.md' | 'DICTIONARY-SEMANTIC.md' | 'DICTIONARY-BINDING.md'
  keywords: readonly string[]
}

export const AGENTIC_OS_DOCS_GITHUB_ROOT_URL = 'https://github.com/huijoohwee/huijoohwee/blob/main/agentic-os-docs'

const buildAgenticOsDocSourceUrl = (fileName: string): string => (
  `${AGENTIC_OS_DOCS_GITHUB_ROOT_URL}/${encodeURIComponent(fileName)}`
)

const buildAgenticOsDocInvocation = (args: {
  id: AgenticOsDocInvocationId
  fileName: string
  label: string
  summary: string
  keywords: readonly string[]
}): AgenticOsDocInvocation => ({
  ...args,
  slashCommand: `/${args.id}`,
  hashToken: `#${args.id}`,
  atToken: `@${args.id}`,
  sourcePath: buildAgenticOsDocSourceUrl(args.fileName),
})

export const AGENTIC_OS_DOC_INVOCATIONS: readonly AgenticOsDocInvocation[] = [
  buildAgenticOsDocInvocation({
    id: 'agentic-os',
    fileName: 'README.md',
    label: 'Agentic OS Docs',
    summary: 'Invoke the Agentic Canvas OS docs index as the neutral runtime-ready context root.',
    keywords: ['agentic canvas os', 'docs', 'runtime-ready', 'index'],
  }),
  buildAgenticOsDocInvocation({
    id: 'agentic-os.agents',
    fileName: 'AGENTS.md',
    label: 'Agentic OS Agents',
    summary: 'Invoke the shared agent operating instructions and invocation rules.',
    keywords: ['agents', 'instructions', 'orchestration', 'slash', 'hash', 'at'],
  }),
  buildAgenticOsDocInvocation({
    id: 'agentic-os.memory',
    fileName: 'MEMORY.md',
    label: 'Agentic OS Memory',
    summary: 'Invoke memory-layer anchors and reusable content handles for shared utils.',
    keywords: ['memory', 'handles', 'shared utils', 'content'],
  }),
  buildAgenticOsDocInvocation({
    id: 'agentic-os.dictionary.command',
    fileName: 'DICTIONARY-COMMAND.md',
    label: 'Agentic OS Command Dictionary',
    summary: 'Invoke centralized slash-command dictionary entries for shared / utilities.',
    keywords: ['slash', 'command', 'dictionary', 'runtime-ready'],
  }),
  buildAgenticOsDocInvocation({
    id: 'agentic-os.dictionary.semantic',
    fileName: 'DICTIONARY-SEMANTIC.md',
    label: 'Agentic OS Semantic Dictionary',
    summary: 'Invoke centralized hash-semantic dictionary entries for shared # utilities.',
    keywords: ['hash', 'semantic', 'dictionary', 'filters'],
  }),
  buildAgenticOsDocInvocation({
    id: 'agentic-os.dictionary.binding',
    fileName: 'DICTIONARY-BINDING.md',
    label: 'Agentic OS Binding Dictionary',
    summary: 'Invoke centralized at-binding dictionary entries for shared @ utilities.',
    keywords: ['at', 'binding', 'dictionary', 'source'],
  }),
  buildAgenticOsDocInvocation({
    id: 'agentic-os.prd-tad',
    fileName: 'PRD-TAD.md',
    label: 'Agentic OS PRD/TAD',
    summary: 'Invoke the product and technical architecture decision surface.',
    keywords: ['prd', 'tad', 'architecture', 'requirements'],
  }),
  buildAgenticOsDocInvocation({
    id: 'agentic-os.runtime',
    fileName: 'RUNTIME-READINESS.md',
    label: 'Agentic OS Runtime Readiness',
    summary: 'Invoke the spec-complete to runtime-ready readiness contract.',
    keywords: ['runtime', 'readiness', 'validation', 'tco'],
  }),
  buildAgenticOsDocInvocation({
    id: 'agentic-os.harness',
    fileName: 'HARNESS-CONTRACTS.md',
    label: 'Agentic OS Harness Contracts',
    summary: 'Invoke harness, orchestration, and min-viable-max-value runtime contracts.',
    keywords: ['harness', 'contracts', 'orchestration', 'mvp'],
  }),
  buildAgenticOsDocInvocation({
    id: 'agentic-os.mcp-gateway',
    fileName: 'MCP-GATEWAY.md',
    label: 'Agentic OS MCP Gateway',
    summary: 'Invoke provider-neutral MCP gateway and tool-routing contracts.',
    keywords: ['mcp', 'gateway', 'tools', 'routing'],
  }),
  buildAgenticOsDocInvocation({
    id: 'agentic-os.validation',
    fileName: 'VALIDATION-RUNBOOK.md',
    label: 'Agentic OS Validation Runbook',
    summary: 'Invoke focused validation and no-regression runbook context.',
    keywords: ['validation', 'runbook', 'tests', 'regression'],
  }),
] as const

export const AGENTIC_OS_DOC_INVOCATION_ACTION_ID_PREFIX = 'agentic-os-doc:'
export const AGENTIC_OS_DICTIONARY_INVOCATION_ACTION_ID_PREFIX = 'agentic-os-invocation:'

const dictionaryPath = (fileName: AgenticOsDictionaryInvocation['dictionaryFileName']): string => (
  buildAgenticOsDocSourceUrl(fileName)
)

const sanitizeInvocationId = (token: string): string => String(token || '')
  .replace(/^[/#@]+/, '')
  .replace(/[^A-Za-z0-9._-]+/g, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase()

const buildAgenticOsDictionaryInvocation = (args: {
  kind: AgenticOsDictionaryInvocationKind
  token: AgenticOsDictionaryInvocation['token']
  label: string
  summary: string
  group: string
  dictionaryFileName: AgenticOsDictionaryInvocation['dictionaryFileName']
  keywords: readonly string[]
}): AgenticOsDictionaryInvocation => ({
  ...args,
  id: `${args.kind}:${sanitizeInvocationId(args.token)}`,
  sourcePath: dictionaryPath(args.dictionaryFileName),
})

export const AGENTIC_OS_COMMAND_INVOCATIONS: readonly AgenticOsDictionaryInvocation[] = [
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/memory.seed', label: 'Memory seed', group: 'Agentic OS command dictionary', summary: 'Create or update neutral memory content from authored source docs.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['memory', 'frontmatter', 'source', 'seed'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/prd-tad.create', label: 'PRD/TAD create', group: 'Agentic OS command dictionary', summary: 'Produce or refresh the combined PRD/TAD contract from validated context.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['prd', 'tad', 'architecture', 'vcc'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/runtime-ready.check', label: 'Runtime-ready check', group: 'Agentic OS command dictionary', summary: 'Verify whether a spec-complete artifact has surfaced runtime proof.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['runtime', 'readiness', 'proof', 'validation'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/deploy.guard', label: 'Deploy guard', group: 'Agentic OS command dictionary', summary: 'Stop accidental Prod mirror or Cloudflare mutation without operator approval.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['deploy', 'guard', 'dev-only', 'cloudflare'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/harness.define', label: 'Harness define', group: 'Agentic OS command dictionary', summary: 'Define typed input, output, fallback, cost, and bounds for an AI-capable component.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['harness', 'schema', 'cost', 'bounds'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/mcp.capabilities', label: 'MCP capabilities', group: 'Agentic OS command dictionary', summary: 'Discover tool capabilities through the existing MCP gateway contract.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['mcp', 'capabilities', 'gateway', 'zero-spend'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/cost.audit', label: 'Cost audit', group: 'Agentic OS command dictionary', summary: 'Inspect token, cache, and TCO impact before model-bearing execution.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['cost', 'tokens', 'tco', 'cache'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/canvas.project', label: 'Canvas project', group: 'Agentic OS command dictionary', summary: 'Project source-backed runtime state into existing Canvas owners.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['canvas', 'projection', 'source-backed', 'storyboard'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/validation.run', label: 'Validation run', group: 'Agentic OS command dictionary', summary: 'Run focused checks for the touched docs or runtime owner.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['validation', 'focused', 'proof', 'checks'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/source.normalize', label: 'Source normalize', group: 'Agentic OS command dictionary', summary: 'Neutralize conflicting or stale source content at the upstream owner.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['source', 'normalize', 'no-hardcode', 'no-legacy'] }),
] as const

export const AGENTIC_OS_SEMANTIC_INVOCATIONS: readonly AgenticOsDictionaryInvocation[] = [
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#frontmatter', label: 'Frontmatter', group: 'Agentic OS semantic dictionary', summary: 'YAML frontmatter identity, routing, render flags, and gates.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['yaml', 'identity', 'routing', 'ssot'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#harness', label: 'Harness', group: 'Agentic OS semantic dictionary', summary: 'Typed AI or tool execution contract.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['schema', 'fallback', 'cost', 'bounds'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#token-economics', label: 'Token economics', group: 'Agentic OS semantic dictionary', summary: 'Prompt, completion, cache, latency, and spend performance.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['tokens', 'cache', 'latency', 'spend'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#tco', label: 'TCO', group: 'Agentic OS semantic dictionary', summary: 'Total cost of ownership and deployment-model comparison.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['cost', 'deployment', 'foss', 'roi'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#vcc', label: 'VCC', group: 'Agentic OS semantic dictionary', summary: 'Verifiable completion conditions.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['acceptance', 'proof', 'given when then'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#no-hardcode', label: 'No hardcode', group: 'Agentic OS semantic dictionary', summary: 'Hardcoded URLs, credentials, provider IDs, generated assets, or fixtures.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['fixtures', 'credentials', 'urls', 'stale'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#foss', label: 'FOSS', group: 'Agentic OS semantic dictionary', summary: 'Open-source, local, zero-egress, or vendor-neutral alternative.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['open source', 'local', 'vendor neutral'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#ttv', label: 'TTV', group: 'Agentic OS semantic dictionary', summary: 'Time to value for min-viable-max-value scope.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['scope', 'roi', 'moscow'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#runtime-ready', label: 'Runtime-ready', group: 'Agentic OS semantic dictionary', summary: 'Claim can be proven from surfaced runtime output.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['runtime', 'proof', 'promotion'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#dev-only', label: 'Dev-only', group: 'Agentic OS semantic dictionary', summary: 'Local development boundary before Prod mirror or Cloudflare.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['dev', 'deploy guard', 'cloudflare'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#mcp', label: 'MCP', group: 'Agentic OS semantic dictionary', summary: 'MCP discovery, gateway federation, or tool contract.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['mcp', 'gateway', 'tools'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#canvas', label: 'Canvas', group: 'Agentic OS semantic dictionary', summary: 'Source-backed Canvas projection.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['canvas', 'kgc', 'storyboard'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#cost', label: 'Cost', group: 'Agentic OS semantic dictionary', summary: 'Cost log and budget accounting.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['budget', 'ledger', 'zero'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#approval-gate', label: 'Approval gate', group: 'Agentic OS semantic dictionary', summary: 'Human gate for paid, mutating, payment, browser-auth, or deploy action.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['approval', 'operator', 'blocked'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#no-legacy', label: 'No legacy', group: 'Agentic OS semantic dictionary', summary: 'Remove stale aliases, remaps, duplicate owners, and compatibility paths.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['legacy', 'alias', 'stale', 'cleanup'] }),
] as const

export const AGENTIC_OS_BINDING_INVOCATIONS: readonly AgenticOsDictionaryInvocation[] = [
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@operator', label: 'Operator', group: 'Agentic OS binding dictionary', summary: 'Human approval authority and final release gate.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['approval', 'human', 'release'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@source.frontmatter', label: 'Source frontmatter', group: 'Agentic OS binding dictionary', summary: 'Parsed YAML frontmatter source of truth.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['yaml', 'source', 'ssot'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@source.body', label: 'Source body', group: 'Agentic OS binding dictionary', summary: 'Authored Markdown body source of truth.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['markdown', 'source', 'body'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@local-harness', label: 'Local harness', group: 'Agentic OS binding dictionary', summary: 'Dev-local typed harness or dry-run path.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['local', 'harness', 'dry-run'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@runtime-proof', label: 'Runtime proof', group: 'Agentic OS binding dictionary', summary: 'Surfaced validation evidence.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['proof', 'validation', 'evidence'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@dev-only', label: 'Dev only', group: 'Agentic OS binding dictionary', summary: 'Local development boundary.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['dev', 'boundary', 'no deploy'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@cost-log', label: 'Cost log', group: 'Agentic OS binding dictionary', summary: 'Token, cache, and estimated cost ledger.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['cost', 'tokens', 'ledger'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@mcp-gateway', label: 'MCP gateway', group: 'Agentic OS binding dictionary', summary: 'Discovery-first MCP federation surface.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['mcp', 'gateway', 'federation'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@canvas', label: 'Canvas', group: 'Agentic OS binding dictionary', summary: 'Source-backed Canvas projection.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['canvas', 'storyboard', 'source-backed'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@approval-gate', label: 'Approval gate', group: 'Agentic OS binding dictionary', summary: 'Explicit gate state for spend, mutation, payment, browser auth, or deploy.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['approval', 'gate', 'blocked'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@prod-mirror', label: 'Prod mirror', group: 'Agentic OS binding dictionary', summary: 'Prod mirror path for release staging.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['prod', 'mirror', 'gated'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@cloudflare', label: 'Cloudflare', group: 'Agentic OS binding dictionary', summary: 'Cloudflare route or Worker/Pages control plane.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['cloudflare', 'worker', 'pages', 'gated'] }),
] as const

export const AGENTIC_OS_DICTIONARY_INVOCATIONS: readonly AgenticOsDictionaryInvocation[] = [
  ...AGENTIC_OS_COMMAND_INVOCATIONS,
  ...AGENTIC_OS_SEMANTIC_INVOCATIONS,
  ...AGENTIC_OS_BINDING_INVOCATIONS,
] as const

export type AgenticOsResolvedInvocation = {
  kind: AgenticOsDictionaryInvocationKind | 'doc'
  token: string
  label: string
  summary: string
  sourcePath: string
}

export const findAgenticOsInvocationByToken = (token: string): AgenticOsResolvedInvocation | null => {
  const value = String(token || '').trim()
  if (!value) return null
  const doc = AGENTIC_OS_DOC_INVOCATIONS.find(invocation => (
    invocation.slashCommand === value
    || invocation.hashToken === value
    || invocation.atToken === value
  ))
  if (doc) {
    return {
      kind: 'doc',
      token: value,
      label: doc.label,
      summary: doc.summary,
      sourcePath: doc.sourcePath,
    }
  }
  const dictionaryInvocation = AGENTIC_OS_DICTIONARY_INVOCATIONS.find(invocation => invocation.token === value)
  if (!dictionaryInvocation) return null
  return {
    kind: dictionaryInvocation.kind,
    token: value,
    label: dictionaryInvocation.label,
    summary: dictionaryInvocation.summary,
    sourcePath: dictionaryInvocation.sourcePath,
  }
}

export const buildAgenticOsInvocationSourceTitle = (invocation: AgenticOsResolvedInvocation): string => (
  [
    `${invocation.token} - ${invocation.label}`,
    invocation.summary,
    `Source: ${invocation.sourcePath}`,
  ].filter(Boolean).join('\n')
)

export const findAgenticOsDocInvocationByActionId = (actionId: string): AgenticOsDocInvocation | null => {
  const id = String(actionId || '').startsWith(AGENTIC_OS_DOC_INVOCATION_ACTION_ID_PREFIX)
    ? String(actionId).slice(AGENTIC_OS_DOC_INVOCATION_ACTION_ID_PREFIX.length)
    : ''
  return AGENTIC_OS_DOC_INVOCATIONS.find(doc => doc.id === id) || null
}

export const buildAgenticOsDocActionId = (doc: AgenticOsDocInvocation): string => (
  `${AGENTIC_OS_DOC_INVOCATION_ACTION_ID_PREFIX}${doc.id}`
)

export const buildAgenticOsDictionaryActionId = (invocation: AgenticOsDictionaryInvocation): string => (
  `${AGENTIC_OS_DICTIONARY_INVOCATION_ACTION_ID_PREFIX}${invocation.id}`
)

export const findAgenticOsDictionaryInvocationByActionId = (actionId: string): AgenticOsDictionaryInvocation | null => {
  const id = String(actionId || '').startsWith(AGENTIC_OS_DICTIONARY_INVOCATION_ACTION_ID_PREFIX)
    ? String(actionId).slice(AGENTIC_OS_DICTIONARY_INVOCATION_ACTION_ID_PREFIX.length)
    : ''
  return AGENTIC_OS_DICTIONARY_INVOCATIONS.find(invocation => invocation.id === id) || null
}

export const buildAgenticOsDocInvocationReference = (doc: AgenticOsDocInvocation): string => (
  `${doc.slashCommand} ${doc.hashToken} ${doc.atToken} ${doc.sourcePath}`
)

export const buildAgenticOsDocInvocationMarkdown = (doc: AgenticOsDocInvocation): string => (
  doc.slashCommand
)

export const buildAgenticOsDocSemanticInvocationMarkdown = (doc: AgenticOsDocInvocation): string => (
  doc.hashToken
)

export const buildAgenticOsDocBindingInvocationMarkdown = (doc: AgenticOsDocInvocation): string => (
  doc.atToken
)

export const buildAgenticOsDictionaryInvocationMarkdown = (invocation: AgenticOsDictionaryInvocation): string => (
  invocation.token
)

export const buildAgenticOsDictionaryInvocationReference = (invocation: AgenticOsDictionaryInvocation): string => (
  `${invocation.token} ${invocation.sourcePath}`
)
