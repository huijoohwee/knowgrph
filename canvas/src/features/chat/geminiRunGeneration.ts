import {
  CHAT_GEMINI_BASE,
  CHAT_GEMINI_VIDEO_MODEL_DEFAULT,
  CHAT_PROVIDER_GEMINI,
  buildChatProxyHeaders,
  normalizeChatProviderId,
  resolveBinaryDownloadProxyUrl,
  resolveChatEndpointForRequest,
} from '@/lib/chatEndpoint'
import { readGeminiVideoWidgetDefaults } from '@/features/integrations/geminiVideoGenerationDefaults'
import type { RunGenerationConfig, RunVideoGenerationOptions, GeneratedBinaryAsset } from './byteplusRunGeneration'

const GEMINI_VIDEO_POLL_MAX_ATTEMPTS = 36
const GEMINI_VIDEO_POLL_DELAY_MS = 10_000

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

type GeminiVideoFailureContext = {
  model: string
  authMode: 'byok' | 'serverManaged'
}

const formatGeminiVideoFailure = (detail: string, ctx: GeminiVideoFailureContext): string => {
  return [
    `Gemini Veo video run failed: ${detail}`,
    `Model: ${ctx.model}.`,
    `Auth: ${ctx.authMode}.`,
    'Fix: verify API key in MainPanel Integrations, check model availability, or lower resolution/duration.',
  ].join(' ')
}

export async function generateRunVideoWithGemini(args: {
  config: RunGenerationConfig
  prompt: string
  options?: RunVideoGenerationOptions
}): Promise<GeneratedBinaryAsset | null> {
  if (normalizeChatProviderId(args.config.provider) !== CHAT_PROVIDER_GEMINI) {
    throw new Error('Gemini video run failed: provider must resolve to Google Gemini.')
  }

  const defaults = readGeminiVideoWidgetDefaults()
  const model = cleanString(args.options?.model) || defaults.model || CHAT_GEMINI_VIDEO_MODEL_DEFAULT
  const failureContext: GeminiVideoFailureContext = {
    model,
    authMode: cleanString(args.config.apiKey) ? 'byok' : 'serverManaged',
  }

  const requestId = toRequestId('kg-run-gemini-video')
  const aspectRatio = cleanString(args.options?.ratio) || defaults.aspectRatio
  const resolution = cleanString(args.options?.resolution) || defaults.resolution
  const durationSeconds = cleanString(args.options?.duration) || defaults.durationSeconds
  const personGeneration = cleanString(args.options?.personGeneration) || defaults.personGeneration

  const createEndpointPath = `/v1beta/models/${model}:predictLongRunning`
  const upstreamBase = CHAT_GEMINI_BASE
  const createEndpoint = resolveChatEndpointForRequest(`${upstreamBase}${createEndpointPath}`)
  if (!createEndpoint) {
    throw new Error(formatGeminiVideoFailure('endpoint is not configured. Fix: set a valid Gemini base URL in MainPanel Integrations.', failureContext))
  }

  const requestBody: Record<string, unknown> = {
    instances: [{
      prompt: args.prompt,
    }],
    parameters: {
      aspectRatio,
      resolution,
      durationSeconds,
      personGeneration,
    },
  }

  const createRes = await fetch(createEndpoint, {
    method: 'POST',
    headers: buildProxyHeaders(args.config, requestId),
    body: JSON.stringify(requestBody),
  })

  if (!createRes.ok) {
    const errorText = await createRes.text().catch(() => '')
    throw new Error(formatGeminiVideoFailure(`task creation failed (${createRes.status}): ${errorText || 'unknown error'}`, failureContext))
  }

  const created = (await createRes.json()) as { name?: unknown }
  const operationName = cleanString(created?.name)
  if (!operationName) {
    throw new Error(formatGeminiVideoFailure('task creation succeeded but no operation name was returned.', failureContext))
  }

  const pollEndpoint = resolveChatEndpointForRequest(`${upstreamBase}/${operationName}`)
  if (!pollEndpoint) {
    throw new Error(formatGeminiVideoFailure('task polling endpoint is not configured.', failureContext))
  }

  for (let attempt = 0; attempt < GEMINI_VIDEO_POLL_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await new Promise(resolve => globalThis.setTimeout(resolve, GEMINI_VIDEO_POLL_DELAY_MS))
    }

    const statusRes = await fetch(pollEndpoint, {
      method: 'GET',
      headers: buildProxyHeaders(args.config, `${requestId}-${attempt}`),
    })

    if (!statusRes.ok) {
      if (attempt >= GEMINI_VIDEO_POLL_MAX_ATTEMPTS - 1) {
        throw new Error(formatGeminiVideoFailure(`task polling failed (${statusRes.status})`, failureContext))
      }
      continue
    }

    const payload = (await statusRes.json()) as {
      done?: unknown
      error?: { message?: unknown; code?: unknown }
      response?: {
        generateVideoResponse?: {
          generatedSamples?: ReadonlyArray<{
            video?: {
              uri?: unknown
            }
          }>
        }
      }
    }

    if (payload.error) {
      const message = cleanString(payload.error.message) || cleanString(payload.error.code) || 'unknown error'
      throw new Error(formatGeminiVideoFailure(`operation ended with error: ${message}`, failureContext))
    }

    if (payload.done === true) {
      const videoUri = payload.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
      const uri = cleanString(videoUri)
      if (!uri) {
        throw new Error(formatGeminiVideoFailure('operation completed but no video URI was returned in the response.', failureContext))
      }

      const blob = await fetchBlobFromUrl(uri)
      const renderUrl = resolveBinaryDownloadProxyUrl(uri)
      if (!blob || !renderUrl) {
        throw new Error(formatGeminiVideoFailure('video URI was returned but the asset could not be downloaded through the proxy.', failureContext))
      }

      return {
        blob,
        renderUrl,
        sourceUrl: uri,
        model,
      }
    }
  }

  throw new Error(formatGeminiVideoFailure(
    `task did not complete within ${GEMINI_VIDEO_POLL_MAX_ATTEMPTS} polling attempts (${(GEMINI_VIDEO_POLL_MAX_ATTEMPTS * GEMINI_VIDEO_POLL_DELAY_MS / 1000).toFixed(0)}s). The task may still be generating; rerun after lowering resolution/duration.`,
    failureContext,
  ))
}
