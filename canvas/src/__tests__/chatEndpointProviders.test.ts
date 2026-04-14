import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_OPENAI_ENDPOINT_URL,
  CHAT_PROVIDER_BYTEPLUS,
  CHAT_PROVIDER_OPENAI,
  buildChatProxyHeaders,
  getChatProviderLabel,
  getChatProviderRegionLabel,
  resolveChatEndpointForModels,
  resolveChatEndpointForRequest,
} from '@/lib/chatEndpoint'

export function testBytePlusProviderBuildsOfficialProxyHeaders() {
  const headers = buildChatProxyHeaders({
    provider: CHAT_PROVIDER_BYTEPLUS,
    apiKey: 'byteplus-secret',
    endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
    clientRequestId: 'kg-byteplus-test-123',
  })
  if (headers['X-KG-Chat-Provider'] !== CHAT_PROVIDER_BYTEPLUS) {
    throw new Error(`expected BytePlus provider header, got ${JSON.stringify(headers)}`)
  }
  if (headers['X-KG-Chat-Upstream'] !== 'https://ark.ap-southeast.bytepluses.com') {
    throw new Error(`expected BytePlus upstream header, got ${JSON.stringify(headers)}`)
  }
  if (headers['X-KG-Chat-Api-Key'] !== 'byteplus-secret') {
    throw new Error(`expected BytePlus API key header, got ${JSON.stringify(headers)}`)
  }
  if (headers['X-Client-Request-Id'] !== 'kg-byteplus-test-123') {
    throw new Error(`expected client request id header, got ${JSON.stringify(headers)}`)
  }
}

export function testOfficialEndpointsNormalizeToProxyPaths() {
  const bytePlusRequest = resolveChatEndpointForRequest(CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL)
  const bytePlusModels = resolveChatEndpointForModels(CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL)
  const openAiRequest = resolveChatEndpointForRequest(CHAT_OPENAI_ENDPOINT_URL)
  const bytePlusRegion = getChatProviderRegionLabel(CHAT_PROVIDER_BYTEPLUS, CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL)
  const openAiLabel = getChatProviderLabel(CHAT_PROVIDER_OPENAI)

  if (bytePlusRequest !== '/__chat_proxy/api/v3/chat/completions') {
    throw new Error(`unexpected BytePlus request path: ${JSON.stringify(bytePlusRequest)}`)
  }
  if (bytePlusModels !== '/__chat_proxy/api/v3/models') {
    throw new Error(`unexpected BytePlus models path: ${JSON.stringify(bytePlusModels)}`)
  }
  if (openAiRequest !== '/__chat_proxy/v1/chat/completions') {
    throw new Error(`unexpected OpenAI request path: ${JSON.stringify(openAiRequest)}`)
  }
  if (bytePlusRegion !== 'AP-Southeast-1') {
    throw new Error(`unexpected BytePlus region label: ${JSON.stringify(bytePlusRegion)}`)
  }
  if (openAiLabel !== 'OpenAI') {
    throw new Error(`unexpected OpenAI label: ${JSON.stringify(openAiLabel)}`)
  }
}
