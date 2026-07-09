export const KNOWGRPH_PROBE_TREE_DOC_INVOCATION_ID = 'knowgrph.probe-tree' as const

export type AgenticOsDocInvocationId =
  | 'agentic-os'
  | 'agentic-os.agents'
  | 'agentic-os.memory'
  | 'agentic-os.dictionary.command'
  | 'agentic-os.dictionary.semantic'
  | 'agentic-os.dictionary.binding'
  | 'agentic-os.skills'
  | 'agentic-os.prd-tad'
  | 'agentic-os.runtime'
  | 'agentic-os.proof'
  | 'agentic-os.harness'
  | 'agentic-os.mcp-gateway'
  | 'agentic-os.validation'
  | typeof KNOWGRPH_PROBE_TREE_DOC_INVOCATION_ID

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

export const AGENTIC_OS_DOCS_GITHUB_ROOT_URL = 'https://github.com/huijoohwee/agentic-canvas-os/blob/main/docs'
export const KNOWGRPH_DOCS_GITHUB_ROOT_URL = 'https://github.com/huijoohwee/knowgrph/blob/main/docs/documents'

const buildAgenticOsDocSourceUrl = (fileName: string): string => (
  `${AGENTIC_OS_DOCS_GITHUB_ROOT_URL}/${encodeURIComponent(fileName)}`
)

const buildKnowgrphDocSourceUrl = (fileName: string): string => (
  `${KNOWGRPH_DOCS_GITHUB_ROOT_URL}/${encodeURIComponent(fileName)}`
)

const buildAgenticOsDocInvocation = (args: {
  id: AgenticOsDocInvocationId
  fileName: string
  label: string
  summary: string
  keywords: readonly string[]
  sourcePath?: string
}): AgenticOsDocInvocation => ({
  ...args,
  slashCommand: `/${args.id}`,
  hashToken: `#${args.id}`,
  atToken: `@${args.id}`,
  sourcePath: args.sourcePath || buildAgenticOsDocSourceUrl(args.fileName),
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
    id: 'agentic-os.skills',
    fileName: 'SKILLS.md',
    label: 'Agentic OS Skills',
    summary: 'Invoke source-backed skill contracts, FloatingPanel Chat variants, and computing-flow contracts.',
    keywords: ['skills', 'variants', 'computing-flow', 'harness'],
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
    id: 'agentic-os.proof',
    fileName: 'RUNTIME-PROOF.md',
    label: 'Agentic OS Runtime Proof',
    summary: 'Invoke the current parse, route, validation, and deploy-boundary proof ledger.',
    keywords: ['proof', 'ledger', 'validation', 'deploy guard'],
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
  buildAgenticOsDocInvocation({
    id: KNOWGRPH_PROBE_TREE_DOC_INVOCATION_ID,
    fileName: 'knowgrph-probe-tree-prd-tad.md',
    label: 'Knowgrph Probe-Tree PRD/TAD',
    summary: 'Invoke the runtime-ready local probe-tree PRD/TAD, MCP harness, and markdown graph contract.',
    keywords: ['knowgrph', 'probe-tree', 'prd', 'tad', 'probe.generate', 'probe.select', 'probe.evolve', 'branches-to', 'runtime-ready'],
    sourcePath: buildKnowgrphDocSourceUrl('knowgrph-probe-tree-prd-tad.md'),
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
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/soul.load', label: 'Soul load', group: 'Agentic OS command dictionary', summary: 'Load durable agent identity from SOUL.md as prompt slot 1 without hardcoding a default identity in runtime code.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['soul', 'identity', 'profile', 'no-hardcode'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/personality.overlay', label: 'Personality overlay', group: 'Agentic OS command dictionary', summary: 'Apply a temporary session-level style or mode overlay.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['personality', 'overlay', 'session', 'style'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/moa', label: 'MoA', group: 'Agentic OS command dictionary', summary: 'Run a one-shot Mixture of Agents pass for a hard query without switching the global model or creating a copied provider preset.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['mixture of agents', 'reference agents', 'aggregator', 'token economics'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/query', label: 'Query', group: 'Agentic OS command dictionary', summary: 'Answer from facts, dictionaries, memory, and cited source docs without mutation.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['query', 'facts', 'source-backed', 'read-only'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/memory.seed', label: 'Memory seed', group: 'Agentic OS command dictionary', summary: 'Create or update neutral memory content from authored source docs.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['memory', 'frontmatter', 'source', 'seed'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/memory.write', label: 'Memory write', group: 'Agentic OS command dictionary', summary: 'Add, replace, or remove a bounded memory or user-profile entry.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['memory', 'write', 'profile', 'bounded'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/memory.compact', label: 'Memory compact', group: 'Agentic OS command dictionary', summary: 'Consolidate or remove stale entries when a bounded memory target is near or over capacity.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['memory', 'compact', 'capacity', 'stale'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/memory.search', label: 'Memory search', group: 'Agentic OS command dictionary', summary: 'Search scoped local memory or conversation indexes for reusable facts, decisions, and prior proof.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['memory', 'search', 'prior proof', 'local context'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/session.search', label: 'Session search', group: 'Agentic OS command dictionary', summary: 'Search past conversations or session records on demand.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['session', 'search', 'history', 'truth'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/user.profile', label: 'User profile', group: 'Agentic OS command dictionary', summary: 'Add, replace, remove, or inspect explicit user-profile entries.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['user profile', 'memory', 'explicit', 'bounded'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/skill.discover', label: 'Skill discover', group: 'Agentic OS command dictionary', summary: 'List lightweight skill metadata without loading full skill bodies.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['skill', 'discover', 'metadata', 'progressive disclosure'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/skill.load', label: 'Skill load', group: 'Agentic OS command dictionary', summary: 'Load one selected skill source and optional on-demand resource.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['skill', 'load', 'source', 'reference'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/skill.bundle', label: 'Skill bundle', group: 'Agentic OS command dictionary', summary: 'Resolve a bundle that groups existing skills under one invocation.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['skill', 'bundle', 'manifest', 'existing skills'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/skill.manage', label: 'Skill manage', group: 'Agentic OS command dictionary', summary: 'Create, patch, edit, delete, or update supporting files for a skill.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['skill', 'manage', 'security', 'approval'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/context.discover', label: 'Context discover', group: 'Agentic OS command dictionary', summary: 'Discover project-local context files from the active working directory.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['context', 'discover', 'cwd', 'project'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/context.load', label: 'Context load', group: 'Agentic OS command dictionary', summary: 'Load one approved context file into the behavior context.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['context', 'load', 'progressive disclosure', 'runtime proof'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/context.audit', label: 'Context audit', group: 'Agentic OS command dictionary', summary: 'Inspect context-file precedence, loaded files, truncation, scan blocks, and stale risks.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['context', 'audit', 'precedence', 'stale'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/reference.expand', label: 'Reference expand', group: 'Agentic OS command dictionary', summary: 'Expand inline context references from a message into attached context.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['reference', 'expand', 'inline context', 'token economics'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/reference.audit', label: 'Reference audit', group: 'Agentic OS command dictionary', summary: 'Inspect reference expansion safety, size, source, and warning state.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['reference', 'audit', 'attached context', 'warnings'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/kanban.task', label: 'Kanban task', group: 'Agentic OS command dictionary', summary: 'Create or update one durable task row in kanban.md.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['kanban', 'task row', 'durable task', 'runtime proof'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/kanban.handoff', label: 'Kanban handoff', group: 'Agentic OS command dictionary', summary: 'Add a readable handoff row for another named profile or worker process.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['kanban', 'handoff', 'worker process', 'profile'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/kanban.sync', label: 'Kanban sync', group: 'Agentic OS command dictionary', summary: 'Reconcile board rows across named agent profiles without spawning fragile subagent swarms.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['kanban', 'sync', 'conflict-aware', 'agent profile'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/tool.catalog', label: 'Tool catalog', group: 'Agentic OS command dictionary', summary: 'Read available tool categories, routing providers, status, and unavailable states.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['tool', 'catalog', 'routing', 'zero-spend'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/tool.route', label: 'Tool route', group: 'Agentic OS command dictionary', summary: 'Route one tool call through the selected knowgrph tool surface.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['tool', 'route', 'approval', 'cost'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/tool.provider.select', label: 'Tool provider select', group: 'Agentic OS command dictionary', summary: 'Select gateway, direct, local, or unavailable provider state per tool category.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['tool provider', 'routing', 'no-hardcode', 'server-managed'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/tool.gateway.audit', label: 'Tool gateway audit', group: 'Agentic OS command dictionary', summary: 'Inspect routing, usage, cost, egress, approval, and deploy boundary state.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['tool gateway', 'audit', 'cost', 'egress'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/toolset.enable', label: 'Toolset enable', group: 'Agentic OS command dictionary', summary: 'Enable a logical toolset for one platform surface.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['toolset', 'enable', 'platform surface', 'approval'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/toolset.disable', label: 'Toolset disable', group: 'Agentic OS command dictionary', summary: 'Disable a logical toolset for one platform surface.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['toolset', 'disable', 'platform surface', 'vcc'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/tool.search', label: 'Tool search', group: 'Agentic OS command dictionary', summary: 'Search the session-scoped deferred-tool catalog.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['tool', 'search', 'deferred catalog', 'progressive disclosure'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/tool.describe', label: 'Tool describe', group: 'Agentic OS command dictionary', summary: 'Load one deferred tool schema on demand.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['tool', 'describe', 'schema', 'on demand'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/tool.call', label: 'Tool call', group: 'Agentic OS command dictionary', summary: 'Invoke a selected deferred tool through a bridge route.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['tool', 'call', 'bridge', 'approval'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/experience.capture', label: 'Experience capture', group: 'Agentic OS command dictionary', summary: 'Convert an observed run, failure, proof packet, or operator correction into a typed experience record.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['experience', 'learning loop', 'proof', 'operator correction'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/skill.propose', label: 'Skill propose', group: 'Agentic OS command dictionary', summary: 'Propose a new reusable skill from repeated experience without directly modifying runtime code.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['skill', 'proposal', 'experience', 'review'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/skill.evolve', label: 'Skill evolve', group: 'Agentic OS command dictionary', summary: 'Improve an existing skill through bounded evaluation and human-reviewed diff proposal.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['skill', 'evolution', 'evaluation', 'review'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/identity.reflect', label: 'Identity reflect', group: 'Agentic OS command dictionary', summary: 'Update the local identity model from stable operator preferences, project boundaries, and working rules.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['identity', 'preferences', 'operator', 'memory'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/orchestration.graph', label: 'Orchestration graph', group: 'Agentic OS command dictionary', summary: 'Declare or validate a stateful agent orchestration graph without importing an external graph runtime.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['orchestration', 'graph', 'state', 'compile checks'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/state.checkpoint', label: 'State checkpoint', group: 'Agentic OS command dictionary', summary: 'Define checkpoint, resume, recovery, and idempotency behavior for long-running runs.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['checkpoint', 'resume', 'recovery', 'idempotency'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/human.review', label: 'Human review', group: 'Agentic OS command dictionary', summary: 'Interrupt a run for operator inspection, edit, approval, rejection, and resume.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['human review', 'approval', 'interrupt', 'resume'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/stream.trace', label: 'Stream trace', group: 'Agentic OS command dictionary', summary: 'Surface execution progress, state transitions, cost, and stop events as a typed trace.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['stream', 'trace', 'state transitions', 'cost'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/superagent.run', label: 'SuperAgent run', group: 'Agentic OS command dictionary', summary: 'Run a bounded long-horizon research, coding, or creation workflow through source-backed orchestration.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['superagent', 'long-horizon', 'sandbox', 'message gateway'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/prd-tad.create', label: 'PRD/TAD create', group: 'Agentic OS command dictionary', summary: 'Produce or refresh the combined PRD/TAD contract from validated context.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['prd', 'tad', 'architecture', 'vcc'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/runtime-ready.check', label: 'Runtime-ready check', group: 'Agentic OS command dictionary', summary: 'Verify whether a spec-complete artifact has surfaced runtime proof.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['runtime', 'readiness', 'proof', 'validation'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/deploy.guard', label: 'Deploy guard', group: 'Agentic OS command dictionary', summary: 'Stop accidental Prod mirror or Cloudflare mutation without operator approval.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['deploy', 'guard', 'dev-only', 'cloudflare'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/harness.define', label: 'Harness define', group: 'Agentic OS command dictionary', summary: 'Define typed input, output, fallback, cost, and bounds for an AI-capable component.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['harness', 'schema', 'cost', 'bounds'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/mcp.capabilities', label: 'MCP capabilities', group: 'Agentic OS command dictionary', summary: 'Discover tool capabilities through the existing MCP gateway contract.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['mcp', 'capabilities', 'gateway', 'zero-spend'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/cost.audit', label: 'Cost audit', group: 'Agentic OS command dictionary', summary: 'Inspect token, cache, and TCO impact before model-bearing execution.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['cost', 'tokens', 'tco', 'cache'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/canvas.project', label: 'Canvas project', group: 'Agentic OS command dictionary', summary: 'Project source-backed runtime state into existing Canvas owners.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['canvas', 'projection', 'source-backed', 'storyboard'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/canvas.render', label: 'Canvas render', group: 'Agentic OS command dictionary', summary: 'Inspect or trigger projection through existing Canvas render owners without mutating source graph data.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['render', 'canvas', 'projection', 'runtime'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/validation.run', label: 'Validation run', group: 'Agentic OS command dictionary', summary: 'Run focused checks for the touched docs or runtime owner.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['validation', 'focused', 'proof', 'checks'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/workspace.review', label: 'Workspace review', group: 'Agentic OS command dictionary', summary: 'Review current workspace context, sources, memory, bindings, and blockers before execution.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['review workspace', 'context', 'sources', 'blockers'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/pipeline.trace', label: 'Pipeline trace', group: 'Agentic OS command dictionary', summary: 'Trace source ingestion, parsing, render projection, harness state, and cost boundaries.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['trace pipeline', 'pipeline', 'cache', 'cost'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/source.ingest', label: 'Source ingest', group: 'Agentic OS command dictionary', summary: 'Inspect or run source intake through existing Source Files and workspace owners.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['ingest', 'source files', 'intake', 'provenance'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/source.parse', label: 'Source parse', group: 'Agentic OS command dictionary', summary: 'Parse current source frontmatter and body into normalized graph, table, KTV, or KGC context.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['parse', 'frontmatter', 'graph', 'kgc'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/source.normalize', label: 'Source normalize', group: 'Agentic OS command dictionary', summary: 'Neutralize conflicting or stale source content at the upstream owner.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['source', 'normalize', 'no-hardcode', 'no-legacy'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/ingest-url', label: 'Ingest URL', group: 'Agentic OS command dictionary', summary: 'Ingest an operator-provided URL through the approved URL intake and source-file pipeline.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['ingest url', 'url', 'source', 'intake'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'command', token: '/computing-flow', label: 'Computing flow', group: 'Agentic OS command dictionary', summary: 'Generate or validate a source-backed KGC computing-flow DAG.', dictionaryFileName: 'DICTIONARY-COMMAND.md', keywords: ['computing-flow', 'kgc', 'frontmatter', 'dag'] }),
] as const

export const AGENTIC_OS_SEMANTIC_INVOCATIONS: readonly AgenticOsDictionaryInvocation[] = [
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#truth', label: 'Truth', group: 'Agentic OS semantic dictionary', summary: 'Source-backed fact stable enough for shared agent reuse.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['truth', 'facts', 'source-backed', 'routing'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#soul', label: 'Soul', group: 'Agentic OS semantic dictionary', summary: 'Durable agent identity, voice, and communication defaults.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['soul', 'identity', 'voice'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#primary-identity', label: 'Primary identity', group: 'Agentic OS semantic dictionary', summary: 'Prompt slot 1 identity replacement.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['identity', 'prompt slot', 'fallback'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#personality-overlay', label: 'Personality overlay', group: 'Agentic OS semantic dictionary', summary: 'Temporary session-level style or mode overlay.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['personality', 'overlay', 'session'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#mixture-of-agents', label: 'Mixture of agents', group: 'Agentic OS semantic dictionary', summary: 'Bounded multi-agent deliberation where references advise and one aggregator acts.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['moa', 'multi-agent', 'aggregator'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#reference-agents', label: 'Reference agents', group: 'Agentic OS semantic dictionary', summary: 'Advisory reference calls inside a Mixture of Agents run.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['reference', 'advisory', 'bounded'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#aggregator-agent', label: 'Aggregator agent', group: 'Agentic OS semantic dictionary', summary: 'Acting agent that produces the final MoA response.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['aggregator', 'final response', 'tool gates'] }),
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
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#computing-flow', label: 'Computing flow', group: 'Agentic OS semantic dictionary', summary: 'KGC/frontmatter DAG execution contract.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['kgc', 'frontmatter', 'dag', 'handles'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#learning-loop', label: 'Learning loop', group: 'Agentic OS semantic dictionary', summary: 'Closed learning cycle from experience capture to reviewed persistence.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['learning', 'experience', 'persistence', 'review'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#persistent-memory', label: 'Persistent memory', group: 'Agentic OS semantic dictionary', summary: 'Bounded curated memory that persists across sessions.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['memory', 'persistent', 'capacity', 'scan'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#user-profile', label: 'User profile', group: 'Agentic OS semantic dictionary', summary: 'Explicit operator preferences, communication style, and expectations.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['user profile', 'preferences', 'operator', 'explicit'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#frozen-snapshot', label: 'Frozen snapshot', group: 'Agentic OS semantic dictionary', summary: 'Session-start memory/profile prompt snapshot.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['snapshot', 'session', 'prompt', 'immutable'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#memory-capacity', label: 'Memory capacity', group: 'Agentic OS semantic dictionary', summary: 'Character/token bound for memory and profile targets.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['memory', 'capacity', 'overflow', 'compact'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#session-search', label: 'Session search', group: 'Agentic OS semantic dictionary', summary: 'On-demand search over prior conversations or session records.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['session', 'search', 'read-only', 'citations'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#skill-system', label: 'Skill system', group: 'Agentic OS semantic dictionary', summary: 'On-demand procedural knowledge loaded only when useful.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['skill', 'system', 'on-demand', 'procedural knowledge'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#progressive-disclosure', label: 'Progressive disclosure', group: 'Agentic OS semantic dictionary', summary: 'Token-minimizing staged loading.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['progressive disclosure', 'tokens', 'staged loading'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#skill-bundle', label: 'Skill bundle', group: 'Agentic OS semantic dictionary', summary: 'Grouped skill invocation.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['skill', 'bundle', 'grouped invocation'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#agentskills-compatible', label: 'Agent Skills compatible', group: 'Agentic OS semantic dictionary', summary: 'Open-standard skill file compatibility.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['agent skills', 'standard', 'compatibility'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#skill-security', label: 'Skill security', group: 'Agentic OS semantic dictionary', summary: 'Skill trust, scan, compatibility, and write approval.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['skill', 'security', 'trust', 'approval'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#context-file', label: 'Context file', group: 'Agentic OS semantic dictionary', summary: 'Project-local instruction file that shapes behavior.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['context', 'file', 'instructions', 'scan'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#project-context', label: 'Project context', group: 'Agentic OS semantic dictionary', summary: 'Behavioral context scoped to a project or subdirectory.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['project', 'context', 'directory', 'scope'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#cwd-discovery', label: 'CWD discovery', group: 'Agentic OS semantic dictionary', summary: 'Working-directory and ancestor/subdirectory context discovery.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['cwd', 'discovery', 'context', 'ancestor'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#context-reference', label: 'Context reference', group: 'Agentic OS semantic dictionary', summary: 'Inline message reference that requests bounded content expansion.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['context', 'reference', 'inline', 'bounded'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#inline-context', label: 'Inline context', group: 'Agentic OS semantic dictionary', summary: 'Content injected into the effective message before model or tool execution.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['inline', 'context', 'expansion', 'traceable'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#attached-context', label: 'Attached context', group: 'Agentic OS semantic dictionary', summary: 'Appended context packet produced by reference expansion.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['attached', 'context', 'reference', 'packet'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#kanban-board', label: 'Kanban board', group: 'Agentic OS semantic dictionary', summary: 'Durable Markdown task board shared across named profiles.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['kanban', 'board', 'durable', 'profiles'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#task-row', label: 'Task row', group: 'Agentic OS semantic dictionary', summary: 'One durable work item row.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['task', 'row', 'owner', 'status'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#profile-handoff', label: 'Profile handoff', group: 'Agentic OS semantic dictionary', summary: 'Explicit row-level transfer between named agent profiles.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['profile', 'handoff', 'row', 'review'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#worker-process', label: 'Worker process', group: 'Agentic OS semantic dictionary', summary: 'Full OS process worker with its own identity and runtime state.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['worker', 'process', 'identity', 'runtime state'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#multi-agent-collaboration', label: 'Multi-agent collaboration', group: 'Agentic OS semantic dictionary', summary: 'Durable collaboration through shared rows rather than transient subagents.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['multi-agent', 'collaboration', 'rows', 'ssot'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#tool-gateway', label: 'Tool gateway', group: 'Agentic OS semantic dictionary', summary: 'Existing-infrastructure routing for tool calls.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['tool', 'gateway', 'routing', 'mcp'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#tool-routing', label: 'Tool routing', group: 'Agentic OS semantic dictionary', summary: 'Per-tool provider selection and fallback.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['tool', 'routing', 'provider', 'fallback'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#tool-function', label: 'Tool function', group: 'Agentic OS semantic dictionary', summary: 'Callable function that extends agent capability.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['tool', 'function', 'schema', 'owner'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#toolset', label: 'Toolset', group: 'Agentic OS semantic dictionary', summary: 'Logical bundle of existing tool functions.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['toolset', 'bundle', 'existing functions'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#platform-toolset', label: 'Platform toolset', group: 'Agentic OS semantic dictionary', summary: 'Platform-scoped toolset state.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['platform', 'toolset', 'surface', 'scope'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#tool-search', label: 'Tool search', group: 'Agentic OS semantic dictionary', summary: 'Deferred tool catalog search.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['tool', 'search', 'deferred catalog', 'metadata'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#deferred-tool-schema', label: 'Deferred tool schema', group: 'Agentic OS semantic dictionary', summary: 'On-demand schema for one selected deferred tool.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['tool', 'schema', 'deferred', 'on demand'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#bridge-tool', label: 'Bridge tool', group: 'Agentic OS semantic dictionary', summary: 'Bridge route to an underlying deferred tool identity.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['tool', 'bridge', 'route', 'schema'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#web-search', label: 'Web search', group: 'Agentic OS semantic dictionary', summary: 'Web search and extraction tool category.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['web search', 'extraction', 'citations', 'egress'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#image-generation', label: 'Image generation', group: 'Agentic OS semantic dictionary', summary: 'Image generation tool category.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['image', 'generation', 'approval', 'artifact'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#text-to-speech', label: 'Text to speech', group: 'Agentic OS semantic dictionary', summary: 'Text-to-speech tool category.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['tts', 'audio', 'voice', 'output'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#cloud-browser', label: 'Cloud browser', group: 'Agentic OS semantic dictionary', summary: 'Cloud browser automation tool category.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['browser', 'automation', 'redaction', 'approval'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#skill-evolution', label: 'Skill evolution', group: 'Agentic OS semantic dictionary', summary: 'Bounded improvement of reusable skill contracts.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['skill', 'evaluation', 'review', 'semantic preservation'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#memory-search', label: 'Memory search', group: 'Agentic OS semantic dictionary', summary: 'Scoped retrieval from local memory or past conversation indexes.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['memory', 'retrieval', 'prior context', 'typed empty'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#identity-model', label: 'Identity model', group: 'Agentic OS semantic dictionary', summary: 'Stable, source-backed operator and project preference model.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['identity', 'preferences', 'source-backed', 'non-secret'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#orchestration-graph', label: 'Orchestration graph', group: 'Agentic OS semantic dictionary', summary: 'State, node, edge, and compile-check contract for agent workflows.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['orchestration', 'graph', 'state', 'edges'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#stateful-agent', label: 'Stateful agent', group: 'Agentic OS semantic dictionary', summary: 'Long-running agent with explicit state across turns or sessions.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['stateful', 'agent', 'memory', 'resume'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#durable-execution', label: 'Durable execution', group: 'Agentic OS semantic dictionary', summary: 'Fault-tolerant execution that can resume after interruption or failure.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['durable', 'checkpoint', 'retry', 'recovery'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#human-in-loop', label: 'Human in loop', group: 'Agentic OS semantic dictionary', summary: 'Operator inspection or approval inside a run.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['human', 'review', 'approval', 'resume'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#long-horizon-harness', label: 'Long-horizon harness', group: 'Agentic OS semantic dictionary', summary: 'Bounded research, coding, or creation harness with typed graph, tools, artifacts, and stop condition.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['superagent', 'long-horizon', 'harness', 'stop condition'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#sandboxed-workspace', label: 'Sandboxed workspace', group: 'Agentic OS semantic dictionary', summary: 'Isolated workspace scope for generated files, commands, and artifacts.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['sandbox', 'workspace', 'artifacts', 'scope'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'semantic', token: '#message-gateway', label: 'Message gateway', group: 'Agentic OS semantic dictionary', summary: 'Typed handoff channel for role messages, worker updates, and resumable long-horizon coordination.', dictionaryFileName: 'DICTIONARY-SEMANTIC.md', keywords: ['message', 'gateway', 'handoff', 'resume'] }),
] as const

export const AGENTIC_OS_BINDING_INVOCATIONS: readonly AgenticOsDictionaryInvocation[] = [
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@agent', label: 'Agent', group: 'Agentic OS binding dictionary', summary: 'Executing agent bound by shared facts, operating instructions, and explicit operator direction.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['agent', 'facts', 'instructions', 'operator'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@soul-profile', label: 'Soul profile', group: 'Agentic OS binding dictionary', summary: 'Durable source-backed agent identity and voice.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['soul', 'identity', 'voice'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@identity-slot', label: 'Identity slot', group: 'Agentic OS binding dictionary', summary: 'Prompt slot 1 identity position.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['identity', 'prompt slot', 'fallback'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@personality-overlay', label: 'Personality overlay', group: 'Agentic OS binding dictionary', summary: 'Temporary session-level style overlay.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['personality', 'overlay', 'session'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@moa-preset', label: 'MoA preset', group: 'Agentic OS binding dictionary', summary: 'Local neutral MoA preset binding for reference roles, aggregator role, caps, and failover policy.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['moa', 'preset', 'caps'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@reference-agents', label: 'Reference agents', group: 'Agentic OS binding dictionary', summary: 'Bounded advisory agents in a Mixture of Agents run.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['reference', 'advisory', 'private context'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@aggregator-agent', label: 'Aggregator agent', group: 'Agentic OS binding dictionary', summary: 'Single acting agent in a Mixture of Agents run.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['aggregator', 'final response', 'approval gates'] }),
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
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@experience', label: 'Experience', group: 'Agentic OS binding dictionary', summary: 'Typed record of a run, failure, proof packet, or operator correction.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['experience', 'proof', 'lesson', 'provenance'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@memory-store', label: 'Memory store', group: 'Agentic OS binding dictionary', summary: 'Scoped local memory and conversation index surface.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['memory', 'local storage', 'scoped read', 'operator'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@memory-entry', label: 'Memory entry', group: 'Agentic OS binding dictionary', summary: 'One compact memory or profile entry.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['memory', 'entry', 'profile', 'scan'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@memory-snapshot', label: 'Memory snapshot', group: 'Agentic OS binding dictionary', summary: 'Frozen memory/profile context captured at session start.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['memory', 'snapshot', 'session', 'prompt'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@memory-policy', label: 'Memory policy', group: 'Agentic OS binding dictionary', summary: 'Capacity, write approval, scan, duplicate, and compaction policy.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['memory', 'policy', 'capacity', 'compaction'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@user-profile', label: 'User profile', group: 'Agentic OS binding dictionary', summary: 'Bounded user profile for explicit preferences, communication style, and expectations.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['user profile', 'preferences', 'operator', 'bounded'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@session-index', label: 'Session index', group: 'Agentic OS binding dictionary', summary: 'Searchable past-session record index.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['session', 'index', 'search', 'read-only'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@skill-index', label: 'Skill index', group: 'Agentic OS binding dictionary', summary: 'Lightweight skill metadata index.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['skill', 'index', 'metadata', 'discovery'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@skill-source', label: 'Skill source', group: 'Agentic OS binding dictionary', summary: 'One selected skill source document.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['skill', 'source', 'skill.md', 'selection'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@skill-reference', label: 'Skill reference', group: 'Agentic OS binding dictionary', summary: 'Optional skill resource such as references, scripts, templates, or assets.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['skill', 'reference', 'resource', 'shallow'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@skill-bundle', label: 'Skill bundle', group: 'Agentic OS binding dictionary', summary: 'Bundle manifest that groups existing skill ids.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['skill', 'bundle', 'manifest', 'existing'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@skill-policy', label: 'Skill policy', group: 'Agentic OS binding dictionary', summary: 'Skill trust, scan, compatibility, write approval, and validation policy.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['skill', 'policy', 'scan', 'approval'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@context-file', label: 'Context file', group: 'Agentic OS binding dictionary', summary: 'One discovered project-local context file.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['context', 'file', 'project', 'scan'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@working-directory', label: 'Working directory', group: 'Agentic OS binding dictionary', summary: 'Current startup or tool-call working directory used for context discovery.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['working directory', 'cwd', 'context', 'scope'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@context-policy', label: 'Context policy', group: 'Agentic OS binding dictionary', summary: 'Precedence, scan, truncation, and progressive-discovery rules for context files.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['context', 'policy', 'precedence', 'truncation'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@file:', label: 'File reference', group: 'Agentic OS binding dictionary', summary: 'Context reference to one workspace file or 1-indexed line range.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['file', 'reference', 'line range', 'workspace'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@folder:', label: 'Folder reference', group: 'Agentic OS binding dictionary', summary: 'Context reference to a directory listing or bounded folder summary.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['folder', 'reference', 'directory', 'bounded'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@diff', label: 'Diff reference', group: 'Agentic OS binding dictionary', summary: 'Context reference to the current unstaged diff.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['diff', 'reference', 'worktree', 'read-only'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@staged', label: 'Staged reference', group: 'Agentic OS binding dictionary', summary: 'Context reference to the current staged diff.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['staged', 'reference', 'index', 'read-only'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@git:', label: 'Git reference', group: 'Agentic OS binding dictionary', summary: 'Context reference to recent commit metadata or patch range.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['git', 'reference', 'commit', 'patch'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@url:', label: 'URL reference', group: 'Agentic OS binding dictionary', summary: 'Context reference to fetched external content.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['url', 'reference', 'egress', 'citation'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@reference-policy', label: 'Reference policy', group: 'Agentic OS binding dictionary', summary: 'Workspace, scan, size, platform, URL egress, warning, and refusal rules for context references.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['reference', 'policy', 'scan', 'refusal'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@attached-context', label: 'Attached context', group: 'Agentic OS binding dictionary', summary: 'Expanded context packet attached to a request.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['attached', 'context', 'packet', 'reference'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@kanban-board', label: 'Kanban board', group: 'Agentic OS binding dictionary', summary: 'Durable kanban.md task board.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['kanban', 'board', 'markdown table', 'ssot'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@task-row', label: 'Task row', group: 'Agentic OS binding dictionary', summary: 'One validated task row in kanban.md.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['task', 'row', 'schema', 'acceptance'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@handoff-row', label: 'Handoff row', group: 'Agentic OS binding dictionary', summary: 'One validated handoff row in kanban.md.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['handoff', 'row', 'profiles', 'resume'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@agent-profile', label: 'Agent profile', group: 'Agentic OS binding dictionary', summary: 'Named profile that can own or receive board work.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['agent', 'profile', 'owner', 'handoff'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@worker-process', label: 'Worker process', group: 'Agentic OS binding dictionary', summary: 'Full OS process worker for a named profile.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['worker', 'process', 'cwd', 'bounds'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@tool-gateway', label: 'Tool gateway', group: 'Agentic OS binding dictionary', summary: 'Existing knowgrph tool routing surface.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['tool', 'gateway', 'mcp', 'routing'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@tool-provider', label: 'Tool provider', group: 'Agentic OS binding dictionary', summary: 'Provider state for a specific tool category.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['tool', 'provider', 'routing', 'server-managed'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@tool-function', label: 'Tool function', group: 'Agentic OS binding dictionary', summary: 'One callable function that extends agent capability.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['tool', 'function', 'schema', 'fallback'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@toolset', label: 'Toolset', group: 'Agentic OS binding dictionary', summary: 'Logical bundle of existing tool functions.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['toolset', 'bundle', 'existing functions'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@platform-surface', label: 'Platform surface', group: 'Agentic OS binding dictionary', summary: 'CLI, FloatingPanel Chat, browser, MCP, or control-plane surface.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['platform', 'surface', 'toolset', 'scope'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@deferred-tool-catalog', label: 'Deferred tool catalog', group: 'Agentic OS binding dictionary', summary: 'Session-scoped catalog of eligible deferred tools.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['tool', 'deferred catalog', 'session', 'metadata'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@bridge-tool', label: 'Bridge tool', group: 'Agentic OS binding dictionary', summary: 'Model-visible bridge surface for deferred tool search, describe, or call.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['tool', 'bridge', 'search', 'call'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@web-search-tool', label: 'Web search tool', group: 'Agentic OS binding dictionary', summary: 'Search and extraction capability.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['web search', 'extraction', 'citations'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@image-tool', label: 'Image tool', group: 'Agentic OS binding dictionary', summary: 'Image generation capability.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['image', 'generation', 'artifact', 'approval'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@tts-tool', label: 'TTS tool', group: 'Agentic OS binding dictionary', summary: 'Text-to-speech capability.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['tts', 'voice', 'audio', 'output'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@browser-tool', label: 'Browser tool', group: 'Agentic OS binding dictionary', summary: 'Cloud browser automation capability.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['browser', 'automation', 'redaction', 'approval'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@tool-policy', label: 'Tool policy', group: 'Agentic OS binding dictionary', summary: 'Tool approval, egress, secret, cost, and fallback policy.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['tool', 'policy', 'approval', 'egress'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@skill-catalog', label: 'Skill catalog', group: 'Agentic OS binding dictionary', summary: 'Reusable skill contract catalog.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['skill', 'catalog', 'proposal', 'review'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@identity-model', label: 'Identity model', group: 'Agentic OS binding dictionary', summary: 'Stable model of operator preferences, project boundaries, and agent operating rules.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['identity', 'preferences', 'project boundaries', 'non-secret'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@orchestration-graph', label: 'Orchestration graph', group: 'Agentic OS binding dictionary', summary: 'Source-backed state, node, edge, and stop-condition topology.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['orchestration', 'graph', 'state', 'topology'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@state-store', label: 'State store', group: 'Agentic OS binding dictionary', summary: 'Scoped current-state snapshot for a stateful run.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['state', 'snapshot', 'secret-free', 'mutation approval'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@checkpoint-store', label: 'Checkpoint store', group: 'Agentic OS binding dictionary', summary: 'Durable checkpoint and resume surface.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['checkpoint', 'resume', 'recovery', 'cleanup'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@human-review', label: 'Human review', group: 'Agentic OS binding dictionary', summary: 'Operator review interrupt and resume binding.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['human review', 'interrupt', 'resume', 'approval'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@sandbox-workspace', label: 'Sandbox workspace', group: 'Agentic OS binding dictionary', summary: 'Isolated workspace for generated files, commands, and long-horizon artifacts.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['sandbox', 'workspace', 'artifacts', 'scope'] }),
  buildAgenticOsDictionaryInvocation({ kind: 'binding', token: '@message-gateway', label: 'Message gateway', group: 'Agentic OS binding dictionary', summary: 'Typed channel for long-horizon worker messages, handoffs, and resumable coordination.', dictionaryFileName: 'DICTIONARY-BINDING.md', keywords: ['message', 'gateway', 'handoff', 'resume'] }),
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
