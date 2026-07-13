import { applyWorkspaceImportToCanvas } from '@/features/workspace-fs/applyWorkspaceImportToCanvas'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { activateFirstImportedWorkspaceFile } from '@/features/markdown-workspace/useWorkspaceFileActions/importRuntimeActions'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  AGENTIC_VIDEO_ROUTE_TOKEN,
  VIDEO_GENERATION_DEMO_SCRIPT_BINDING_TOKEN,
  parseGenerationInvocation,
  type GenerationInvocation,
} from '@/features/chat/generationInvocation'
import { isVideoAgentDemoPresetError, loadVideoAgentDemoPreset } from '@/features/chat/videoAgentDemoPreset'
import { requestWorkflowRunAllFromCommittedCanvas } from '@/features/canvas/workflowRunAllBridge'
import type { WorkflowRunAllStatus } from '@/features/canvas/utils'
import { getCachedStoryboardWidgetWorkflowRunPlan } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetRenderGraph'
import { getChatProviderLabel } from '@/lib/chatEndpoint'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import type { GraphData } from '@/lib/graph/types'
import { splitInvocationTokenSegments } from '@/lib/markdown/invocationTokens'
import {
  buildHistoryKey,
  cacheChatHistoryMessagesForKeys,
  publishChatHistoryTransition,
} from './floatingPanelChatRuntime'
import type { ChatMessage } from '../FloatingPanelChatSections'
import type { FloatingPanelChatSubmitArgs } from './floatingPanelChatSubmitTypes'

const buildVideoAgentPresetRunStartedResponse = (args: {
  invocation: GenerationInvocation
  authMode: 'byok' | 'serverManaged'
}): string => (
  `Loaded the source-backed agentic video canvas and started Run all with ${getChatProviderLabel(args.invocation.provider)} using ${args.authMode === 'byok' ? 'BYOK' : 'server-managed credentials'} at #spec.${args.invocation.specification}. Progress and typed failures appear in this Chat thread; returned text, image, audio, and video artifacts populate Cards, Widgets, Rich Media Panels, Timeline, Media, and Source Files.`
)

export const buildVideoAgentPresetRunProgressResponse = (args: {
  startedResponse: string
  status: WorkflowRunAllStatus
}): string => `${args.startedResponse}\n\n${args.status.message}`

export type VideoAgentPresetExecutionPreflight =
  | { ok: true; invocation: GenerationInvocation }
  | { ok: false; error: string }

export const resolveVideoAgentPresetExecutionPreflight = (args: {
  input: string
  chatAuthMode: 'byok' | 'serverManaged'
  chatApiKey: string | null
}): VideoAgentPresetExecutionPreflight => {
  const invocation = parseGenerationInvocation(args.input)
  if (!invocation) return { ok: false, error: 'The video preset invocation is missing a valid provider, output, or specification token.' }
  if (args.chatAuthMode === 'byok' && !String(args.chatApiKey || '').trim()) {
    return { ok: false, error: `Enter a ${getChatProviderLabel(invocation.provider)} BYOK credential before sending the preset.` }
  }
  return { ok: true, invocation }
}

type VideoAgentDemoPresetExchangeArgs = {
  input: string
  response: string
  status: 'ok' | 'error'
  timestampMs: number
  modelId: string
  historyKeys: readonly string[]
  messages: FloatingPanelChatSubmitArgs['messages']
  setInput: FloatingPanelChatSubmitArgs['setInput']
  setMessages: FloatingPanelChatSubmitArgs['setMessages']
  pushChatExchangeLog: FloatingPanelChatSubmitArgs['pushChatExchangeLog']
  persistChatExchangeLog: FloatingPanelChatSubmitArgs['persistChatExchangeLog']
}

export const persistVideoAgentDemoPresetExchange = async (args: VideoAgentDemoPresetExchangeArgs): Promise<{ userMessageId: string; assistantMessageId: string }> => {
  const identity = args.timestampMs.toString(36)
  const userMessageId = `video-preset-user-${identity}`
  const assistantMessageId = `video-preset-assistant-${identity}`
  const messages: ChatMessage[] = [
    { id: userMessageId, role: 'user', content: args.input },
    { id: assistantMessageId, role: 'assistant', content: args.response },
  ]
  args.setInput('')
  const messagesWithExchange = cacheChatHistoryMessagesForKeys({
    historyKeys: args.historyKeys,
    messages: [...args.messages, ...messages],
  })
  args.setMessages(publishChatHistoryTransition({ historyKeys: args.historyKeys, messages: messagesWithExchange }))
  args.pushChatExchangeLog({
    request: args.input,
    response: args.response,
    status: args.status,
    model: args.modelId,
    tsMs: args.timestampMs,
  })
  await args.persistChatExchangeLog({
    request: args.input,
    response: args.response,
    status: args.status,
    model: args.modelId,
    timestampMs: args.timestampMs,
  })
  return { userMessageId, assistantMessageId }
}

export const updateVideoAgentDemoPresetAssistantMessage = (args: {
  assistantMessageId: string
  content: string
  historyKeys: readonly string[]
  setMessages: FloatingPanelChatSubmitArgs['setMessages']
}): void => {
  args.setMessages(previous => {
    const next = previous.map(message => (
      message.id === args.assistantMessageId
        ? { ...message, content: args.content }
        : message
    ))
    const cached = cacheChatHistoryMessagesForKeys({
      historyKeys: args.historyKeys,
      messages: next,
    })
    return publishChatHistoryTransition({ historyKeys: args.historyKeys, messages: cached })
  })
}

export const isVideoAgentDemoPresetInvocation = (input: string): boolean => {
  const invocationTokens = new Set(
    splitInvocationTokenSegments(input)
      .filter(segment => segment.kind === 'token')
      .map(segment => segment.value.toLowerCase()),
  )
  return (
    invocationTokens.has(AGENTIC_VIDEO_ROUTE_TOKEN)
    && invocationTokens.has(VIDEO_GENERATION_DEMO_SCRIPT_BINDING_TOKEN)
  )
}

export const tryActivateVideoAgentDemoPreset = async (args: {
  input: string
  submitArgs: FloatingPanelChatSubmitArgs
}): Promise<boolean> => {
  if (!isVideoAgentDemoPresetInvocation(args.input)) return false
  const { submitArgs } = args
  submitArgs.setErrorText(null)
  submitArgs.setIsLoading(true)
  const timestampMs = Date.now()
  let activatedHistoryKey = submitArgs.historyKey
  let response = 'Unable to start the source-backed agentic video canvas.'
  let status: 'ok' | 'error' = 'ok'
  let activationSucceeded = false
  let committedGraphData: GraphData | null = null
  let startedResponse = ''
  let latestRunStatus: WorkflowRunAllStatus | null = null
  let assistantMessageId = ''
  const publishRunStatusToChat = (runStatus: WorkflowRunAllStatus) => {
    latestRunStatus = runStatus
    if (!assistantMessageId || !startedResponse) return
    updateVideoAgentDemoPresetAssistantMessage({
      assistantMessageId,
      content: buildVideoAgentPresetRunProgressResponse({ startedResponse, status: runStatus }),
      historyKeys: [submitArgs.historyKey, activatedHistoryKey],
      setMessages: submitArgs.setMessages,
    })
  }
  try {
    const preset = await loadVideoAgentDemoPreset()
    if (isVideoAgentDemoPresetError(preset)) {
      throw new Error(preset.error)
    }
    const fs = await getWorkspaceFs()
    await applyWorkspaceImportToCanvas({
      fs,
      createdPaths: [preset.presetPath, preset.sourcePath],
      // Register both source documents first; the focused preset below is the
      // single owner that applies graph state for this activation.
      opts: { applyToGraph: false },
    })
    const activated = await activateFirstImportedWorkspaceFile({
      fs,
      createdPaths: [preset.presetPath],
      applyToGraph: true,
    })
    if (!activated) throw new Error('The source-backed video graph did not finish activating.')
    const activeState = useGraphStore.getState()
    const activeGraphData = activeState.graphData as GraphData | null
    const activeDocumentName = String(activeState.markdownDocumentName || '').trim()
    const graphDocumentName = String(((activeGraphData?.metadata || {}) as Record<string, unknown>).markdownDocumentName || '').trim()
    const activeDocumentPath = activeDocumentName ? `/${activeDocumentName.replace(/^\/+/, '')}` : ''
    const [presetDocumentText, activeDocumentText] = await Promise.all([
      fs.readFileText(preset.presetPath).catch(() => ''),
      activeDocumentPath ? fs.readFileText(activeDocumentPath).catch(() => '') : Promise.resolve(''),
    ])
    if (
      !activeDocumentName
      || graphDocumentName !== activeDocumentName
      || !presetDocumentText
      || activeDocumentText !== presetDocumentText
    ) {
      throw new Error('The source-backed video graph did not commit the selected preset document.')
    }
    const runPlan = getCachedStoryboardWidgetWorkflowRunPlan({
      graphData: activeGraphData,
      graphRevision: readGraphDataRevision(activeGraphData),
      preferCurrentGraphDataRefs: true,
    })
    const phaseCounts = runPlan?.phaseCounts
    const imageStageCount = (phaseCounts?.imageFoundation || 0) + (phaseCounts?.imageScene || 0)
    if (!runPlan?.orderedNodeIds.length || !phaseCounts?.text || imageStageCount === 0 || !phaseCounts.video) {
      throw new Error('The source-backed video graph committed without runnable text, image, and video stages.')
    }
    committedGraphData = activeGraphData
    activatedHistoryKey = buildHistoryKey(activeGraphData)
    activationSucceeded = true
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unable to activate the video preset.'
    response = `Unable to activate the source-backed agentic video canvas: ${errorMessage}`
    status = 'error'
    submitArgs.setErrorText(errorMessage)
  }
  if (activationSucceeded) {
    try {
      const preflight = resolveVideoAgentPresetExecutionPreflight({
        input: args.input,
        chatAuthMode: submitArgs.chatAuthMode,
        chatApiKey: submitArgs.chatApiKey,
      })
      if (preflight.ok === false) throw new Error(preflight.error)
      useGraphStore.getState().setChatProvider(preflight.invocation.provider)
      startedResponse = buildVideoAgentPresetRunStartedResponse({
        invocation: preflight.invocation,
        authMode: submitArgs.chatAuthMode,
      })
      const runAccepted = await requestWorkflowRunAllFromCommittedCanvas({
        source: 'chat',
        committedGraphData,
        onStatus: publishRunStatusToChat,
      })
      if (!runAccepted) throw new Error('The committed Storyboard Run all surface did not become ready within 5 seconds.')
      response = startedResponse
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to start Run all.'
      response = `Loaded the source-backed agentic video canvas, but Run all did not start: ${errorMessage}`
      status = 'error'
      submitArgs.setErrorText(errorMessage)
    }
  }
  try {
    const exchange = await persistVideoAgentDemoPresetExchange({
      input: args.input,
      response,
      status,
      timestampMs,
      modelId: submitArgs.chatModel || submitArgs.chatProvider || 'video-agent-preset',
      historyKeys: [submitArgs.historyKey, activatedHistoryKey],
      messages: submitArgs.messages,
      setInput: submitArgs.setInput,
      setMessages: submitArgs.setMessages,
      pushChatExchangeLog: submitArgs.pushChatExchangeLog,
      persistChatExchangeLog: submitArgs.persistChatExchangeLog,
    })
    assistantMessageId = exchange.assistantMessageId
    if (latestRunStatus && startedResponse) publishRunStatusToChat(latestRunStatus)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unable to persist the video preset result.'
    submitArgs.setErrorText(errorMessage)
  } finally {
    submitArgs.setIsLoading(false)
  }
  return true
}
