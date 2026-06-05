import { getChatHistoryStorageKey } from '@/lib/config'
import type { JSONValue } from '@/lib/graph/types'
import type { GraphData } from '@/lib/graph/types'
import {
  CHAT_PROVIDER_AGNES,
  CHAT_PROVIDER_BYTEPLUS,
  CHAT_PROVIDER_GOOGLE_CLOUD,
  CHAT_PROVIDER_MIROMIND,
  CHAT_PROVIDER_OPENAI,
  CHAT_PROVIDER_QWEN,
  isResponsesEndpointUrl,
  normalizeChatProviderId,
} from '@/lib/chatEndpoint'
import { recoverStructuredKgcAssistantPayload } from './chatHistoryWorkspace.kgc.recovery'
import { extractAssistantContentText, isObjectRecord } from './assistantContentText'
import type { ChatMessage } from './FloatingPanelChatSections'

export const clampTemperature = (raw: unknown): number => {
  const t = Number(raw)
  if (!Number.isFinite(t)) return 0.3
  if (t < 0) return 0
  if (t > 2) return 2
  return t
}

const clampBytePlusPenalty = (raw: unknown): number => {
  const next = Number(raw)
  if (!Number.isFinite(next)) return 0
  if (next < -2) return -2
  if (next > 2) return 2
  return next
}

const clampBytePlusTopP = (raw: unknown): number => {
  const next = Number(raw)
  if (!Number.isFinite(next)) return 0.7
  if (next < 0) return 0
  if (next > 1) return 1
  return next
}

const clampBytePlusTopLogprobs = (raw: unknown): number => {
  const next = Math.floor(Number(raw))
  if (!Number.isFinite(next)) return 0
  if (next < 0) return 0
  if (next > 20) return 20
  return next
}

const normalizeBytePlusServiceTier = (raw: unknown): 'auto' | 'default' => {
  return String(raw || '').trim().toLowerCase() === 'default' ? 'default' : 'auto'
}

const normalizeBytePlusReasoningEffort = (raw: unknown): 'minimal' | 'low' | 'medium' | 'high' => {
  const next = String(raw || '').trim().toLowerCase()
  if (next === 'low' || next === 'medium' || next === 'high') return next
  return 'minimal'
}

const normalizeBytePlusThinkingType = (raw: unknown): 'enabled' | 'disabled' => {
  const next = String(raw || '').trim().toLowerCase()
  return next === 'enabled' ? 'enabled' : 'disabled'
}

const coerceBooleanFlag = (raw: unknown, fallback: boolean): boolean => {
  if (typeof raw === 'boolean') return raw
  const next = String(raw || '').trim().toLowerCase()
  if (!next) return fallback
  if (next === 'false' || next === '0' || next === 'no' || next === 'off') return false
  if (next === 'true' || next === '1' || next === 'yes' || next === 'on') return true
  return fallback
}

export const buildProviderChatRequestOptions = (args: {
  provider: unknown
  endpointUrl?: unknown
  chatModel?: unknown
  chatTemperature: unknown
  chatServiceTier: unknown
  chatStream: unknown
  chatMessagesJson: unknown
  chatReasoningEffort: unknown
  chatThinkingType: unknown
  chatThinkingJson: unknown
  chatFrequencyPenalty: unknown
  chatPresencePenalty: unknown
  chatTopP: unknown
  chatLogprobs: unknown
  chatTopLogprobs: unknown
  chatParallelToolCalls: unknown
  chatStopJson: unknown
  chatStreamOptionsJson: unknown
  chatResponseFormatJson: unknown
  chatLogitBiasJson: unknown
  chatToolsJson: unknown
  chatToolChoiceJson: unknown
}): Record<string, unknown> => {
  const modelId = typeof args.chatModel === 'string' ? args.chatModel.trim() : ''
  const isGpt5Model = modelId ? /^gpt-5(?:[.-]|$)/i.test(modelId) : false
  const provider = normalizeChatProviderId(args.provider)
  const shouldSendTemperature = provider !== CHAT_PROVIDER_OPENAI ? true : !isGpt5Model
  const shouldSendTopP = provider !== CHAT_PROVIDER_OPENAI ? true : !isGpt5Model

  const base: Record<string, unknown> = {
    ...(shouldSendTemperature ? { temperature: clampTemperature(args.chatTemperature) } : {}),
  }
  const isResponsesEndpoint = isResponsesEndpointUrl(args.endpointUrl)

  const parseOptionalJsonConfig = (raw: unknown, fieldName: string, providerLabel: string): JSONValue | undefined => {
    if (typeof raw !== 'string') {
      return typeof raw === 'undefined' ? undefined : (raw as JSONValue)
    }
    const text = raw.trim()
    if (!text) return undefined
    try {
      return JSON.parse(text) as JSONValue
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '')
      throw new Error(`Invalid ${providerLabel} ${fieldName} JSON: ${message || 'parse failed'}`)
    }
  }

  if (provider === CHAT_PROVIDER_BYTEPLUS) {
    const logprobs = coerceBooleanFlag(args.chatLogprobs, false)
    const topLogprobs = clampBytePlusTopLogprobs(args.chatTopLogprobs)
    const thinking = parseOptionalJsonConfig(args.chatThinkingJson, 'thinking', 'BytePlus')
    const messages = parseOptionalJsonConfig(args.chatMessagesJson, 'messages', 'BytePlus')
    const stop = parseOptionalJsonConfig(args.chatStopJson, 'stop', 'BytePlus')
    const streamOptions = parseOptionalJsonConfig(args.chatStreamOptionsJson, 'stream_options', 'BytePlus')
    const responseFormat = parseOptionalJsonConfig(args.chatResponseFormatJson, 'response_format', 'BytePlus')
    const logitBias = parseOptionalJsonConfig(args.chatLogitBiasJson, 'logit_bias', 'BytePlus')
    const tools = parseOptionalJsonConfig(args.chatToolsJson, 'tools', 'BytePlus')
    const toolChoice = parseOptionalJsonConfig(args.chatToolChoiceJson, 'tool_choice', 'BytePlus')
    return {
      ...base,
      ...(typeof messages !== 'undefined' ? { messages } : {}),
      service_tier: normalizeBytePlusServiceTier(args.chatServiceTier),
      reasoning_effort: normalizeBytePlusReasoningEffort(args.chatReasoningEffort),
      thinking: thinking ?? { type: normalizeBytePlusThinkingType(args.chatThinkingType) },
      frequency_penalty: clampBytePlusPenalty(args.chatFrequencyPenalty),
      presence_penalty: clampBytePlusPenalty(args.chatPresencePenalty),
      top_p: clampBytePlusTopP(args.chatTopP),
      logprobs,
      ...(logprobs ? { top_logprobs: topLogprobs } : {}),
      parallel_tool_calls: coerceBooleanFlag(args.chatParallelToolCalls, true),
      ...(typeof stop !== 'undefined' ? { stop } : {}),
      ...(typeof streamOptions !== 'undefined' ? { stream_options: streamOptions } : {}),
      ...(typeof responseFormat !== 'undefined' ? { response_format: responseFormat } : {}),
      ...(typeof logitBias !== 'undefined' ? { logit_bias: logitBias } : {}),
      ...(typeof tools !== 'undefined' ? { tools } : {}),
      ...(typeof toolChoice !== 'undefined' ? { tool_choice: toolChoice } : {}),
      stream: coerceBooleanFlag(args.chatStream, true),
    }
  }

  if (provider === CHAT_PROVIDER_AGNES) {
    const tools = parseOptionalJsonConfig(args.chatToolsJson, 'tools', 'Agnes AI')
    const toolChoice = parseOptionalJsonConfig(args.chatToolChoiceJson, 'tool_choice', 'Agnes AI')
    return {
      ...base,
      top_p: clampBytePlusTopP(args.chatTopP),
      ...(typeof tools !== 'undefined' ? { tools } : {}),
      ...(typeof toolChoice !== 'undefined' ? { tool_choice: toolChoice } : {}),
    }
  }

  if (provider !== CHAT_PROVIDER_OPENAI && provider !== CHAT_PROVIDER_MIROMIND && provider !== CHAT_PROVIDER_QWEN && provider !== CHAT_PROVIDER_GOOGLE_CLOUD) return base

  const providerLabel =
    provider === CHAT_PROVIDER_MIROMIND
      ? 'MiroMind'
      : provider === CHAT_PROVIDER_QWEN
        ? 'Qwen'
        : provider === CHAT_PROVIDER_GOOGLE_CLOUD
          ? 'Google Cloud'
        : 'OpenAI'
  const logprobs = coerceBooleanFlag(args.chatLogprobs, false)
  const topLogprobs = clampBytePlusTopLogprobs(args.chatTopLogprobs)
  const stop = parseOptionalJsonConfig(args.chatStopJson, 'stop', providerLabel)
  const streamOptions = parseOptionalJsonConfig(args.chatStreamOptionsJson, 'stream_options', providerLabel)
  const text = parseOptionalJsonConfig(args.chatResponseFormatJson, 'text', providerLabel)
  const responseFormat = parseOptionalJsonConfig(args.chatResponseFormatJson, 'response_format', providerLabel)
  const logitBias = parseOptionalJsonConfig(args.chatLogitBiasJson, 'logit_bias', providerLabel)
  const tools = parseOptionalJsonConfig(args.chatToolsJson, 'tools', providerLabel)
  const toolChoice = parseOptionalJsonConfig(args.chatToolChoiceJson, 'tool_choice', providerLabel)
  const effort = normalizeBytePlusReasoningEffort(args.chatReasoningEffort)

  const topP = clampBytePlusTopP(args.chatTopP)

  return {
    ...base,
    service_tier: normalizeBytePlusServiceTier(args.chatServiceTier),
    frequency_penalty: clampBytePlusPenalty(args.chatFrequencyPenalty),
    presence_penalty: clampBytePlusPenalty(args.chatPresencePenalty),
    ...(shouldSendTopP ? { top_p: topP } : {}),
    parallel_tool_calls: coerceBooleanFlag(args.chatParallelToolCalls, true),
    ...(typeof stop !== 'undefined' ? { stop } : {}),
    ...(typeof streamOptions !== 'undefined' ? { stream_options: streamOptions } : {}),
    ...(typeof logitBias !== 'undefined' ? { logit_bias: logitBias } : {}),
    ...(typeof tools !== 'undefined' ? { tools } : {}),
    ...(typeof toolChoice !== 'undefined' ? { tool_choice: toolChoice } : {}),
    ...(isResponsesEndpoint
      ? {
          ...(logprobs ? { include: ['message.output_text.logprobs'] } : {}),
          ...(logprobs && topLogprobs > 0 ? { top_logprobs: topLogprobs } : {}),
          ...(typeof text !== 'undefined' ? { text } : {}),
          ...(effort ? { reasoning: { effort } } : {}),
        }
      : {
          logprobs,
          ...(logprobs ? { top_logprobs: topLogprobs } : {}),
          ...(typeof responseFormat !== 'undefined' ? { response_format: responseFormat } : {}),
        }),
  }
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

export type ChatStreamUsage = {
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  reasoningTokens: number | null
  numSearchQueries: number | null
}

export type AssistantStreamDelta = {
  contentDelta: string
  reasoningStepSummaries: string[]
  finishReason: string | null
  usage: ChatStreamUsage | null
  modelId: string | null
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
  const normalized = buffer.replace(/\r\n/g, '\n')
  const blocks = normalized.split('\n\n')
  const rest = blocks.pop() || ''
  const events: string[] = []
  for (const block of blocks) {
    const dataLines: string[] = []
    block.split('\n').forEach(rawLine => {
      const line = String(rawLine || '')
      if (!line) return
      if (line.startsWith(':')) return
      if (!line.startsWith('data:')) return
      dataLines.push(line.slice('data:'.length).trimStart())
    })
    const payload = dataLines.join('\n').trim()
    if (payload) events.push(payload)
  }
  return { events, rest }
}

const toNullableNumber = (value: unknown): number | null => {
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

export const formatReasoningStepSummary = (step: unknown): string => {
  if (!step || typeof step !== 'object') return ''
  const record = step as Record<string, unknown>
  const type = typeof record.type === 'string' ? record.type.trim() : ''
  const thought = typeof record.thought === 'string' ? record.thought.trim() : ''
  const content = typeof record.content === 'string' ? record.content.trim() : ''
  if (type === 'thinking') return thought || content || 'thinking'
  if (type === 'web_search') {
    const search = record.web_search
    if (search && typeof search === 'object') {
      const keywords = Array.isArray((search as { search_keywords?: unknown }).search_keywords)
        ? ((search as { search_keywords: unknown[] }).search_keywords
          .filter(item => typeof item === 'string')
          .map(item => String(item).trim())
          .filter(Boolean))
        : []
      if (keywords.length > 0) return `web_search: ${keywords.join(', ')}`
    }
    return 'web_search'
  }
  if (type === 'fetch_url_content') {
    const fetchStep = record.fetch_url_content
    if (fetchStep && typeof fetchStep === 'object') {
      const title = typeof (fetchStep as { title?: unknown }).title === 'string'
        ? String((fetchStep as { title: unknown }).title).trim()
        : ''
      const url = typeof (fetchStep as { url?: unknown }).url === 'string'
        ? String((fetchStep as { url: unknown }).url).trim()
        : ''
      return `fetch_url: ${title || url || 'source'}`
    }
    return 'fetch_url'
  }
  if (type === 'execute_python' || type === 'execute_command') return type
  return thought || content || type
}

export const formatChatStreamUsageSummary = (usage: ChatStreamUsage | null): string | null => {
  if (!usage) return null
  const parts = [
    usage.promptTokens !== null ? `prompt ${usage.promptTokens}` : null,
    usage.completionTokens !== null ? `completion ${usage.completionTokens}` : null,
    usage.totalTokens !== null ? `total ${usage.totalTokens}` : null,
    usage.reasoningTokens !== null ? `reasoning ${usage.reasoningTokens}` : null,
    usage.numSearchQueries !== null ? `searches ${usage.numSearchQueries}` : null,
  ].filter((value): value is string => Boolean(value))
  return parts.length > 0 ? `Usage: ${parts.join(' · ')}` : null
}

export const extractAssistantStreamDelta = (payload: unknown): AssistantStreamDelta => {
  if (!payload || typeof payload !== 'object') {
    return {
      contentDelta: '',
      reasoningStepSummaries: [],
      finishReason: null,
      usage: null,
      modelId: null,
    }
  }
  const record = payload as Record<string, unknown>
  const choices = Array.isArray(record.choices) ? record.choices : []
  const first = isObjectRecord(choices[0]) ? choices[0] : null
  const delta = isObjectRecord(first?.delta) ? first.delta : null
  const message = isObjectRecord(first?.message) ? first.message : null
  const reasoningSteps = Array.isArray(delta?.reasoning_steps)
    ? delta.reasoning_steps
      .map(formatReasoningStepSummary)
      .filter(Boolean)
    : []
  const usage = record.usage && typeof record.usage === 'object'
    ? {
        promptTokens: toNullableNumber((record.usage as Record<string, unknown>).prompt_tokens),
        completionTokens: toNullableNumber((record.usage as Record<string, unknown>).completion_tokens),
        totalTokens: toNullableNumber((record.usage as Record<string, unknown>).total_tokens),
        reasoningTokens: toNullableNumber((record.usage as Record<string, unknown>).reasoning_tokens),
        numSearchQueries: toNullableNumber((record.usage as Record<string, unknown>).num_search_queries),
      }
    : null
  return {
    contentDelta:
      extractAssistantContentText(delta?.content)
      || extractAssistantContentText(delta?.text)
      || extractAssistantContentText(message?.content)
      || extractAssistantContentText(record),
    reasoningStepSummaries: reasoningSteps,
    finishReason: typeof first?.finish_reason === 'string' ? String(first.finish_reason) : null,
    usage,
    modelId: typeof record.model === 'string' ? String(record.model) : null,
  }
}

export const extractAssistantDelta = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') return ''
  const record = payload as Record<string, unknown>
  const choices = record.choices
  const rootText = extractAssistantContentText(record.output_text) || extractAssistantContentText(record.output)
  if (!Array.isArray(choices) || choices.length === 0) return rootText
  const first = isObjectRecord(choices[0]) ? choices[0] : null
  const delta = isObjectRecord(first?.delta) ? extractAssistantContentText(first.delta.content) : ''
  const direct = isObjectRecord(first?.message) ? extractAssistantContentText(first.message.content) : ''
  return delta || direct || rootText || ''
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

export const shouldRetryWithActivationFallback = (status: number, detail: string): boolean => {
  if (status !== 400 && status !== 403 && status !== 404) return false
  const lowered = String(detail || '').toLowerCase()
  if (!lowered) return false
  if (!lowered.includes('model')) return false
  if (lowered.includes('has not activated')) return true
  if (lowered.includes('activate the model service')) return true
  if (lowered.includes('no permission')) return true
  if (lowered.includes('no access')) return true
  if (lowered.includes('do not have access')) return true
  if (lowered.includes('not support current account')) return true
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
  return recoverStructuredKgcAssistantPayload(raw)
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
    text.startsWith('---\n') ||
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
