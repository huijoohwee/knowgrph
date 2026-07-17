import { generateRunMarkdownWithProvider } from '@/features/chat/byteplusRunGeneration'

const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses'
const OPENAI_TEST_MODEL = 'gpt-5-nano'

export async function testGenerateRunMarkdownWithProviderSupportsOpenAiResponsesApi() {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url !== '/__chat_proxy/v1/responses') {
        throw new Error(`unexpected openai responses endpoint: ${url}`)
      }
      const body = JSON.parse(String(init?.body || '{}')) as {
        model?: string
        input?: unknown
        instructions?: unknown
        messages?: unknown
      }
      if (!body.model) throw new Error('expected responses request to include model')
      if (typeof body.instructions !== 'string' || !body.instructions.trim()) {
        throw new Error('expected responses request to include instructions')
      }
      if (typeof body.input !== 'string' || !body.input.trim()) {
        throw new Error('expected responses request to use input text payload')
      }
      if (typeof body.messages !== 'undefined') {
        throw new Error('expected responses request to omit messages field')
      }
      return new Response(JSON.stringify({
        output: [{
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: '# Final Output\n\nSpecific answer.' }],
        }],
      }), { headers: { 'content-type': 'application/json' } })
    }) as typeof fetch

    const text = await generateRunMarkdownWithProvider({
      config: {
        provider: 'openai',
        endpointUrl: OPENAI_RESPONSES_ENDPOINT,
        apiKey: '',
        chatModel: OPENAI_TEST_MODEL,
      },
      prompt: 'Generate markdown',
      options: { chatMaxCompletionTokens: 120 },
    })
    if (text !== '# Final Output\n\nSpecific answer.') {
      throw new Error(`unexpected generated markdown from responses: ${String(text)}`)
    }

    globalThis.fetch = (async () => new Response(JSON.stringify({
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output: [
        { type: 'reasoning', content: [] },
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"response":{"structuredContent":{"cards":[' }] },
      ],
    }), { headers: { 'content-type': 'application/json' } })) as typeof fetch
    let errorMessage = ''
    try {
      await generateRunMarkdownWithProvider({
        config: {
          provider: 'openai',
          endpointUrl: OPENAI_RESPONSES_ENDPOINT,
          chatModel: OPENAI_TEST_MODEL,
        },
        prompt: 'Generate markdown',
        options: { chatStream: false, chatMaxCompletionTokens: 1000 },
      })
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error || '')
    }
    if (!errorMessage.includes('incomplete response (max_output_tokens)')) {
      throw new Error(`expected incomplete OpenAI Responses output to remain distinct from semantic rejection, got ${errorMessage}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}
