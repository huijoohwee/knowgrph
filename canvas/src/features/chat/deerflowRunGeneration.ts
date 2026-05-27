import {
  CHAT_DEERFLOW_CHAT_COMPLETIONS_PATH,
  CHAT_DEERFLOW_ENDPOINT_URL,
  CHAT_PROVIDER_DEERFLOW,
  buildChatProxyHeaders,
  normalizeChatProviderId,
  resolveBinaryDownloadProxyUrl,
  resolveChatEndpointForRequest,
} from '@/lib/chatEndpoint'
import { parseErrorBody, parseSseEvents } from './FloatingPanelChat.helpers'
import type {
  GeneratedBinaryAsset,
  RunGenerationConfig,
  RunImageGenerationOptions,
  RunVideoGenerationOptions,
} from './byteplusRunGeneration'

type DeerFlowRunKind = 'image' | 'video'

const DEERFLOW_RUNS_STREAM_PATH = '/api/runs/stream'

const cleanString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : ''
}

const cleanInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const cleanBool = (value: unknown): boolean | null => {
  if (value === true) return true
  if (value === false) return false
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase()
    if (lowered === 'true' || lowered === '1' || lowered === 'yes' || lowered === 'on') return true
    if (lowered === 'false' || lowered === '0' || lowered === 'no' || lowered === 'off') return false
  }
  return null
}

const buildRequestId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}`

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

const resolveDeerFlowRunsStreamEndpoint = (endpointUrl: unknown): string | null => {
  const requestEndpoint = resolveChatEndpointForRequest(endpointUrl || CHAT_DEERFLOW_ENDPOINT_URL)
  if (!requestEndpoint) return null
  const splitAt = requestEndpoint.indexOf('?')
  const pathOnly = splitAt >= 0 ? requestEndpoint.slice(0, splitAt) : requestEndpoint
  if (pathOnly.endsWith(CHAT_DEERFLOW_CHAT_COMPLETIONS_PATH)) {
    return `${pathOnly.slice(0, -CHAT_DEERFLOW_CHAT_COMPLETIONS_PATH.length)}${DEERFLOW_RUNS_STREAM_PATH}`
  }
  if (pathOnly.endsWith('/v1/chat/completions')) {
    return `${pathOnly.slice(0, -'/v1/chat/completions'.length)}${DEERFLOW_RUNS_STREAM_PATH}`
  }
  if (pathOnly.endsWith('/v1/responses')) {
    return `${pathOnly.slice(0, -'/v1/responses'.length)}${DEERFLOW_RUNS_STREAM_PATH}`
  }
  if (pathOnly.endsWith('/')) return `${pathOnly.slice(0, -1)}${DEERFLOW_RUNS_STREAM_PATH}`
  return `${pathOnly}${DEERFLOW_RUNS_STREAM_PATH}`
}

const deriveProxyPrefix = (requestPath: string): string => {
  const raw = cleanString(requestPath)
  if (!raw) return ''
  const idx = raw.indexOf('/api/')
  if (idx <= 0) return ''
  return raw.slice(0, idx)
}

const isImageAssetPath = (value: string): boolean => {
  return /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(value)
}

const isVideoAssetPath = (value: string): boolean => {
  return /\.(mp4|webm|mov|m4v|avi|mkv)(\?|$)/i.test(value)
}

const extractArtifactPathFromFileEntry = (entry: unknown, kind: DeerFlowRunKind): string => {
  if (!entry || typeof entry !== 'object') return ''
  const candidateFields = ['artifact_path', 'path', 'file_path', 'url', 'download_url', 'artifact_url']
  for (const field of candidateFields) {
    const candidate = cleanString((entry as Record<string, unknown>)[field])
    if (!candidate) continue
    if (kind === 'image' && !isImageAssetPath(candidate)) continue
    if (kind === 'video' && !isVideoAssetPath(candidate)) continue
    return candidate
  }
  return ''
}

const extractRunArtifactCandidate = (
  payload: unknown,
  kind: DeerFlowRunKind,
): { url: string; sourceUrl?: string; model?: string } | null => {
  if (!payload || typeof payload !== 'object') return null
  const rec = payload as Record<string, unknown>
  const model = cleanString(rec.model)
  const directUrlFields = ['artifact_url', 'url', 'image_url', 'video_url', 'download_url']
  for (const field of directUrlFields) {
    const value = cleanString(rec[field])
    if (!value) continue
    return { url: value, sourceUrl: value, ...(model ? { model } : {}) }
  }

  const artifact = rec.artifact
  if (artifact && typeof artifact === 'object') {
    const nested = extractRunArtifactCandidate(artifact, kind)
    if (nested) {
      return model && !nested.model ? { ...nested, model } : nested
    }
  }
  const data = rec.data
  if (data && typeof data === 'object') {
    const nested = extractRunArtifactCandidate(data, kind)
    if (nested) {
      return model && !nested.model ? { ...nested, model } : nested
    }
  }

  const threadId = cleanString(rec.thread_id) || cleanString((rec.thread as Record<string, unknown> | undefined)?.id)
  const artifactPath = cleanString(rec.artifact_path) || cleanString(rec.path) || cleanString(rec.file_path)
  const files = Array.isArray(rec.files) ? rec.files : Array.isArray((rec.artifacts as Record<string, unknown> | undefined)?.files) ? ((rec.artifacts as Record<string, unknown>).files as unknown[]) : []
  const filePath = files
    .map(file => extractArtifactPathFromFileEntry(file, kind))
    .find(Boolean) || ''
  const selectedPath = artifactPath || filePath
  if (threadId && selectedPath && !/^https?:\/\//i.test(selectedPath)) {
    const normalizedPath = selectedPath.startsWith('/') ? selectedPath : `/${selectedPath}`
    const url = `/api/threads/${encodeURIComponent(threadId)}/artifacts${normalizedPath}`
    return { url, ...(model ? { model } : {}) }
  }
  return null
}

const absolutizeArtifactUrl = (args: { rawUrl: string; proxyPrefix: string }): string => {
  const raw = cleanString(args.rawUrl)
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('/')) {
    if (args.proxyPrefix && raw.startsWith('/api/')) return `${args.proxyPrefix}${raw}`
    return raw
  }
  const prefixed = raw.startsWith('api/') ? `/${raw}` : `/api/${raw}`
  if (args.proxyPrefix) return `${args.proxyPrefix}${prefixed}`
  return prefixed
}

const fetchBlobFromArtifactUrl = async (url: string): Promise<{ blob: Blob; renderUrl: string } | null> => {
  const target = cleanString(url)
  if (!target) return null
  if (target.startsWith('/')) {
    const res = await fetch(target, { method: 'GET' })
    if (!res.ok) return null
    return { blob: await res.blob(), renderUrl: target }
  }
  const renderUrl = resolveBinaryDownloadProxyUrl(target)
  const res = await fetch(renderUrl, { method: 'GET', headers: { Accept: '*/*' } })
  if (!res.ok) return null
  return { blob: await res.blob(), renderUrl }
}

const parseRunStreamArtifact = async (
  res: Response,
  kind: DeerFlowRunKind,
  proxyPrefix: string,
): Promise<{ blob: Blob; renderUrl: string; sourceUrl?: string; model?: string } | null> => {
  const body = res.body
  if (!body) return null
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let latestCandidate: { url: string; sourceUrl?: string; model?: string } | null = null
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    buffer += decoder.decode(chunk.value, { stream: true })
    const parsed = parseSseEvents(buffer)
    buffer = parsed.rest
    for (const event of parsed.events) {
      if (event === '[DONE]') continue
      try {
        const payload = JSON.parse(event) as unknown
        const candidate = extractRunArtifactCandidate(payload, kind)
        if (candidate) latestCandidate = candidate
      } catch {
        void 0
      }
    }
  }
  buffer += decoder.decode()
  if (buffer.trim()) {
    const parsed = parseSseEvents(buffer)
    for (const event of parsed.events) {
      if (event === '[DONE]') continue
      try {
        const payload = JSON.parse(event) as unknown
        const candidate = extractRunArtifactCandidate(payload, kind)
        if (candidate) latestCandidate = candidate
      } catch {
        void 0
      }
    }
  }
  if (!latestCandidate) return null
  const artifactUrl = absolutizeArtifactUrl({ rawUrl: latestCandidate.url, proxyPrefix })
  if (!artifactUrl) return null
  const asset = await fetchBlobFromArtifactUrl(artifactUrl)
  if (!asset) return null
  return {
    blob: asset.blob,
    renderUrl: asset.renderUrl,
    sourceUrl: cleanString(latestCandidate.sourceUrl) || (/^https?:\/\//i.test(artifactUrl) ? artifactUrl : undefined),
    model: cleanString(latestCandidate.model) || undefined,
  }
}

const runDeerFlowRichMediaGeneration = async (args: {
  kind: DeerFlowRunKind
  config: RunGenerationConfig
  prompt: string
  options?: RunImageGenerationOptions | RunVideoGenerationOptions
}): Promise<GeneratedBinaryAsset | null> => {
  if (normalizeChatProviderId(args.config.provider) !== CHAT_PROVIDER_DEERFLOW) return null
  const endpoint = resolveDeerFlowRunsStreamEndpoint(args.config.endpointUrl)
  if (!endpoint) {
    throw new Error('DeerFlow rich media run failed: endpoint is not configured.')
  }
  const requestId = buildRequestId(`kg-deerflow-${args.kind}`)
  const model = cleanString((args.options as { model?: unknown } | undefined)?.model)
    || cleanString(args.config.chatModel)
  const commonOptions: Record<string, unknown> = {
    ...(model ? { model } : {}),
    prompt: args.prompt,
  }
  if (args.kind === 'image') {
    const imageOptions = args.options as RunImageGenerationOptions | undefined
    Object.assign(commonOptions, {
      ...(cleanString(imageOptions?.size) ? { size: cleanString(imageOptions?.size) } : {}),
      ...(cleanString(imageOptions?.outputFormat) ? { output_format: cleanString(imageOptions?.outputFormat) } : {}),
      ...(cleanString(imageOptions?.responseFormat) ? { response_format: cleanString(imageOptions?.responseFormat) } : {}),
      ...(cleanString(imageOptions?.optimizePromptOptions) ? { optimize_prompt_options: cleanString(imageOptions?.optimizePromptOptions) } : {}),
      ...(cleanString(imageOptions?.referenceImageUrl) ? { reference_image: cleanString(imageOptions?.referenceImageUrl) } : {}),
      ...(imageOptions?.aspectRatio != null ? { aspect_ratio: imageOptions.aspectRatio } : {}),
      ...(cleanBool(imageOptions?.stream) != null ? { stream: cleanBool(imageOptions?.stream) } : {}),
      ...(cleanBool(imageOptions?.watermark) != null ? { watermark: cleanBool(imageOptions?.watermark) } : {}),
      ...(cleanInteger(imageOptions?.seed) != null ? { seed: cleanInteger(imageOptions?.seed) } : {}),
    })
  } else {
    const videoOptions = args.options as RunVideoGenerationOptions | undefined
    Object.assign(commonOptions, {
      ...(cleanString(videoOptions?.ratio) ? { ratio: cleanString(videoOptions?.ratio) } : {}),
      ...(cleanString(videoOptions?.resolution) ? { resolution: cleanString(videoOptions?.resolution) } : {}),
      ...(cleanInteger(videoOptions?.duration) != null ? { duration: cleanInteger(videoOptions?.duration) } : {}),
      ...(cleanBool(videoOptions?.generateAudio) != null ? { generate_audio: cleanBool(videoOptions?.generateAudio) } : {}),
      ...(cleanBool(videoOptions?.draft) != null ? { draft: cleanBool(videoOptions?.draft) } : {}),
      ...(cleanBool(videoOptions?.cameraFixed) != null ? { camera_fixed: cleanBool(videoOptions?.cameraFixed) } : {}),
      ...(cleanString(videoOptions?.imageUrlUrl) ? { image_url_mode: cleanString(videoOptions?.imageUrlUrl) } : {}),
      ...(cleanString(videoOptions?.referenceImageUrl) ? { reference_image: cleanString(videoOptions?.referenceImageUrl) } : {}),
      ...(cleanString(videoOptions?.contentJson) ? { content_json: cleanString(videoOptions?.contentJson) } : {}),
    })
  }

  const payload = {
    kind: args.kind,
    mode: args.kind,
    prompt: args.prompt,
    options: commonOptions,
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: buildProxyHeaders(args.config, requestId),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await parseErrorBody(res)
    throw new Error(detail || `DeerFlow ${args.kind} run failed (${res.status})`)
  }

  const proxyPrefix = deriveProxyPrefix(endpoint)
  const contentType = String((typeof res.headers.get === 'function' ? res.headers.get('content-type') : '') || '').toLowerCase()
  const streamed = contentType.includes('text/event-stream')
    ? await parseRunStreamArtifact(res, args.kind, proxyPrefix)
    : null
  if (streamed) {
    return {
      blob: streamed.blob,
      renderUrl: streamed.renderUrl,
      sourceUrl: streamed.sourceUrl,
      model: streamed.model || model || 'deerflow',
    }
  }
  const data = (await res.json()) as unknown
  const candidate = extractRunArtifactCandidate(data, args.kind)
  if (!candidate) return null
  const artifactUrl = absolutizeArtifactUrl({ rawUrl: candidate.url, proxyPrefix })
  if (!artifactUrl) return null
  const asset = await fetchBlobFromArtifactUrl(artifactUrl)
  if (!asset) return null
  return {
    blob: asset.blob,
    renderUrl: asset.renderUrl,
    sourceUrl: cleanString(candidate.sourceUrl) || (/^https?:\/\//i.test(artifactUrl) ? artifactUrl : undefined),
    model: cleanString(candidate.model) || model || 'deerflow',
  }
}

export async function generateRunImageWithDeerFlow(args: {
  config: RunGenerationConfig
  prompt: string
  options?: RunImageGenerationOptions
}): Promise<GeneratedBinaryAsset | null> {
  return runDeerFlowRichMediaGeneration({
    kind: 'image',
    config: args.config,
    prompt: args.prompt,
    options: args.options,
  })
}

export async function generateRunVideoWithDeerFlow(args: {
  config: RunGenerationConfig
  prompt: string
  options?: RunVideoGenerationOptions
}): Promise<GeneratedBinaryAsset | null> {
  return runDeerFlowRichMediaGeneration({
    kind: 'video',
    config: args.config,
    prompt: args.prompt,
    options: args.options,
  })
}
