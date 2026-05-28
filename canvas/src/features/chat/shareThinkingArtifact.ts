import { analyzeKgcRequest, sanitizeRequestIntent } from './chatKgcRequestProfile'
import { formatReasoningStepSummary } from './FloatingPanelChat.helpers'
import type { DereferencedChatStreamArtifact } from './chatStreamArtifactDereference'

const REPORT_SHARE_HINT_RX = /\/report\/share\//i
const GENERIC_ARTIFACT_LABELS = new Set(['chat response', 'response', 'report', 'analysis'])
const REQUESTED_SECTION_LABELS: Record<string, string> = {
  useCase: 'Use Case',
  problem: 'Problem',
  solution: 'Solution',
  userFlow: 'User Flow',
  workflow: 'Work Flow',
  dataFlow: 'Data Flow',
  goals: 'Goals',
  userStories: 'User Stories',
  monetization: 'Monetization',
  integrations: 'Integration',
}
const GENERIC_WORKSPACE_HEADING_RX = /^(computing flow definition|runner protocol|graph registry|document links|flow graph|pipeline|open questions|customization guide)$/i
const GENERIC_PREVIEW_LINE_RX = /(this document is the pipeline|machine-readable source of truth|human-readable projection|self-runnable|graph-complete|schema-validated|ssot surfaces|renderers may use this block|dual-layer structure|workspace listings)/i
const REQUEST_KEYWORD_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'be', 'by', 'for', 'from', 'how', 'in', 'into', 'is', 'of', 'on', 'or', 'the', 'to', 'with',
  'should', 'could', 'would', 'please', 'question', 'query', 'output', 'stream', 'report', 'response',
])

const pad2 = (value: number): string => String(value).padStart(2, '0')

const toYamlScalar = (value: unknown): string => JSON.stringify(String(value ?? ''))

const toSlug = (value: unknown): string => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const clampText = (value: unknown, maxLength: number): string => {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : text
}

const wrapFence = (content: string, language: string): string => {
  const safe = String(content || '').replace(/\r\n/g, '\n')
  const fence = safe.includes('```') ? '````' : '```'
  return `${fence}${language}\n${safe}\n${fence}`
}

const formatReadableUtc = (timestampMs: number): string => {
  const date = new Date(Number.isFinite(timestampMs) ? timestampMs : Date.now())
  return [
    date.getUTCFullYear(),
    '-',
    pad2(date.getUTCMonth() + 1),
    '-',
    pad2(date.getUTCDate()),
    ' ',
    pad2(date.getUTCHours()),
    ':',
    pad2(date.getUTCMinutes()),
    ':',
    pad2(date.getUTCSeconds()),
    ' UTC',
  ].join('')
}

const extractUniqueUrls = (values: readonly string[]): string[] => {
  const out: string[] = []
  const seen = new Set<string>()
  const urlRx = /https?:\/\/[^\s<>"')\]]+/gi
  values.forEach(value => {
    const text = String(value || '')
    let match: RegExpExecArray | null = null
    while ((match = urlRx.exec(text)) !== null) {
      const candidate = String(match[0] || '').replace(/[),.;]+$/g, '')
      if (!candidate) continue
      const key = candidate.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(candidate)
    }
  })
  return out
}

const isReportShareUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return REPORT_SHARE_HINT_RX.test(url.pathname)
  } catch {
    return false
  }
}

const uniqueText = (values: readonly string[]): string[] => {
  const out: string[] = []
  const seen = new Set<string>()
  values.forEach(value => {
    const text = String(value || '').trim()
    if (!text) return
    const key = text.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(text)
  })
  return out
}

type StreamArtifactQueryRelevance = {
  intent: string
  focus: string
  requestedSections: string[]
  namedTerms: string[]
}

type WorkspaceOutputSnapshot = {
  headings: string[]
  previewLines: string[]
  requestedSectionsPresent: string[]
  namedTermsPresent: string[]
}

type StreamSignalSnapshot = {
  contentChunkCount: number
  reasoningChunkCount: number
  selectedSignals: string[]
  markdownProjectionLines: string[]
  reasoningHighlights: string[]
  toolSignals: string[]
  sourceUrls: string[]
}

const buildStreamArtifactQueryRelevance = (requestText: string): StreamArtifactQueryRelevance => {
  const intent = sanitizeRequestIntent(requestText, 320) || 'Prompt unavailable.'
  const profile = analyzeKgcRequest(requestText)
  const requestedSections = Object.entries(profile.requestedSections)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => REQUESTED_SECTION_LABELS[key] || key)
  const focusParts = uniqueText([
    profile.objective && profile.objective !== sanitizeRequestIntent(requestText, 320) ? profile.objective : '',
    profile.artifact && !GENERIC_ARTIFACT_LABELS.has(profile.artifact.toLowerCase()) ? `Artifact: ${profile.artifact}` : '',
    profile.product ? `Product: ${profile.product}` : '',
    profile.subject ? `Subject: ${profile.subject}` : '',
    profile.domain ? `Domain: ${profile.domain}` : '',
    requestedSections.length > 0 ? `Requested Sections: ${requestedSections.join(', ')}` : '',
    ...profile.topics,
    ...profile.namedTerms,
  ])
  return {
    intent,
    focus: clampText(focusParts.join(' · '), 260) || intent,
    requestedSections,
    namedTerms: uniqueText(profile.namedTerms),
  }
}

const stripLeadingFrontmatter = (value: string): string => {
  const text = String(value || '').replace(/\r\n/g, '\n').trim()
  if (!text.startsWith('---\n')) return text
  const closingIndex = text.indexOf('\n---\n', 4)
  if (closingIndex < 0) return text
  return text.slice(closingIndex + 5).trim()
}

const extractMarkdownHeadingSnapshot = (value: string, maxCount = 6): string[] => {
  const body = stripLeadingFrontmatter(value)
  if (!body) return []
  const headings = uniqueText(
    body
      .split('\n')
      .map(line => {
        const match = /^\s*#{1,6}\s+(.+?)\s*$/.exec(line)
        return match?.[1] ? clampText(match[1], 120) : ''
      })
      .filter(Boolean),
  )
  return headings.slice(0, Math.max(1, maxCount))
}

const shouldSkipPreviewLine = (line: string): boolean => {
  const normalized = String(line || '').trim()
  if (!normalized) return true
  if (normalized === '---') return true
  if (normalized.startsWith('```')) return true
  if (normalized.startsWith('|')) return true
  if (normalized.startsWith('[↑ ') || normalized.startsWith('[↓ ')) return true
  if (normalized.startsWith('`bg#')) return true
  if (normalized.includes('{{')) return true
  if (/^> \*\*Machine source:/i.test(normalized)) return true
  if (/^read the table left to right:/i.test(normalized)) return true
  if (GENERIC_PREVIEW_LINE_RX.test(normalized)) return true
  if (/^#{1,6}\s+/.test(normalized)) {
    const heading = normalized.replace(/^#{1,6}\s+/, '').trim()
    if (GENERIC_WORKSPACE_HEADING_RX.test(heading)) return true
  }
  return false
}

const extractKeywordTokens = (value: string): string[] => {
  const matches: string[] = String(value || '').match(/\b[A-Za-z0-9]{2,}\b/g) || []
  return uniqueText(matches.filter(token => {
    const lowered = token.toLowerCase()
    if (REQUEST_KEYWORD_STOPWORDS.has(lowered)) return false
    if (/^[0-9]+$/.test(token)) return false
    if (token.length <= 2 && token !== token.toUpperCase()) return false
    return true
  }))
}

const buildRequestKeywordSet = (requestText: string, queryRelevance?: StreamArtifactQueryRelevance): Set<string> => {
  const keywords = [
    ...extractKeywordTokens(requestText),
    ...(queryRelevance?.namedTerms || []).flatMap(term => extractKeywordTokens(term)),
    ...(queryRelevance?.requestedSections || []).flatMap(section => extractKeywordTokens(section)),
  ]
  return new Set(keywords.map(keyword => keyword.toLowerCase()))
}

const scorePreviewLine = (line: string, keywordSet: Set<string>): number => {
  const normalized = String(line || '').trim()
  if (!normalized || shouldSkipPreviewLine(normalized)) return Number.NEGATIVE_INFINITY
  const tokens = extractKeywordTokens(normalized).map(token => token.toLowerCase())
  const overlap = tokens.filter(token => keywordSet.has(token))
  if (overlap.length === 0) return -1
  let score = overlap.length * 10
  if (/^#{1,6}\s+/.test(normalized)) score += 2
  if (normalized.length <= 160) score += 1
  return score
}

const extractRelevantMarkdownPreviewLines = (args: {
  value: string
  requestText: string
  maxCount?: number
}): string[] => {
  const maxCount = Math.max(1, args.maxCount || 6)
  const body = stripLeadingFrontmatter(args.value)
  if (!body) return []
  const queryRelevance = buildStreamArtifactQueryRelevance(args.requestText)
  const keywordSet = buildRequestKeywordSet(args.requestText, queryRelevance)
  const candidates = body
    .split('\n')
    .map((line, index) => ({
      line: clampText(String(line || '').trim(), 180),
      index,
    }))
    .filter(entry => entry.line)
    .map(entry => ({
      ...entry,
      score: scorePreviewLine(entry.line, keywordSet),
    }))
    .filter(entry => Number.isFinite(entry.score) && entry.score > 0)
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
  return uniqueText(candidates.map(entry => entry.line)).slice(0, maxCount)
}

const buildWorkspaceOutputSnapshot = (args: {
  requestText: string
  workspaceAssistantText?: string | null
}): WorkspaceOutputSnapshot => {
  const text = stripLeadingFrontmatter(String(args.workspaceAssistantText || '').trim())
  if (!text) {
    return {
      headings: [],
      previewLines: [],
      requestedSectionsPresent: [],
      namedTermsPresent: [],
    }
  }
  const queryRelevance = buildStreamArtifactQueryRelevance(args.requestText)
  const lowered = text.toLowerCase()
  const keywordSet = buildRequestKeywordSet(args.requestText, queryRelevance)
  const headings = extractMarkdownHeadingSnapshot(text).filter(heading => {
    const normalized = heading.replace(/^\{\{.+\}\}\s*·\s*/g, '').trim()
    if (!normalized) return false
    if (normalized.includes('{{')) return false
    if (GENERIC_WORKSPACE_HEADING_RX.test(normalized)) return false
    return scorePreviewLine(normalized, keywordSet) > 0
  })
  return {
    headings,
    previewLines: extractRelevantMarkdownPreviewLines({
      value: text,
      requestText: args.requestText,
      maxCount: 6,
    }),
    requestedSectionsPresent: queryRelevance.requestedSections.filter(section => lowered.includes(section.toLowerCase())),
    namedTermsPresent: queryRelevance.namedTerms.filter(term => lowered.includes(term.toLowerCase())),
  }
}

const safeParseJson = (value: string): unknown => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

const readStringField = (record: Record<string, unknown> | null, key: string): string => {
  const value = record?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

const pushUniqueLimited = (target: string[], value: unknown, maxCount = 16, maxLength = 220) => {
  if (target.length >= maxCount) return
  const text = clampText(value, maxLength)
  if (!text) return
  const key = text.toLowerCase()
  if (target.some(item => item.toLowerCase() === key)) return
  target.push(text)
}

const collectStepToolSignal = (step: unknown): string => {
  const record = asRecord(step)
  if (!record) return ''
  const summary = formatReasoningStepSummary(step)
  if (summary) return summary
  const type = readStringField(record, 'type')
  return type
}

const collectToolCallSignals = (delta: Record<string, unknown>): string[] => {
  const out: string[] = []
  const calls = Array.isArray(delta.tool_calls) ? delta.tool_calls : []
  calls.forEach(call => {
    const record = asRecord(call)
    const fn = asRecord(record?.function)
    const name = readStringField(fn, 'name') || readStringField(record, 'name') || readStringField(record, 'type')
    if (name) pushUniqueLimited(out, `tool_call: ${name}`, 8, 120)
  })
  return out
}

const extractReasoningTexts = (delta: Record<string, unknown>): string[] => {
  return uniqueText([
    readStringField(delta, 'reasoning_content'),
    readStringField(delta, 'reasoning'),
    readStringField(delta, 'thought'),
    readStringField(delta, 'analysis'),
  ]).filter(Boolean)
}

const buildStreamSignalSnapshot = (args: {
  requestText: string
  rawSseEvents: string[]
}): StreamSignalSnapshot => {
  const selectedSignals: string[] = []
  const contentParts: string[] = []
  const reasoningParts: string[] = []
  const reasoningHighlights: string[] = []
  const toolSignals: string[] = []
  const sourceUrlCandidates: string[] = []
  let contentChunkCount = 0
  let reasoningChunkCount = 0
  for (const event of args.rawSseEvents) {
    const parsed = safeParseJson(event)
    const parsedRecord = asRecord(parsed)
    const deltas = Array.isArray(parsedRecord?.choices) ? parsedRecord?.choices : []
    let eventSummary = ''
    for (const choice of deltas) {
      const choiceRecord = asRecord(choice)
      const delta = asRecord(choiceRecord?.delta) || asRecord(choiceRecord?.message) || {}
      const content = readStringField(delta, 'content')
      if (content.replace(/\s+/g, '').trim()) contentChunkCount += 1
      if (content) contentParts.push(content)
      const previewLines = extractRelevantMarkdownPreviewLines({
        value: content,
        requestText: args.requestText,
        maxCount: 2,
      })
      if (previewLines.length > 0) {
        eventSummary = `content: ${previewLines.join(' | ')}`
        break
      }
      const reasoningSteps = Array.isArray(delta.reasoning_steps) ? delta.reasoning_steps : []
      if (reasoningSteps.length > 0) {
        reasoningChunkCount += 1
        reasoningSteps.forEach(step => {
          const signal = collectStepToolSignal(step)
          pushUniqueLimited(toolSignals, signal, 12, 180)
          pushUniqueLimited(reasoningHighlights, signal, 12, 180)
          sourceUrlCandidates.push(...extractUniqueUrls([JSON.stringify(step)]))
        })
        eventSummary = `reasoning: ${reasoningSteps.length} step${reasoningSteps.length === 1 ? '' : 's'}`
      }
      const reasoningTexts = extractReasoningTexts(delta)
      if (reasoningTexts.length > 0) {
        reasoningChunkCount += 1
        reasoningParts.push(...reasoningTexts)
        reasoningTexts.forEach(text => {
          const relevantLines = extractRelevantMarkdownPreviewLines({
            value: text,
            requestText: args.requestText,
            maxCount: 2,
          })
          relevantLines.forEach(line => pushUniqueLimited(reasoningHighlights, line, 12, 180))
        })
        if (!eventSummary) eventSummary = `reasoning: ${clampText(reasoningTexts[0], 120)}`
      }
      collectToolCallSignals(delta).forEach(signal => pushUniqueLimited(toolSignals, signal, 12, 180))
      sourceUrlCandidates.push(...extractUniqueUrls([event, content, ...reasoningTexts]))
    }
    if (!eventSummary) {
      const urls = extractUniqueUrls([event])
      if (urls.length > 0) eventSummary = `url: ${clampText(urls[0], 160)}`
    }
    if (!eventSummary) continue
    selectedSignals.push(eventSummary)
  }
  const streamMarkdown = contentParts.join('')
  const markdownProjectionLines = extractRelevantMarkdownPreviewLines({
    value: streamMarkdown,
    requestText: args.requestText,
    maxCount: 8,
  })
  const reasoningProjectionLines = extractRelevantMarkdownPreviewLines({
    value: reasoningParts.join('\n'),
    requestText: args.requestText,
    maxCount: 4,
  })
  reasoningProjectionLines.forEach(line => pushUniqueLimited(reasoningHighlights, line, 12, 180))
  return {
    contentChunkCount,
    reasoningChunkCount,
    selectedSignals: uniqueText(selectedSignals).slice(0, 8),
    markdownProjectionLines,
    reasoningHighlights: uniqueText(reasoningHighlights).slice(0, 8),
    toolSignals: uniqueText(toolSignals).slice(0, 8),
    sourceUrls: extractUniqueUrls(sourceUrlCandidates).slice(0, 8),
  }
}

type ArtifactNode = {
  id: string
  type: string
  label: string
  stage: string
  summary: string
  order: number
  href?: string
  references?: string[]
}

type ArtifactEdge = {
  id: string
  source: string
  target: string
  label: string
}

const pushNodeYaml = (lines: string[], node: ArtifactNode) => {
  lines.push(`  - id: ${toYamlScalar(node.id)}`)
  lines.push(`    type: ${toYamlScalar(node.type)}`)
  lines.push(`    label: ${toYamlScalar(node.label)}`)
  lines.push('    properties:')
  lines.push(`      stage: ${toYamlScalar(node.stage)}`)
  lines.push(`      summary: ${toYamlScalar(node.summary)}`)
  lines.push(`      order: ${node.order}`)
  if (node.href) lines.push(`      href: ${toYamlScalar(node.href)}`)
  if (node.references && node.references.length > 0) {
    lines.push('      references:')
    node.references.forEach(reference => {
      lines.push(`        - ${toYamlScalar(reference)}`)
    })
  }
}

const pushEdgeYaml = (lines: string[], edge: ArtifactEdge) => {
  lines.push(`  - id: ${toYamlScalar(edge.id)}`)
  lines.push(`    source: ${toYamlScalar(edge.source)}`)
  lines.push(`    target: ${toYamlScalar(edge.target)}`)
  lines.push(`    label: ${toYamlScalar(edge.label)}`)
}

const buildArtifactFrontmatter = (args: {
  documentId: string
  documentTitle: string
  nodes: ArtifactNode[]
  edges: ArtifactEdge[]
}): string => {
  const lines = [
    '---',
    'kgCanvasSurfaceMode: "2d"',
    'kgCanvasRenderMode: "2d"',
    'kgCanvas2dRenderer: "storyboard"',
    'kgDocumentSemanticMode: "document"',
    'kgFrontmatterModeEnabled: true',
    'kgMultiDimTableModeEnabled: false',
    'kgDocumentStructureBaselineLock: false',
    'doc:',
    `  id: ${toYamlScalar(args.documentId)}`,
    `  title: ${toYamlScalar(args.documentTitle)}`,
    'nodes:',
  ]
  args.nodes.forEach(node => pushNodeYaml(lines, node))
  lines.push('edges:')
  args.edges.forEach(edge => pushEdgeYaml(lines, edge))
  lines.push('---', '')
  return lines.join('\n')
}

export type ShareThinkingArtifactBundleLike = {
  sessionId: string
  streamLogPath?: string | null
}

export type ShareThinkingArtifactReportLike = {
  path: string
}

export type BuildShareThinkingArtifactArgs = {
  artifact: Pick<DereferencedChatStreamArtifact, 'url' | 'exportToken' | 'exportMarkdownPath' | 'workspacePath' | 'fileName'>
  bundle: ShareThinkingArtifactBundleLike
  timestampMs: number
  traceId: string
  providerSummary: string
  modelId: string | null
  workspacePath?: string | null
  requestText: string
  rawAssistantText: string
  workspaceAssistantText?: string | null
  usageSummary: string | null
  finishReason: string | null
  reasoningSteps: string[]
  rawSseEvents: string[]
  status: 'ok' | 'error'
  observedUrls: string[]
  reportDocuments: ShareThinkingArtifactReportLike[]
  promptText?: string | null
  queryText?: string | null
  summaryText?: string | null
  preferredTrajectoryLines?: string[]
  preferredThinkingProcessLines?: string[]
  preferredSearchLines?: string[]
  preferredRunCodeLines?: string[]
  preferredWorkspaceOutputLines?: string[]
  preferredStreamAlignedOutputLines?: string[]
  preferredSourceLinks?: string[]
  preferredRelatedArtifactLines?: string[]
  queryRelevanceOverride?: Partial<StreamArtifactQueryRelevance>
}

export const buildShareThinkingArtifactDocument = (args: BuildShareThinkingArtifactArgs): string => {
  const documentId = `share-trace:${args.artifact.exportToken}:${toSlug(args.traceId) || 'trace'}`
  const promptText = String((args.promptText ?? args.requestText) || '').trim() || 'Prompt unavailable.'
  const queryText = String((args.queryText ?? promptText) || '').trim() || promptText
  const queryRelevanceBase = buildStreamArtifactQueryRelevance(queryText)
  const queryRelevance: StreamArtifactQueryRelevance = {
    intent: String(args.queryRelevanceOverride?.intent || '').trim() || queryRelevanceBase.intent,
    focus: String(args.queryRelevanceOverride?.focus || '').trim() || queryRelevanceBase.focus,
    requestedSections:
      Array.isArray(args.queryRelevanceOverride?.requestedSections) && args.queryRelevanceOverride?.requestedSections.length > 0
        ? uniqueText(args.queryRelevanceOverride?.requestedSections || [])
        : queryRelevanceBase.requestedSections,
    namedTerms:
      Array.isArray(args.queryRelevanceOverride?.namedTerms) && args.queryRelevanceOverride?.namedTerms.length > 0
        ? uniqueText(args.queryRelevanceOverride?.namedTerms || [])
        : queryRelevanceBase.namedTerms,
  }
  const workspaceOutputSnapshot = buildWorkspaceOutputSnapshot({
    requestText: queryText,
    workspaceAssistantText: args.workspaceAssistantText,
  })
  const streamSignalSnapshot = buildStreamSignalSnapshot({
    requestText: queryText,
    rawSseEvents: args.rawSseEvents,
  })
  const traceHighlights = uniqueText([
    ...(Array.isArray(args.preferredThinkingProcessLines) ? args.preferredThinkingProcessLines : []),
    ...args.reasoningSteps,
    ...streamSignalSnapshot.reasoningHighlights,
    ...streamSignalSnapshot.toolSignals,
  ]).slice(0, 14)
  const preferredTrajectoryLines = uniqueText(Array.isArray(args.preferredTrajectoryLines) ? args.preferredTrajectoryLines : [])
  const trajectoryLines = (preferredTrajectoryLines.length > 0
    ? uniqueText([
        ...preferredTrajectoryLines,
        `Prompt received for ${queryRelevance.focus}.`,
        `Intent captured: ${queryRelevance.intent}`,
        ...streamSignalSnapshot.selectedSignals,
      ])
    : uniqueText([
        `Prompt received for ${queryRelevance.focus}.`,
        `Intent captured: ${queryRelevance.intent}`,
        ...streamSignalSnapshot.selectedSignals,
        ...(workspaceOutputSnapshot.headings.length > 0
          ? [`Workspace headings: ${workspaceOutputSnapshot.headings.join(' | ')}`]
          : []),
      ])).slice(0, 14)
  const preferredSearchLines = uniqueText(Array.isArray(args.preferredSearchLines) ? args.preferredSearchLines : []).slice(0, 14)
  const searchLines = preferredSearchLines.length > 0
    ? preferredSearchLines
    : uniqueText([
        ...args.reasoningSteps,
        ...streamSignalSnapshot.toolSignals,
        ...streamSignalSnapshot.selectedSignals,
      ])
        .filter(line => /\b(web_search|search|fetch_url)\b/i.test(line))
        .slice(0, 14)
  const preferredRunCodeLines = uniqueText(Array.isArray(args.preferredRunCodeLines) ? args.preferredRunCodeLines : []).slice(0, 14)
  const runCodeLines = preferredRunCodeLines.length > 0
    ? preferredRunCodeLines
    : uniqueText([
        ...args.reasoningSteps,
        ...streamSignalSnapshot.toolSignals,
        ...streamSignalSnapshot.selectedSignals,
      ])
        .filter(line => /\b(execute_python|execute_command|tool_call:|run[_\s-]?code|python|command)\b/i.test(line))
        .slice(0, 14)
  const rawProjectionLines = extractRelevantMarkdownPreviewLines({
    value: String(args.rawAssistantText || '').trim(),
    requestText: queryText,
    maxCount: 10,
  })
  const relatedUrls = uniqueText([
    ...(Array.isArray(args.preferredSourceLinks) ? args.preferredSourceLinks : []),
    args.artifact.url,
    ...args.observedUrls.filter(url => url === args.artifact.url || isReportShareUrl(url)),
    ...streamSignalSnapshot.sourceUrls,
  ]).slice(0, 12)
  const workspaceOutputLines =
    Array.isArray(args.preferredWorkspaceOutputLines) && args.preferredWorkspaceOutputLines.length > 0
      ? uniqueText(args.preferredWorkspaceOutputLines).slice(0, 10)
      : (String(args.workspaceAssistantText || '').trim()
        ? extractRelevantMarkdownPreviewLines({
            value: String(args.workspaceAssistantText || ''),
            requestText: queryText,
            maxCount: 10,
          })
        : [])
  const streamAlignedOutputLines =
    Array.isArray(args.preferredStreamAlignedOutputLines) && args.preferredStreamAlignedOutputLines.length > 0
      ? uniqueText(args.preferredStreamAlignedOutputLines).slice(0, 10)
      : rawProjectionLines
  const relatedArtifactLines = uniqueText([
    ...(Array.isArray(args.preferredRelatedArtifactLines) ? args.preferredRelatedArtifactLines : []),
    ...(String(args.bundle.streamLogPath || '').trim() ? [`- Session Log: [chat-stream-log](${String(args.bundle.streamLogPath || '').trim()})`] : []),
    ...args.reportDocuments.map((report, index) => `- Session Report ${index + 1}: [${report.path.split('/').pop() || `report-${index + 1}`} ](${report.path})`.replace(' ]', ']')),
    `- Session Dereferenced Markdown: [${args.artifact.fileName}](${args.artifact.workspacePath})`,
  ])
  const nodes: ArtifactNode[] = [
    {
      id: `${documentId}:share`,
      type: 'panel',
      label: `${args.artifact.exportToken} Share`,
      stage: 'Reports',
      summary: clampText(args.artifact.url, 180),
      href: args.artifact.url,
      order: 1,
      references: [args.artifact.url, args.artifact.exportMarkdownPath],
    },
    {
      id: `${documentId}:trace`,
      type: 'beat',
      label: 'Execution Trace',
      stage: 'Observability',
      summary: `${traceHighlights.length} summarized search/tool trace signals.`,
      order: 2,
    },
  ]
  const edges: ArtifactEdge[] = [
    { id: `${documentId}:share-trace`, source: `${documentId}:share`, target: `${documentId}:trace`, label: 'observed-by' },
  ]
  return [
    buildArtifactFrontmatter({
      documentId,
      documentTitle: `${args.artifact.exportToken} Thinking Trace`,
      nodes,
      edges,
    }),
    `# ${args.artifact.exportToken} Thinking Trace`,
    '',
    `- Share URL: ${args.artifact.url}`,
    `- Canonical Markdown: [${args.artifact.exportToken}.md](${args.artifact.exportMarkdownPath})`,
    `- Session: \`${args.bundle.sessionId}\``,
    `- Trace: \`${args.traceId}\``,
    `- Created: ${formatReadableUtc(args.timestampMs)}`,
    `- Provider: ${args.providerSummary || 'unknown'}`,
    `- Model: ${args.modelId || 'unknown'}`,
    `- Status: ${args.status}`,
    `- Finish: ${args.finishReason || 'pending'}`,
    `- Usage: ${args.usageSummary || 'unavailable'}`,
    '',
    String(args.summaryText || '').trim() || 'Execution trace summary derived from streamed search/tool signals and workspace-aligned output.',
    '',
    '## Prompt',
    '',
    wrapFence(promptText, 'markdown'),
    '',
    '## Query Relevance',
    '',
    `- Intent: ${queryRelevance.intent}`,
    `- Focus: ${queryRelevance.focus}`,
    `- Requested Sections: ${queryRelevance.requestedSections.length > 0 ? queryRelevance.requestedSections.join(', ') : 'none explicitly requested'}`,
    `- Named Terms: ${queryRelevance.namedTerms.length > 0 ? queryRelevance.namedTerms.join(', ') : 'none extracted'}`,
    '',
    '## Thinking Trajectory',
    '',
    ...(trajectoryLines.length > 0
      ? trajectoryLines.map(line => `- ${line}`)
      : ['- No trajectory milestones were extracted from the streamed JSON trace.']),
    '',
    '## Thinking Process',
    '',
    ...(traceHighlights.length > 0
      ? traceHighlights.map(line => `- ${line}`)
      : ['- No explicit reasoning, search, or tool trace lines were captured for this share artifact.']),
    '',
    '## Searching For',
    '',
    ...(searchLines.length > 0
      ? searchLines.map(line => `- ${line}`)
      : ['- No explicit search or fetch-url signals were captured.']),
    '',
    '## Run Code',
    '',
    ...(runCodeLines.length > 0
      ? runCodeLines.map(line => `- ${line}`)
      : ['- No run-code, execute-command, execute-python, or tool-call execution signals were captured.']),
    '',
    '## Workspace Output Snapshot',
    '',
    ...(workspaceOutputLines.length > 0 ? workspaceOutputLines.map(line => `- ${line}`) : ['- Workspace output unavailable.']),
    '',
    '## Stream-Aligned Output',
    '',
    ...(streamAlignedOutputLines.length > 0
      ? streamAlignedOutputLines.map(line => `- ${line}`)
      : ['- No stream-aligned markdown projection lines were extracted.']),
    '',
    '## Source Links',
    '',
    ...(relatedUrls.length > 0 ? relatedUrls.map(url => `- ${url}`) : ['- No source URLs captured.']),
    '',
    '## Related Artifacts',
    '',
    ...relatedArtifactLines,
    '',
    '## Finalization',
    '',
    'Now I can write the final answer.',
    '',
  ].join('\n')
}
