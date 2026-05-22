import {
  KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID,
  buildKnowgrphStorageDefaultDocPath,
  buildKnowgrphStorageDocPath,
} from '@/lib/storage/knowgrphStorageSyncContract'
import {
  buildKnowgrphAgentReadyToolContracts,
  KNOWGRPH_AGENT_READY_TOOL_IDS,
} from './knowgrphAgentReadyToolContract.mjs'

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
  registerTool?: (tool: WebMcpTool, options?: Record<string, unknown>) => void
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

const WEB_MCP_TOOL_CONTRACTS = buildKnowgrphAgentReadyToolContracts({
  defaultWorkspaceId: KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID,
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
const SOURCE_FILES_TOOL_NAME = SOURCE_FILES_TOOL_CONTRACT.webName
const READ_SOURCE_FILE_TOOL_NAME = READ_SOURCE_FILE_TOOL_CONTRACT.webName
const WEB_MCP_TOOL_NAMES = [SOURCE_FILES_TOOL_NAME, READ_SOURCE_FILE_TOOL_NAME] as const

const markWebMcpRuntime = (state = WEB_MCP_TOOL_NAMES.join(',')): void => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.kgWebmcpTools = WEB_MCP_TOOL_NAMES.join(',')
  document.documentElement.dataset.kgWebmcpContext = state
}

const readGlobalNavigator = (): WebMcpNavigator => {
  const root = globalThis as typeof globalThis & { navigator?: WebMcpNavigator }
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

const buildSourceFilesTool = (): WebMcpTool => ({
  name: SOURCE_FILES_TOOL_NAME,
  title: SOURCE_FILES_TOOL_CONTRACT.title,
  description: SOURCE_FILES_TOOL_CONTRACT.description,
  inputSchema: SOURCE_FILES_TOOL_CONTRACT.inputSchema,
  annotations: SOURCE_FILES_TOOL_CONTRACT.annotations,
  execute: async () => {
    const response = await fetch('https://airvio.co/api/storage/source-files', {
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
    const response = await fetch(`https://airvio.co${path}`, {
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

const installToolsIntoModelContext = (context: ModelContextLike, tools: WebMcpTool[]): boolean => {
  let installed = false
  if (typeof context.provideContext === 'function') {
    context.provideContext({ tools })
    installed = true
  }
  if (typeof context.registerTool === 'function') {
    for (const tool of tools) {
      try {
        context.registerTool(tool)
        installed = true
      } catch {
        installed = true
      }
    }
  }
  if (Array.isArray(context.tools)) {
    for (const tool of tools) {
      if (!context.tools.some(entry => entry?.name === tool.name)) context.tools.push(tool)
    }
    installed = true
  }
  return installed
}

const defineFallbackModelContext = (nav: WebMcpNavigator, context: ModelContextLike): void => {
  try {
    Object.defineProperty(nav, 'modelContext', {
      configurable: true,
      enumerable: false,
      value: context,
      writable: true,
    })
  } catch {
    nav.modelContext = context
  }
}

export function installKnowgrphWebMcpRuntime(): void {
  if (typeof globalThis === 'undefined') return
  const nav = readGlobalNavigator()
  const tools = [buildSourceFilesTool(), buildReadSourceFileTool()]
  const existing = nav.modelContext
  markWebMcpRuntime()
  if (existing && installToolsIntoModelContext(existing, tools)) {
    markWebMcpRuntime('installed')
    return
  }
  defineFallbackModelContext(nav, { tools })
  markWebMcpRuntime(
    WEB_MCP_TOOL_NAMES.every(name => nav.modelContext?.tools?.some(entry => entry?.name === name))
      ? 'fallback-readable'
      : 'fallback-defined',
  )
}
