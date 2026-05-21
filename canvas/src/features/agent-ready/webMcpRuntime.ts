type WebMcpTool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: () => Promise<unknown>
}

type ModelContextLike = {
  tools?: WebMcpTool[]
  provideContext?: (context: { tools: WebMcpTool[] }) => void
}

const SOURCE_FILES_TOOL_NAME = 'knowgrph.list_source_files'

const markWebMcpRuntime = (): void => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.kgWebmcpTools = SOURCE_FILES_TOOL_NAME
}

const readGlobalNavigator = (): Navigator & { modelContext?: ModelContextLike } => {
  const root = globalThis as typeof globalThis & { navigator?: Navigator & { modelContext?: ModelContextLike } }
  if (root.navigator) return root.navigator
  const nav = {} as Navigator & { modelContext?: ModelContextLike }
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
  description: 'List published Knowgrph Source Files.',
  inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  execute: async () => {
    const response = await fetch('https://airvio.co/api/storage/source-files', {
      headers: { accept: 'application/json' },
    })
    return response.json()
  },
})

export function installKnowgrphWebMcpRuntime(): void {
  if (typeof globalThis === 'undefined') return
  const nav = readGlobalNavigator()
  const tool = buildSourceFilesTool()
  const existing = nav.modelContext
  markWebMcpRuntime()
  if (existing && typeof existing.provideContext === 'function') {
    existing.provideContext({ tools: [tool] })
    return
  }
  if (existing && Array.isArray(existing.tools)) {
    if (!existing.tools.some(entry => entry?.name === SOURCE_FILES_TOOL_NAME)) existing.tools.push(tool)
    return
  }
  nav.modelContext = { tools: [tool] }
}
