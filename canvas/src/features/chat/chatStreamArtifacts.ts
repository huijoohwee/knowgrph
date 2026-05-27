import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { fetchWorkspaceUrlContent } from '@/features/markdown-workspace/workspaceImport/urlContent'
import { CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT } from './chatStorageConfig'
import { extractKgcWorkspaceSessionId, formatKgcWorkspaceSessionId } from './chatHistoryWorkspace.paths'
import { ensureWorkspaceFolderPathExists, writeWorkspaceFileTextEnsuringFile } from './chatWorkspaceFsWrite'
import {
  persistDereferencedChatStreamArtifacts,
  type DereferencedChatStreamArtifact,
} from './chatStreamArtifactDereference'

const REPORT_SHARE_HINT_RX = /\/(?:report\/)?share\//i

const pad2 = (value: number): string => String(value).padStart(2, '0')

const toYamlScalar = (value: unknown): string => {
  return JSON.stringify(String(value ?? ''))
}

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

export const formatChatStreamArtifactSessionId = (timestampMs: number): string => {
  return formatKgcWorkspaceSessionId(timestampMs)
}

const readSessionIdFromWorkspacePath = (workspacePath: string | null | undefined): string | null => {
  const raw = String(workspacePath || '').trim()
  if (!raw) return null
  return extractKgcWorkspaceSessionId(normalizeWorkspacePath(raw))
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

type ArtifactNode = {
  id: string
  type: string
  label: string
  stage: string
  summary: string
  order: number
  prompt?: string
  action?: string
  href?: string
  tags?: string[]
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
  if (node.prompt) lines.push(`      prompt: ${toYamlScalar(node.prompt)}`)
  if (node.action) lines.push(`      action: ${toYamlScalar(node.action)}`)
  if (node.href) lines.push(`      href: ${toYamlScalar(node.href)}`)
  if (node.tags && node.tags.length > 0) {
    lines.push('      tags:')
    node.tags.forEach(tag => {
      lines.push(`        - ${toYamlScalar(tag)}`)
    })
  }
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

type ChatStreamArtifactBundle = {
  sessionId: string
  folderPath: string
  streamLogPath: string
  streamReportPath: string
}

export const resolveChatStreamArtifactBundle = (args: {
  workspacePath?: string | null
  timestampMs: number
  defaultLocalRootPath: string
}): ChatStreamArtifactBundle => {
  const sessionId = readSessionIdFromWorkspacePath(args.workspacePath) || formatChatStreamArtifactSessionId(args.timestampMs)
  const rootPath = normalizeWorkspacePath(String(args.defaultLocalRootPath || '').trim() || CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT)
  const folderPath = normalizeWorkspacePath(`${rootPath === '/' ? '' : rootPath}/${sessionId}`)
  return {
    sessionId,
    folderPath,
    streamLogPath: normalizeWorkspacePath(`${folderPath}/chat-stream-log_${sessionId}.md`),
    streamReportPath: normalizeWorkspacePath(`${folderPath}/chat-stream-report_${sessionId}.md`),
  }
}

const buildPlaceholderArtifactText = (args: {
  kind: 'log' | 'report'
  bundle: ChatStreamArtifactBundle
  timestampMs: number
}): string => {
  const title = args.kind === 'log' ? 'Chat Stream Log' : 'Chat Stream Report'
  const documentId = `${args.kind}:${args.bundle.sessionId}`
  const nodes: ArtifactNode[] = [
    {
      id: `${documentId}:session`,
      type: 'story',
      label: `Chat Session ${args.bundle.sessionId}`,
      stage: 'Lineage',
      summary: 'New Chat session artifact bundle prepared in workspace Source Files.',
      order: 1,
      tags: ['chat', 'session', args.kind],
    },
    {
      id: `${documentId}:artifact`,
      type: 'panel',
      label: title,
      stage: args.kind === 'log' ? 'Observability' : 'Reports',
      summary: 'Awaiting stream output.',
      order: 2,
    },
  ]
  const edges: ArtifactEdge[] = [
    {
      id: `${documentId}:session-artifact`,
      source: `${documentId}:session`,
      target: `${documentId}:artifact`,
      label: 'prepares',
    },
  ]
  return [
    buildArtifactFrontmatter({
      documentId,
      documentTitle: `${title} ${args.bundle.sessionId}`,
      nodes,
      edges,
    }),
    `# ${title}`,
    '',
    `- Session: \`${args.bundle.sessionId}\``,
    `- Created: ${formatReadableUtc(args.timestampMs)}`,
    '',
    'Artifact placeholder created by FloatingPanel Chat New Chat.',
    '',
  ].join('\n')
}

export const ensureChatStreamArtifactBundleInitialized = async (args: {
  workspacePath?: string | null
  timestampMs: number
  defaultLocalRootPath: string
}): Promise<ChatStreamArtifactBundle> => {
  const bundle = resolveChatStreamArtifactBundle(args)
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  await ensureWorkspaceFolderPathExists(bundle.folderPath)
  const seedTargets = [
    { path: bundle.streamLogPath, kind: 'log' as const },
    { path: bundle.streamReportPath, kind: 'report' as const },
  ]
  for (const target of seedTargets) {
    const existing = await fs.readFileText(target.path)
    if (existing !== null) continue
    await writeWorkspaceFileTextEnsuringFile({
      fs,
      path: target.path,
      text: buildPlaceholderArtifactText({
        kind: target.kind,
        bundle,
        timestampMs: args.timestampMs,
      }),
    })
  }
  return bundle
}

const buildStreamLogDocument = (args: {
  bundle: ChatStreamArtifactBundle
  timestampMs: number
  traceId: string
  providerSummary: string
  modelId: string | null
  requestText: string
  rawAssistantText: string
  usageSummary: string | null
  finishReason: string | null
  reasoningSteps: string[]
  rawSseEvents: string[]
  status: 'ok' | 'error'
  observedUrls: string[]
  dereferencedArtifacts: DereferencedChatStreamArtifact[]
}): string => {
  const documentId = `stream-log:${args.bundle.sessionId}:${toSlug(args.traceId) || 'trace'}`
  const nodes: ArtifactNode[] = [
    {
      id: `${documentId}:session`,
      type: 'story',
      label: `Chat Session ${args.bundle.sessionId}`,
      stage: 'Lineage',
      summary: `${args.providerSummary || 'Provider pending'} streamed JSON SSE chunks into workspace artifacts.`,
      order: 1,
      tags: ['chat', 'session', 'stream-log'],
    },
    {
      id: `${documentId}:prompt`,
      type: 'beat',
      label: 'Prompt Contract',
      stage: 'Lineage',
      summary: clampText(args.requestText, 180) || 'Prompt unavailable.',
      prompt: clampText(args.requestText, 400) || 'Prompt unavailable.',
      order: 2,
    },
    {
      id: `${documentId}:stream`,
      type: 'panel',
      label: 'SSE Stream',
      stage: 'Observability',
      summary: `${args.rawSseEvents.length} JSON chunk${args.rawSseEvents.length === 1 ? '' : 's'} observed.`,
      action: clampText([args.usageSummary, args.finishReason ? `finish ${args.finishReason}` : null].filter(Boolean).join(' · '), 240),
      order: 3,
      tags: ['sse', 'json', args.status],
    },
  ]
  const edges: ArtifactEdge[] = [
    { id: `${documentId}:session-prompt`, source: `${documentId}:session`, target: `${documentId}:prompt`, label: 'prompts' },
    { id: `${documentId}:prompt-stream`, source: `${documentId}:prompt`, target: `${documentId}:stream`, label: 'streams' },
  ]
  args.observedUrls.slice(0, 8).forEach((url, index) => {
    const nodeId = `${documentId}:url:${index + 1}`
    nodes.push({
      id: nodeId,
      type: 'panel',
      label: `Observed URL ${index + 1}`,
      stage: isReportShareUrl(url) ? 'Reports' : 'References',
      summary: clampText(url, 180),
      href: url,
      order: 10 + index,
      references: [url],
    })
    edges.push({
      id: `${documentId}:stream-url:${index + 1}`,
      source: `${documentId}:stream`,
      target: nodeId,
      label: isReportShareUrl(url) ? 'publishes' : 'references',
    })
  })
  args.dereferencedArtifacts.slice(0, 8).forEach((artifact, index) => {
    const nodeId = `${documentId}:dereference:${index + 1}`
    nodes.push({
      id: nodeId,
      type: 'panel',
      label: `Dereferenced Artifact ${index + 1}`,
      stage: 'Reports',
      summary: clampText(artifact.fileName, 180),
      href: artifact.url,
      order: 30 + index,
      references: [artifact.url, artifact.workspacePath],
    })
    edges.push({
      id: `${documentId}:stream-dereference:${index + 1}`,
      source: `${documentId}:stream`,
      target: nodeId,
      label: 'dereferences',
    })
  })
  return [
    buildArtifactFrontmatter({
      documentId,
      documentTitle: `Chat Stream Log ${args.bundle.sessionId}`,
      nodes,
      edges,
    }),
    '# Chat Stream Log',
    '',
    `- Session: \`${args.bundle.sessionId}\``,
    `- Trace: \`${args.traceId}\``,
    `- Created: ${formatReadableUtc(args.timestampMs)}`,
    `- Provider: ${args.providerSummary || 'unknown'}`,
    `- Model: ${args.modelId || 'unknown'}`,
    `- Status: ${args.status}`,
    `- Finish: ${args.finishReason || 'pending'}`,
    `- Usage: ${args.usageSummary || 'unavailable'}`,
    `- Reasoning Steps: ${args.reasoningSteps.length}`,
    '',
    '## Prompt',
    '',
    wrapFence(String(args.requestText || '').trim() || 'Prompt unavailable.', 'markdown'),
    '',
    '## Final Assistant Text',
    '',
    wrapFence(String(args.rawAssistantText || '').trim() || 'Assistant text unavailable.', 'markdown'),
    '',
    '## SSE JSON Chunks',
    '',
    args.rawSseEvents.length > 0
      ? args.rawSseEvents.map((event, index) => [
          `### Chunk ${index + 1}`,
          '',
          wrapFence(event, 'json'),
          '',
        ].join('\n')).join('')
      : 'No SSE JSON chunks captured.',
    '',
    '## Dereferenced Workspace Artifacts',
    '',
    args.dereferencedArtifacts.length > 0
      ? args.dereferencedArtifacts.map(artifact => `- [${artifact.fileName}](${artifact.workspacePath}) ← ${artifact.url}`).join('\n')
      : 'No eligible share/report URLs were dereferenced.',
    '',
  ].join('\n')
}

const buildStreamReportDocument = (args: {
  bundle: ChatStreamArtifactBundle
  timestampMs: number
  traceId: string
  providerSummary: string
  modelId: string | null
  requestText: string
  rawAssistantText: string
  usageSummary: string | null
  finishReason: string | null
  reasoningSteps: string[]
  status: 'ok' | 'error'
  reportUrl: string | null
  reportIndex: number
  reportCount: number
  observedUrls: string[]
  dereferencedArtifacts: DereferencedChatStreamArtifact[]
}): string => {
  const suffix = args.reportCount > 1 ? `-${args.reportIndex + 1}` : ''
  const documentId = `stream-report${suffix}:${args.bundle.sessionId}:${toSlug(args.traceId) || 'trace'}`
  const reportLabel =
    args.reportCount > 1
      ? `Chat Stream Report ${args.reportIndex + 1}`
      : 'Chat Stream Report'
  const nodes: ArtifactNode[] = [
    {
      id: `${documentId}:session`,
      type: 'story',
      label: `Chat Session ${args.bundle.sessionId}`,
      stage: 'Lineage',
      summary: `${args.providerSummary || 'Provider pending'} finalized a stream-derived markdown report.`,
      order: 1,
      tags: ['chat', 'session', 'stream-report'],
    },
    {
      id: `${documentId}:report`,
      type: 'panel',
      label: reportLabel,
      stage: 'Reports',
      summary: clampText(args.rawAssistantText, 180) || 'Stream-derived report content pending.',
      action: clampText([args.usageSummary, args.finishReason ? `finish ${args.finishReason}` : null].filter(Boolean).join(' · '), 240),
      href: args.reportUrl || undefined,
      order: 2,
      references: args.reportUrl ? [args.reportUrl] : undefined,
    },
    {
      id: `${documentId}:observability`,
      type: 'beat',
      label: 'Observability',
      stage: 'Observability',
      summary: `Reasoning steps ${args.reasoningSteps.length}; ${args.usageSummary || 'usage unavailable'}`,
      order: 3,
    },
  ]
  const edges: ArtifactEdge[] = [
    { id: `${documentId}:session-report`, source: `${documentId}:session`, target: `${documentId}:report`, label: 'publishes' },
    { id: `${documentId}:report-observability`, source: `${documentId}:report`, target: `${documentId}:observability`, label: 'observed-by' },
  ]
  args.observedUrls.slice(0, 8).forEach((url, index) => {
    const nodeId = `${documentId}:reference:${index + 1}`
    nodes.push({
      id: nodeId,
      type: 'panel',
      label: isReportShareUrl(url) ? `Shared Artifact ${index + 1}` : `Reference ${index + 1}`,
      stage: isReportShareUrl(url) ? 'Reports' : 'References',
      summary: clampText(url, 180),
      href: url,
      order: 10 + index,
      references: [url],
    })
    edges.push({
      id: `${documentId}:report-reference:${index + 1}`,
      source: `${documentId}:report`,
      target: nodeId,
      label: isReportShareUrl(url) ? 'shares' : 'references',
    })
  })
  args.dereferencedArtifacts.slice(0, 8).forEach((artifact, index) => {
    const nodeId = `${documentId}:dereferenced:${index + 1}`
    nodes.push({
      id: nodeId,
      type: 'panel',
      label: `Dereferenced Markdown ${index + 1}`,
      stage: 'Reports',
      summary: clampText(artifact.fileName, 180),
      href: artifact.url,
      order: 30 + index,
      references: [artifact.url, artifact.workspacePath],
    })
    edges.push({
      id: `${documentId}:report-dereference:${index + 1}`,
      source: `${documentId}:report`,
      target: nodeId,
      label: 'dereferences',
    })
  })
  return [
    buildArtifactFrontmatter({
      documentId,
      documentTitle: `${reportLabel} ${args.bundle.sessionId}`,
      nodes,
      edges,
    }),
    `# ${reportLabel}`,
    '',
    `- Session: \`${args.bundle.sessionId}\``,
    `- Trace: \`${args.traceId}\``,
    `- Created: ${formatReadableUtc(args.timestampMs)}`,
    `- Provider: ${args.providerSummary || 'unknown'}`,
    `- Model: ${args.modelId || 'unknown'}`,
    `- Status: ${args.status}`,
    `- Finish: ${args.finishReason || 'pending'}`,
    `- Usage: ${args.usageSummary || 'unavailable'}`,
    '',
    ...(args.reportUrl ? ['## Share URL', '', `- ${args.reportUrl}`, ''] : []),
    '## Dereferenced Workspace Artifacts',
    '',
    args.dereferencedArtifacts.length > 0
      ? args.dereferencedArtifacts.map(artifact => `- [${artifact.fileName}](${artifact.workspacePath}) ← ${artifact.url}`).join('\n')
      : 'No eligible share/report URLs were dereferenced.',
    '',
    '## Prompt',
    '',
    wrapFence(String(args.requestText || '').trim() || 'Prompt unavailable.', 'markdown'),
    '',
    '## Stream-Derived Report',
    '',
    wrapFence(String(args.rawAssistantText || '').trim() || 'Report content unavailable.', 'markdown'),
    '',
  ].join('\n')
}

const toReportPath = (bundle: ChatStreamArtifactBundle, reportIndex: number, reportCount: number): string => {
  if (reportCount <= 1 || reportIndex === 0) return bundle.streamReportPath
  const ordinal = String(reportIndex + 1).padStart(2, '0')
  return normalizeWorkspacePath(`${bundle.folderPath}/chat-${ordinal}-stream-report_${bundle.sessionId}.md`)
}

export const persistChatStreamArtifacts = async (args: {
  workspacePath?: string | null
  timestampMs: number
  defaultLocalRootPath: string
  traceId: string
  providerSummary: string
  modelId: string | null
  requestText: string
  rawAssistantText: string
  usageSummary: string | null
  finishReason: string | null
  reasoningSteps: string[]
  rawSseEvents: string[]
  status: 'ok' | 'error'
  fetchUrlContent?: typeof fetchWorkspaceUrlContent
}): Promise<ChatStreamArtifactBundle> => {
  const bundle = await ensureChatStreamArtifactBundleInitialized({
    workspacePath: args.workspacePath,
    timestampMs: args.timestampMs,
    defaultLocalRootPath: args.defaultLocalRootPath,
  })
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const observedUrls = extractUniqueUrls([args.rawAssistantText, ...args.rawSseEvents])
  const reportUrls = observedUrls.filter(isReportShareUrl)
  const dereferencedArtifacts = await persistDereferencedChatStreamArtifacts({
    folderPath: bundle.folderPath,
    urls: observedUrls,
    fetchUrlContent: args.fetchUrlContent,
  })
  const logText = buildStreamLogDocument({
    bundle,
    timestampMs: args.timestampMs,
    traceId: args.traceId,
    providerSummary: args.providerSummary,
    modelId: args.modelId,
    requestText: args.requestText,
    rawAssistantText: args.rawAssistantText,
    usageSummary: args.usageSummary,
    finishReason: args.finishReason,
    reasoningSteps: args.reasoningSteps,
    rawSseEvents: args.rawSseEvents,
    status: args.status,
    observedUrls,
    dereferencedArtifacts,
  })
  await writeWorkspaceFileTextEnsuringFile({ fs, path: bundle.streamLogPath, text: logText })

  const reportCount = Math.max(1, reportUrls.length)
  for (let i = 0; i < reportCount; i += 1) {
    const reportPath = toReportPath(bundle, i, reportCount)
    const reportText = buildStreamReportDocument({
      bundle,
      timestampMs: args.timestampMs,
      traceId: args.traceId,
      providerSummary: args.providerSummary,
      modelId: args.modelId,
      requestText: args.requestText,
      rawAssistantText: args.rawAssistantText,
      usageSummary: args.usageSummary,
      finishReason: args.finishReason,
      reasoningSteps: args.reasoningSteps,
      status: args.status,
      reportUrl: reportUrls[i] || null,
      reportIndex: i,
      reportCount,
      observedUrls,
      dereferencedArtifacts,
    })
    await writeWorkspaceFileTextEnsuringFile({ fs, path: reportPath, text: reportText })
  }
  return bundle
}
