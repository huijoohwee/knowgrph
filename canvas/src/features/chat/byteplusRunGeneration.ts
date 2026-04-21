import {
  CHAT_BYTEPLUS_CONTENT_GENERATIONS_TASKS_PATH,
  CHAT_BYTEPLUS_IMAGES_GENERATIONS_PATH,
  CHAT_PROVIDER_BYTEPLUS,
  buildChatProxyHeaders,
  getDefaultGenerationModelForProvider,
  normalizeChatProviderId,
  resolveBinaryDownloadProxyUrl,
  resolveBytePlusContentEndpointForRequest,
  resolveChatEndpointForModels,
  resolveChatEndpointForRequest,
} from '@/lib/chatEndpoint'
import { parseErrorBody, loadAvailableModelIds } from './SidePanelChat.helpers'

export type RunGenerationConfig = {
  provider: unknown
  endpointUrl?: unknown
  apiKey?: unknown
  chatModel?: unknown
}

const toRequestId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}`

const cleanString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : ''
}

const buildProxyHeaders = (config: RunGenerationConfig, requestId: string): HeadersInit => {
  return {
    'Content-Type': 'application/json',
    ...buildChatProxyHeaders({
      provider: config.provider,
      apiKey: config.apiKey,
      endpointUrl: config.endpointUrl,
      clientRequestId: requestId,
    }),
  }
}

const normalizeModelId = (value: string): string => {
  return cleanString(value).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

const chooseMatchingModel = (available: string[], preferred: string, keywords: string[]): string => {
  const exact = available.find(id => normalizeModelId(id) === normalizeModelId(preferred))
  if (exact) return exact
  const preferredNormalized = normalizeModelId(preferred)
  const keywordNormalized = keywords.map(normalizeModelId).filter(Boolean)
  const preferredFamily = available.find(id => normalizeModelId(id).includes(preferredNormalized))
  if (preferredFamily) return preferredFamily
  const keywordMatch = available.find(id => {
    const normalized = normalizeModelId(id)
    return keywordNormalized.every(keyword => normalized.includes(keyword))
  })
  if (keywordMatch) return keywordMatch
  return preferred
}

const resolveGenerationModel = async (
  config: RunGenerationConfig,
  kind: 'text' | 'image' | 'video',
): Promise<string> => {
  const provider = normalizeChatProviderId(config.provider)
  const preferred = kind === 'text'
    ? cleanString(config.chatModel) || getDefaultGenerationModelForProvider(provider, 'text')
    : getDefaultGenerationModelForProvider(provider, kind)
  if (provider !== CHAT_PROVIDER_BYTEPLUS) return preferred
  const modelsEndpoint = resolveChatEndpointForModels(config.endpointUrl)
  if (!modelsEndpoint) return preferred
  try {
    const available = await loadAvailableModelIds(modelsEndpoint, buildProxyHeaders(config, toRequestId(`kg-byteplus-models-${kind}`)))
    if (!available.length) return preferred
    const keywords = kind === 'text'
      ? ['seed', '2', 'lite']
      : kind === 'image'
        ? ['seedream', '5', 'lite']
        : ['seedance', '2']
    return chooseMatchingModel(available, preferred, keywords)
  } catch {
    return preferred
  }
}

const extractChatText = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') return ''
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || !choices.length) return ''
  const first = choices[0] as { message?: { content?: unknown } } | null
  const content = first?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    const parts = content
      .map(part => {
        if (!part || typeof part !== 'object') return ''
        const text = (part as { text?: unknown }).text
        return typeof text === 'string' ? text : ''
      })
      .filter(Boolean)
    return parts.join('\n').trim()
  }
  return ''
}

const base64ToBlob = (base64: string, mimeType: string): Blob | null => {
  try {
    const clean = cleanString(base64).replace(/^data:[^;]+;base64,/, '')
    if (!clean) return null
    const binary = atob(clean)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mimeType })
  } catch {
    return null
  }
}

const fetchBlobFromUrl = async (url: string): Promise<Blob | null> => {
  const target = cleanString(url)
  if (!target) return null
  const proxiedTarget = resolveBinaryDownloadProxyUrl(target)
  if (!proxiedTarget) return null
  try {
    const res = await fetch(proxiedTarget, {
      method: 'GET',
      headers: {
        Accept: '*/*',
      },
    })
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

const extractImageBlob = async (payload: unknown): Promise<Blob | null> => {
  if (!payload || typeof payload !== 'object') return null
  const data = Array.isArray((payload as { data?: unknown }).data) ? (payload as { data: unknown[] }).data : []
  const first = data[0]
  if (!first || typeof first !== 'object') return null
  const rec = first as { b64_json?: unknown; url?: unknown }
  const b64 = typeof rec.b64_json === 'string' ? rec.b64_json : ''
  if (b64) return base64ToBlob(b64, 'image/png')
  const url = typeof rec.url === 'string' ? rec.url : ''
  return await fetchBlobFromUrl(url)
}

const extractVideoUrl = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') return ''
  const direct = cleanString((payload as { video_url?: unknown }).video_url)
  if (direct) return direct
  const data = (payload as { data?: unknown }).data
  if (data && typeof data === 'object') {
    const nestedDirect = cleanString((data as { video_url?: unknown }).video_url)
    if (nestedDirect) return nestedDirect
    const nestedUrl = data as { video_url?: { url?: unknown }; output?: unknown; content?: unknown }
    const nestedObjectUrl = cleanString(nestedUrl.video_url?.url)
    if (nestedObjectUrl) return nestedObjectUrl
    if (Array.isArray(nestedUrl.output)) {
      for (const entry of nestedUrl.output) {
        if (!entry || typeof entry !== 'object') continue
        const candidate = cleanString((entry as { video_url?: unknown; url?: unknown }).video_url || (entry as { url?: unknown }).url)
        if (candidate) return candidate
      }
    }
    if (Array.isArray(nestedUrl.content)) {
      for (const entry of nestedUrl.content) {
        if (!entry || typeof entry !== 'object') continue
        const candidate = cleanString((entry as { url?: unknown }).url)
        if (candidate) return candidate
      }
    }
  }
  return ''
}

export async function generateRunMarkdownWithProvider(args: {
  config: RunGenerationConfig
  prompt: string
}): Promise<string | null> {
  const endpoint = resolveChatEndpointForRequest(args.config.endpointUrl)
  if (!endpoint) return null
  const provider = normalizeChatProviderId(args.config.provider)
  const model = await resolveGenerationModel(args.config, 'text')
  const requestId = toRequestId('kg-run-text')
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: buildProxyHeaders(args.config, requestId),
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'Return only the final user-facing markdown deliverable. Do not mention KGC, frontmatter, pipeline, or internal graph mechanics.',
        },
        {
          role: 'user',
          content: args.prompt,
        },
      ],
    }),
  })
  if (!res.ok) {
    const detail = await parseErrorBody(res)
    throw new Error(detail || `Run markdown generation failed (${res.status})`)
  }
  const data = (await res.json()) as unknown
  const text = extractChatText(data)
  return text || null
}

export async function generateRunImageWithBytePlus(args: {
  config: RunGenerationConfig
  prompt: string
}): Promise<Blob | null> {
  if (normalizeChatProviderId(args.config.provider) !== CHAT_PROVIDER_BYTEPLUS) return null
  const endpoint = resolveBytePlusContentEndpointForRequest({
    endpointUrl: args.config.endpointUrl,
    path: CHAT_BYTEPLUS_IMAGES_GENERATIONS_PATH,
  })
  if (!endpoint) return null
  const model = await resolveGenerationModel(args.config, 'image')
  const requestId = toRequestId('kg-run-image')
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: buildProxyHeaders(args.config, requestId),
    body: JSON.stringify({
      model,
      prompt: args.prompt,
      response_format: 'b64_json',
      size: '1024x1024',
    }),
  })
  if (!res.ok) {
    const detail = await parseErrorBody(res)
    throw new Error(detail || `Run image generation failed (${res.status})`)
  }
  const data = (await res.json()) as unknown
  return await extractImageBlob(data)
}

export async function generateRunVideoWithBytePlus(args: {
  config: RunGenerationConfig
  prompt: string
}): Promise<Blob | null> {
  if (normalizeChatProviderId(args.config.provider) !== CHAT_PROVIDER_BYTEPLUS) return null
  const endpoint = resolveBytePlusContentEndpointForRequest({
    endpointUrl: args.config.endpointUrl,
    path: CHAT_BYTEPLUS_CONTENT_GENERATIONS_TASKS_PATH,
  })
  if (!endpoint) return null
  const model = await resolveGenerationModel(args.config, 'video')
  const requestId = toRequestId('kg-run-video')
  const createRes = await fetch(endpoint, {
    method: 'POST',
    headers: buildProxyHeaders(args.config, requestId),
    body: JSON.stringify({
      model,
      content: [{ type: 'text', text: args.prompt }],
      resolution: '720p',
      ratio: '16:9',
      duration: 5,
      generate_audio: false,
      watermark: false,
    }),
  })
  if (!createRes.ok) {
    const detail = await parseErrorBody(createRes)
    throw new Error(detail || `Run video generation failed (${createRes.status})`)
  }
  const created = (await createRes.json()) as { id?: unknown }
  const taskId = cleanString(created?.id)
  if (!taskId) return null
  const statusEndpoint = resolveBytePlusContentEndpointForRequest({
    endpointUrl: args.config.endpointUrl,
    path: `${CHAT_BYTEPLUS_CONTENT_GENERATIONS_TASKS_PATH}/${taskId}`,
  })
  if (!statusEndpoint) return null
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (attempt > 0) {
      await new Promise(resolve => globalThis.setTimeout(resolve, attempt < 5 ? 1500 : 2500))
    }
    const statusRes = await fetch(statusEndpoint, {
      method: 'GET',
      headers: buildProxyHeaders(args.config, `${requestId}-${attempt}`),
    })
    if (!statusRes.ok) continue
    const payload = (await statusRes.json()) as { status?: unknown }
    const status = cleanString(payload?.status).toLowerCase()
    if (status === 'failed' || status === 'expired') return null
    const url = extractVideoUrl(payload)
    if (status === 'succeeded' && url) {
      return await fetchBlobFromUrl(url)
    }
  }
  return null
}
