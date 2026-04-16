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
import { CHAT_KGC_RESPONSE_CONTRACT_PROMPT, CHAT_RESPONSE_CONTRACT_PROMPT } from '../chatResponseContract'
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
import {
  clampTemperature,
  extractAssistantDelta,
  loadAvailableModelIds,
  parseErrorBody,
  parseLine,
  parseSseEvents,
  shouldRetryWithModelFallback,
  toShortId,
  putChatHistoryCache,
} from '../SidePanelChat.helpers'
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

const buildCorrectionPrompt = (args: { ruleId: string; message: string; invalidMarkdown: string }) => {
  const block = clipForPrompt(args.invalidMarkdown, 6000)
  return [
    '@flag:correction',
    `failed_rule: ${args.ruleId}`,
    `reason: ${args.message}`,
    '',
    'Return a corrected answer that fully satisfies ALL rules and the strict output format.',
    'Fix only what is necessary; preserve section order and schema.',
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
        args.setStreamingWorkspacePath(liveKgcPath)
        args.followWorkspaceMarkdownPath(liveKgcPath)
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
        graphSummaryMaxTokens: args.chatGraphSummaryMaxTokens,
        guidelineDigestMaxTokens: args.chatGuidelineDigestMaxTokens,
      })
      const includeSelectionContext = args.chatContextScope === 'selection' || args.chatContextScope === 'hybrid'
      const includeWorkspaceContext = args.chatContextScope === 'workspace' || args.chatContextScope === 'hybrid'

      const systemMessages: { role: 'system'; content: string }[] = [
        {
          role: 'system',
          content: args.chatStorageTarget === 'chatKnowgrph' ? CHAT_KGC_RESPONSE_CONTRACT_PROMPT : CHAT_RESPONSE_CONTRACT_PROMPT,
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
        return await fetch(requestUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages,
            temperature: clampTemperature(args.chatTemperature),
            ...(tokenLimitKey === 'max_completion_tokens'
              ? { max_completion_tokens: tokenLimit }
              : { max_tokens: tokenLimit }),
            stream: true,
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
          if (!force && args.streamDraftTextRef.current && args.streamDraftTextRef.current.path === liveKgcPath && args.streamDraftTextRef.current.text === text) return
          args.followWorkspaceMarkdownPath(liveKgcPath)
          args.streamDraftTextRef.current = { path: liveKgcPath, text }
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

        const extracted = (() => {
          const text = String(assistantText || '').replace(/\r\n/g, '\n')
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
        })()
        const kgc = typeof extracted.kgc === 'string' ? extracted.kgc.trim() : ''
        if (!kgc) {
          finalStatus = 'ok'
          finalAssistantText = assistantText
          break
        }
        if (!isKgcStructuredMarkdown(kgc)) {
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
