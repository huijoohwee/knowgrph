import {
  KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID,
  buildKnowgrphStorageDefaultDocPath,
  buildKnowgrphStorageDocPath,
} from '@/lib/storage/knowgrphStorageSyncContract'

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

const SOURCE_FILES_TOOL_NAME = 'knowgrph.list_source_files'
const READ_SOURCE_FILE_TOOL_NAME = 'knowgrph.read_source_file'
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
  title: 'List Source Files',
  description: 'List published Knowgrph Source Files.',
  inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  annotations: { readOnlyHint: true },
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
  title: 'Read Source File',
  description: 'Read published Knowgrph Editor Workspace markdown content.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['canonicalPath'],
    properties: {
      canonicalPath: { type: 'string' },
      workspaceId: { type: 'string', default: KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID },
    },
  },
  annotations: { readOnlyHint: true },
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
