import { getChatHistoryStorageKey } from '@/lib/config'
import type { GraphData } from '@/lib/graph/types'
import type { ChatMessage } from './SidePanelChatSections'

export const clampTemperature = (raw: unknown): number => {
  const t = Number(raw)
  if (!Number.isFinite(t)) return 0.3
  if (t < 0) return 0
  if (t > 2) return 2
  return t
}

export const toShortId = (): string => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const parseLine = (raw: unknown): number | null => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const buildHistoryKey = (graphData: GraphData | null): string => {
  const meta = graphData?.metadata || null
  const getString = (k: string) => {
    const raw = meta ? meta[k] : null
    return typeof raw === 'string' ? raw.trim() : ''
  }
  const idish =
    getString('graphId') ||
    getString('id') ||
    getString('source') ||
    getString('path') ||
    getString('dataset') ||
    getString('name')
  const fallback = (() => {
    if (!graphData) return 'empty'
    const nodes = Array.isArray(graphData.nodes) ? graphData.nodes.length : 0
    const edges = Array.isArray(graphData.edges) ? graphData.edges.length : 0
    const type = typeof graphData.type === 'string' ? graphData.type : 'graph'
    return `${type}:${nodes}:${edges}`
  })()
  return getChatHistoryStorageKey(idish || fallback)
}

export const parseSseEvents = (buffer: string): { events: string[]; rest: string } => {
  const lines = buffer.split(/\r?\n/)
  const rest = lines.pop() || ''
  const events: string[] = []
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line.startsWith('data:')) continue
    const payload = line.slice('data:'.length).trim()
    if (!payload) continue
    events.push(payload)
  }
  return { events, rest }
}

export const extractAssistantDelta = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') return ''
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return ''
  const first = choices[0] as { delta?: { content?: unknown }; message?: { content?: unknown } } | null
  const delta = first?.delta && typeof first.delta.content === 'string' ? String(first.delta.content) : ''
  const direct = first?.message && typeof first.message.content === 'string' ? String(first.message.content) : ''
  return delta || direct || ''
}

export const parseErrorBody = async (res: Response): Promise<string> => {
  const contentType = String(res.headers.get('content-type') || '').toLowerCase()
  try {
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as {
        error?: { message?: unknown } | string
        message?: unknown
      }
      if (data && typeof data.error === 'object' && data.error && typeof data.error.message === 'string') {
        return data.error.message.trim()
      }
      if (typeof data?.error === 'string') return data.error.trim()
      if (typeof data?.message === 'string') return data.message.trim()
      return ''
    }
    const text = await res.text()
    return String(text || '').trim()
  } catch {
    return ''
  }
}

export const shouldRetryWithModelFallback = (status: number, detail: string): boolean => {
  if (status !== 400 && status !== 404) return false
  const lowered = String(detail || '').toLowerCase()
  if (!lowered) return false
  if (!lowered.includes('model')) return false
  if (lowered.includes('not found')) return true
  if (lowered.includes('does not exist')) return true
  if (lowered.includes('unknown')) return true
  if (lowered.includes('invalid')) return true
  if (lowered.includes('load')) return true
  return false
}

export const loadAvailableModelIds = async (
  endpoint: string,
  headers?: HeadersInit,
): Promise<string[]> => {
  const res = await fetch(endpoint, {
    method: 'GET',
    headers,
  })
  if (!res.ok) return []
  const data = (await res.json()) as { data?: unknown }
  const list = Array.isArray(data?.data) ? data.data : []
  const ids = list
    .map(entry => {
      if (!entry || typeof entry !== 'object') return ''
      const id = (entry as { id?: unknown }).id
      return typeof id === 'string' ? id.trim() : ''
    })
    .filter(Boolean)
  if (!ids.length) return []
  const seen = new Set<string>()
  const out: string[] = []
  ids.forEach(id => {
    if (seen.has(id)) return
    seen.add(id)
    out.push(id)
  })
  return out
}

export const CHAT_HISTORY_COALESCE_DELAY_MS = 220

export const extractKgcBlockFromAssistantText = (
  raw: string,
): { answer: string; kgc: string | null } => {
  const text = String(raw || '').replace(/\r\n/g, '\n')
  const rx = /(^|\n)\s*```+kgc\s*\n([\s\S]*?)\n\s*```+/gi
  const matches: Array<{ full: string; body: string }> = []
  let m: RegExpExecArray | null
  while ((m = rx.exec(text))) {
    const full = String(m[0] || '')
    const body = typeof m[2] === 'string' ? String(m[2] || '').trim() : ''
    if (full && body) matches.push({ full, body })
    if (matches.length > 2) break
  }
  if (matches.length !== 1) {
    return { answer: text.trim(), kgc: null }
  }
  const match = matches[0]
  const answer = text.replace(match.full, '').trim()
  return { answer, kgc: match.body }
}
const CHAT_HISTORY_CACHE_LIMIT = 80
const chatHistoryCache = new Map<string, ChatMessage[]>()

export const getCachedChatHistory = (key: string): ChatMessage[] | null => {
  const v = chatHistoryCache.get(String(key || ''))
  return Array.isArray(v) ? v : null
}

export const putChatHistoryCache = (key: string, value: ChatMessage[]): void => {
  if (!key) return
  if (chatHistoryCache.has(key)) {
    chatHistoryCache.delete(key)
  }
  chatHistoryCache.set(key, value)
  if (chatHistoryCache.size <= CHAT_HISTORY_CACHE_LIMIT) return
  const oldestKey = chatHistoryCache.keys().next().value
  if (typeof oldestKey === 'string' && oldestKey) {
    chatHistoryCache.delete(oldestKey)
  }
}

export const toHistoryTaskKey = (historyKey: string): string => {
  const safe = String(historyKey || '').trim() || 'default'
  return `chat:history:persist:${safe}`
}

export const persistChatExchangeLog = async (payload: {
  request: string
  response: string
  status: 'ok' | 'error' | 'aborted'
  model: string
  timestampMs: number
}): Promise<void> => {
  try {
    await fetch('/__chat_log_append', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    void 0
  }
}

export const toConciseBulletText = (raw: string, maxWords = 50): string => {
  const cleaned = String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/````[\s\S]*?````/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/[#>*_`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = cleaned.split(' ').filter(Boolean)
  if (words.length === 0) return 'No response content.'
  const sliced = words.slice(0, Math.max(1, maxWords))
  const suffix = words.length > sliced.length ? '…' : ''
  return `${sliced.join(' ')}${suffix}`
}

export const scoreFallbackCandidate = (raw: string): number => {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim()
  if (!text) return -1_000
  if (text.includes('Previous invalid KGC attempt was omitted')) return -900
  const looksLikeStructuredArtifact =
    text.includes('# ── DOCUMENT IDENTITY') ||
    text.includes('# ── NODES') ||
    text.includes('# ── FLOW EDITOR') ||
    (/@node:|@edge:/.test(text) && !/^##\s+/m.test(text))
  if (looksLikeStructuredArtifact) return -850
  const words = text.split(/\s+/).filter(Boolean).length
  const headings = (text.match(/^#{2,4}\s+/gm) || []).length
  const bullets = (text.match(/^\s*[-*]\s+/gm) || []).length
  const hasKgcFence = /```+\s*kgc\b/i.test(text)
  const hasEscapedKgc = /\\`\\`\\`\s*kgc\b/i.test(text)
  const hasResidualArtifact = /\n\s*kgc\s*\n/i.test(`\n${text}\n`) || text.includes('\\---')
  let score = words + headings * 24 + bullets * 4
  if (hasKgcFence) score -= 120
  if (hasEscapedKgc) score -= 80
  if (hasResidualArtifact) score -= 60
  return score
}

export const pickBestErrorFallbackSource = (args: {
  rawAssistantText: string
  extractedAnswer: string
  extractedKgc: string | null
  fallbackNote: string
}): string => {
  const candidates = [
    String(args.rawAssistantText || ''),
    String(args.extractedAnswer || ''),
    String(args.fallbackNote || ''),
  ]
  let best = ''
  let bestScore = -Infinity
  for (const candidate of candidates) {
    const score = scoreFallbackCandidate(candidate)
    if (score <= bestScore) continue
    best = candidate
    bestScore = score
  }
  return best || args.fallbackNote
}
