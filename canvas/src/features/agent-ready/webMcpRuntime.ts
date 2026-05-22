type WebMcpTool = {
  name: string
  title?: string
  description: string
  inputSchema: Record<string, unknown>
  execute: () => Promise<unknown>
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

const markWebMcpRuntime = (state = SOURCE_FILES_TOOL_NAME): void => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.kgWebmcpTools = SOURCE_FILES_TOOL_NAME
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
      headers: { accept: 'application/json' },
    })
    return response.json()
  },
})

const installToolIntoModelContext = (context: ModelContextLike, tool: WebMcpTool): boolean => {
  let installed = false
  if (typeof context.provideContext === 'function') {
    context.provideContext({ tools: [tool] })
    installed = true
  }
  if (typeof context.registerTool === 'function') {
    try {
      context.registerTool(tool)
      installed = true
    } catch {
      installed = true
    }
  }
  if (Array.isArray(context.tools)) {
    if (!context.tools.some(entry => entry?.name === SOURCE_FILES_TOOL_NAME)) context.tools.push(tool)
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
  const tool = buildSourceFilesTool()
  const existing = nav.modelContext
  markWebMcpRuntime()
  if (existing && installToolIntoModelContext(existing, tool)) {
    markWebMcpRuntime('installed')
    return
  }
  defineFallbackModelContext(nav, { tools: [tool] })
  markWebMcpRuntime(nav.modelContext?.tools?.some(entry => entry?.name === SOURCE_FILES_TOOL_NAME) ? 'fallback-readable' : 'fallback-defined')
}
