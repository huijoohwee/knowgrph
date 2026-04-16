import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import type { WorkspacePath } from '@/features/workspace-fs/types'
import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'

export type ChatHistoryWorkspaceAppendArgs = {
  requestedPath: string | null
  onResolvedPath?: (path: string) => void
  timestampMs: number
  providerSummary: string
  userText: string
  assistantText: string
  storageType?: 'chatKnowgrph' | 'chatHistory'
  defaultLocalRootPath?: string | null
  title?: string
  traceId?: string | null
}

export type ChatHistoryWorkspaceDraftArgs = {
  requestedPath: string | null
  onResolvedPath?: (path: string) => void
  timestampMs: number
  providerSummary: string
  userText: string
  assistantText: string
  storageType?: 'chatKnowgrph' | 'chatHistory'
  defaultLocalRootPath?: string | null
  title?: string
  traceId?: string | null
}

type KgcStructuredTurnArgs = {
  timestampMs: number
  requestText: string
  assistantText: string
}

const KGC_REQUIRED_SECTION_ORDER = [
  '# ── DOCUMENT IDENTITY',
  'doc:',
  '# ── VARIABLES (type `@` to open CRUD toolbar)',
  '# ── NODES',
  'nodes:',
  '- @node:',
  '# ── EDGES',
  'edges:',
  '- @edge:',
  '# ── FLOW EDITOR (interactive + computable)',
  'flow:',
] as const

const KGC_REQUIRED_VARIABLE_MARKERS = [
  '\nsubject:',
  '\naction:',
  '\ngoal:',
  '\nsolution:',
  '\nrequest_md:',
  '\nsolution_md:',
] as const

const KGC_HISTORY_MARKER = '<!-- kg-chat-history -->'

const countMatches = (text: string, pattern: RegExp): number => {
  const matches = text.match(pattern)
  return Array.isArray(matches) ? matches.length : 0
}

const resolveFilePrefix = (args?: { storageType?: 'chatKnowgrph' | 'chatHistory' }): 'chh' | 'kgc' => {
  if (args?.storageType === 'chatKnowgrph') return 'kgc'
  return 'chh'
}

const inFlightByPath = new Map<string, Promise<void>>()
const sessionAutoPathByScope = new Map<string, WorkspacePath>()
const sessionAutoInFlightByScope = new Map<string, Promise<WorkspacePath>>()

const pad2 = (n: number): string => String(n).padStart(2, '0')

const formatIsoDateOnly = (timestampMs: number): string => {
  const d = new Date(Number.isFinite(timestampMs) ? timestampMs : Date.now())
  const yyyy = String(d.getFullYear())
  const mm = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  return `${yyyy}-${mm}-${dd}`
}

const tryParseCompactTimestampFromKgcFileName = (fileName: string): string | null => {
  const raw = String(fileName || '').trim()
  const m = raw.match(/^kgc_(\d{14})\.md$/i)
  if (!m) return null
  return String(m[1] || '').trim() || null
}

const compactTimestampToIsoDateOnly = (compact: string): string | null => {
  const s = String(compact || '').trim()
  if (!/^\d{14}$/.test(s)) return null
  const yyyy = s.slice(0, 4)
  const mm = s.slice(4, 6)
  const dd = s.slice(6, 8)
  return `${yyyy}-${mm}-${dd}`
}

const formatCompactTimestamp = (timestampMs: number): string => {
  const d = new Date(Number.isFinite(timestampMs) ? timestampMs : Date.now())
  const yyyy = String(d.getFullYear())
  const mm = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const min = pad2(d.getMinutes())
  const sec = pad2(d.getSeconds())
  return `${yyyy}${mm}${dd}${hh}${min}${sec}`
}

const formatReadableTimestamp = (timestampMs: number): string => {
  const d = new Date(Number.isFinite(timestampMs) ? timestampMs : Date.now())
  const yyyy = String(d.getFullYear())
  const mm = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const min = pad2(d.getMinutes())
  const sec = pad2(d.getSeconds())
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`
}

const wrapFence = (content: string, lang: string): string => {
  const safeLang = String(lang || '').trim() || 'text'
  const safe = String(content || '').replace(/\r\n/g, '\n')
  const ticks = safe.includes('```') ? '````' : '```'
  const open = `${ticks}${safeLang}`
  const close = ticks
  return [open, safe, close].join('\n')
}

const yamlString = (value: string): string => {
  const raw = String(value || '')
  return JSON.stringify(raw)
}

const yamlBlock = (value: string, indent = 2): string => {
  const raw = String(value || '').replace(/\r\n/g, '\n')
  const pad = ' '.repeat(Math.max(0, indent))
  if (!raw) return '|'
  const lines = raw.split('\n')
  return ['|', ...lines.map(l => {
    const trimmed = l.trim()
    // Keep markdown frontmatter delimiters inert inside block scalars so the
    // workspace parser never mistakes preserved assistant prose for a new
    // document boundary.
    const safe = trimmed === '---' || trimmed === '...' ? `\\${trimmed}` : l
    return `${pad}${safe}`
  })].join('\n')
}

const normalizeInlineValue = (value: string, fallback: string, maxChars = 160): string => {
  const cleaned = String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars)
  return cleaned || fallback
}

const toKgcNodeId = (value: string, fallback: string): string => {
  const cleaned = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
  return cleaned ? `n-${cleaned}` : fallback
}

export const isKgcStructuredMarkdown = (raw: string): boolean => {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim()
  if (!text.startsWith('---\n')) return false
  if (/^```+/m.test(text)) return false
  const lines = text.split('\n')
  let fmEnd = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (String(lines[i] || '').trim() === '---') {
      fmEnd = i
      break
    }
  }
  if (fmEnd < 0) return false
  const frontmatter = lines.slice(0, fmEnd + 1).join('\n')
  const markdownBody = lines.slice(fmEnd + 1).join('\n').trim()
  if (!markdownBody) return false
  if (!/\{\{[A-Za-z_][A-Za-z0-9_-]*[^}]*\}\}/.test(markdownBody)) return false
  let searchFrom = 0
  for (const marker of KGC_REQUIRED_SECTION_ORDER) {
    const idx = frontmatter.indexOf(marker, searchFrom)
    if (idx < 0) return false
    searchFrom = idx + marker.length
  }
  if (!KGC_REQUIRED_VARIABLE_MARKERS.every(marker => frontmatter.includes(marker))) return false
  if (countMatches(frontmatter, /(^|\n)\s*-\s*@node:/g) < 2) return false
  if (countMatches(frontmatter, /(^|\n)\s*-\s*@edge:/g) < 1) return false
  const flowStart = frontmatter.indexOf('\nflow:')
  if (flowStart < 0) return false
  const flowText = frontmatter.slice(flowStart + 1)
  const requiredFlowSnippets = [
    'flow:',
    'direction:',
    'computed:',
    '\n  nodes:',
    '\n  edges:',
    '\n    - id:',
    '\n      type:',
    '\n      data:',
  ]
  if (!requiredFlowSnippets.every(snippet => flowText.includes(snippet))) return false
  if (/^\s*(subject|action|goal|solution)\s*:\s*["']?\s*["']?\s*$/m.test(frontmatter)) return false
  const parsed = tryParseMarkdownFrontmatterFlowGraph('chatKnowgrph.kgc.md', text)
  if (!parsed) return false
  const nodes = Array.isArray(parsed.graphData.nodes) ? parsed.graphData.nodes : []
  const edges = Array.isArray(parsed.graphData.edges) ? parsed.graphData.edges : []
  return nodes.length >= 2 && edges.length >= 1
}

export const buildKgcStructuredTurn = (args: KgcStructuredTurnArgs): string => {
  const compactId = formatCompactTimestamp(args.timestampMs)
  const created = formatIsoDateOnly(args.timestampMs)
  const subject = normalizeInlineValue(args.requestText, 'chat request')
  const solution = normalizeInlineValue(args.assistantText, 'assistant response')
  const requestNodeId = toKgcNodeId(subject, 'n-user-request')
  const responseNodeId = toKgcNodeId(solution, 'n-ai-response')
  const requestMd = String(args.requestText || '').replace(/\r\n/g, '\n').trim() || 'TBD'
  const assistantMd = String(args.assistantText || '').replace(/\r\n/g, '\n').trim() || 'TBD'
  return [
    '---',
    '# ── DOCUMENT IDENTITY ────────────────────────────────────────────────────────',
    'doc:',
    `  id: ${yamlString(`doc:kgc:turn:${compactId}`)}`,
    `  title: ${yamlString('chatKnowgrph turn')}`,
    '  type: chatKnowgrph',
    `  version: ${yamlString('1.0.0')}`,
    `  created: ${yamlString(created)}`,
    '',
    '# ── VARIABLES (type `@` to open CRUD toolbar) ────────────────────────────────',
    `subject:  ${yamlString(subject)}`,
    `action:   ${yamlString('respond to the active request')}`,
    `goal:     ${yamlString('persist one ingestible chat turn')}`,
    `solution: ${yamlString(solution)}`,
    `request_md: ${yamlBlock(requestMd)}`,
    `solution_md: ${yamlBlock(assistantMd)}`,
    '',
    '# ── NODES ────────────────────────────────────────────────────────────────────',
    '# @node:id sigil wires body prose to the flow: block.',
    'nodes:',
    `  - @node:${requestNodeId}:  { label: "{{subject}}",  type: input   }`,
    `  - @node:${responseNodeId}: { label: "{{solution}}", type: output  }`,
    '',
    '# ── EDGES ────────────────────────────────────────────────────────────────────',
    'edges:',
    `  - @edge:${requestNodeId}:turn → ${responseNodeId}:turn`,
    '',
    '# ── FLOW EDITOR (interactive + computable) ───────────────────────────────────',
    '#',
    '# chatKnowgrph turn contract:',
    '#   input   nodes → authored request context',
    '#   output  nodes → stored assistant response',
    '#',
    '# Handle names use snake_case matching PostgreSQL column names directly.',
    'flow:',
    '  direction:  LR',
    '  edgeType:   smoothstep',
    '  snapToGrid: true',
    '  gridSize:   20',
    '  computed:   false',
    '',
    '  nodes:',
    `    - id:    ${requestNodeId}`,
    '      type:  input',
    '      label: "{{subject}}"',
    '      position: { x: 0, y: 60 }',
    '      handles:',
    '        source: [turn]',
    '      data:',
    '        role: "user"',
    '        text: "{{subject}}"',
    '      annotation: "`bg#E1F5EE:input`"',
    '',
    `    - id:    ${responseNodeId}`,
    '      type:  output',
    '      label: "{{solution}}"',
    '      position: { x: 360, y: 60 }',
    '      handles:',
    '        target: [turn]',
    '      data:',
    '        role: "assistant"',
    '        text: "{{solution}}"',
    '      annotation: "`bg#EAF3DE:output`"',
    '',
    '  edges:',
    `    - source: ${requestNodeId}.turn`,
    `      target: ${responseNodeId}.turn`,
    '      label: "responds"',
    '',
    '---',
    '',
    '# {{subject}}',
    '',
    '## Intent',
    '- Action: {{action}}',
    '- Goal: {{goal}}',
    '',
    '## Request',
    '{{request_md}}',
    '',
    '## Solution',
    '{{solution_md}}',
  ].join('\n')
}

export const normalizeKgcAssistantBodyForStorage = (args: KgcStructuredTurnArgs): string => {
  const raw = String(args.assistantText || '').replace(/\r\n/g, '\n').trim()
  if (isKgcStructuredMarkdown(raw)) return raw
  return buildKgcStructuredTurn(args)
}

const extractBodyAfterLeadingFrontmatter = (raw: string): string => {
  const text = String(raw || '').replace(/\r\n/g, '\n')
  const lines = text.split('\n')
  let lead = 0
  while (lead < lines.length && !String(lines[lead] || '').trim()) lead += 1
  if (String(lines[lead] || '').trim() !== '---') return text.trim()
  for (let i = lead + 1; i < lines.length; i += 1) {
    if (String(lines[i] || '').trim() !== '---') continue
    return lines.slice(i + 1).join('\n').trim()
  }
  return ''
}

const normalizeKgcHistoryBody = (raw: string): string => {
  let text = String(raw || '').replace(/\r\n/g, '\n').trim()
  if (!text) return ''
  if (text.startsWith(KGC_HISTORY_MARKER)) {
    text = text.slice(KGC_HISTORY_MARKER.length).trim()
  }
  text = text.replace(/^# Knowledge Graph Canvas Storage\s*$/m, '').trim()
  text = text.replace(/^\*KGC storage document\.\*\s*$/m, '').trim()
  text = text.replace(/^\*Append-only turns live below; top structure stays stable for parsing\.\*\s*$/m, '').trim()
  text = text.replace(/^# Chat turns\s*$/m, '').trim()
  text = text.replace(/^## Chat turns\s*$/m, '').trim()
  return text.trim()
}

const extractKgcHistoryBody = (raw: string): string => {
  const text = String(raw || '').replace(/\r\n/g, '\n')
  const markerIndex = text.indexOf(KGC_HISTORY_MARKER)
  if (markerIndex >= 0) {
    return normalizeKgcHistoryBody(text.slice(markerIndex))
  }
  return normalizeKgcHistoryBody(extractBodyAfterLeadingFrontmatter(text))
}

const buildKgcHistoryEntry = (args: {
  timestampMs: number
  traceId: string
  providerSummary: string
  userText: string
  assistantText: string
  inProgress?: boolean
}): string => {
  const canonicalKgc = normalizeKgcAssistantBodyForStorage({
    timestampMs: args.timestampMs,
    requestText: args.userText,
    assistantText: args.assistantText,
  })
  const heading = args.inProgress
    ? `## ${formatReadableTimestamp(args.timestampMs)} (in progress)`
    : `## ${formatReadableTimestamp(args.timestampMs)}`
  const body = [
    heading,
    '',
    `Trace-ID: ${args.traceId}`,
    '',
    `Provider: ${String(args.providerSummary || '').trim() || 'unknown'}`,
    '',
    '### user',
    wrapFence(args.userText, 'text'),
    '',
    '### assistant',
    wrapFence(canonicalKgc, 'kgc'),
  ]
  if (args.inProgress) {
    return [
      draftStartTag(args.traceId),
      ...body,
      draftEndTag(args.traceId),
    ].join('\n')
  }
  return body.join('\n')
}

export const buildKgcWorkspaceDocument = (args: {
  canonicalKgc: string
  historyBody?: string
}): string => {
  const canonical = String(args.canonicalKgc || '').replace(/\r\n/g, '\n').trim()
  const historyBody = normalizeKgcHistoryBody(args.historyBody || '')
  const lines = [canonical]
  if (historyBody) {
    lines.push('', KGC_HISTORY_MARKER, '', '# Chat turns', '', historyBody)
  }
  return `${lines.join('\n').trimEnd()}\n`
}

const looksLikeHostAbsoluteFsPath = (value: string): boolean => {
  const s = String(value || '').trim()
  if (!s) return false
  if (/^[a-zA-Z]:\\/.test(s) || /^[a-zA-Z]:\//.test(s)) return true
  return (
    s.startsWith('/Users/') ||
    s.startsWith('/home/') ||
    s.startsWith('/Volumes/') ||
    s.startsWith('/private/') ||
    s.startsWith('/tmp/') ||
    s.startsWith('/var/')
  )
}

const mirrorWorkspaceFileToHostFs = async (args: { absolutePath: string; text: string }): Promise<void> => {
  if (typeof window === 'undefined') return
  const abs = String(args.absolutePath || '').trim()
  if (!looksLikeHostAbsoluteFsPath(abs)) return
  try {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      try {
        controller.abort()
      } catch {
        void 0
      }
    }, 5_000)
    try {
      const res = await fetch('/__kg_fs_write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: abs, text: args.text }),
        signal: controller.signal,
      })
      if (!res.ok) return
    } finally {
      window.clearTimeout(timeoutId)
    }
  } catch {
    void 0
  }
}

const buildKgcFrontmatter = (args: {
  timestampMs: number
  providerSummary: string
  fileName: string
}): string => {
  const compactFromFile = tryParseCompactTimestampFromKgcFileName(args.fileName)
  const compactId = compactFromFile || formatCompactTimestamp(args.timestampMs)
  const created = compactTimestampToIsoDateOnly(compactId) || formatIsoDateOnly(args.timestampMs)
  return [
    '---',
    '# ── DOCUMENT IDENTITY ────────────────────────────────────────────────────────',
    'doc:',
    `  id: ${yamlString(`doc:kgc:${compactId}`)}`,
    `  title: ${yamlString('Knowledge Graph Canvas Storage')}`,
    '  type: chatKnowgrph',
    `  version: ${yamlString('1.0.0')}`,
    `  created: ${yamlString(created)}`,
    '',
    '# ── VARIABLES (type `@` to open CRUD toolbar) ────────────────────────────────',
    'subject:  "chatKnowgrph"',
    'action:   "append knowledge"',
    'goal:     "a single markdown file as the SSOT chat workspace"',
    'solution: "KGC storage document with nodes/edges/flow + appended turns"',
    '',
    `chat_file:  ${yamlString(args.fileName)}`,
    `chat_provider: ${yamlString(args.providerSummary || 'unknown')}`,
    `chat_storage: ${yamlString('chatKnowgrph')}`,
    '',
    '# ── NODES ────────────────────────────────────────────────────────────────────',
    '# @node:id sigil wires body prose to the flow: block.',
    'nodes:',
    '  - @node:n-chat: { label: "chat", type: input }',
    '  - @node:n-kgc:  { label: "kgc storage", type: output }',
    '',
    '# ── EDGES ────────────────────────────────────────────────────────────────────',
    'edges:',
    '  - @edge:n-chat:turn → n-kgc:turn',
    '',
    '# ── FLOW EDITOR (interactive + computable) ───────────────────────────────────',
    '#',
    '# chatKnowgrph storage contract:',
    '#   input   node → user request',
    '#   output  node → stored assistant response',
    '#',
    '# Handle names use snake_case.',
    'flow:',
    '  direction:  LR',
    '  edgeType:   smoothstep',
    '  snapToGrid: true',
    '  gridSize:   20',
    '  computed:   false',
    '',
    '  nodes:',
    '    - id:    n-chat',
    '      type:  input',
    '      label: "chat"',
    '      position: { x: 0, y: 60 }',
    '      handles:',
    '        source: [turn]',
    '      data:',
    `        file: ${yamlString(args.fileName)}`,
    '        note: "Appends user+assistant turns below."',
    '      annotation: "`bg#E1F5EE:input`"',
    '',
    '    - id:    n-kgc',
    '      type:  output',
    '      label: "kgc storage"',
    '      position: { x: 360, y: 60 }',
    '      handles:',
    '        target: [turn]',
    '      data:',
    `        file: ${yamlString(args.fileName)}`,
    '        format: "markdown"',
    '      annotation: "`bg#EAF3DE:output`"',
    '',
    '  edges:',
    '    - source: n-chat.turn',
    '      target: n-kgc.turn',
    '      label: "append"',
    '',
    '---',
    '',
    '# Knowledge Graph Canvas Storage',
    '',
    '*KGC storage document.*',
    '*Append-only turns live below; top structure stays stable for parsing.*',
    '',
    '## Chat turns',
  ].join('\n')
}

const normalizeKgcFrontmatterIdentityToFileName = (raw: string, fileName: string): string => {
  const compact = tryParseCompactTimestampFromKgcFileName(fileName)
  if (!compact) return raw
  const created = compactTimestampToIsoDateOnly(compact)
  let next = String(raw || '')
  const idLineRe = /^(\s*id:\s*)(["']?)doc:kgc:\d{14}(["']?)\s*$/m
  if (idLineRe.test(next)) {
    next = next.replace(idLineRe, `$1"doc:kgc:${compact}"`)
  }
  if (created) {
    const createdLineRe = /^(\s*created:\s*)(["']?)\d{4}-\d{2}-\d{2}(["']?)\s*$/m
    if (createdLineRe.test(next)) {
      next = next.replace(createdLineRe, `$1"${created}"`)
    }
  }
  return next
}

const ensureFolderIfMissing = async (folderPath: WorkspacePath): Promise<void> => {
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const list = await fs.listEntries()
  const normalized = normalizeWorkspacePath(folderPath)
  const exists = list.some(e => e.kind === 'folder' && normalizeWorkspacePath(e.path) === normalized)
  if (exists) return
  const parent = normalized === '/' ? '/' : normalizeWorkspacePath(normalized.slice(0, normalized.lastIndexOf('/')) || '/')
  const name = normalized === '/' ? '' : normalized.split('/').filter(Boolean).slice(-1)[0]
  if (!name) return
  try {
    await fs.createFolder({ parentPath: parent, name })
  } catch {
    void 0
  }
}

const ensureFolderTreeIfMissing = async (folderPath: WorkspacePath): Promise<void> => {
  const normalized = normalizeWorkspacePath(folderPath)
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 0) return
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const list = await fs.listEntries()
  const folders = new Set(
    list
      .filter(e => e.kind === 'folder')
      .map(e => normalizeWorkspacePath(e.path)),
  )
  let parent: WorkspacePath = '/'
  for (const seg of segments) {
    const name = String(seg || '').trim()
    if (!name) continue
    const next = normalizeWorkspacePath(`${parent === '/' ? '' : parent}/${name}`)
    if (!folders.has(next)) {
      try {
        await fs.createFolder({ parentPath: parent, name })
        folders.add(next)
      } catch {
        void 0
      }
    }
    parent = next
  }
}

const formatFilename = (prefix: 'chh' | 'kgc', timestampMs: number): string => {
  return `${prefix}_${formatCompactTimestamp(timestampMs)}.md`
}

const resolveSessionScopeKey = (args?: {
  storageType?: 'chatKnowgrph' | 'chatHistory'
  defaultLocalRootPath?: string | null
}): string => {
  const prefix = resolveFilePrefix(args)
  const rootRaw = String(args?.defaultLocalRootPath || '').trim()
  const root = normalizeWorkspacePath(rootRaw || '/chats')
  return `${prefix}:${root}`
}

const ensureWorkspaceFilePathExists = async (requestedPath: string): Promise<WorkspacePath> => {
  const normalized = normalizeWorkspacePath(requestedPath)
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const existing = await fs.readFileText(normalized)
  if (existing !== null) return normalized
  const lastSlash = normalized.lastIndexOf('/')
  const parent = normalizeWorkspacePath(lastSlash > 0 ? normalized.slice(0, lastSlash) : '/')
  const name = normalized.split('/').filter(Boolean).slice(-1)[0] || ''
  if (!name) return normalized
  await ensureFolderTreeIfMissing(parent)
  const created = await fs.createFile({ parentPath: parent, name, text: '' })
  return normalizeWorkspacePath(created)
}

const draftStartTag = (traceId: string): string => `<!-- kg-chat-draft:start:${traceId} -->`
const draftEndTag = (traceId: string): string => `<!-- kg-chat-draft:end:${traceId} -->`

const stripDraftBlock = (existing: string, traceId: string): string => {
  const start = draftStartTag(traceId)
  const end = draftEndTag(traceId)
  const src = String(existing || '')
  const startIdx = src.indexOf(start)
  if (startIdx < 0) return src
  const endIdx = src.indexOf(end, startIdx + start.length)
  if (endIdx < 0) return src.slice(0, startIdx).trimEnd() + '\n'
  return `${src.slice(0, startIdx)}${src.slice(endIdx + end.length)}`.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

const buildKgcDraftEntry = (args: {
  timestampMs: number
  traceId: string
  providerSummary: string
  userText: string
  assistantText: string
}): string => {
  return [
    buildKgcHistoryEntry({
      timestampMs: args.timestampMs,
      traceId: args.traceId,
      providerSummary: args.providerSummary,
      userText: args.userText,
      assistantText: args.assistantText || '_Streaming..._',
      inProgress: true,
    }),
    '',
  ].join('\n')
}

export const createNewChatHistoryWorkspaceFilePath = async (
  timestampMs: number,
  args?: { storageType?: 'chatKnowgrph' | 'chatHistory'; defaultLocalRootPath?: string | null },
): Promise<WorkspacePath> => {
  const prefix = resolveFilePrefix(args)
  const scopeKey = resolveSessionScopeKey(args)
  const rootPathRaw = String(args?.defaultLocalRootPath || '').trim()
  const folder: WorkspacePath = normalizeWorkspacePath(rootPathRaw || '/chats')
  await ensureFolderTreeIfMissing(folder)
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const name = formatFilename(prefix, timestampMs)
  const created = await fs.createFile({ parentPath: folder, name, text: '' })
  const normalized = normalizeWorkspacePath(created)
  sessionAutoPathByScope.set(scopeKey, normalized)
  sessionAutoInFlightByScope.delete(scopeKey)
  return normalized
}

export const ensureChatHistoryWorkspaceFilePath = async (args: {
  requestedPath: string | null
  timestampMs: number
  storageType?: 'chatKnowgrph' | 'chatHistory'
  defaultLocalRootPath?: string | null
  onResolvedPath?: (path: string) => void
}): Promise<string> => {
  const path = await ensureHistoryFilePath(args.requestedPath, args.timestampMs, {
    storageType: args.storageType,
    defaultLocalRootPath: args.defaultLocalRootPath,
  })
  if (typeof args.onResolvedPath === 'function') {
    try {
      args.onResolvedPath(path)
    } catch {
      void 0
    }
  }
  return path
}

const ensureHistoryFilePath = async (
  requestedPath: string | null,
  timestampMs: number,
  args?: { storageType?: 'chatKnowgrph' | 'chatHistory'; defaultLocalRootPath?: string | null },
): Promise<WorkspacePath> => {
  const scopeKey = resolveSessionScopeKey(args)
  const raw = typeof requestedPath === 'string' ? requestedPath.trim() : ''
  if (raw) return await ensureWorkspaceFilePathExists(raw)
  const cached = sessionAutoPathByScope.get(scopeKey)
  if (cached) return await ensureWorkspaceFilePathExists(cached)
  const inflight = sessionAutoInFlightByScope.get(scopeKey)
  if (inflight) return await inflight
  const nextInFlight = (async () => {
    return await createNewChatHistoryWorkspaceFilePath(timestampMs, args)
  })()
  sessionAutoInFlightByScope.set(scopeKey, nextInFlight)
  try {
    return await nextInFlight
  } finally {
    if (sessionAutoInFlightByScope.get(scopeKey) === nextInFlight) {
      sessionAutoInFlightByScope.delete(scopeKey)
    }
  }
}

export const appendChatHistoryWorkspaceFile = async (args: ChatHistoryWorkspaceAppendArgs): Promise<string> => {
  const prefix = resolveFilePrefix(args)
  const path = await ensureHistoryFilePath(args.requestedPath, args.timestampMs, {
    storageType: args.storageType,
    defaultLocalRootPath: args.defaultLocalRootPath,
  })
  const key = normalizeWorkspacePath(path)
  const previous = inFlightByPath.get(key) || Promise.resolve()
  const run = previous.then(async () => {
    if (typeof args.onResolvedPath === 'function') {
      try {
        args.onResolvedPath(key)
      } catch {
        void 0
      }
    }
    const fs = await getWorkspaceFs()
    await fs.ensureSeed()
    const existingRaw = (await fs.readFileText(key)) || ''
    const traceId = String(args.traceId || '').trim() || `trace-${args.timestampMs}`
    const fileName = key.split('/').filter(Boolean).slice(-1)[0] || `${prefix}.md`
    const normalizedExistingRaw = prefix === 'kgc'
      ? normalizeKgcFrontmatterIdentityToFileName(existingRaw, fileName)
      : existingRaw
    const existing = stripDraftBlock(normalizedExistingRaw, traceId)
    const baseTitle = args.title || (prefix === 'kgc' ? 'Knowledge Graph Canvas Storage' : 'Chat History Storage')
    const header = existing.trim()
      ? ''
      : prefix === 'kgc'
        ? [buildKgcFrontmatter({ timestampMs: args.timestampMs, providerSummary: args.providerSummary, fileName }), ''].join('\n')
        : [`# ${baseTitle}`, '', 'This file is managed by Knowgrph Chat.', ''].join('\n')
    const assistantBody = String(args.assistantText || '').replace(/\r\n/g, '\n').trim()
    const kgcAssistantBody = normalizeKgcAssistantBodyForStorage({
      timestampMs: args.timestampMs,
      requestText: args.userText,
      assistantText: assistantBody || 'No response content.',
    })
    if (prefix === 'kgc') {
      const existingHistoryBody = extractKgcHistoryBody(existing)
      const nextHistoryBody = [
        existingHistoryBody,
        buildKgcHistoryEntry({
          timestampMs: args.timestampMs,
          traceId,
          providerSummary: args.providerSummary,
          userText: args.userText,
          assistantText: kgcAssistantBody,
        }),
      ].filter(Boolean).join('\n\n')
      const next = buildKgcWorkspaceDocument({
        canonicalKgc: kgcAssistantBody,
        historyBody: nextHistoryBody,
      })
      await fs.writeFileText(key, next)
      void mirrorWorkspaceFileToHostFs({ absolutePath: key, text: next })
      return
    }
    const assistantSection = ['### assistant', wrapFence(args.assistantText, 'markdown'), ''].join('\n')

    const entry = [
      `## ${formatReadableTimestamp(args.timestampMs)}`,
      '',
      `Trace-ID: ${traceId}`,
      '',
      `Provider: ${String(args.providerSummary || '').trim() || 'unknown'}`,
      '',
      '### user',
      wrapFence(args.userText, 'text'),
      '',
      assistantSection,
    ].join('\n')
    const joiner = existing.endsWith('\n') || !existing ? '' : '\n'
    const next = [existing, header, entry].filter(Boolean).join(joiner)
    await fs.writeFileText(key, next)
    void mirrorWorkspaceFileToHostFs({ absolutePath: key, text: next })
  })
  inFlightByPath.set(key, run)
  try {
    await run
  } finally {
    if (inFlightByPath.get(key) === run) inFlightByPath.delete(key)
  }
  return key
}

export const upsertChatHistoryWorkspaceDraft = async (args: ChatHistoryWorkspaceDraftArgs): Promise<string> => {
  const prefix = resolveFilePrefix(args)
  const traceId = String(args.traceId || '').trim() || `trace-${args.timestampMs}`
  const path = await ensureHistoryFilePath(args.requestedPath, args.timestampMs, {
    storageType: args.storageType,
    defaultLocalRootPath: args.defaultLocalRootPath,
  })
  const key = normalizeWorkspacePath(path)
  const previous = inFlightByPath.get(key) || Promise.resolve()
  const run = previous.then(async () => {
    if (typeof args.onResolvedPath === 'function') {
      try {
        args.onResolvedPath(key)
      } catch {
        void 0
      }
    }
    const fs = await getWorkspaceFs()
    await fs.ensureSeed()
    const existingRaw = (await fs.readFileText(key)) || ''
    const fileName = key.split('/').filter(Boolean).slice(-1)[0] || `${prefix}.md`
    const normalizedExistingRaw = prefix === 'kgc'
      ? normalizeKgcFrontmatterIdentityToFileName(existingRaw, fileName)
      : existingRaw
    if (prefix === 'kgc') {
      const canonicalKgc = normalizeKgcAssistantBodyForStorage({
        timestampMs: args.timestampMs,
        requestText: args.userText,
        assistantText: String(args.assistantText || '').replace(/\r\n/g, '\n').trim() || '_Streaming..._',
      })
      const existing = stripDraftBlock(normalizedExistingRaw, traceId)
      const existingHistoryBody = extractKgcHistoryBody(existing)
      const draft = buildKgcDraftEntry({
        timestampMs: args.timestampMs,
        traceId,
        providerSummary: args.providerSummary,
        userText: args.userText,
        assistantText: args.assistantText,
      })
      const nextHistoryBody = [existingHistoryBody, draft.trim()].filter(Boolean).join('\n\n')
      const next = buildKgcWorkspaceDocument({
        canonicalKgc,
        historyBody: nextHistoryBody,
      })
      if (next === normalizedExistingRaw) return
      await fs.writeFileText(key, next)
      if (!existingRaw.trim()) {
        void mirrorWorkspaceFileToHostFs({ absolutePath: key, text: next })
      }
      return
    }
    const baseTitle = args.title || 'Chat History Storage'
    const header = existingRaw.trim()
      ? ''
      : [`# ${baseTitle}`, '', 'This file is managed by Knowgrph Chat.', ''].join('\n')
    const existing = stripDraftBlock(normalizedExistingRaw, traceId)
    const draft = buildKgcDraftEntry({
      timestampMs: args.timestampMs,
      traceId,
      providerSummary: args.providerSummary,
      userText: args.userText,
      assistantText: args.assistantText,
    })
    const joiner = existing.endsWith('\n') || !existing ? '' : '\n'
    const next = [existing, header, draft].filter(Boolean).join(joiner)
    if (next === normalizedExistingRaw) return
    await fs.writeFileText(key, next)
    if (!existingRaw.trim()) {
      void mirrorWorkspaceFileToHostFs({ absolutePath: key, text: next })
    }
  })
  inFlightByPath.set(key, run)
  try {
    await run
  } finally {
    if (inFlightByPath.get(key) === run) inFlightByPath.delete(key)
  }
  return key
}
