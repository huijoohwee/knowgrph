import { buildSubmitArgsFixture } from '@/__tests__/helpers/chatSubmitArgsFixture'
import type { ChatMessage } from '@/features/chat/FloatingPanelChatSections'
import { executeFloatingPanelChatSubmitCoordinator } from '@/features/chat/floatingPanelChat/floatingPanelChatSubmitCoordinator'
import { createChatSubmitRequestSender } from '@/features/chat/floatingPanelChat/floatingPanelChatSubmitRequest'

export async function testCreateChatSubmitRequestSenderUsesOpenAiResponsesInputPayload() {
  let capturedBody: Record<string, unknown> | null = null
  const submitArgs = buildSubmitArgsFixture({
    chatProvider: 'openai',
    chatEndpointUrl: 'https://api.openai.com/v1/responses',
    chatModel: 'gpt-5-nano',
    chatMaxCompletionTokens: 512,
  })
  const sender = createChatSubmitRequestSender({
    submitArgs,
    requestUrl: '/__chat_proxy/v1/responses',
    controller: new AbortController(),
    fetchFn: async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>
      return new Response('{}', { status: 200 })
    },
  })
  await sender('gpt-5-nano', [
    { role: 'system', content: 'base-system' },
    { role: 'user', content: 'Generate KGC' },
    { role: 'assistant', content: 'Previous answer' },
  ], 'max_completion_tokens')
  if (!capturedBody) throw new Error('Expected OpenAI Responses request sender to invoke fetch')
  if ('messages' in capturedBody || capturedBody.max_completion_tokens) {
    throw new Error(`Expected OpenAI Responses payload to omit Chat Completions fields, got ${JSON.stringify(capturedBody)}`)
  }
  if (capturedBody.max_output_tokens !== 512 || capturedBody.stream !== true) {
    throw new Error(`Expected OpenAI Responses payload to use max_output_tokens and streaming, got ${JSON.stringify(capturedBody)}`)
  }
  const input = Array.isArray(capturedBody.input) ? capturedBody.input as Array<Record<string, unknown>> : []
  const userContent = Array.isArray(input[1]?.content) ? input[1]?.content as Array<Record<string, unknown>> : []
  const assistantContent = Array.isArray(input[2]?.content) ? input[2]?.content as Array<Record<string, unknown>> : []
  if (input.length !== 3 || input[0]?.role !== 'system' || userContent[0]?.type !== 'input_text' || assistantContent[0]?.type !== 'output_text') {
    throw new Error(`Expected OpenAI Responses input messages with typed text parts, got ${JSON.stringify(capturedBody.input)}`)
  }
}

export async function testExecuteFloatingPanelChatSubmitCoordinatorAvoidsDuplicateEndpointConnectivityDetail() {
  const errors: Array<string | null> = []
  const connectivity: Array<'unknown' | 'ok' | 'error'> = []
  const connectivityDetail: Array<string | null> = []
  let messages: ChatMessage[] = [{ id: 'assistant-pending', role: 'assistant', content: '' }]
  const submitArgs = buildSubmitArgsFixture({
    chatStorageTarget: 'chatHistory',
    setErrorText: value => { errors.push(typeof value === 'function' ? null : value) },
    setConnectivity: value => { connectivity.push(typeof value === 'function' ? 'unknown' : value) },
    setConnectivityDetail: value => { connectivityDetail.push(typeof value === 'function' ? null : value) },
    setMessages: updater => { messages = typeof updater === 'function' ? updater(messages) : updater },
    abortRef: { current: null },
    streamDraftTextRef: { current: null },
    streamFollowRef: { current: null },
  })
  await executeFloatingPanelChatSubmitCoordinator({
    submitArgs,
    requestUrl: '/__chat_proxy/v1/responses',
    trimmedInput: 'Generate KGC',
    assistantMessageId: 'assistant-pending',
    nextMessages: [{ id: 'user-1', role: 'user', content: 'Generate KGC' }],
    requestTimestampMs: Date.UTC(2026, 4, 22, 18, 1, 0),
    traceId: 'trace-endpoint-400',
    bootstrapDraft: async () => null,
    buildRequestContext: async () => ({
      packedContext: { selected_node: null, connected_edges: [], frontmatter: null, graph_summary: '', guideline_digest: '' },
      systemMessages: [{ role: 'system', content: 'base-system' }],
      conversationMessages: [{ role: 'user', content: 'Generate KGC' }],
    }),
    createRequestSender: () => async () => new Response('{}', { status: 400 }),
    resolveInitialModel: () => ({ providerModelOptions: ['gpt-5-nano'], effectiveModel: 'gpt-5-nano' }),
    executeTransportAttempt: async () => ({
      response: new Response('{}', { status: 400 }),
      effectiveModel: 'gpt-5-nano',
      detail: "Unsupported parameter: 'messages'. In the Responses API, this parameter has moved to 'input'.",
    }),
  })
  if (!errors[0]?.includes("Unsupported parameter: 'messages'")) {
    throw new Error(`Expected coordinator to keep the endpoint detail in the primary error text, got ${JSON.stringify(errors)}`)
  }
  if (connectivity[0] !== 'error' || connectivityDetail[0] !== null) {
    throw new Error(`Expected endpoint status failure to avoid a duplicate connectivity detail, got ${JSON.stringify({ connectivity, connectivityDetail })}`)
  }
  if (messages.some(message => message.id === 'assistant-pending')) {
    throw new Error('Expected endpoint status failure to dismiss the pending assistant placeholder')
  }
}
