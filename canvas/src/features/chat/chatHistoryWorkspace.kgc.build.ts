import { buildDeterministicBaseTemplateKgcTurn } from './chatHistoryWorkspace.kgc.baseFallback'
import { isKgcStructuredMarkdown } from './chatHistoryWorkspace.kgc.parse'
import { enforceKgcQueryResponsiveContent } from './chatHistoryWorkspace.kgc.normalize'

type KgcStorageNormalizeArgs = {
  timestampMs: number
  workspacePath?: string
  requestText: string
  assistantText: string
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

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
  return [`${ticks}${safeLang}`, safe, ticks].join('\n')
}

export const normalizeKgcAssistantBodyForStorage = (args: KgcStorageNormalizeArgs): string => {
  const raw = String(args.assistantText || '').replace(/\r\n/g, '\n').trim()
  if (raw && isKgcStructuredMarkdown(raw)) {
    return enforceKgcQueryResponsiveContent({
      markdown: raw,
      requestText: args.requestText,
      workspacePath: args.workspacePath,
    })
  }
  const fileName = String(args.workspacePath || '').split('/').filter(Boolean).slice(-1)[0] || ''
  const fallback = buildDeterministicBaseTemplateKgcTurn({
    timestampMs: args.timestampMs,
    fileName,
    requestText: args.requestText,
    assistantText: args.assistantText,
  })
  return enforceKgcQueryResponsiveContent({
    markdown: fallback,
    requestText: args.requestText,
    workspacePath: args.workspacePath,
  })
}

export const buildKgcWorkspaceDocument = (args: {
  canonicalKgc: string
  historyBody?: string
}): string => {
  const canonical = String(args.canonicalKgc || '').replace(/\r\n/g, '\n').trim()
  return `${canonical.trimEnd()}\n`
}

export const buildKgcDraftEntry = (args: {
  timestampMs: number
  traceId: string
  providerSummary: string
  userText: string
  assistantText: string
}): string => {
  const heading = `## ${formatReadableTimestamp(args.timestampMs)} (in progress)`
  const assistantMarkdown = String(args.assistantText || '_Streaming..._').replace(/\r\n/g, '\n').trim() || '_Streaming..._'
  return [
    `<!-- kg-chat-draft:start:${args.traceId} -->`,
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
    wrapFence(assistantMarkdown, 'markdown'),
    `<!-- kg-chat-draft:end:${args.traceId} -->`,
  ].join('\n')
}
