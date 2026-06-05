import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  CHAT_AGNES_BASE,
  CHAT_AGNES_ENDPOINT_URL,
  CHAT_BYTEPLUS_AP_SOUTHEAST_BASE,
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_GOOGLE_CLOUD_ENDPOINT_URL,
  CHAT_GOOGLE_CLOUD_MODEL_OPTIONS,
  CHAT_MIROMIND_BASE,
  CHAT_MIROMIND_ENDPOINT_URL,
  CHAT_OPENAI_ENDPOINT_URL,
  CHAT_QWEN_BASE,
  CHAT_QWEN_ENDPOINT_URL,
  CHAT_QWEN_MODEL_OPTIONS,
  CHAT_OPENAI_MODEL_OPTIONS,
  CHAT_PROVIDER_AGNES,
  CHAT_PROVIDER_BYTEPLUS,
  CHAT_PROVIDER_GOOGLE_CLOUD,
  CHAT_PROVIDER_MIROMIND,
  CHAT_PROVIDER_OPENAI,
  CHAT_PROVIDER_QWEN,
  buildChatProxyHeaders,
  getChatModelOptions,
  getChatProviderLabel,
  getChatProviderRegionLabel,
  getSharedChatModelCatalogOptions,
  normalizeChatModelIdForProvider,
  resolveChatModelIdForProvider,
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
  const agnesHeaders = buildChatProxyHeaders({
    provider: CHAT_PROVIDER_AGNES,
    apiKey: 'agnes-secret',
    endpointUrl: CHAT_AGNES_ENDPOINT_URL,
    clientRequestId: 'kg-agnes-test-123',
  })
  const agnesRequest = resolveChatEndpointForRequest(CHAT_AGNES_ENDPOINT_URL)
  const agnesBaseRequest = resolveChatEndpointForRequest(CHAT_AGNES_BASE)
  const agnesModels = resolveChatEndpointForModels(CHAT_AGNES_ENDPOINT_URL)
  const agnesRegion = getChatProviderRegionLabel(CHAT_PROVIDER_AGNES, CHAT_AGNES_ENDPOINT_URL)
  const agnesLabel = getChatProviderLabel(CHAT_PROVIDER_AGNES)
  const agnesModelOptions = getChatModelOptions(CHAT_PROVIDER_AGNES)
  const qwenHeaders = buildChatProxyHeaders({
    provider: CHAT_PROVIDER_QWEN,
    apiKey: 'qwen-secret',
    endpointUrl: CHAT_QWEN_ENDPOINT_URL,
    clientRequestId: 'kg-qwen-test-123',
  })
  const qwenRequest = resolveChatEndpointForRequest(CHAT_QWEN_ENDPOINT_URL)
  const qwenBaseRequest = resolveChatEndpointForRequest(`${CHAT_QWEN_BASE}/compatible-mode/v1`)
  const qwenProxyBaseRequest = resolveChatEndpointForRequest('/__chat_proxy/compatible-mode/v1')
  const qwenModels = resolveChatEndpointForModels(CHAT_QWEN_ENDPOINT_URL)
  const qwenBaseModels = resolveChatEndpointForModels(`${CHAT_QWEN_BASE}/compatible-mode/v1`)
  const qwenRegion = getChatProviderRegionLabel(CHAT_PROVIDER_QWEN, CHAT_QWEN_ENDPOINT_URL)
  const qwenLabel = getChatProviderLabel(CHAT_PROVIDER_QWEN)
  const qwenModelOptions = getChatModelOptions(CHAT_PROVIDER_QWEN)
  const googleCloudHeaders = buildChatProxyHeaders({
    provider: CHAT_PROVIDER_GOOGLE_CLOUD,
    apiKey: 'google-cloud-token',
    endpointUrl: CHAT_GOOGLE_CLOUD_ENDPOINT_URL,
    clientRequestId: 'kg-google-cloud-test-123',
  })
  const googleCloudRequest = resolveChatEndpointForRequest(CHAT_GOOGLE_CLOUD_ENDPOINT_URL)
  const googleCloudBaseRequest = resolveChatEndpointForRequest(CHAT_GOOGLE_CLOUD_ENDPOINT_URL.replace('/chat/completions', ''))
  const googleCloudModels = resolveChatEndpointForModels(CHAT_GOOGLE_CLOUD_ENDPOINT_URL)
  const googleCloudRegion = getChatProviderRegionLabel(CHAT_PROVIDER_GOOGLE_CLOUD, CHAT_GOOGLE_CLOUD_ENDPOINT_URL)
  const googleCloudLabel = getChatProviderLabel(CHAT_PROVIDER_GOOGLE_CLOUD)
  const googleCloudModelOptions = getChatModelOptions(CHAT_PROVIDER_GOOGLE_CLOUD)
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
  if (agnesHeaders['X-KG-Chat-Provider'] !== CHAT_PROVIDER_AGNES) {
    throw new Error(`expected Agnes provider header, got ${JSON.stringify(agnesHeaders)}`)
  }
  if (agnesHeaders['X-KG-Chat-Upstream'] !== CHAT_AGNES_BASE) {
    throw new Error(`expected Agnes upstream header, got ${JSON.stringify(agnesHeaders)}`)
  }
  if (agnesHeaders['X-KG-Chat-Api-Key'] !== 'agnes-secret') {
    throw new Error(`expected Agnes API key header, got ${JSON.stringify(agnesHeaders)}`)
  }
  if (agnesHeaders['X-Client-Request-Id'] !== 'kg-agnes-test-123') {
    throw new Error(`expected Agnes client request id header, got ${JSON.stringify(agnesHeaders)}`)
  }
  if (qwenHeaders['X-KG-Chat-Provider'] !== CHAT_PROVIDER_QWEN) {
    throw new Error(`expected Qwen provider header, got ${JSON.stringify(qwenHeaders)}`)
  }
  if (qwenHeaders['X-KG-Chat-Upstream'] !== CHAT_QWEN_BASE) {
    throw new Error(`expected Qwen upstream header, got ${JSON.stringify(qwenHeaders)}`)
  }
  if (qwenHeaders['X-KG-Chat-Api-Key'] !== 'qwen-secret') {
    throw new Error(`expected Qwen API key header, got ${JSON.stringify(qwenHeaders)}`)
  }
  if (qwenHeaders['X-Client-Request-Id'] !== 'kg-qwen-test-123') {
    throw new Error(`expected Qwen client request id header, got ${JSON.stringify(qwenHeaders)}`)
  }
  if (googleCloudHeaders['X-KG-Chat-Provider'] !== CHAT_PROVIDER_GOOGLE_CLOUD) {
    throw new Error(`expected Google Cloud provider header, got ${JSON.stringify(googleCloudHeaders)}`)
  }
  if (googleCloudHeaders['X-KG-Chat-Upstream'] !== 'https://us-central1-aiplatform.googleapis.com') {
    throw new Error(`expected Google Cloud upstream header, got ${JSON.stringify(googleCloudHeaders)}`)
  }
  if (googleCloudHeaders['X-KG-Chat-Api-Key'] !== 'google-cloud-token') {
    throw new Error(`expected Google Cloud access token header, got ${JSON.stringify(googleCloudHeaders)}`)
  }
  if (googleCloudHeaders['X-Client-Request-Id'] !== 'kg-google-cloud-test-123') {
    throw new Error(`expected Google Cloud client request id header, got ${JSON.stringify(googleCloudHeaders)}`)
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
  if (agnesRequest !== '/__chat_proxy/v1/chat/completions') {
    throw new Error(`unexpected Agnes request path: ${JSON.stringify(agnesRequest)}`)
  }
  if (agnesBaseRequest !== '/__chat_proxy/v1/chat/completions') {
    throw new Error(`unexpected Agnes base request path: ${JSON.stringify(agnesBaseRequest)}`)
  }
  if (agnesModels !== '/__chat_proxy/v1/models') {
    throw new Error(`unexpected Agnes models path: ${JSON.stringify(agnesModels)}`)
  }
  if (qwenRequest !== '/__chat_proxy/compatible-mode/v1/chat/completions') {
    throw new Error(`unexpected Qwen request path: ${JSON.stringify(qwenRequest)}`)
  }
  if (qwenBaseRequest !== '/__chat_proxy/compatible-mode/v1/chat/completions') {
    throw new Error(`unexpected Qwen base request path: ${JSON.stringify(qwenBaseRequest)}`)
  }
  if (qwenProxyBaseRequest !== '/__chat_proxy/compatible-mode/v1/chat/completions') {
    throw new Error(`unexpected Qwen proxy base request path: ${JSON.stringify(qwenProxyBaseRequest)}`)
  }
  if (qwenModels !== '/__chat_proxy/compatible-mode/v1/models') {
    throw new Error(`unexpected Qwen models path: ${JSON.stringify(qwenModels)}`)
  }
  if (qwenBaseModels !== '/__chat_proxy/compatible-mode/v1/models') {
    throw new Error(`unexpected Qwen base models path: ${JSON.stringify(qwenBaseModels)}`)
  }
  if (googleCloudRequest !== '/__chat_proxy/v1/projects/PROJECT_ID/locations/us-central1/endpoints/openapi/chat/completions') {
    throw new Error(`unexpected Google Cloud request path: ${JSON.stringify(googleCloudRequest)}`)
  }
  if (googleCloudBaseRequest !== '/__chat_proxy/v1/projects/PROJECT_ID/locations/us-central1/endpoints/openapi/chat/completions') {
    throw new Error(`unexpected Google Cloud base request path: ${JSON.stringify(googleCloudBaseRequest)}`)
  }
  if (googleCloudModels !== '/__chat_proxy/v1/projects/PROJECT_ID/locations/us-central1/endpoints/openapi/models') {
    throw new Error(`unexpected Google Cloud models path: ${JSON.stringify(googleCloudModels)}`)
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
  if (agnesRegion !== 'Global') {
    throw new Error(`unexpected Agnes region label: ${JSON.stringify(agnesRegion)}`)
  }
  if (qwenRegion !== 'Singapore') {
    throw new Error(`unexpected Qwen region label: ${JSON.stringify(qwenRegion)}`)
  }
  if (googleCloudRegion !== 'US-Central1') {
    throw new Error(`unexpected Google Cloud region label: ${JSON.stringify(googleCloudRegion)}`)
  }
  if (openAiLabel !== 'OpenAI') {
    throw new Error(`unexpected OpenAI label: ${JSON.stringify(openAiLabel)}`)
  }
  if (miromindLabel !== 'MiroMind API') {
    throw new Error(`unexpected MiroMind label: ${JSON.stringify(miromindLabel)}`)
  }
  if (agnesLabel !== 'Agnes AI API') {
    throw new Error(`unexpected Agnes label: ${JSON.stringify(agnesLabel)}`)
  }
  if (qwenLabel !== 'Qwen API') {
    throw new Error(`unexpected Qwen label: ${JSON.stringify(qwenLabel)}`)
  }
  if (googleCloudLabel !== 'Google Cloud Vertex AI') {
    throw new Error(`unexpected Google Cloud label: ${JSON.stringify(googleCloudLabel)}`)
  }
  if (
    miromindModelOptions[0] !== 'mirothinker-1-7-deepresearch-mini'
    || !miromindModelOptions.includes('mirothinker-1-7-deepresearch')
  ) {
    throw new Error(`unexpected MiroMind model options: ${JSON.stringify(miromindModelOptions)}`)
  }
  if (agnesModelOptions[0] !== 'agnes-2.0-flash' || agnesModelOptions.length !== 1) {
    throw new Error(`unexpected Agnes model options: ${JSON.stringify(agnesModelOptions)}`)
  }
  if (
    qwenModelOptions[0] !== CHAT_QWEN_MODEL_OPTIONS[0]
    || !qwenModelOptions.includes('qwen3-max')
    || !qwenModelOptions.includes('qwen-flash')
  ) {
    throw new Error(`unexpected Qwen model options: ${JSON.stringify(qwenModelOptions)}`)
  }
  if (
    googleCloudModelOptions[0] !== CHAT_GOOGLE_CLOUD_MODEL_OPTIONS[0]
    || !googleCloudModelOptions.includes('google/gemini-1.5-flash-001')
  ) {
    throw new Error(`unexpected Google Cloud model options: ${JSON.stringify(googleCloudModelOptions)}`)
  }
}

export function testSharedChatModelCatalogReusesMainPanelIntegrationsOptions() {
  const sharedOptions = getSharedChatModelCatalogOptions(CHAT_PROVIDER_OPENAI)
  const expectedOptions = [
    CHAT_OPENAI_MODEL_OPTIONS[0],
    CHAT_OPENAI_MODEL_OPTIONS[1],
    CHAT_OPENAI_MODEL_OPTIONS[2],
    CHAT_OPENAI_MODEL_OPTIONS[4],
    'qwen-plus',
    'qwen3-max',
    'qwen-flash',
    'google/gemini-2.0-flash-001',
    'dreamina-seedance-2-0-fast-260128',
    'dreamina-seedance-2-0-260128',
    'qwen/qwen3.5-9b@q4_k_m',
  ]
  expectedOptions.forEach(value => {
    if (!sharedOptions.includes(value)) {
      throw new Error(`expected shared chat model catalog to include ${value}, got ${JSON.stringify(sharedOptions)}`)
    }
  })
  if (sharedOptions[0] !== CHAT_OPENAI_MODEL_OPTIONS[0]) {
    throw new Error(`expected provider-preferred catalog ordering, got ${JSON.stringify(sharedOptions.slice(0, 4))}`)
  }
}

export function testChatModelInputVariantsUseCanonicalMapTerminology() {
  const modelsPath = resolve(process.cwd(), 'src', 'lib', 'chatEndpointModels.ts')
  const endpointPath = resolve(process.cwd(), 'src', 'lib', 'chatEndpoint.ts')
  const modelsText = readFileSync(modelsPath, 'utf8')
  const endpointText = readFileSync(endpointPath, 'utf8')
  if (!modelsText.includes('CHAT_MODEL_ID_BY_INPUT_VARIANT')) {
    throw new Error('expected chat model input normalization to use canonical input-variant terminology')
  }
  if (modelsText.includes('CHAT_MODEL_ALIASES') || endpointText.includes('CHAT_MODEL_ALIASES')) {
    throw new Error('expected chat model normalization to avoid alias terminology')
  }
  const normalized = normalizeChatModelIdForProvider('gpt-5 nano', CHAT_PROVIDER_OPENAI)
  if (normalized !== CHAT_OPENAI_MODEL_OPTIONS[0]) {
    throw new Error(`expected gpt-5 nano input variant to normalize to ${CHAT_OPENAI_MODEL_OPTIONS[0]}, got ${JSON.stringify(normalized)}`)
  }
}

export function testOpenAiResolverDropsUnknownNativeModelIds() {
  const staleNativeModel = ['gpt', '5.4', 'nano'].join('-')
  const resolved = resolveChatModelIdForProvider(staleNativeModel, CHAT_PROVIDER_OPENAI, { preserveUnknownCustomModel: true })
  if (resolved !== CHAT_OPENAI_MODEL_OPTIONS[0]) {
    throw new Error(`expected stale native OpenAI model to normalize to ${CHAT_OPENAI_MODEL_OPTIONS[0]}, got ${JSON.stringify(resolved)}`)
  }
  const qwenResolved = resolveChatModelIdForProvider(staleNativeModel, CHAT_PROVIDER_QWEN, { preserveUnknownCustomModel: true })
  if (qwenResolved !== CHAT_QWEN_MODEL_OPTIONS[0]) {
    throw new Error(`expected stale native OpenAI model to normalize to ${CHAT_QWEN_MODEL_OPTIONS[0]} under Qwen, got ${JSON.stringify(qwenResolved)}`)
  }
  const customModel = 'ft:custom-model'
  const customResolved = resolveChatModelIdForProvider(customModel, CHAT_PROVIDER_OPENAI, { preserveUnknownCustomModel: true })
  if (customResolved !== customModel) {
    throw new Error(`expected custom OpenAI model to stay configurable, got ${JSON.stringify(customResolved)}`)
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
    'suffix = bytePlusUpstreamSelected',
    "? '/api/v3/chat/completions'",
    ': qwenUpstreamSelected',
    "? '/compatible-mode/v1/chat/completions'",
    ": '/v1/chat/completions'",
    "if (suffix === '/api/v3' || suffix === '/api/v3/') suffix = '/api/v3/chat/completions'",
    "if (suffix === '/v1/models' || suffix === '/v1/models/' || suffix === '/models' || suffix === '/models/') suffix = '/api/v3/models'",
    "if (suffix === '/images/generations' || suffix === '/images/generations/') suffix = '/api/v3/images/generations'",
    "if (suffix.startsWith('/contents/generations/tasks')) suffix = `/api/v3${suffix}`",
    "const qwenProviderSelected = providerHeader === 'qwen'",
    "const googleCloudProviderSelected = providerHeader === 'google-cloud'",
    'process.env.DASHSCOPE_API_KEY',
    'process.env.GOOGLE_CLOUD_ACCESS_TOKEN',
    'requiresGoogleCloudKey',
    "if (suffix === '/compatible-mode/v1' || suffix === '/compatible-mode/v1/') suffix = '/compatible-mode/v1/chat/completions'",
    "if (suffix === '/v1/models' || suffix === '/v1/models/' || suffix === '/models' || suffix === '/models/') suffix = '/compatible-mode/v1/models'",
    'endpoints/openapi/chat/completions',
  ]
  const missing = expectedSnippets.filter(snippet => !source.includes(snippet))
  if (missing.length) {
    throw new Error(`expected BytePlus proxy compatibility rewrites in vite.config.ts, missing ${JSON.stringify(missing)}`)
  }
}

export function testChatProxyErrorResponsesGuardHeadersSent() {
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
    'const canWriteChatProxyResponse = (res: import',
    '!res.destroyed && !res.writableEnded',
    'if (!canWriteChatProxyResponse(res)) return false',
    'if (res.headersSent) {',
    'return false',
    'if (!canWriteChatProxyResponse(res)) return',
    'res.end()',
    'toActionableChatProxyError',
  ]
  const missing = expectedSnippets.filter(snippet => !source.includes(snippet))
  if (missing.length) {
    throw new Error(`expected chat proxy errors to avoid writing headers after response start, missing ${JSON.stringify(missing)}`)
  }
}
