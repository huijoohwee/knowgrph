import { KNOWGRPH_MEMORY_LAYER_MCP_TOOL_NAMES } from '@/features/memory/aiAgentsMemoryLayerContract.mjs'
import {
  AGENTIC_OS_DOC_INVOCATIONS,
  AGENTIC_OS_SEMANTIC_INVOCATIONS,
  getAgenticOsDocInvocations,
  getAgenticOsSemanticInvocations,
  type AgenticOsDocInvocationId,
} from '@/features/agentic-os/agenticOsDocInvocations'
import { buildGenerationInvocationSystemPrompt, GENERATION_SPECIFICATION_INVOCATIONS } from './generationInvocation'

export type ChatInvocationId =
  | 'memory.search'
  | 'memory.add'
  | 'memory.assemble'
  | 'memory.extract'
  | 'memory.user_model'
  | 'promotion.retry'
  | 'media'
  | 'agent'
  | 'mcp'
  | 'model'
  | AgenticOsDocInvocationId
  | string

export type ChatInvocationOption = {
  id: ChatInvocationId
  token: `#${string}`
  label: string
  summary: string
  keywords: readonly string[]
  toolName?: string
  sourcePath?: string
  slashCommand?: string
  atToken?: string
}

const BASE_CHAT_INVOCATION_OPTIONS: readonly ChatInvocationOption[] = [
  ...GENERATION_SPECIFICATION_INVOCATIONS.map(option => ({ id: `generation.${option.specification}`, token: option.token, label: `${option.label} specification`, summary: option.summary, keywords: ['generation', 'specification', option.specification], slashCommand: '/video-agent' })),
  { id: 'memory.search', token: '#memory.search', label: 'Search memory', summary: 'Retrieve explicitly scoped memory through the configured memory MCP runtime.', keywords: ['recall', 'context', 'mem0'], toolName: KNOWGRPH_MEMORY_LAYER_MCP_TOOL_NAMES.search },
  { id: 'memory.add', token: '#memory.add', label: 'Add memory', summary: 'Persist explicitly scoped memory through the configured memory MCP runtime.', keywords: ['remember', 'persist', 'mem0'], toolName: KNOWGRPH_MEMORY_LAYER_MCP_TOOL_NAMES.add },
  { id: 'memory.assemble', token: '#memory.assemble', label: 'Assemble memory prompt', summary: 'Inject ranked memories into a bounded prompt context.', keywords: ['prompt', 'context', 'tokens'], toolName: KNOWGRPH_MEMORY_LAYER_MCP_TOOL_NAMES.assemblePrompt },
  { id: 'memory.extract', token: '#memory.extract', label: 'Extract procedural memory', summary: 'Promote a completed harness run into a reusable KGC procedural-memory document through the configured memory MCP runtime.', keywords: ['procedural', 'harness', 'replay', 'kgc'], toolName: KNOWGRPH_MEMORY_LAYER_MCP_TOOL_NAMES.extractProcedural },
  { id: 'memory.user_model', token: '#memory.user_model', label: 'Materialize user model', summary: 'Project scoped in-repo memories into a deterministic USER_MODEL markdown document and stable workspace file through the configured memory MCP runtime.', keywords: ['profile', 'user model', 'frontmatter', 'markdown'], toolName: KNOWGRPH_MEMORY_LAYER_MCP_TOOL_NAMES.materializeUserModel },
  { id: 'promotion.retry', token: '#promotion.retry', label: 'Retry artifact promotion', summary: 'Retry GitHub/storage mirroring for an already-saved local workspace artifact without regenerating it.', keywords: ['promotion', 'mirror', 'github', 'storage', 'artifact', 'retry'] },
  { id: 'media', token: '#media', label: 'Media context', summary: 'Use media references selected from the shared FloatingPanel Media inventory.', keywords: ['image', 'audio', 'video', 'asset', 'floating panel'] },
  { id: 'agent', token: '#agent', label: 'Agent runtime', summary: 'Route the request through the selected provider-neutral agent capability.', keywords: ['ai', 'orchestration', 'vdeoxpln'] },
  { id: 'mcp', token: '#mcp', label: 'MCP runtime', summary: 'Use only tools exposed by the configured MCP runtime.', keywords: ['tools', 'server', 'protocol'] },
  { id: 'model', token: '#model', label: 'Active model', summary: 'Bind the request to the currently selected provider and model.', keywords: ['llm', 'provider', 'inference'] },
] as const

const BASE_CHAT_INVOCATION_TOKENS = new Set(BASE_CHAT_INVOCATION_OPTIONS.map(option => option.token.toLowerCase()))

export const CHAT_INVOCATION_OPTIONS: readonly ChatInvocationOption[] = [
  ...BASE_CHAT_INVOCATION_OPTIONS,
  ...AGENTIC_OS_DOC_INVOCATIONS.map(doc => ({
    id: doc.id,
    token: doc.hashToken,
    label: doc.label,
    summary: doc.summary,
    keywords: doc.keywords,
    sourcePath: doc.sourcePath,
    slashCommand: doc.slashCommand,
    atToken: doc.atToken,
  })),
  ...AGENTIC_OS_SEMANTIC_INVOCATIONS.filter(invocation => !BASE_CHAT_INVOCATION_TOKENS.has(invocation.token.toLowerCase())).map(invocation => ({
    id: invocation.id as ChatInvocationId,
    token: invocation.token as `#${string}`,
    label: invocation.label,
    summary: invocation.summary,
    keywords: invocation.keywords,
    sourcePath: invocation.sourcePath,
  })),
]

export const getChatInvocationOptions = (): readonly ChatInvocationOption[] => {
  const liveDocOptions = getAgenticOsDocInvocations().map(doc => ({
    id: doc.id,
    token: doc.hashToken,
    label: doc.label,
    summary: doc.summary,
    keywords: doc.keywords,
    sourcePath: doc.sourcePath,
    slashCommand: doc.slashCommand,
    atToken: doc.atToken,
  }))
  const liveSemanticOptions = getAgenticOsSemanticInvocations()
    .filter(invocation => !BASE_CHAT_INVOCATION_TOKENS.has(invocation.token.toLowerCase()))
    .map(invocation => ({
      id: invocation.id as ChatInvocationId,
      token: invocation.token as `#${string}`,
      label: invocation.label,
      summary: invocation.summary,
      keywords: invocation.keywords,
      sourcePath: invocation.sourcePath,
    }))
  return [
    ...BASE_CHAT_INVOCATION_OPTIONS,
    ...liveDocOptions,
    ...liveSemanticOptions,
  ]
}

export const isChatInvocationToken = (token: string): boolean => (
  getChatInvocationOptions().some(option => option.token.toLowerCase() === String(token || '').toLowerCase())
)

export const parseChatInvocationDirectives = (raw: unknown): ChatInvocationOption[] => {
  const text = String(raw || '')
  const optionsByToken = new Map(getChatInvocationOptions().map(option => [option.token.toLowerCase(), option]))
  const found = new Map<ChatInvocationId, ChatInvocationOption>()
  for (const match of text.matchAll(/(^|\s)(#[A-Za-z0-9_.-]+)/g)) {
    const option = optionsByToken.get(String(match[2] || '').toLowerCase())
    if (option && !found.has(option.id)) found.set(option.id, option)
  }
  return [...found.values()]
}

export const buildChatInvocationSystemPrompt = (args: {
  userQuery: string
  chatProvider: string
  chatModel: string | null
}): string => {
  const directives = parseChatInvocationDirectives(args.userQuery)
  const generationPrompt = buildGenerationInvocationSystemPrompt(args.userQuery)
  if (directives.length === 0 && !generationPrompt) return ''
  const toolNames = directives.map(directive => directive.toolName).filter((value): value is string => !!value)
  const requestsProceduralExtract = directives.some(directive => directive.id === 'memory.extract')
  const requestsUserModel = directives.some(directive => directive.id === 'memory.user_model')
  const requestsPromotionRetry = directives.some(directive => directive.id === 'promotion.retry')
  const sourceRefs = directives
    .filter(directive => directive.sourcePath)
    .map(directive => `${directive.token}=${directive.sourcePath}`)
  return [
    'Chat invocation contract:',
    `- Directives: ${directives.map(directive => directive.token).join(', ')}`,
    `- Active provider/model: ${String(args.chatProvider || 'unknown')} / ${String(args.chatModel || 'unknown')}`,
    `- Requested MCP tools: ${toolNames.length > 0 ? toolNames.join(', ') : 'none'}`,
    sourceRefs.length > 0 ? `- Agentic OS doc sources: ${sourceRefs.join(', ')}` : '',
    '- Memory tools require an explicit user_id, agent_id, run_id, or app_id scope. Ask for missing scope instead of inventing it.',
    requestsProceduralExtract ? '- Procedural memory extraction also requires an existing output_dir rooted inside KNOWGRPH_ROOT. Ask for the exact output_dir instead of inferring or fabricating a harness run path.' : '',
    requestsProceduralExtract ? '- When procedural extraction is requested, keep optional title, document_slug, and persist_memory fields operator-directed; do not invent document names beyond the runtime defaults.' : '',
    requestsUserModel ? '- User-model materialization writes deterministic USER_MODEL markdown from the scoped in-repo memory store and mirrors it into a stable workspace path under the local chat root by default. Ask for the exact scope if it is missing, and keep title/document_slug/workspace_path/default_local_root_path/max_memories operator-directed.' : '',
    requestsPromotionRetry ? '- Promotion retry requires one or more exact workspace artifact paths that already exist locally. Ask for the exact path instead of inferring or fabricating one.' : '',
    requestsPromotionRetry ? '- Promotion retry reuses the saved local workspace artifact as-is. Do not regenerate, rewrite, or revalidate the KGC body when the request is only to rerun mirroring.' : '',
    '- Media directives consume only media references present in the user message or workspace context. Preserve their source URLs and media kinds; do not invent assets.',
    '- Agentic OS doc directives bind to local source docs as reference context only; they do not authorize Prod or Cloudflare deployment.',
    '- Invoke a requested tool only when it is present in the request tool set or connected MCP runtime. Otherwise return the exact tool name and required inputs as a handoff; never claim execution.',
    '- Keep tool output provider-neutral and preserve structured MCP results for the existing response projector.',
    generationPrompt,
  ].filter(Boolean).join('\n')
}
