import React from 'react'
import { UI_COPY } from '@/lib/config'
import {
  CHAT_DEFAULT_ENDPOINT_URL,
  CHAT_PROVIDER_OPENAI,
  buildChatProxyHeaders,
  getDefaultChatModelForProvider,
  getChatModelOptions,
  normalizeChatEndpointUrlInput,
  normalizeChatModelIdForProvider,
  normalizeChatProviderId,
  resolveChatEndpointForModels,
  resolveChatEndpointForRequest,
} from '@/lib/chatEndpoint'
import { clampChatCompletionTokens } from '../chatAiMarkdownSpec'
import { packChatContext, buildPackedContextSystemPrompt } from '../chatContextPack'
import {
  CHAT_BASE_KGC_RESPONSE_CONTRACT_PROMPT,
  CHAT_BASE_RESPONSE_CONTRACT_PROMPT,
} from '../chatResponseBaseContract'
import {
  buildBoundedGraphSystemPrompt,
  buildMarkdownNodeSnippetPrompt,
  buildWorkspaceWideContextPrompt,
} from '../chatPromptHelpers'
import { buildResolvableVarKeySet, validateChatMarkdown } from '../chatMarkdownValidation'
import { CHAT_AI_MARKDOWN_MAX_RETRY } from '../chatAiMarkdownSpec'
import {
  ensureChatHistoryWorkspaceFilePath,
  isKgcStructuredMarkdown,
  upsertChatHistoryWorkspaceDraft,
} from '../chatHistoryWorkspace'
import { toKgcTraceWorkspacePath } from '../chatHistoryWorkspace.paths'
import {
  buildProviderChatRequestOptions,
  clampTemperature,
  extractAssistantDelta,
  loadAvailableModelIds,
  parseErrorBody,
  parseLine,
  parseSseEvents,
  shouldRetryWithModelFallback,
  toShortId,
  putChatHistoryCache,
  extractKgcBlockFromAssistantText,
} from '../SidePanelChat.helpers'
import type { ChatMessage } from '../SidePanelChatSections'
import type { SidePanelChatSubmitArgs } from './sidePanelChatSubmitTypes'

const wrapFence = (content: string, lang: string): string => {
  const safeLang = String(lang || '').trim() || 'text'
  const safe = String(content || '').replace(/\r\n/g, '\n')
  const ticks = safe.includes('```') ? '````' : '```'
  return [`${ticks}${safeLang}`, safe, ticks].join('\n')
}

const clipForPrompt = (raw: string, maxChars: number): string => {
  const text = String(raw || '')
  if (text.length <= maxChars) return text
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`
}

const toFiniteNumberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

const buildCorrectionPrompt = (args: { ruleId: string; message: string; invalidMarkdown: string }) => {
  const block = clipForPrompt(args.invalidMarkdown, 6000)
  return [
    '@flag:correction',
    `failed_rule: ${args.ruleId}`,
    `reason: ${args.message}`,
    '',
    'Return ONLY one corrected standalone KGC markdown document.',
    'Start immediately with the YAML frontmatter delimiter `---` and continue streaming the final document only.',
    'Do not add preamble, explanation, wrapper prose, or extra markdown outside the KGC document.',
    'Keep the response query-shaped and fully satisfy ALL rules plus the strict output format.',
    'Fix only what is necessary; preserve section order, schema, and request relevance.',
    '',
    'Invalid output (for reference; do not repeat verbatim):',
    wrapFence(block, 'markdown'),
  ].join('\n')
}

export const useSidePanelChatSubmit = (args: SidePanelChatSubmitArgs) => {
  return React.useCallback<React.FormEventHandler<HTMLFormElement>>(async ev => {
    ev.preventDefault()
    const trimmed = args.input.trim()
    if (!trimmed || args.isLoading) return
    if (!args.chatModel) {
      args.setErrorText(UI_COPY.chatMissingEndpointAndModelError)
      args.setConnectivity('unknown')
      args.setConnectivityDetail(null)
      return
    }
    const requestUrl = resolveChatEndpointForRequest(
      normalizeChatEndpointUrlInput(args.chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL, args.chatProvider),
    )
    if (!requestUrl) {
      args.setErrorText(UI_COPY.chatMissingEndpointAndModelError)
      args.setConnectivity('unknown')
      args.setConnectivityDetail(null)
      return
    }

    args.setErrorText(null)
    args.setConnectivityDetail(null)
    const userMessageId = toShortId()
    const assistantMessageId = toShortId()
    const requestTimestampMs = Date.now()
    const traceId = `trace-${requestTimestampMs}-${assistantMessageId}`
    args.setStreamingAssistant({ id: assistantMessageId, text: '' })
    const nextMessages: ChatMessage[] = [
      ...args.messages,
      { id: userMessageId, role: 'user', content: trimmed },
      { id: assistantMessageId, role: 'assistant', content: '' },
    ]
    putChatHistoryCache(args.historyKey, nextMessages.slice(-80))
    args.setMessages(nextMessages)
    args.setInput('')
    args.setIsLoading(true)

    try {
      let liveKgcPath: string | null = null
      if (args.chatStorageTarget === 'chatKnowgrph') {
        liveKgcPath = await ensureChatHistoryWorkspaceFilePath({
          requestedPath: args.chatKnowgrphWorkspacePath,
          timestampMs: requestTimestampMs,
          storageType: 'chatKnowgrph',
          defaultLocalRootPath: args.chatLocalStorageRootPath,
          onResolvedPath: p => args.setChatKnowgrphWorkspacePath(p),
        })
        const liveTracePath = toKgcTraceWorkspacePath(liveKgcPath) || liveKgcPath
        args.setStreamingWorkspacePath(liveTracePath)
        args.followWorkspaceMarkdownPath(liveTracePath)
        await upsertChatHistoryWorkspaceDraft({
          requestedPath: liveKgcPath,
          onResolvedPath: p => args.setChatKnowgrphWorkspacePath(p),
          timestampMs: requestTimestampMs,
          providerSummary: args.chatProviderSummary,
          userText: trimmed,
          assistantText: '',
          storageType: 'chatKnowgrph',
          defaultLocalRootPath: args.chatLocalStorageRootPath,
          title: 'Knowledge Graph Canvas Storage',
          traceId,
        })
      }

      const packedContext = packChatContext({
        graphData: args.graphData,
        currentNode: args.currentNode,
        markdownText: args.markdownText,
        graphSummaryMaxTokens: toFiniteNumberOrUndefined(args.chatGraphSummaryMaxTokens),
        guidelineDigestMaxTokens: toFiniteNumberOrUndefined(args.chatGuidelineDigestMaxTokens),
      })
      const includeSelectionContext = args.chatContextScope === 'selection' || args.chatContextScope === 'hybrid'
      const includeWorkspaceContext = args.chatContextScope === 'workspace' || args.chatContextScope === 'hybrid'

      const systemMessages: { role: 'system'; content: string }[] = [
        {
          role: 'system',
          content:
            args.chatStorageTarget === 'chatKnowgrph'
              ? CHAT_BASE_KGC_RESPONSE_CONTRACT_PROMPT
              : CHAT_BASE_RESPONSE_CONTRACT_PROMPT,
        },
        {
          role: 'system',
          content: buildPackedContextSystemPrompt(packedContext),
        },
      ]

      if (includeSelectionContext) {
        systemMessages.push({ role: 'system', content: buildBoundedGraphSystemPrompt(args.graphData, args.currentNode) })
      }
      if (args.chatSystemPrompt && typeof args.chatSystemPrompt === 'string' && args.chatSystemPrompt.trim()) {
        systemMessages.push({ role: 'system', content: args.chatSystemPrompt })
      }
      if (includeSelectionContext) {
        const markdownSnippet = buildMarkdownNodeSnippetPrompt(args.markdownText, args.currentNode, parseLine)
        if (markdownSnippet) systemMessages.push({ role: 'system', content: markdownSnippet })
      }
      if (includeWorkspaceContext) {
        const workspaceContextPrompt = await buildWorkspaceWideContextPrompt({
          markdownDocumentName: args.markdownDocumentName,
          markdownText: args.markdownText,
          sourceFiles: args.sourceFiles,
          cacheKey: args.workspaceContextCacheKey,
        })
        if (workspaceContextPrompt) systemMessages.push({ role: 'system', content: workspaceContextPrompt })
      }

      const conversationMessages: { role: 'user' | 'assistant'; content: string }[] = nextMessages
        .filter(m => m.id !== assistantMessageId)
        .map(m => ({ role: m.role, content: m.content }))

      const buildPayloadMessages = (correction: string | null) => {
        const out: { role: 'system' | 'user' | 'assistant'; content: string }[] = [...systemMessages]
        if (correction && correction.trim()) out.push({ role: 'system', content: correction })
        out.push(...conversationMessages)
        return out
      }

      const controller = new AbortController()
      args.abortRef.current = controller

      const resolveTokenLimitKey = (): 'max_tokens' | 'max_completion_tokens' => {
        const provider = normalizeChatProviderId(args.chatProvider)
        if (provider === CHAT_PROVIDER_OPENAI) return 'max_completion_tokens'
        return 'max_tokens'
      }

      const sendChat = async (
        model: string,
        messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
        tokenLimitKey: 'max_tokens' | 'max_completion_tokens' = resolveTokenLimitKey(),
      ) => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...buildChatProxyHeaders({
            provider: args.chatProvider,
            apiKey: args.chatAuthMode === 'byok' ? args.chatApiKey : null,
            endpointUrl: args.chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL,
            clientRequestId: `kg-chat-${toShortId()}`,
          }),
        }
        const tokenLimit = clampChatCompletionTokens(args.chatMaxCompletionTokens)
        const effectiveTokenLimit =
          args.chatStorageTarget === 'chatKnowgrph'
            ? Math.max(4000, tokenLimit)
            : tokenLimit
        const providerOptions = buildProviderChatRequestOptions({
          provider: args.chatProvider,
          endpointUrl: args.chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL,
          chatModel: args.chatModel,
          chatTemperature: args.chatTemperature,
          chatServiceTier: args.chatServiceTier,
          chatStream: args.chatStream,
          chatMessagesJson: args.chatMessagesJson,
          chatReasoningEffort: args.chatReasoningEffort,
          chatThinkingType: args.chatThinkingType,
          chatThinkingJson: args.chatThinkingJson,
          chatFrequencyPenalty: args.chatFrequencyPenalty,
          chatPresencePenalty: args.chatPresencePenalty,
          chatTopP: args.chatTopP,
          chatLogprobs: args.chatLogprobs,
          chatTopLogprobs: args.chatTopLogprobs,
          chatParallelToolCalls: args.chatParallelToolCalls,
          chatStopJson: args.chatStopJson,
          chatStreamOptionsJson: args.chatStreamOptionsJson,
          chatResponseFormatJson: args.chatResponseFormatJson,
          chatLogitBiasJson: args.chatLogitBiasJson,
          chatToolsJson: args.chatToolsJson,
          chatToolChoiceJson: args.chatToolChoiceJson,
        })
        return await fetch(requestUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages,
            stream: true,
            ...providerOptions,
            ...(tokenLimitKey === 'max_completion_tokens'
              ? { max_completion_tokens: effectiveTokenLimit }
              : { max_tokens: effectiveTokenLimit }),
          }),
          signal: controller.signal,
        })
      }

      const providerModelOptions = getChatModelOptions(args.chatProvider)
      const normalizedProviderModel = normalizeChatModelIdForProvider(args.chatModel, args.chatProvider)
      let effectiveModel =
        providerModelOptions.includes(normalizedProviderModel)
          ? normalizedProviderModel
          : getDefaultChatModelForProvider(args.chatProvider)

      const MAX_VALIDATION_ATTEMPTS = args.chatStorageTarget === 'chatKnowgrph' ? CHAT_AI_MARKDOWN_MAX_RETRY : 1
      let attempt = 0
      let correctionPrompt: string | null = null
      let finalAssistantText = ''
      let finalValidatedKgc: string | null = null
      let finalStatus: 'ok' | 'error' = 'ok'
      let finalOverride: string | null = null

      while (attempt < MAX_VALIDATION_ATTEMPTS) {
        attempt += 1
        const payloadMessages = buildPayloadMessages(correctionPrompt)
        let tokenLimitKey = resolveTokenLimitKey()
        let tokenParamFallbackTried = false
        let res: Response
        try {
          res = await sendChat(effectiveModel, payloadMessages, tokenLimitKey)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error || '')
          const lowered = message.toLowerCase()
          const isRetryable =
            !controller.signal.aborted &&
            (/aborted/i.test(message) || lowered.includes('failed to fetch') || lowered.includes('networkerror') || lowered.includes('err_aborted'))
          if (!isRetryable) throw error
          res = await sendChat(effectiveModel, payloadMessages, tokenLimitKey)
        }
        if (!res.ok) {
          const initialDetail = await parseErrorBody(res)

          const shouldRetryWithTokenFallback = (status: number, detail: string | null): boolean => {
            if (status !== 400) return false
            const text = String(detail || '')
            return (
              text.includes("Unsupported parameter: 'max_tokens'") ||
              text.includes("Unsupported parameter: 'max_completion_tokens'") ||
              text.includes("Use 'max_completion_tokens' instead") ||
              text.includes('Use "max_completion_tokens" instead')
            )
          }

          if (!tokenParamFallbackTried && shouldRetryWithTokenFallback(res.status, initialDetail)) {
            tokenParamFallbackTried = true
            tokenLimitKey = tokenLimitKey === 'max_tokens' ? 'max_completion_tokens' : 'max_tokens'
            res = await sendChat(effectiveModel, payloadMessages, tokenLimitKey)
          }

          const allowFallback = shouldRetryWithModelFallback(res.status, initialDetail)
          if (allowFallback) {
            const modelsEndpoint = resolveChatEndpointForModels(args.chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL)
            const ids = modelsEndpoint
              ? await loadAvailableModelIds(
                modelsEndpoint,
                buildChatProxyHeaders({
                  provider: args.chatProvider,
                  apiKey: args.chatAuthMode === 'byok' ? args.chatApiKey : null,
                  endpointUrl: args.chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL,
                  clientRequestId: `kg-chat-models-${toShortId()}`,
                }),
              )
              : []
            const preferredFallback = providerModelOptions.find(id => ids.includes(id) && id !== effectiveModel) || ''
            const fallback = preferredFallback || ids.find(id => id !== effectiveModel) || ids[0] || ''
            if (fallback && fallback !== effectiveModel) {
              effectiveModel = fallback
              args.setChatModel(fallback)
              res = await sendChat(fallback, payloadMessages, tokenLimitKey)
            }
          }
          if (!res.ok) {
            const detail = initialDetail || (await parseErrorBody(res))
            const statusText = UI_COPY.chatRequestFailedStatus(res.status)
            const suffix = detail ? ` ${detail}` : ''
            args.setConnectivity('error')
            args.setConnectivityDetail(`Chat endpoint returned ${res.status}.`)
            args.setErrorText(`${statusText}${suffix}`.trim())
            args.setStreamingAssistant(null)
            args.setMessages(prev => prev.filter(m => m.id !== assistantMessageId))
            args.setIsLoading(false)
            args.abortRef.current = null
            return
          }
        }

        const contentType = String(res.headers.get('content-type') || '').toLowerCase()
        const isEventStream = contentType.includes('text/event-stream')

        let assistantText = ''

        const flushDraft = async (text: string, force: boolean) => {
          if (args.chatStorageTarget !== 'chatKnowgrph') return
          if (!liveKgcPath) return
          const liveTracePath = toKgcTraceWorkspacePath(liveKgcPath) || liveKgcPath
          if (!force && args.streamDraftTextRef.current && args.streamDraftTextRef.current.path === liveTracePath && args.streamDraftTextRef.current.text === text) return
          args.followWorkspaceMarkdownPath(liveTracePath)
          args.streamDraftTextRef.current = { path: liveTracePath, text }
          try {
            await upsertChatHistoryWorkspaceDraft({
              requestedPath: liveKgcPath,
              onResolvedPath: p => args.setChatKnowgrphWorkspacePath(p),
              timestampMs: requestTimestampMs,
              providerSummary: args.chatProviderSummary,
              userText: trimmed,
              assistantText: text,
              storageType: 'chatKnowgrph',
              defaultLocalRootPath: args.chatLocalStorageRootPath,
              title: 'Knowledge Graph Canvas Storage',
              traceId,
            })
          } catch {
            void 0
          }
        }

        if (isEventStream && res.body) {
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          let done = false
          let lastDraftFlushMs = 0
          let pendingDraftWrite: Promise<unknown> | null = null
          const flushDraftThrottled = (force: boolean) => {
            if (args.chatStorageTarget !== 'chatKnowgrph') return
            if (!liveKgcPath) return
            const nowMs = Date.now()
            if (!force && nowMs - lastDraftFlushMs < 160) return
            lastDraftFlushMs = nowMs
            pendingDraftWrite = flushDraft(assistantText, force)
          }
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
                const next = extractAssistantDelta(JSON.parse(raw) as unknown)
                if (!next) continue
                assistantText += next
                flushDraftThrottled(false)
              } catch {
                void 0
              }
            }
          }
          flushDraftThrottled(true)
          if (pendingDraftWrite) {
            try {
              await pendingDraftWrite
            } catch {
              void 0
            }
          }
        } else {
          const data = (await res.json()) as unknown
          assistantText = extractAssistantDelta(data) || ''
          await flushDraft(assistantText, true)
        }

        if (!assistantText) {
          args.setErrorText(UI_COPY.chatResponseMissingContentError)
          args.setStreamingAssistant(null)
          args.setMessages(prev => prev.filter(m => m.id !== assistantMessageId))
          const nowMs = Date.now()
          args.pushChatExchangeLog({
            request: trimmed,
            response: UI_COPY.chatResponseMissingContentError,
            status: 'error',
            model: effectiveModel,
            tsMs: nowMs,
          })
          void args.persistChatExchangeLog({
            request: trimmed,
            response: UI_COPY.chatResponseMissingContentError,
            status: 'error',
            model: effectiveModel,
            timestampMs: nowMs,
          })
          args.setIsLoading(false)
          args.abortRef.current = null
          return
        }

        finalAssistantText = assistantText
        if (args.chatStorageTarget !== 'chatKnowgrph') break

        const extracted = extractKgcBlockFromAssistantText(assistantText)
        const kgc = typeof extracted.kgc === 'string' ? extracted.kgc.trim() : ''
        if (!kgc) {
          if (attempt < MAX_VALIDATION_ATTEMPTS) {
            correctionPrompt = buildCorrectionPrompt({
              ruleId: 'V-03',
              message: 'Previous answer did not include a parseable standalone KGC document. Return exactly one complete KGC markdown document.',
              invalidMarkdown: assistantText,
            })
            continue
          }
          finalStatus = 'ok'
          finalAssistantText = assistantText
          break
        }
        if (!isKgcStructuredMarkdown(kgc)) {
          if (attempt < MAX_VALIDATION_ATTEMPTS) {
            correctionPrompt = buildCorrectionPrompt({
              ruleId: 'V-03',
              message: 'Previous KGC payload was incomplete or not structurally parseable. Return one complete KGC markdown document with valid frontmatter and required sections.',
              invalidMarkdown: kgc,
            })
            continue
          }
          finalStatus = 'ok'
          finalAssistantText = assistantText
          break
        }

        const resolvableVarKeys = buildResolvableVarKeySet({ frontmatter: packedContext.frontmatter, markdown: kgc })
        const validation = validateChatMarkdown({ markdown: kgc, resolvableVarKeys })
        if (validation.ok) {
          finalValidatedKgc = kgc
          break
        }

        const first = validation.errors[0]
        const nextRule = first?.ruleId || 'V-03'
        const nextMsg = first?.message || 'Validation failed.'

        if (attempt < MAX_VALIDATION_ATTEMPTS) {
          correctionPrompt = buildCorrectionPrompt({
            ruleId: nextRule,
            message: nextMsg,
            invalidMarkdown: kgc,
          })
          continue
        }

        finalStatus = 'ok'
        finalAssistantText = assistantText
        break
      }

      const nowMs = Date.now()
      await args.finalizeAssistantSuccess({
        assistantMessageId,
        requestText: trimmed,
        modelId: effectiveModel,
        rawAssistantText: finalAssistantText,
        validatedKgc: finalValidatedKgc,
        timestampMs: nowMs,
        traceId,
        knownKnowgrphPath: liveKgcPath,
        status: finalStatus,
        finalAssistantOverride: finalOverride,
      })

      args.setStreamingWorkspacePath(null)
      args.streamFollowRef.current = null
      args.streamDraftTextRef.current = null

      args.setConnectivity('ok')
      args.setConnectivityDetail(null)
      args.setIsLoading(false)
      args.abortRef.current = null
      args.setStreamingWorkspacePath(null)
      args.streamFollowRef.current = null
      args.streamDraftTextRef.current = null
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err || '')
      if (raw && raw.toLowerCase().includes('aborted')) {
        const nowMs = Date.now()
        args.setStreamingAssistant(null)
        args.pushChatExchangeLog({
          request: trimmed,
          response: raw || 'Request aborted',
          status: 'aborted',
          model: args.chatModel || null,
          tsMs: nowMs,
        })
        void args.persistChatExchangeLog({
          request: trimmed,
          response: raw || 'Request aborted',
          status: 'aborted',
          model: args.chatModel || '',
          timestampMs: nowMs,
        })
        args.setMessages(prev => prev.filter(m => m.id !== assistantMessageId))
        args.setConnectivity('unknown')
        args.setConnectivityDetail(null)
        args.setIsLoading(false)
        args.abortRef.current = null
        args.setStreamingWorkspacePath(null)
        args.streamFollowRef.current = null
        args.streamDraftTextRef.current = null
        return
      }
      const lowered = raw.toLowerCase()
      const endpoint = typeof args.chatEndpointUrl === 'string' && args.chatEndpointUrl ? String(args.chatEndpointUrl) : ''
      const isNetwork =
        raw === 'Failed to fetch' ||
        lowered.includes('networkerror') ||
        lowered.includes('net::') ||
        lowered.includes('connection refused')
      const friendly = isNetwork
        ? endpoint
          ? UI_COPY.chatUnableToReachEndpointError(endpoint)
          : UI_COPY.chatUnableToReachEndpointGenericError
        : raw || UI_COPY.chatRequestFailedGenericError

      args.setErrorText(friendly)
      args.setStreamingAssistant(null)
      args.setConnectivity('error')
      args.setConnectivityDetail(friendly)
      const nowMs = Date.now()
      args.pushChatExchangeLog({
        request: trimmed,
        response: friendly,
        status: 'error',
        model: args.chatModel || null,
        tsMs: nowMs,
      })
      void args.persistChatExchangeLog({
        request: trimmed,
        response: friendly,
        status: 'error',
        model: args.chatModel || '',
        timestampMs: nowMs,
      })
      args.setMessages(prev => prev.filter(m => m.id !== assistantMessageId))
      args.setIsLoading(false)
      args.abortRef.current = null
      args.setStreamingWorkspacePath(null)
      args.streamFollowRef.current = null
      args.streamDraftTextRef.current = null
    }
  }, [
    args,
  ])
}
