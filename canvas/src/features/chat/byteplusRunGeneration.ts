import {
  CHAT_BYTEPLUS_CONTENT_GENERATIONS_TASKS_PATH,
  CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT,
  CHAT_BYTEPLUS_IMAGE_MODEL_OPTIONS,
  CHAT_BYTEPLUS_IMAGES_GENERATIONS_PATH,
  CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT,
  CHAT_PROVIDER_BYTEPLUS,
  buildChatProxyHeaders,
  getDefaultGenerationModelForProvider,
  normalizeChatProviderId,
  resolveBinaryDownloadProxyUrl,
  resolveBytePlusContentEndpointForRequest,
  resolveChatEndpointForModels,
  resolveChatEndpointForRequest,
} from '@/lib/chatEndpoint'
import {
  buildProviderChatRequestOptions,
  extractAssistantDelta,
  loadAvailableModelIds,
  parseErrorBody,
  parseSseEvents,
  shouldRetryWithActivationFallback,
} from './SidePanelChat.helpers'
import { LS_KEYS } from '@/lib/config'
import { lsBool, lsInt, lsJson } from '@/lib/persistence'

export type RunGenerationConfig = {
  provider: unknown
  endpointUrl?: unknown
  apiKey?: unknown
  chatModel?: unknown
}

export type RunTextGenerationOptions = {
  chatTemperature?: unknown
  chatMaxCompletionTokens?: unknown
  chatServiceTier?: unknown
  chatStream?: unknown
  chatMessagesJson?: unknown
  chatReasoningEffort?: unknown
  chatThinkingType?: unknown
  chatThinkingJson?: unknown
  chatFrequencyPenalty?: unknown
  chatPresencePenalty?: unknown
  chatTopP?: unknown
  chatLogprobs?: unknown
  chatTopLogprobs?: unknown
  chatParallelToolCalls?: unknown
  chatStopJson?: unknown
  chatStreamOptionsJson?: unknown
  chatResponseFormatJson?: unknown
  chatLogitBiasJson?: unknown
  chatToolsJson?: unknown
  chatToolChoiceJson?: unknown
  onText?: (text: string) => void
}

export type RunImageGenerationOptions = {
  model?: unknown
  size?: unknown
  outputFormat?: unknown
  watermark?: unknown
  seed?: unknown
  guidanceScale?: unknown
  referenceImageUrl?: unknown
}

export type RunVideoGenerationOptions = {
  model?: unknown
  contentJson?: unknown
  aspectRatio?: unknown
  resolution?: unknown
  duration?: unknown
  generateAudio?: unknown
  fast?: unknown
  watermark?: unknown
  referenceImageUrl?: unknown
}

export type GeneratedBinaryAsset = {
  blob: Blob
  renderUrl: string
  sourceUrl?: string
  model: string
}

export type ResolvedGenerationModelPreview = {
  preferredModel: string
  resolvedModel: string
  availableCount: number
  matchedAvailableModel: boolean
}

type BytePlusVideoFailureContext = {
  preferredModel: string
  resolvedModel: string
  matchedAvailableModel: boolean
  availableCount: number
  authMode: 'byok' | 'serverManaged'
}

type BytePlusImageFailureContext = {
  preferredModel: string
  resolvedModel: string
  availableCount: number
  authMode: 'byok' | 'serverManaged'
  attemptedResolvedModels: string[]
}

const BYTEPLUS_VIDEO_POLL_MAX_ATTEMPTS = 24

const getBytePlusVideoPollDelayMs = (attempt: number): number => {
  if (attempt < 3) return 2500
  if (attempt < 6) return 5000
  return 10000
}

const toRequestId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}`

const cleanString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : ''
}

const cleanBool = (value: unknown): boolean | null => {
  if (value === true) return true
  if (value === false) return false
  if (typeof value === 'string') {
    const raw = value.trim().toLowerCase()
    if (raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on') return true
    if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') return false
  }
  return null
}

const cleanInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
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

const tokenizeModelId = (value: string): string[] => {
  return cleanString(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map(token => token.trim())
    .filter(Boolean)
}

const isGenericGenerationMode = (value: string): boolean => {
  const normalized = normalizeModelId(value)
  return normalized === 'generateimage' || normalized === 'generatevideo'
}

const readBytePlusImageDefaults = (): {
  model: string
  size: string
  outputFormat: string
  watermark: boolean | null
  seed: number | null
  guidanceScale: number | null
} => {
  const model = lsJson<string>(LS_KEYS.byteplusImageModel, CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT, value => (typeof value === 'string' ? value : null))
  const size = lsJson<string>(LS_KEYS.byteplusImageSize, '2K', value => (typeof value === 'string' ? value : null))
  const outputFormat = lsJson<string>(LS_KEYS.byteplusImageOutputFormat, 'jpeg', value => (typeof value === 'string' ? value : null))
  const watermark = lsBool(LS_KEYS.byteplusImageWatermark, false)
  const seed = (() => {
    const value = lsInt(LS_KEYS.byteplusImageSeed, 0)
    return Number.isFinite(value) ? value : null
  })()
  const guidanceScale = lsJson<number>(LS_KEYS.byteplusImageGuidanceScale, 0, value => (typeof value === 'number' && Number.isFinite(value) ? value : null))
  return {
    model: cleanString(model),
    size: cleanString(size),
    outputFormat: cleanString(outputFormat).toLowerCase(),
    watermark,
    seed: Number.isFinite(seed) ? seed : null,
    guidanceScale: typeof guidanceScale === 'number' && Number.isFinite(guidanceScale) ? guidanceScale : null,
  }
}

const readBytePlusVideoDefaults = (): {
  model: string
  contentJson: string
  aspectRatio: string
  resolution: string
  duration: number | null
  generateAudio: boolean | null
  fast: boolean | null
  watermark: boolean | null
} => {
  const model = lsJson<string>(LS_KEYS.byteplusVideoModel, CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT, value => (typeof value === 'string' ? value : null))
  const contentJson = lsJson<string>(LS_KEYS.byteplusVideoContentJson, '', value => (typeof value === 'string' ? value : null))
  const aspectRatio = lsJson<string>(LS_KEYS.byteplusVideoAspectRatio, 'landscape', value => (typeof value === 'string' ? value : null))
  const resolution = lsJson<string>(LS_KEYS.byteplusVideoResolution, '720p', value => (typeof value === 'string' ? value : null))
  const duration = (() => {
    const v = lsInt(LS_KEYS.byteplusVideoDuration, 5)
    return Number.isFinite(v) ? v : null
  })()
  const generateAudio = lsBool(LS_KEYS.byteplusVideoGenerateAudio, false)
  const fast = lsBool(LS_KEYS.byteplusVideoFast, false)
  const watermark = lsBool(LS_KEYS.byteplusVideoWatermark, false)
  return {
    model: cleanString(model),
    contentJson: typeof contentJson === 'string' ? contentJson : '',
    aspectRatio: cleanString(aspectRatio),
    resolution: cleanString(resolution),
    duration: Number.isFinite(duration) ? duration : null,
    generateAudio,
    fast,
    watermark,
  }
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

type BytePlusVideoModelSignature = {
  major: string
  minor: string
  pro: boolean
  fast: boolean
}

type BytePlusImageModelSignature = {
  major: string
  minor: string
  lite: boolean
}

const parseBytePlusVideoModelSignature = (value: string, wantsFast?: boolean): BytePlusVideoModelSignature | null => {
  const tokens = tokenizeModelId(value)
  const seedanceIndex = tokens.findIndex(token => token === 'seedance')
  if (seedanceIndex < 0) return null
  const numericTokens = tokens.slice(seedanceIndex + 1).filter(token => /^\d+$/.test(token))
  if (numericTokens.length < 2) return null
  return {
    major: numericTokens[0] || '',
    minor: numericTokens[1] || '',
    pro: tokens.includes('pro'),
    fast: wantsFast === true ? true : tokens.includes('fast'),
  }
}

const parseBytePlusImageModelSignature = (value: string): BytePlusImageModelSignature | null => {
  const tokens = tokenizeModelId(value)
  const seedreamIndex = tokens.findIndex(token => token === 'seedream')
  if (seedreamIndex < 0) return null
  const numericTokens = tokens.slice(seedreamIndex + 1).filter(token => /^\d+$/.test(token))
  if (numericTokens.length < 2) return null
  return {
    major: numericTokens[0] || '',
    minor: numericTokens[1] || '',
    lite: tokens.includes('lite'),
  }
}

const chooseMatchingImageModel = (available: string[], preferred: string): string => {
  const exact = available.find(id => normalizeModelId(id) === normalizeModelId(preferred))
  if (exact) return exact
  const preferredSignature = parseBytePlusImageModelSignature(preferred)
  if (preferredSignature) {
    const signatureMatch = available.find(id => {
      const candidateSignature = parseBytePlusImageModelSignature(id)
      if (!candidateSignature) return false
      return (
        candidateSignature.major === preferredSignature.major
        && candidateSignature.minor === preferredSignature.minor
        && candidateSignature.lite === preferredSignature.lite
      )
    })
    if (signatureMatch) return signatureMatch
  }
  const preferredNormalized = normalizeModelId(preferred)
  const preferredFamily = available.find(id => normalizeModelId(id).includes(preferredNormalized))
  if (preferredFamily) return preferredFamily
  const keywordTokens = deriveImageKeywords(preferred)
  const tokenMatch = available.find(id => {
    const candidateTokens = tokenizeModelId(id)
    return keywordTokens.every(token => candidateTokens.includes(token))
  })
  if (tokenMatch) return tokenMatch
  return preferred
}

const chooseMatchingVideoModel = (available: string[], preferred: string, wantsFast: boolean): string => {
  const exact = available.find(id => normalizeModelId(id) === normalizeModelId(preferred))
  if (exact) return exact
  const preferredSignature = parseBytePlusVideoModelSignature(preferred, wantsFast)
  if (preferredSignature) {
    const signatureMatch = available.find(id => {
      const candidateSignature = parseBytePlusVideoModelSignature(id)
      if (!candidateSignature) return false
      return (
        candidateSignature.major === preferredSignature.major
        && candidateSignature.minor === preferredSignature.minor
        && candidateSignature.pro === preferredSignature.pro
        && candidateSignature.fast === preferredSignature.fast
      )
    })
    if (signatureMatch) return signatureMatch
  }
  const preferredNormalized = normalizeModelId(preferred)
  const preferredFamily = available.find(id => normalizeModelId(id).includes(preferredNormalized))
  if (preferredFamily) return preferredFamily
  const keywordTokens = deriveVideoKeywords(preferred, wantsFast)
  const tokenMatch = available.find(id => {
    const candidateTokens = tokenizeModelId(id)
    return keywordTokens.every(token => candidateTokens.includes(token))
  })
  if (tokenMatch) return tokenMatch
  return preferred
}

const deriveVideoKeywords = (preferred: string, wantsFast: boolean): string[] => {
  const normalized = normalizeModelId(preferred)
  if (normalized.includes('dreaminaseedance20') || normalized.includes('seedance20')) {
    return wantsFast ? ['seedance', '2', '0', 'fast'] : ['seedance', '2', '0']
  }
  if (normalized.includes('bytedanceseedance15pro') || normalized.includes('seedance15pro')) {
    return ['seedance', '1', '5', 'pro']
  }
  if (normalized.includes('bytedanceseedance10pro') || normalized.includes('seedance10pro')) {
    return wantsFast ? ['seedance', '1', '0', 'pro', 'fast'] : ['seedance', '1', '0', 'pro']
  }
  return wantsFast ? ['seedance', 'fast'] : ['seedance']
}

const deriveImageKeywords = (preferred: string): string[] => {
  const normalized = normalizeModelId(preferred)
  if (normalized.includes('seedream40')) return ['seedream', '4', '0']
  if (normalized.includes('seedream45')) return ['seedream', '4', '5']
  if (normalized.includes('seedream50lite')) return ['seedream', '5', '0', 'lite']
  return ['seedream']
}

const resolveGenerationModelPreview = async (
  config: RunGenerationConfig,
  kind: 'text' | 'image' | 'video',
  explicitModel?: unknown,
  options?: { fast?: unknown },
): Promise<ResolvedGenerationModelPreview> => {
  const provider = normalizeChatProviderId(config.provider)
  const explicit = cleanString(explicitModel)
  const defaults =
    provider === CHAT_PROVIDER_BYTEPLUS
      ? kind === 'video'
        ? readBytePlusVideoDefaults()
        : kind === 'image'
          ? readBytePlusImageDefaults()
          : null
      : null
  const hasExplicit = Boolean(explicit && !isGenericGenerationMode(explicit))
  const hasDefaultModel = Boolean(defaults?.model && !isGenericGenerationMode(defaults.model))
  const preferred = hasExplicit
    ? explicit
    : kind === 'text'
      ? cleanString(config.chatModel) || getDefaultGenerationModelForProvider(provider, 'text')
      : (hasDefaultModel ? String(defaults?.model || '').trim() : getDefaultGenerationModelForProvider(provider, kind))
  if (provider !== CHAT_PROVIDER_BYTEPLUS) {
    return {
      preferredModel: preferred,
      resolvedModel: preferred,
      availableCount: 0,
      matchedAvailableModel: false,
    }
  }
  const modelsEndpoint = resolveChatEndpointForModels(config.endpointUrl)
  if (!modelsEndpoint) {
    return {
      preferredModel: preferred,
      resolvedModel: preferred,
      availableCount: 0,
      matchedAvailableModel: false,
    }
  }
  try {
    const available = await loadAvailableModelIds(modelsEndpoint, buildProxyHeaders(config, toRequestId(`kg-byteplus-models-${kind}`)))
    if (!available.length) {
      return {
        preferredModel: preferred,
        resolvedModel: preferred,
        availableCount: 0,
        matchedAvailableModel: false,
      }
    }
    const wantsFast = cleanBool(options?.fast) === true
    let resolved = preferred
    const hasStrongPreference = hasExplicit || ((kind === 'video' || kind === 'image') && hasDefaultModel)
    if (hasStrongPreference) {
      if (kind === 'video') {
        const preferredTarget = wantsFast && !normalizeModelId(preferred).includes('fast')
          ? `${preferred}-fast`
          : preferred
        resolved = chooseMatchingVideoModel(available, preferredTarget, wantsFast)
      } else if (kind === 'image') {
        resolved = chooseMatchingImageModel(available, preferred)
      } else {
        const exact = available.find(id => normalizeModelId(id) === normalizeModelId(preferred))
        if (exact) {
          resolved = exact
        } else {
          const preferredNormalized = normalizeModelId(preferred)
          const preferredFamily = available.find(id => normalizeModelId(id).includes(preferredNormalized))
          resolved = preferredFamily || preferred
        }
      }
      return {
        preferredModel: preferred,
        resolvedModel: resolved,
        availableCount: available.length,
        matchedAvailableModel: available.includes(resolved),
      }
    }

    const preferredTarget = kind === 'video' && wantsFast && !normalizeModelId(preferred).includes('fast')
      ? `${preferred}-fast`
      : preferred
    const keywords = kind === 'text'
      ? ['seed', '2', 'lite']
      : kind === 'image'
        ? deriveImageKeywords(preferredTarget)
        : []
    resolved = kind === 'video'
      ? chooseMatchingVideoModel(available, preferredTarget, wantsFast)
      : kind === 'image'
        ? chooseMatchingImageModel(available, preferredTarget)
      : chooseMatchingModel(available, preferredTarget, keywords)
    return {
      preferredModel: preferred,
      resolvedModel: resolved,
      availableCount: available.length,
      matchedAvailableModel: available.includes(resolved),
    }
  } catch {
    return {
      preferredModel: preferred,
      resolvedModel: preferred,
      availableCount: 0,
      matchedAvailableModel: false,
    }
  }
}

export const resolveBytePlusVideoModelPreview = async (
  config: RunGenerationConfig,
  explicitModel?: unknown,
  options?: { fast?: unknown },
): Promise<ResolvedGenerationModelPreview> => {
  return resolveGenerationModelPreview(config, 'video', explicitModel, options)
}

const resolveGenerationModel = async (
  config: RunGenerationConfig,
  kind: 'text' | 'image' | 'video',
  explicitModel?: unknown,
  options?: { fast?: unknown },
): Promise<string> => {
  const preview = await resolveGenerationModelPreview(config, kind, explicitModel, options)
  return preview.resolvedModel
}

const extractChatText = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') return ''
  const openAiResponsesDirect = (() => {
    const direct = (payload as { output_text?: unknown }).output_text
    return typeof direct === 'string' ? direct.trim() : ''
  })()
  if (openAiResponsesDirect) return openAiResponsesDirect

  const openAiResponsesOutput = (() => {
    const output = (payload as { output?: unknown }).output
    if (!Array.isArray(output) || !output.length) return ''
    const parts: string[] = []
    for (const item of output) {
      if (!item || typeof item !== 'object') continue
      const content = (item as { content?: unknown }).content
      if (!Array.isArray(content)) continue
      for (const entry of content) {
        if (!entry || typeof entry !== 'object') continue
        const type = String((entry as { type?: unknown }).type || '').trim().toLowerCase()
        if (type && type !== 'output_text' && type !== 'text') continue
        const text = (entry as { text?: unknown }).text
        if (typeof text === 'string' && text.trim()) parts.push(text)
      }
    }
    return parts.join('\n').trim()
  })()
  if (openAiResponsesOutput) return openAiResponsesOutput

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

const extractStreamTextDelta = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') return ''
  const eventType = cleanString((payload as { type?: unknown }).type).toLowerCase()
  if (eventType === 'response.output_text.delta') {
    const delta = (payload as { delta?: unknown }).delta
    return typeof delta === 'string' ? delta : ''
  }
  if (eventType === 'response.output_text.done') {
    const text = (payload as { text?: unknown }).text
    return typeof text === 'string' ? text : ''
  }
  return extractAssistantDelta(payload)
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

const base64ToDataUrl = (base64: string, mimeType: string): string => {
  const clean = cleanString(base64).replace(/^data:[^;]+;base64,/, '')
  return clean ? `data:${mimeType};base64,${clean}` : ''
}

const mapAspectRatioToImageSize = (aspectRatio: unknown): string => {
  const raw = cleanString(aspectRatio).toLowerCase()
  if (raw === 'landscape') return '1536x1024'
  if (raw === 'portrait') return '1024x1536'
  return '1024x1024'
}

const mapAspectRatioToVideoRatio = (aspectRatio: unknown): string => {
  const raw = cleanString(aspectRatio).toLowerCase()
  if (raw === 'portrait') return '9:16'
  if (raw === 'square') return '1:1'
  return '16:9'
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

const extractErrorMessage = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') return ''
  const direct = cleanString((payload as { message?: unknown }).message)
  if (direct) return direct
  const errorMessage = cleanString((payload as { error?: { message?: unknown } | string }).error && typeof (payload as { error?: unknown }).error === 'object'
    ? ((payload as { error?: { message?: unknown } }).error?.message)
    : (payload as { error?: string }).error)
  if (errorMessage) return errorMessage
  const dataMessage = cleanString((payload as { data?: { message?: unknown } }).data?.message)
  if (dataMessage) return dataMessage
  const statusMessage = cleanString((payload as { status_message?: unknown }).status_message)
  if (statusMessage) return statusMessage
  return ''
}

const formatBytePlusVideoFailure = (
  detail: string,
  context: BytePlusVideoFailureContext,
): string => {
  const trimmedDetail = cleanString(detail) || 'BytePlus video generation failed.'
  const selectedModel = cleanString(context.preferredModel) || 'BytePlus video default'
  const resolvedModel = cleanString(context.resolvedModel) || selectedModel
  const authLabel = context.authMode === 'byok' ? 'BYOK' : 'serverManaged'
  const fix =
    context.matchedAvailableModel
      ? `Fix: verify this ${authLabel} credential has access to ${resolvedModel} in the active BytePlus region, or switch MainPanel Integrations -> BytePlus Video Generation API -> byteplusVideoModel to another model returned by /models.`
      : `Fix: open MainPanel Integrations -> Chat -> Multi-modal Run, confirm the resolved /models candidate, then set MainPanel Integrations -> BytePlus Video Generation API -> byteplusVideoModel to an accessible BytePlus video model for this credential/region.`
  return [
    `BytePlus video run failed: ${trimmedDetail}`,
    `Selected video model: ${selectedModel}`,
    `Resolved /models candidate: ${resolvedModel}`,
    `Auth mode: ${authLabel}`,
    `BytePlus /models entries checked: ${String(context.availableCount || 0)}`,
    fix,
  ].join(' | ')
}

const formatBytePlusImageFailure = (
  detail: string,
  context: BytePlusImageFailureContext,
): string => {
  const trimmedDetail = cleanString(detail) || 'BytePlus image generation failed.'
  const selectedModel = cleanString(context.preferredModel) || 'BytePlus image default'
  const resolvedModel = cleanString(context.resolvedModel) || selectedModel
  const authLabel = context.authMode === 'byok' ? 'BYOK' : 'serverManaged'
  const attempted = Array.from(new Set(context.attemptedResolvedModels.map(cleanString).filter(Boolean)))
  const fix = attempted.length > 1
    ? `Fix: this ${authLabel} credential could not activate the first image candidate, so Knowgrph also tried other curated image models. Activate one of the attempted models in Ark Console or switch MainPanel Integrations -> BytePlus Image Generation API -> byteplusImageModel to a model your account has activated.`
    : `Fix: activate ${resolvedModel} in Ark Console for this ${authLabel} credential/region, or switch MainPanel Integrations -> BytePlus Image Generation API -> byteplusImageModel to another activated curated image model.`
  return [
    `BytePlus image run failed: ${trimmedDetail}`,
    `Selected image model: ${selectedModel}`,
    `Resolved /models candidate: ${resolvedModel}`,
    `Auth mode: ${authLabel}`,
    `BytePlus /models entries checked: ${String(context.availableCount || 0)}`,
    attempted.length > 1 ? `Attempted resolved models: ${attempted.join(', ')}` : '',
    fix,
  ].filter(Boolean).join(' | ')
}

const getCuratedImageFallbackPreferences = (preferred: string): string[] => {
  const preferredNormalized = normalizeModelId(preferred)
  const rest = CHAT_BYTEPLUS_IMAGE_MODEL_OPTIONS.filter(option => normalizeModelId(option) !== preferredNormalized)
  return [preferred, ...rest]
}

const extractImageAsset = async (payload: unknown): Promise<{ blob: Blob; renderUrl: string; sourceUrl?: string } | null> => {
  if (!payload || typeof payload !== 'object') return null
  const data = Array.isArray((payload as { data?: unknown }).data) ? (payload as { data: unknown[] }).data : []
  const first = data[0]
  if (!first || typeof first !== 'object') return null
  const rec = first as { b64_json?: unknown; url?: unknown }
  const b64 = typeof rec.b64_json === 'string' ? rec.b64_json : ''
  if (b64) {
    const blob = base64ToBlob(b64, 'image/png')
    const renderUrl = base64ToDataUrl(b64, 'image/png')
    return blob && renderUrl ? { blob, renderUrl } : null
  }
  const url = typeof rec.url === 'string' ? rec.url : ''
  const blob = await fetchBlobFromUrl(url)
  const renderUrl = resolveBinaryDownloadProxyUrl(url)
  return blob && renderUrl ? { blob, renderUrl, sourceUrl: cleanString(url) } : null
}

const extractVideoUrl = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') return ''
  const direct = cleanString((payload as { video_url?: unknown }).video_url)
  if (direct) return direct
  const rootContent = (payload as { content?: unknown }).content
  if (rootContent && typeof rootContent === 'object') {
    const rootContentDirect = cleanString((rootContent as { video_url?: unknown }).video_url)
    if (rootContentDirect) return rootContentDirect
    const rootContentObjectUrl = cleanString((rootContent as { video_url?: { url?: unknown } }).video_url?.url)
    if (rootContentObjectUrl) return rootContentObjectUrl
  }
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
  options?: RunTextGenerationOptions
}): Promise<string | null> {
  const endpoint = resolveChatEndpointForRequest(args.config.endpointUrl)
  if (!endpoint) return null
  const isResponsesEndpoint = (() => {
    const raw = String(endpoint || '')
    const q = raw.indexOf('?')
    const path = q >= 0 ? raw.slice(0, q) : raw
    return /\/v1\/responses\/?$/i.test(path)
  })()
  const model = await resolveGenerationModel(args.config, 'text')
  const requestId = toRequestId('kg-run-text')
  const providerOptions = buildProviderChatRequestOptions({
    provider: args.config.provider,
    chatTemperature: args.options?.chatTemperature ?? 0.3,
    chatServiceTier: args.options?.chatServiceTier,
    chatStream: args.options?.chatStream,
    chatMessagesJson: args.options?.chatMessagesJson,
    chatReasoningEffort: args.options?.chatReasoningEffort,
    chatThinkingType: args.options?.chatThinkingType,
    chatThinkingJson: args.options?.chatThinkingJson,
    chatFrequencyPenalty: args.options?.chatFrequencyPenalty,
    chatPresencePenalty: args.options?.chatPresencePenalty,
    chatTopP: args.options?.chatTopP,
    chatLogprobs: args.options?.chatLogprobs,
    chatTopLogprobs: args.options?.chatTopLogprobs,
    chatParallelToolCalls: args.options?.chatParallelToolCalls,
    chatStopJson: args.options?.chatStopJson,
    chatStreamOptionsJson: args.options?.chatStreamOptionsJson,
    chatResponseFormatJson: args.options?.chatResponseFormatJson,
    chatLogitBiasJson: args.options?.chatLogitBiasJson,
    chatToolsJson: args.options?.chatToolsJson,
    chatToolChoiceJson: args.options?.chatToolChoiceJson,
  })
  const providerMessages = Array.isArray((providerOptions as { messages?: unknown }).messages)
    ? (providerOptions as { messages: unknown[] }).messages
    : null
  const baseMessages = [
    {
      role: 'system',
      content: 'Return only the final user-facing markdown deliverable. Do not mention KGC, frontmatter, pipeline, or internal graph mechanics.',
    },
    {
      role: 'user',
      content: args.prompt,
    },
  ]
  const requestMessages = providerMessages || baseMessages
  const tokenLimit = cleanInteger(args.options?.chatMaxCompletionTokens)
  const streamRequested = cleanBool(args.options?.chatStream) !== false
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: buildProxyHeaders(args.config, requestId),
    body: JSON.stringify({
      model,
      ...providerOptions,
      stream: streamRequested,
      ...(isResponsesEndpoint
        ? {
            instructions: baseMessages[0]?.content,
            input: String(args.prompt || ''),
            ...(tokenLimit != null && tokenLimit > 0 ? { max_output_tokens: tokenLimit } : {}),
          }
        : {
            messages: requestMessages,
            ...(tokenLimit != null && tokenLimit > 0 ? { max_completion_tokens: tokenLimit } : {}),
          }),
    }),
  })
  if (!res.ok) {
    const detail = await parseErrorBody(res)
    throw new Error(detail || `Run markdown generation failed (${res.status})`)
  }
  const contentType = String(
    (typeof res.headers?.get === 'function' ? res.headers.get('content-type') : '')
    || '',
  ).toLowerCase()
  const isEventStream = streamRequested && contentType.includes('text/event-stream')
  if (isEventStream && res.body) {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''
    let done = false
    while (!done) {
      const chunk = await reader.read()
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true })
      const parsed = parseSseEvents(buffer)
      buffer = parsed.rest
      for (const raw of parsed.events) {
        if (raw === '[DONE]') {
          done = true
          break
        }
        try {
          const next = extractStreamTextDelta(JSON.parse(raw) as unknown)
          if (!next) continue
          fullText += next
          args.options?.onText?.(fullText)
        } catch {
          void 0
        }
      }
    }
    buffer += decoder.decode()
    if (buffer.trim()) {
      const parsed = parseSseEvents(buffer)
      for (const raw of parsed.events) {
        if (raw === '[DONE]') continue
        try {
          const next = extractStreamTextDelta(JSON.parse(raw) as unknown)
          if (!next) continue
          fullText += next
          args.options?.onText?.(fullText)
        } catch {
          void 0
        }
      }
    }
    return fullText.trim() ? fullText : null
  }
  const data = (await res.json()) as unknown
  const text = extractChatText(data)
  if (text) args.options?.onText?.(text)
  return text || null
}

export async function generateRunImageWithBytePlus(args: {
  config: RunGenerationConfig
  prompt: string
  options?: RunImageGenerationOptions
}): Promise<GeneratedBinaryAsset | null> {
  if (normalizeChatProviderId(args.config.provider) !== CHAT_PROVIDER_BYTEPLUS) return null
  const endpoint = resolveBytePlusContentEndpointForRequest({
    endpointUrl: args.config.endpointUrl,
    path: CHAT_BYTEPLUS_IMAGES_GENERATIONS_PATH,
  })
  if (!endpoint) return null
  const defaults = readBytePlusImageDefaults()
  const modelPreview = await resolveGenerationModelPreview(args.config, 'image', args.options?.model)
  const failureContext: BytePlusImageFailureContext = {
    preferredModel: modelPreview.preferredModel,
    resolvedModel: modelPreview.resolvedModel,
    availableCount: modelPreview.availableCount,
    authMode: cleanString(args.config.apiKey) ? 'byok' : 'serverManaged',
    attemptedResolvedModels: [modelPreview.resolvedModel],
  }
  const requestId = toRequestId('kg-run-image')
  const referenceImageUrl = cleanString(args.options?.referenceImageUrl)
  const size = cleanString(args.options?.size) || defaults.size || '2K'
  const outputFormat = cleanString(args.options?.outputFormat).toLowerCase() || defaults.outputFormat || 'jpeg'
  const watermark = cleanBool(args.options?.watermark) ?? defaults.watermark
  const seed = cleanInteger(args.options?.seed) ?? defaults.seed
  const guidanceScale = (() => {
    const raw = args.options?.guidanceScale
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
    if (typeof raw === 'string') {
      const parsed = Number.parseFloat(raw.trim())
      if (Number.isFinite(parsed)) return parsed
    }
    return defaults.guidanceScale
  })()
  const buildImageRequestBody = (model: string): string => JSON.stringify({
    model,
    prompt: args.prompt,
    ...(referenceImageUrl ? { image: referenceImageUrl } : {}),
    size,
    output_format: outputFormat,
    ...(watermark != null ? { watermark } : {}),
    ...(seed != null && seed > 0 ? { seed } : {}),
    ...(guidanceScale != null && guidanceScale > 0 ? { guidance_scale: guidanceScale } : {}),
    response_format: 'b64_json',
  })
  const runImageRequest = async (model: string, suffix: string): Promise<Response> => {
    return fetch(endpoint, {
      method: 'POST',
      headers: buildProxyHeaders(args.config, `${requestId}${suffix}`),
      body: buildImageRequestBody(model),
    })
  }

  let model = modelPreview.resolvedModel
  let res = await runImageRequest(model, '')
  let detail = res.ok ? '' : await parseErrorBody(res)
  if (!res.ok && shouldRetryWithActivationFallback(res.status, detail)) {
    const preferences = getCuratedImageFallbackPreferences(modelPreview.preferredModel)
    for (const preferred of preferences) {
      const preview = await resolveGenerationModelPreview(args.config, 'image', preferred)
      const retryModel = preview.resolvedModel
      if (!preview.matchedAvailableModel || !retryModel) {
        continue
      }
      if (failureContext.attemptedResolvedModels.some(id => normalizeModelId(id) === normalizeModelId(retryModel))) {
        continue
      }
      failureContext.attemptedResolvedModels.push(retryModel)
      failureContext.availableCount = Math.max(failureContext.availableCount, preview.availableCount)
      failureContext.resolvedModel = retryModel
      const retryRes = await runImageRequest(retryModel, `-${failureContext.attemptedResolvedModels.length}`)
      if (retryRes.ok) {
        res = retryRes
        model = retryModel
        detail = ''
        break
      }
      detail = await parseErrorBody(retryRes)
      res = retryRes
      if (!shouldRetryWithActivationFallback(retryRes.status, detail)) {
        break
      }
    }
  }
  if (!res.ok) {
    throw new Error(formatBytePlusImageFailure(detail || `Run image generation failed (${res.status})`, failureContext))
  }
  const data = (await res.json()) as unknown
  const asset = await extractImageAsset(data)
  return asset ? { ...asset, model } : null
}

export async function generateRunVideoWithBytePlus(args: {
  config: RunGenerationConfig
  prompt: string
  options?: RunVideoGenerationOptions
}): Promise<GeneratedBinaryAsset | null> {
  if (normalizeChatProviderId(args.config.provider) !== CHAT_PROVIDER_BYTEPLUS) {
    throw new Error('BytePlus video run failed: provider must resolve to BytePlus ModelArk.')
  }
  const defaults = readBytePlusVideoDefaults()
  const endpoint = resolveBytePlusContentEndpointForRequest({
    endpointUrl: args.config.endpointUrl,
    path: CHAT_BYTEPLUS_CONTENT_GENERATIONS_TASKS_PATH,
  })
  if (!endpoint) {
    throw new Error('BytePlus video run failed: endpoint is not configured. Fix: set a valid BytePlus regional base URL in MainPanel Integrations -> Chat -> Provider profiles.')
  }
  const modelPreview = await resolveGenerationModelPreview(
    args.config,
    'video',
    args.options?.model,
    { fast: args.options?.fast ?? defaults.fast },
  )
  const model = modelPreview.resolvedModel
  const failureContext: BytePlusVideoFailureContext = {
    preferredModel: modelPreview.preferredModel,
    resolvedModel: modelPreview.resolvedModel,
    matchedAvailableModel: modelPreview.matchedAvailableModel,
    availableCount: modelPreview.availableCount,
    authMode: cleanString(args.config.apiKey) ? 'byok' : 'serverManaged',
  }
  const requestId = toRequestId('kg-run-video')
  const referenceImageUrl = cleanString(args.options?.referenceImageUrl)
  const contentOverride = (() => {
    const widgetOverrideRaw = cleanString(args.options?.contentJson)
    if (widgetOverrideRaw) {
      try {
        const parsed = JSON.parse(widgetOverrideRaw) as unknown
        return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : null
      } catch {
        return null
      }
    }
    const raw = defaults.contentJson.trim()
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : null
    } catch {
      return null
    }
  })()
  const content = contentOverride || ([{ type: 'text', text: args.prompt }] as Array<Record<string, unknown>>)
  if (referenceImageUrl) {
    content.push({
      type: 'image_url',
      image_url: {
        url: referenceImageUrl,
      },
    })
  }
  const duration = cleanInteger(args.options?.duration) ?? defaults.duration
  const generateAudio = cleanBool(args.options?.generateAudio) ?? defaults.generateAudio
  const watermark = cleanBool(args.options?.watermark) ?? defaults.watermark
  const aspectRatio = cleanString(args.options?.aspectRatio) || defaults.aspectRatio
  const resolution = cleanString(args.options?.resolution) || defaults.resolution
  const createRes = await fetch(endpoint, {
    method: 'POST',
    headers: buildProxyHeaders(args.config, requestId),
    body: JSON.stringify({
      model,
      content,
      resolution: resolution || '720p',
      ratio: mapAspectRatioToVideoRatio(aspectRatio),
      duration: duration != null && duration > 0 ? duration : 5,
      generate_audio: generateAudio === true,
      watermark: watermark === true,
    }),
  })
  if (!createRes.ok) {
    const detail = await parseErrorBody(createRes)
    throw new Error(formatBytePlusVideoFailure(detail || `Run video generation failed (${createRes.status})`, failureContext))
  }
  const created = (await createRes.json()) as { id?: unknown }
  const taskId = cleanString(created?.id)
  if (!taskId) {
    throw new Error(formatBytePlusVideoFailure('BytePlus task creation succeeded but no task id was returned.', failureContext))
  }
  const statusEndpoint = resolveBytePlusContentEndpointForRequest({
    endpointUrl: args.config.endpointUrl,
    path: `${CHAT_BYTEPLUS_CONTENT_GENERATIONS_TASKS_PATH}/${taskId}`,
  })
  if (!statusEndpoint) {
    throw new Error(formatBytePlusVideoFailure('BytePlus task polling endpoint is not configured.', failureContext))
  }
  let lastKnownStatus = 'queued'
  let lastKnownUpdatedAt = ''
  for (let attempt = 0; attempt < BYTEPLUS_VIDEO_POLL_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await new Promise(resolve => globalThis.setTimeout(resolve, getBytePlusVideoPollDelayMs(attempt)))
    }
    const statusRes = await fetch(statusEndpoint, {
      method: 'GET',
      headers: buildProxyHeaders(args.config, `${requestId}-${attempt}`),
    })
    if (!statusRes.ok) {
      if (attempt >= BYTEPLUS_VIDEO_POLL_MAX_ATTEMPTS - 1) {
        const detail = await parseErrorBody(statusRes)
        throw new Error(formatBytePlusVideoFailure(detail || `BytePlus task polling failed (${statusRes.status})`, failureContext))
      }
      continue
    }
    const payload = (await statusRes.json()) as { status?: unknown }
    const status = cleanString(payload?.status).toLowerCase()
    if (status) lastKnownStatus = status
    lastKnownUpdatedAt = cleanString((payload as { updated_at?: unknown }).updated_at)
    if (status === 'failed' || status === 'expired') {
      const detail = extractErrorMessage(payload) || `BytePlus task ${taskId} ended with status ${status}.`
      throw new Error(formatBytePlusVideoFailure(detail, failureContext))
    }
    const url = extractVideoUrl(payload)
    if (status === 'succeeded' && url) {
      const blob = await fetchBlobFromUrl(url)
      const renderUrl = resolveBinaryDownloadProxyUrl(url)
      if (!blob || !renderUrl) {
        throw new Error(formatBytePlusVideoFailure('BytePlus task succeeded but the generated video asset could not be downloaded through the shared asset proxy.', failureContext))
      }
      return {
        blob,
        renderUrl,
        sourceUrl: cleanString(url),
        model,
      }
    }
  }
  const timeoutDetail = [
    'BytePlus task did not reach a downloadable succeeded state before polling timed out.',
    `Last task status: ${lastKnownStatus || 'unknown'}.`,
    lastKnownUpdatedAt ? `Last updated_at: ${lastKnownUpdatedAt}.` : '',
    `Polling window: ${String(BYTEPLUS_VIDEO_POLL_MAX_ATTEMPTS)} attempts with progressive 2.5s/5s/10s backoff.`,
    'Fix: the task may still be generating; rerun after lowering duration/resolution or use a faster/smaller model if this region/account consistently exceeds the current polling window.',
  ].filter(Boolean).join(' ')
  throw new Error(formatBytePlusVideoFailure(timeoutDetail, failureContext))
}
