import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { encodePublishedDocShareToken } from '@/features/canvas/canvasDocShareToken.mjs'
import {
  installKnowgrphWebMcpRuntime,
  resetKnowgrphWebMcpRuntimeForTests,
} from '@/features/agent-ready/webMcpRuntime'

type RegisteredTool = {
  name: string
  execute: (input?: Record<string, unknown>) => Promise<unknown>
}

export async function testWebMcpRuntimeLateBindsAndUsesSameOriginStoragePaths(): Promise<void> {
  const previousBaseUrl = process.env.VITE_KNOWGRPH_STORAGE_BASE_URL
  const previousFetch = globalThis.fetch
  const { restore } = initJsdomHarness()
  const registeredTools = new Map<string, RegisteredTool>()
  const fetchCalls: string[] = []

  try {
    delete process.env.VITE_KNOWGRPH_STORAGE_BASE_URL
    resetKnowgrphWebMcpRuntimeForTests()

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

    installKnowgrphWebMcpRuntime()

    if (document.documentElement.dataset.kgWebmcpContext !== 'fallback-readable') {
      throw new Error(
        `expected fallback-readable runtime state before late modelContext binding, got ${String(document.documentElement.dataset.kgWebmcpContext)}`,
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
        `expected installed runtime state after late modelContext binding, got ${String(document.documentElement.dataset.kgWebmcpContext)}`,
      )
    }

    const listTool = registeredTools.get('knowgrph.list_source_files')
    const readTool = registeredTools.get('knowgrph.read_source_file')
    const readSharedTool = registeredTools.get('knowgrph.read_shared_document')
    if (!listTool || !readTool || !readSharedTool) {
      throw new Error(`expected all read-only WebMCP tools to be registered, got ${Array.from(registeredTools.keys()).join(', ')}`)
    }

    const shareToken = encodePublishedDocShareToken({ canonicalPath: 'docs/shared.md' })
    await listTool.execute()
    await readTool.execute({ canonicalPath: 'docs/example.md' })
    await readSharedTool.execute({ shareUrl: `/knowgrph/share/${shareToken}` })

    if (!fetchCalls.includes('/api/storage/source-files')) {
      throw new Error(`expected localhost list_source_files to use same-origin storage path, got ${fetchCalls.join(', ')}`)
    }
    if (!fetchCalls.includes('/api/storage/doc-default/docs%2Fexample.md')) {
      throw new Error(`expected localhost read_source_file to use same-origin storage path, got ${fetchCalls.join(', ')}`)
    }
    if (!fetchCalls.includes('/api/storage/doc-default/docs%2Fshared.md')) {
      throw new Error(`expected localhost read_shared_document to reuse same-origin storage path, got ${fetchCalls.join(', ')}`)
    }
  } finally {
    if (typeof previousBaseUrl === 'string') process.env.VITE_KNOWGRPH_STORAGE_BASE_URL = previousBaseUrl
    else delete process.env.VITE_KNOWGRPH_STORAGE_BASE_URL
    globalThis.fetch = previousFetch
    resetKnowgrphWebMcpRuntimeForTests()
    restore()
  }
}
