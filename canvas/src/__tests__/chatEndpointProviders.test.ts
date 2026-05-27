import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_BASE,
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_MIROMIND_BASE,
  CHAT_MIROMIND_ENDPOINT_URL,
  CHAT_OPENAI_ENDPOINT_URL,
  CHAT_PROVIDER_BYTEPLUS,
  CHAT_PROVIDER_MIROMIND,
  CHAT_PROVIDER_OPENAI,
  buildChatProxyHeaders,
  getChatModelOptions,
  getChatProviderLabel,
  getChatProviderRegionLabel,
  getSharedChatModelCatalogOptions,
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
  const bytePlusBaseRequest = resolveChatEndpointForRequest(`${CHAT_BYTEPLUS_AP_SOUTHEAST_BASE}/api/v3`)
  const bytePlusBaseModels = resolveChatEndpointForModels(`${CHAT_BYTEPLUS_AP_SOUTHEAST_BASE}/api/v3`)
  const bytePlusProxyBaseRequest = resolveChatEndpointForRequest('/__chat_proxy/api/v3')
  const bytePlusProxyBaseModels = resolveChatEndpointForModels('/__chat_proxy/api/v3')
  const miromindHeaders = buildChatProxyHeaders({
    provider: CHAT_PROVIDER_MIROMIND,
    apiKey: 'miromind-secret',
    endpointUrl: CHAT_MIROMIND_ENDPOINT_URL,
    clientRequestId: 'kg-miromind-test-123',
  })
  const miromindRequest = resolveChatEndpointForRequest(CHAT_MIROMIND_ENDPOINT_URL)
  const miromindBaseRequest = resolveChatEndpointForRequest(CHAT_MIROMIND_BASE)
  const miromindModels = resolveChatEndpointForModels(CHAT_MIROMIND_ENDPOINT_URL)
  const miromindRegion = getChatProviderRegionLabel(CHAT_PROVIDER_MIROMIND, CHAT_MIROMIND_ENDPOINT_URL)
  const miromindLabel = getChatProviderLabel(CHAT_PROVIDER_MIROMIND)
  const miromindModelOptions = getChatModelOptions(CHAT_PROVIDER_MIROMIND)
  const openAiRequest = resolveChatEndpointForRequest(CHAT_OPENAI_ENDPOINT_URL)
  const bytePlusRegion = getChatProviderRegionLabel(CHAT_PROVIDER_BYTEPLUS, CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL)
  const openAiLabel = getChatProviderLabel(CHAT_PROVIDER_OPENAI)

  if (bytePlusRequest !== '/__chat_proxy/api/v3/chat/completions') {
    throw new Error(`unexpected BytePlus request path: ${JSON.stringify(bytePlusRequest)}`)
  }
  if (bytePlusModels !== '/__chat_proxy/api/v3/models') {
    throw new Error(`unexpected BytePlus models path: ${JSON.stringify(bytePlusModels)}`)
  }
  if (bytePlusBaseRequest !== '/__chat_proxy/api/v3/chat/completions') {
    throw new Error(`unexpected BytePlus base request path: ${JSON.stringify(bytePlusBaseRequest)}`)
  }
  if (bytePlusBaseModels !== '/__chat_proxy/api/v3/models') {
    throw new Error(`unexpected BytePlus base models path: ${JSON.stringify(bytePlusBaseModels)}`)
  }
  if (bytePlusProxyBaseRequest !== '/__chat_proxy/api/v3/chat/completions') {
    throw new Error(`unexpected BytePlus proxy base request path: ${JSON.stringify(bytePlusProxyBaseRequest)}`)
  }
  if (bytePlusProxyBaseModels !== '/__chat_proxy/api/v3/models') {
    throw new Error(`unexpected BytePlus proxy base models path: ${JSON.stringify(bytePlusProxyBaseModels)}`)
  }
  if (miromindHeaders['X-KG-Chat-Provider'] !== CHAT_PROVIDER_MIROMIND) {
    throw new Error(`expected MiroMind provider header, got ${JSON.stringify(miromindHeaders)}`)
  }
  if (miromindHeaders['X-KG-Chat-Upstream'] !== CHAT_MIROMIND_BASE) {
    throw new Error(`expected MiroMind upstream header, got ${JSON.stringify(miromindHeaders)}`)
  }
  if (miromindHeaders['X-KG-Chat-Api-Key'] !== 'miromind-secret') {
    throw new Error(`expected MiroMind API key header, got ${JSON.stringify(miromindHeaders)}`)
  }
  if (miromindHeaders['X-Client-Request-Id'] !== 'kg-miromind-test-123') {
    throw new Error(`expected MiroMind client request id header, got ${JSON.stringify(miromindHeaders)}`)
  }
  if (miromindRequest !== '/__chat_proxy/v1/chat/completions') {
    throw new Error(`unexpected MiroMind request path: ${JSON.stringify(miromindRequest)}`)
  }
  if (miromindBaseRequest !== '/__chat_proxy/v1/chat/completions') {
    throw new Error(`unexpected MiroMind base request path: ${JSON.stringify(miromindBaseRequest)}`)
  }
  if (miromindModels !== '/__chat_proxy/v1/models') {
    throw new Error(`unexpected MiroMind models path: ${JSON.stringify(miromindModels)}`)
  }
  if (openAiRequest !== '/__chat_proxy/v1/responses') {
    throw new Error(`unexpected OpenAI request path: ${JSON.stringify(openAiRequest)}`)
  }
  if (bytePlusRegion !== 'AP-Southeast-1') {
    throw new Error(`unexpected BytePlus region label: ${JSON.stringify(bytePlusRegion)}`)
  }
  if (miromindRegion !== 'Global') {
    throw new Error(`unexpected MiroMind region label: ${JSON.stringify(miromindRegion)}`)
  }
  if (openAiLabel !== 'OpenAI') {
    throw new Error(`unexpected OpenAI label: ${JSON.stringify(openAiLabel)}`)
  }
  if (miromindLabel !== 'MiroMind API') {
    throw new Error(`unexpected MiroMind label: ${JSON.stringify(miromindLabel)}`)
  }
  if (
    miromindModelOptions[0] !== 'mirothinker-1-7-deepresearch-mini'
    || !miromindModelOptions.includes('mirothinker-1-7-deepresearch')
  ) {
    throw new Error(`unexpected MiroMind model options: ${JSON.stringify(miromindModelOptions)}`)
  }
}

export function testSharedChatModelCatalogReusesMainPanelIntegrationsOptions() {
  const sharedOptions = getSharedChatModelCatalogOptions(CHAT_PROVIDER_OPENAI)
  const expectedOptions = [
    'gpt-5.4-nano',
    'gpt-5.4-mini',
    'gpt-5.4',
    'gpt-5.5',
    'dreamina-seedance-2-0-fast-260128',
    'dreamina-seedance-2-0-260128',
    'qwen/qwen3.5-9b@q4_k_m',
  ]
  expectedOptions.forEach(value => {
    if (!sharedOptions.includes(value)) {
      throw new Error(`expected shared chat model catalog to include ${value}, got ${JSON.stringify(sharedOptions)}`)
    }
  })
  if (sharedOptions[0] !== 'gpt-5.4-nano') {
    throw new Error(`expected provider-preferred catalog ordering, got ${JSON.stringify(sharedOptions.slice(0, 4))}`)
  }
}

export function testBytePlusProxyRewritesLegacyRunAllPaths() {
  const candidates = [
    resolve(process.cwd(), 'vite.config.ts'),
    resolve(process.cwd(), 'canvas/vite.config.ts'),
  ]
  const viteConfigPath = candidates.find(candidate => existsSync(candidate))
  if (!viteConfigPath) {
    throw new Error(`could not find vite.config.ts from ${process.cwd()}`)
  }
  const source = readFileSync(viteConfigPath, 'utf8')
  const expectedSnippets = [
    "bytePlusUpstreamSelected ? '/api/v3/chat/completions' : '/v1/chat/completions'",
    "if (suffix === '/api/v3' || suffix === '/api/v3/') suffix = '/api/v3/chat/completions'",
    "if (suffix === '/v1/models' || suffix === '/v1/models/' || suffix === '/models' || suffix === '/models/') suffix = '/api/v3/models'",
    "if (suffix === '/images/generations' || suffix === '/images/generations/') suffix = '/api/v3/images/generations'",
    "if (suffix.startsWith('/contents/generations/tasks')) suffix = `/api/v3${suffix}`",
  ]
  const missing = expectedSnippets.filter(snippet => !source.includes(snippet))
  if (missing.length) {
    throw new Error(`expected BytePlus proxy compatibility rewrites in vite.config.ts, missing ${JSON.stringify(missing)}`)
  }
}
