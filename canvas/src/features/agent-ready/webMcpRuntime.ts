import {
  KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID,
  buildKnowgrphStorageDefaultDocPath,
  buildKnowgrphStorageDocPath,
  buildKnowgrphStorageSourceFilesIndexPath,
} from '@/lib/storage/knowgrphStorageSyncContract'
import { readEnvString } from '@/lib/config.env'
import { resolvePublishedDocIdentity } from '@/features/canvas/canvasDocShareToken.mjs'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  buildKnowgrphAgentReadyToolContracts,
  KNOWGRPH_AGENT_READY_TOOL_IDS,
} from './knowgrphAgentReadyToolContract.mjs'
import { inspectSharedDocumentStructure } from './sharedDocumentStructureInspection.mjs'
import { inspectLocalCanvasTopology } from './localCanvasTopologyInspection'
import { inspectLocalCanvasSnapshot } from './localCanvasSnapshotInspection'
import { inspectLocalThreeCameraPose } from './localThreeCameraPoseInspection'

type WebMcpToolInput = Record<string, unknown> | undefined

type WebMcpTool = {
  name: string
  title?: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (input?: WebMcpToolInput) => Promise<unknown>
  annotations?: {
    readOnlyHint?: boolean
  }
}

type ModelContextLike = {
  tools?: WebMcpTool[]
  provideContext?: (context: { tools: WebMcpTool[] }) => void
  registerTool?: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => void
}

type WebMcpNavigator = Navigator & { modelContext?: ModelContextLike }

type AgentReadyToolContract = {
  name: string
  webName: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: {
    readOnlyHint?: boolean
  }
}

type ModelContextRegistrationState = {
  registeredToolNames: Set<string>
  abortControllers: Map<string, AbortController | null>
}

type WebMcpRuntimeState = {
  fallbackContext: ModelContextLike | null
  activeRegisteredContext: ModelContextLike | null
  registrations: WeakMap<ModelContextLike, ModelContextRegistrationState>
  lateBindingRetryId: number | null
  lateBindingAttemptCount: number
}

const WEB_MCP_TOOL_CONTRACTS = buildKnowgrphAgentReadyToolContracts({
  defaultWorkspaceId: KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID,
  includeBrowserOnlyTools: true,
}) as AgentReadyToolContract[]

const findWebToolContract = (name: string): AgentReadyToolContract => {
  const contract = WEB_MCP_TOOL_CONTRACTS.find(entry => entry.name === name)
  if (!contract) {
    throw new Error(`missing Knowgrph agent-ready tool contract: ${name}`)
  }
  return contract
}

const SOURCE_FILES_TOOL_CONTRACT = findWebToolContract(KNOWGRPH_AGENT_READY_TOOL_IDS.listSourceFiles)
const READ_SOURCE_FILE_TOOL_CONTRACT = findWebToolContract(KNOWGRPH_AGENT_READY_TOOL_IDS.readSourceFile)
const READ_SHARED_DOCUMENT_TOOL_CONTRACT = findWebToolContract(KNOWGRPH_AGENT_READY_TOOL_IDS.readSharedDocument)
const INSPECT_SHARED_DOCUMENT_STRUCTURE_TOOL_CONTRACT = findWebToolContract(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectSharedDocumentStructure)
const INSPECT_LOCAL_WORKSPACE_DOCUMENT_TOOL_CONTRACT = findWebToolContract(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalWorkspaceDocument)
const INSPECT_LOCAL_CANVAS_TOPOLOGY_TOOL_CONTRACT = findWebToolContract(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalCanvasTopology)
const INSPECT_LOCAL_CANVAS_SNAPSHOT_TOOL_CONTRACT = findWebToolContract(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalCanvasSnapshot)
const INSPECT_LOCAL_3D_CAMERA_POSE_TOOL_CONTRACT = findWebToolContract(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocal3dCameraPose)
const INSPECT_AGENT_SURFACE_TOOL_CONTRACT = findWebToolContract(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectAgentSurface)
const SOURCE_FILES_TOOL_NAME = SOURCE_FILES_TOOL_CONTRACT.webName
const READ_SOURCE_FILE_TOOL_NAME = READ_SOURCE_FILE_TOOL_CONTRACT.webName
const READ_SHARED_DOCUMENT_TOOL_NAME = READ_SHARED_DOCUMENT_TOOL_CONTRACT.webName
const INSPECT_SHARED_DOCUMENT_STRUCTURE_TOOL_NAME = INSPECT_SHARED_DOCUMENT_STRUCTURE_TOOL_CONTRACT.webName
const INSPECT_LOCAL_WORKSPACE_DOCUMENT_TOOL_NAME = INSPECT_LOCAL_WORKSPACE_DOCUMENT_TOOL_CONTRACT.webName
const INSPECT_LOCAL_CANVAS_TOPOLOGY_TOOL_NAME = INSPECT_LOCAL_CANVAS_TOPOLOGY_TOOL_CONTRACT.webName
const INSPECT_LOCAL_CANVAS_SNAPSHOT_TOOL_NAME = INSPECT_LOCAL_CANVAS_SNAPSHOT_TOOL_CONTRACT.webName
const INSPECT_LOCAL_3D_CAMERA_POSE_TOOL_NAME = INSPECT_LOCAL_3D_CAMERA_POSE_TOOL_CONTRACT.webName
const INSPECT_AGENT_SURFACE_TOOL_NAME = INSPECT_AGENT_SURFACE_TOOL_CONTRACT.webName
const WEB_MCP_TOOL_NAMES = WEB_MCP_TOOL_CONTRACTS.map(tool => tool.webName)
const WEB_MCP_LATE_BINDING_RETRY_DELAY_MS = 500
const WEB_MCP_LATE_BINDING_MAX_ATTEMPTS = 20
const WEB_MCP_DEFAULT_STORAGE_BASE_URL = 'https://airvio.co'
const WEB_MCP_DEFAULT_AGENT_READY_BASE_URL = 'https://airvio.co/knowgrph'
const WEB_MCP_APP_BASE_PATH = '/knowgrph'
const webMcpRuntimeState: WebMcpRuntimeState = {
  fallbackContext: null,
  activeRegisteredContext: null,
  registrations: new WeakMap<ModelContextLike, ModelContextRegistrationState>(),
  lateBindingRetryId: null,
  lateBindingAttemptCount: 0,
}

const markWebMcpRuntime = (state = WEB_MCP_TOOL_NAMES.join(',')): void => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.kgWebmcpTools = WEB_MCP_TOOL_NAMES.join(',')
  document.documentElement.dataset.kgWebmcpContext = state
}

const normalizeString = (value: unknown): string => String(value || '').trim()

const isLocalhostHost = (hostname: string): boolean => {
  const normalized = normalizeString(hostname).toLowerCase()
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '0.0.0.0'
}

const readWebMcpStorageBaseUrl = (): string => normalizeString(readEnvString('VITE_KNOWGRPH_STORAGE_BASE_URL', ''))

const buildWebMcpStorageRequestUrl = (path: string): string => {
  const safePath = normalizeString(path)
  if (!safePath) return ''
  if (typeof window !== 'undefined') {
    const hostname = normalizeString(window.location?.hostname)
    if (isLocalhostHost(hostname) && safePath.startsWith('/api/storage/')) return safePath
    const currentOrigin = normalizeString(window.location?.origin)
    const baseUrl = readWebMcpStorageBaseUrl() || currentOrigin || WEB_MCP_DEFAULT_STORAGE_BASE_URL
    return new URL(safePath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString()
  }
  const baseUrl = readWebMcpStorageBaseUrl() || WEB_MCP_DEFAULT_STORAGE_BASE_URL
  return new URL(safePath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString()
}

const readWebMcpDocumentBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const currentOrigin = normalizeString(window.location?.origin)
    if (currentOrigin) return currentOrigin
  }
  return readWebMcpStorageBaseUrl() || WEB_MCP_DEFAULT_STORAGE_BASE_URL
}

const readWebMcpAgentReadyBaseUrl = (): string => {
  const configuredBaseUrl = normalizeString(readEnvString('VITE_KNOWGRPH_AGENT_READY_BASE_URL', ''))
  if (configuredBaseUrl) return configuredBaseUrl.replace(/\/+$/, '')
  if (typeof window !== 'undefined') {
    const currentOrigin = normalizeString(window.location?.origin)
    if (currentOrigin) {
      return new URL(`${WEB_MCP_APP_BASE_PATH}/`, currentOrigin.endsWith('/') ? currentOrigin : `${currentOrigin}/`)
        .toString()
        .replace(/\/+$/, '')
    }
  }
  return WEB_MCP_DEFAULT_AGENT_READY_BASE_URL
}

const fetchJson = async (url: string, accept = 'application/json'): Promise<unknown> => {
  const response = await fetch(url, {
    headers: { accept },
  })
  if (!response.ok) {
    throw new Error(`inspect_agent_surface failed with ${response.status} for ${url}`)
  }
  return response.json()
}

const readGlobalNavigator = (): WebMcpNavigator => {
  const root = globalThis as typeof globalThis & { navigator?: WebMcpNavigator; window?: { navigator?: WebMcpNavigator } }
  const windowNavigator = root.window?.navigator
  if (windowNavigator && root.navigator !== windowNavigator) {
    try {
      Object.defineProperty(root, 'navigator', {
        configurable: true,
        value: windowNavigator,
      })
    } catch {
      root.navigator = windowNavigator
    }
    return windowNavigator
  }
  if (root.navigator) return root.navigator
  const nav = {} as WebMcpNavigator
  try {
    Object.defineProperty(root, 'navigator', {
      configurable: true,
      value: nav,
    })
  } catch {
    root.navigator = nav
  }
  return nav
}

const getRegistrationState = (context: ModelContextLike): ModelContextRegistrationState => {
  const existing = webMcpRuntimeState.registrations.get(context)
  if (existing) return existing
  const created: ModelContextRegistrationState = {
    registeredToolNames: new Set<string>(),
    abortControllers: new Map<string, AbortController | null>(),
  }
  webMcpRuntimeState.registrations.set(context, created)
  return created
}

const isDuplicateToolRegistrationError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const name = normalizeString((error as { name?: unknown }).name)
  return name === 'InvalidStateError'
}

const releasePreviousRegisteredContext = (nextContext: ModelContextLike): void => {
  const active = webMcpRuntimeState.activeRegisteredContext
  if (!active || active === nextContext) {
    webMcpRuntimeState.activeRegisteredContext = nextContext
    return
  }
  const registrationState = webMcpRuntimeState.registrations.get(active)
  registrationState?.abortControllers.forEach(controller => controller?.abort())
  webMcpRuntimeState.activeRegisteredContext = nextContext
}

const clearLateBindingRetry = (): void => {
  if (webMcpRuntimeState.lateBindingRetryId === null || typeof window === 'undefined') return
  window.clearTimeout(webMcpRuntimeState.lateBindingRetryId)
  webMcpRuntimeState.lateBindingRetryId = null
}

const buildSourceFilesTool = (): WebMcpTool => ({
  name: SOURCE_FILES_TOOL_NAME,
  title: SOURCE_FILES_TOOL_CONTRACT.title,
  description: SOURCE_FILES_TOOL_CONTRACT.description,
  inputSchema: SOURCE_FILES_TOOL_CONTRACT.inputSchema,
  annotations: SOURCE_FILES_TOOL_CONTRACT.annotations,
  execute: async () => {
    const response = await fetch(buildWebMcpStorageRequestUrl(buildKnowgrphStorageSourceFilesIndexPath()), {
      headers: { accept: 'text/markdown' },
    })
    if (!response.ok) {
      throw new Error(`list_source_files failed with ${response.status}`)
    }
    return {
      workspaceId: KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID,
      markdownIndex: await response.text(),
    }
  },
})

const buildReadSourceFileTool = (): WebMcpTool => ({
  name: READ_SOURCE_FILE_TOOL_NAME,
  title: READ_SOURCE_FILE_TOOL_CONTRACT.title,
  description: READ_SOURCE_FILE_TOOL_CONTRACT.description,
  inputSchema: READ_SOURCE_FILE_TOOL_CONTRACT.inputSchema,
  annotations: READ_SOURCE_FILE_TOOL_CONTRACT.annotations,
  execute: async (input) => {
    const canonicalPath = String(input?.canonicalPath || '').trim()
    if (!canonicalPath) {
      throw new Error('canonicalPath is required')
    }
    const workspaceId = String(input?.workspaceId || '').trim()
    const path = workspaceId
      ? buildKnowgrphStorageDocPath(workspaceId, canonicalPath)
      : buildKnowgrphStorageDefaultDocPath(canonicalPath)
    const response = await fetch(buildWebMcpStorageRequestUrl(path), {
      headers: { accept: 'text/markdown' },
    })
    if (!response.ok) {
      throw new Error(`read_source_file failed with ${response.status}`)
    }
    return {
      workspaceId: workspaceId || KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID,
      canonicalPath,
      markdown: await response.text(),
    }
  },
})

const buildReadSharedDocumentTool = (): WebMcpTool => ({
  name: READ_SHARED_DOCUMENT_TOOL_NAME,
  title: READ_SHARED_DOCUMENT_TOOL_CONTRACT.title,
  description: READ_SHARED_DOCUMENT_TOOL_CONTRACT.description,
  inputSchema: READ_SHARED_DOCUMENT_TOOL_CONTRACT.inputSchema,
  annotations: READ_SHARED_DOCUMENT_TOOL_CONTRACT.annotations,
  execute: async (input) => {
    const resolvedDocument = resolvePublishedDocIdentity({
      shareToken: input?.shareToken,
      shareUrl: input?.shareUrl,
      appBasePath: WEB_MCP_APP_BASE_PATH,
      baseUrl: readWebMcpDocumentBaseUrl(),
    })
    if (!resolvedDocument) {
      throw new Error('shareToken or shareUrl must resolve to a published Knowgrph document')
    }
    const workspaceId = String(resolvedDocument.workspaceId || '').trim()
    const canonicalPath = resolvedDocument.canonicalPath
    const path = workspaceId
      ? buildKnowgrphStorageDocPath(workspaceId, canonicalPath)
      : buildKnowgrphStorageDefaultDocPath(canonicalPath)
    const response = await fetch(buildWebMcpStorageRequestUrl(path), {
      headers: { accept: 'text/markdown' },
    })
    if (!response.ok) {
      throw new Error(`read_shared_document failed with ${response.status}`)
    }
    return {
      workspaceId: workspaceId || KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID,
      canonicalPath,
      markdown: await response.text(),
    }
  },
})

const buildInspectSharedDocumentStructureTool = (): WebMcpTool => ({
  name: INSPECT_SHARED_DOCUMENT_STRUCTURE_TOOL_NAME,
  title: INSPECT_SHARED_DOCUMENT_STRUCTURE_TOOL_CONTRACT.title,
  description: INSPECT_SHARED_DOCUMENT_STRUCTURE_TOOL_CONTRACT.description,
  inputSchema: INSPECT_SHARED_DOCUMENT_STRUCTURE_TOOL_CONTRACT.inputSchema,
  annotations: INSPECT_SHARED_DOCUMENT_STRUCTURE_TOOL_CONTRACT.annotations,
  execute: async (input) => {
    const resolvedDocument = resolvePublishedDocIdentity({
      shareToken: input?.shareToken,
      shareUrl: input?.shareUrl,
      appBasePath: WEB_MCP_APP_BASE_PATH,
      baseUrl: readWebMcpDocumentBaseUrl(),
    })
    if (!resolvedDocument) {
      throw new Error('shareToken or shareUrl must resolve to a published Knowgrph document')
    }
    const workspaceId = String(resolvedDocument.workspaceId || '').trim()
    const canonicalPath = resolvedDocument.canonicalPath
    const path = workspaceId
      ? buildKnowgrphStorageDocPath(workspaceId, canonicalPath)
      : buildKnowgrphStorageDefaultDocPath(canonicalPath)
    const response = await fetch(buildWebMcpStorageRequestUrl(path), {
      headers: { accept: 'text/markdown' },
    })
    if (!response.ok) {
      throw new Error(`inspect_shared_document_structure failed with ${response.status}`)
    }
    return inspectSharedDocumentStructure({
      workspaceId: workspaceId || KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID,
      canonicalPath,
      markdown: await response.text(),
    })
  },
})

const buildInspectLocalWorkspaceDocumentTool = (): WebMcpTool => ({
  name: INSPECT_LOCAL_WORKSPACE_DOCUMENT_TOOL_NAME,
  title: INSPECT_LOCAL_WORKSPACE_DOCUMENT_TOOL_CONTRACT.title,
  description: INSPECT_LOCAL_WORKSPACE_DOCUMENT_TOOL_CONTRACT.description,
  inputSchema: INSPECT_LOCAL_WORKSPACE_DOCUMENT_TOOL_CONTRACT.inputSchema,
  annotations: INSPECT_LOCAL_WORKSPACE_DOCUMENT_TOOL_CONTRACT.annotations,
  execute: async () => {
    const state = useGraphStore.getState()
    const documentName = normalizeString(state.markdownDocumentName)
    const markdown = String(state.markdownDocumentText || '')
    const documentSourceUrl = normalizeString(state.markdownDocumentSourceUrl)
    if (!documentName && !normalizeString(markdown)) {
      return {
        available: false,
        sourceKind: 'browser-local-workspace',
        documentName: '',
        documentSourceUrl: documentSourceUrl || null,
        message: 'No active markdown document is loaded in the local Knowgrph workspace.',
      }
    }
    return {
      available: true,
      sourceKind: 'browser-local-workspace',
      documentName: documentName || 'document.md',
      documentSourceUrl: documentSourceUrl || null,
      ...inspectSharedDocumentStructure({
        canonicalPath: documentName || 'document.md',
        markdown,
      }),
    }
  },
})

const buildInspectLocalCanvasTopologyTool = (): WebMcpTool => ({
  name: INSPECT_LOCAL_CANVAS_TOPOLOGY_TOOL_NAME,
  title: INSPECT_LOCAL_CANVAS_TOPOLOGY_TOOL_CONTRACT.title,
  description: INSPECT_LOCAL_CANVAS_TOPOLOGY_TOOL_CONTRACT.description,
  inputSchema: INSPECT_LOCAL_CANVAS_TOPOLOGY_TOOL_CONTRACT.inputSchema,
  annotations: INSPECT_LOCAL_CANVAS_TOPOLOGY_TOOL_CONTRACT.annotations,
  execute: async () => {
    const state = useGraphStore.getState()
    return inspectLocalCanvasTopology({
      graphData: state.graphData,
      graphDataRevision: state.graphDataRevision,
      markdownDocumentName: state.markdownDocumentName,
      markdownDocumentText: state.markdownDocumentText,
      canvasRenderMode: state.canvasRenderMode,
      canvas2dRenderer: state.canvas2dRenderer,
      documentSemanticMode: state.documentSemanticMode,
      frontmatterModeEnabled: state.frontmatterModeEnabled,
      multiDimTableModeEnabled: state.multiDimTableModeEnabled,
      documentStructureBaselineLock: state.documentStructureBaselineLock,
      collapsedGroupIds: state.collapsedGroupIds,
      selectedNodeId: state.selectedNodeId,
      selectedEdgeId: state.selectedEdgeId,
    })
  },
})

const buildInspectLocalCanvasSnapshotTool = (): WebMcpTool => ({
  name: INSPECT_LOCAL_CANVAS_SNAPSHOT_TOOL_NAME,
  title: INSPECT_LOCAL_CANVAS_SNAPSHOT_TOOL_CONTRACT.title,
  description: INSPECT_LOCAL_CANVAS_SNAPSHOT_TOOL_CONTRACT.description,
  inputSchema: INSPECT_LOCAL_CANVAS_SNAPSHOT_TOOL_CONTRACT.inputSchema,
  annotations: INSPECT_LOCAL_CANVAS_SNAPSHOT_TOOL_CONTRACT.annotations,
  execute: async () => {
    const state = useGraphStore.getState()
    const svgMarkup = await state.captureCanvasSvgSnapshot('2d')
    return inspectLocalCanvasSnapshot({
      markdownDocumentName: state.markdownDocumentName,
      canvasRenderMode: state.canvasRenderMode,
      canvas2dRenderer: state.canvas2dRenderer,
      svgMarkup,
    })
  },
})

const buildInspectLocal3dCameraPoseTool = (): WebMcpTool => ({
  name: INSPECT_LOCAL_3D_CAMERA_POSE_TOOL_NAME,
  title: INSPECT_LOCAL_3D_CAMERA_POSE_TOOL_CONTRACT.title,
  description: INSPECT_LOCAL_3D_CAMERA_POSE_TOOL_CONTRACT.description,
  inputSchema: INSPECT_LOCAL_3D_CAMERA_POSE_TOOL_CONTRACT.inputSchema,
  annotations: INSPECT_LOCAL_3D_CAMERA_POSE_TOOL_CONTRACT.annotations,
  execute: async () => {
    const state = useGraphStore.getState()
    return inspectLocalThreeCameraPose({
      markdownDocumentName: state.markdownDocumentName,
      canvasRenderMode: state.canvasRenderMode,
      canvas3dMode: state.canvas3dMode,
      viewPinned: state.viewPinned,
      pose: state.captureThreeCameraPose(),
    })
  },
})

const buildInspectAgentSurfaceTool = (): WebMcpTool => ({
  name: INSPECT_AGENT_SURFACE_TOOL_NAME,
  title: INSPECT_AGENT_SURFACE_TOOL_CONTRACT.title,
  description: INSPECT_AGENT_SURFACE_TOOL_CONTRACT.description,
  inputSchema: INSPECT_AGENT_SURFACE_TOOL_CONTRACT.inputSchema,
  annotations: INSPECT_AGENT_SURFACE_TOOL_CONTRACT.annotations,
  execute: async () => {
    const agentReadyBaseUrl = readWebMcpAgentReadyBaseUrl()
    const [health, apiCatalog, openApi, mcpServerCard, agentCard, agentSkills] = await Promise.all([
      fetchJson(`${agentReadyBaseUrl}/health`, 'application/health+json'),
      fetchJson(`${agentReadyBaseUrl}/.well-known/api-catalog`, 'application/linkset+json'),
      fetchJson(`${agentReadyBaseUrl}/.well-known/openapi.json`, 'application/json'),
      fetchJson(`${agentReadyBaseUrl}/.well-known/mcp/server-card.json`, 'application/json'),
      fetchJson(`${agentReadyBaseUrl}/.well-known/agent-card.json`, 'application/json'),
      fetchJson(`${agentReadyBaseUrl}/.well-known/agent-skills/index.json`, 'application/json'),
    ])
    return {
      baseUrl: agentReadyBaseUrl,
      healthUrl: `${agentReadyBaseUrl}/health`,
      mcpUrl: `${agentReadyBaseUrl}/mcp`,
      apiCatalogUrl: `${agentReadyBaseUrl}/.well-known/api-catalog`,
      openApiUrl: `${agentReadyBaseUrl}/.well-known/openapi.json`,
      mcpServerCardUrl: `${agentReadyBaseUrl}/.well-known/mcp/server-card.json`,
      agentCardUrl: `${agentReadyBaseUrl}/.well-known/agent-card.json`,
      agentSkillsUrl: `${agentReadyBaseUrl}/.well-known/agent-skills/index.json`,
      health,
      apiCatalog,
      openApi,
      mcpServerCard,
      agentCard,
      agentSkills,
    }
  },
})

const WEB_MCP_TOOLS = [
  buildSourceFilesTool(),
  buildReadSourceFileTool(),
  buildReadSharedDocumentTool(),
  buildInspectSharedDocumentStructureTool(),
  buildInspectLocalWorkspaceDocumentTool(),
  buildInspectLocalCanvasTopologyTool(),
  buildInspectLocalCanvasSnapshotTool(),
  buildInspectLocal3dCameraPoseTool(),
  buildInspectAgentSurfaceTool(),
]

const installToolsIntoModelContext = (context: ModelContextLike, tools: WebMcpTool[]): boolean => {
  const registrationState = getRegistrationState(context)
  let providedContext = false
  if (typeof context.provideContext === 'function') {
    try {
      context.provideContext({ tools })
      providedContext = true
    } catch {
      void 0
    }
  }
  if (typeof context.registerTool === 'function') {
    for (const tool of tools) {
      if (registrationState.registeredToolNames.has(tool.name)) continue
      const controller = typeof AbortController === 'function' ? new AbortController() : null
      try {
        context.registerTool(tool, controller ? { signal: controller.signal } : {})
        registrationState.registeredToolNames.add(tool.name)
        registrationState.abortControllers.set(tool.name, controller)
      } catch (error) {
        if (!isDuplicateToolRegistrationError(error)) continue
        registrationState.registeredToolNames.add(tool.name)
        registrationState.abortControllers.set(tool.name, null)
      }
    }
  }
  if (Array.isArray(context.tools)) {
    for (const tool of tools) {
      if (!context.tools.some(entry => entry?.name === tool.name)) context.tools.push(tool)
    }
  }
  const allToolsRegistered = tools.every(
    tool => registrationState.registeredToolNames.has(tool.name) || context.tools?.some(entry => entry?.name === tool.name),
  )
  if (allToolsRegistered) {
    releasePreviousRegisteredContext(context)
    return true
  }
  return providedContext && typeof context.registerTool !== 'function' && !Array.isArray(context.tools)
}

const tryInstallLateBoundModelContext = (nav: WebMcpNavigator): boolean => {
  const context = nav.modelContext
  if (!context || context === webMcpRuntimeState.fallbackContext) return false
  const installed = installToolsIntoModelContext(context, WEB_MCP_TOOLS)
  if (installed) {
    clearLateBindingRetry()
    markWebMcpRuntime('installed')
    return true
  }
  return false
}

const scheduleLateBindingRetry = (nav: WebMcpNavigator): void => {
  if (typeof window === 'undefined') return
  if (webMcpRuntimeState.lateBindingRetryId !== null) return
  if (webMcpRuntimeState.lateBindingAttemptCount >= WEB_MCP_LATE_BINDING_MAX_ATTEMPTS) {
    markWebMcpRuntime('retry-exhausted')
    return
  }
  webMcpRuntimeState.lateBindingRetryId = window.setTimeout(() => {
    webMcpRuntimeState.lateBindingRetryId = null
    webMcpRuntimeState.lateBindingAttemptCount += 1
    if (!tryInstallLateBoundModelContext(nav)) scheduleLateBindingRetry(nav)
  }, WEB_MCP_LATE_BINDING_RETRY_DELAY_MS)
}

const defineFallbackModelContext = (nav: WebMcpNavigator, context: ModelContextLike): void => {
  webMcpRuntimeState.fallbackContext = context
  let currentContext = nav.modelContext && nav.modelContext !== context ? nav.modelContext : context
  try {
    Object.defineProperty(nav, 'modelContext', {
      configurable: true,
      enumerable: false,
      get: () => currentContext,
      set: (value: ModelContextLike | undefined) => {
        currentContext = value || context
        if (currentContext !== context) void tryInstallLateBoundModelContext(nav)
      },
    })
  } catch {
    nav.modelContext = context
  }
}

export function installKnowgrphWebMcpRuntime(): void {
  if (typeof globalThis === 'undefined') return
  const nav = readGlobalNavigator()
  markWebMcpRuntime('installing')
  if (nav.modelContext && installToolsIntoModelContext(nav.modelContext, WEB_MCP_TOOLS)) {
    markWebMcpRuntime('installed')
    return
  }
  if (!nav.modelContext) defineFallbackModelContext(nav, { tools: [...WEB_MCP_TOOLS] })
  markWebMcpRuntime(
    WEB_MCP_TOOL_NAMES.every(name => nav.modelContext?.tools?.some(entry => entry?.name === name))
      ? 'fallback-readable'
      : 'awaiting-model-context',
  )
  scheduleLateBindingRetry(nav)
}

export function resetKnowgrphWebMcpRuntimeForTests(): void {
  clearLateBindingRetry()
  webMcpRuntimeState.fallbackContext = null
  webMcpRuntimeState.activeRegisteredContext = null
  webMcpRuntimeState.registrations = new WeakMap<ModelContextLike, ModelContextRegistrationState>()
  webMcpRuntimeState.lateBindingAttemptCount = 0
  if (typeof document !== 'undefined') {
    delete document.documentElement.dataset.kgWebmcpContext
    delete document.documentElement.dataset.kgWebmcpTools
  }
}
