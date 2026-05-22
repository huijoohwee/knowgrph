import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { webMcpScript } from '../../../cloudflare/pages/knowgrph-agent-ready.mjs'

type RegisteredTool = {
  name: string
  execute: (input?: Record<string, unknown>) => Promise<unknown>
}

export async function testAgentReadyHtmlWebMcpFallbackLateBindsAndUsesSameOriginStoragePaths(): Promise<void> {
  const previousFetch = globalThis.fetch
  const { restore } = initJsdomHarness()
  const fetchCalls: string[] = []
  const registeredTools = new Map<string, RegisteredTool>()

  try {
    const navigatorObject = window.navigator as Navigator & {
      modelContext?: {
        registerTool?: (tool: RegisteredTool, options?: { signal?: AbortSignal }) => void
      }
    }
    try {
      delete navigatorObject.modelContext
    } catch {
      navigatorObject.modelContext = undefined
    }

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      fetchCalls.push(String(input))
      return {
        ok: true,
        status: 200,
        text: async () => '# mock markdown',
      } as Response
    }) as typeof fetch

    new Function(webMcpScript)()

    if (document.documentElement.dataset.kgWebmcpContext !== 'fallback-readable') {
      throw new Error(
        `expected fallback-readable HTML script state before late modelContext binding, got ${String(document.documentElement.dataset.kgWebmcpContext)}`,
      )
    }

    navigatorObject.modelContext = {
      registerTool(tool, options) {
        if (!options?.signal) {
          throw new Error(`expected AbortSignal-backed registerTool options for ${tool.name}`)
        }
        registeredTools.set(tool.name, tool)
      },
    }

    if (document.documentElement.dataset.kgWebmcpContext !== 'installed') {
      throw new Error(
        `expected installed HTML script state after late modelContext binding, got ${String(document.documentElement.dataset.kgWebmcpContext)}`,
      )
    }

    const listTool = registeredTools.get('knowgrph.list_source_files')
    const readTool = registeredTools.get('knowgrph.read_source_file')
    if (!listTool || !readTool) {
      throw new Error(`expected both injected WebMCP tools to be registered, got ${Array.from(registeredTools.keys()).join(', ')}`)
    }

    await listTool.execute()
    await readTool.execute({ canonicalPath: 'docs/example.md' })

    if (!fetchCalls.includes('/api/storage/source-files')) {
      throw new Error(`expected injected list_source_files to use same-origin storage path, got ${fetchCalls.join(', ')}`)
    }
    if (!fetchCalls.includes('/api/storage/doc-default/docs%2Fexample.md')) {
      throw new Error(`expected injected read_source_file to use same-origin storage path, got ${fetchCalls.join(', ')}`)
    }
  } finally {
    globalThis.fetch = previousFetch
    restore()
  }
}
