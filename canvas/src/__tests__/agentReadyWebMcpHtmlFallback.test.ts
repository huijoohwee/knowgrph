import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { encodePublishedDocShareToken } from '@/features/canvas/canvasDocShareToken.mjs'
import { webMcpScript } from '../../../cloudflare/pages/knowgrph-agent-ready.mjs'

type RegisteredTool = {
  name: string
  execute: (input?: Record<string, unknown>) => Promise<unknown>
}

const MOCK_SHARED_DOCUMENT_MARKDOWN = `---
flow:
  nodes:
    - id: start
      label: Start
    - id: end
      label: End
  connections:
    - source: start
      target: end
  subgraphs:
    - id: lane-main
      label: Main
---

# Shared Doc

## Overview
`

const createMockResponse = (url: string): Response =>
  ({
    ok: true,
    status: 200,
    text: async () => (
      url.includes('/api/storage/doc-default/')
        || url.includes('/api/storage/doc/')
        ? MOCK_SHARED_DOCUMENT_MARKDOWN
        : '# mock markdown'
    ),
    json: async () => ({
      url,
      ok: true,
      capabilities: { tools: [{ name: 'list_source_files' }] },
      status: 'pass',
      service: 'knowgrph-agent-ready-pages',
      skills: [{ name: 'knowgrph-source-files', type: 'markdown', url: `${url}/skill.md`, sha256: 'sha' }],
      openapi: '3.1.0',
      paths: { '/knowgrph/health': { get: {} } },
    }),
  }) as Response

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
      const url = String(input)
      fetchCalls.push(url)
      return createMockResponse(url)
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
    const readSharedTool = registeredTools.get('knowgrph.read_shared_document')
    const inspectSharedDocumentTool = registeredTools.get('knowgrph.inspect_shared_document_structure')
    const inspectLocalDocumentTool = registeredTools.get('knowgrph.inspect_local_workspace_document')
    const inspectLocalCanvasTool = registeredTools.get('knowgrph.inspect_local_canvas_topology')
    const inspectLocalCanvasSnapshotTool = registeredTools.get('knowgrph.inspect_local_canvas_snapshot')
    const inspectLocal3dCameraPoseTool = registeredTools.get('knowgrph.inspect_local_3d_camera_pose')
    const inspectLocal3dLayoutPositionsTool = registeredTools.get('knowgrph.inspect_local_3d_layout_positions')
    const inspectLocal2dZoomViewportTool = registeredTools.get('knowgrph.inspect_local_2d_zoom_viewport')
    const inspectLocalSourceFilesSnapshotTool = registeredTools.get('knowgrph.inspect_local_source_files_snapshot')
    const inspectTool = registeredTools.get('knowgrph.inspect_agent_surface')
    if (!listTool || !readTool || !readSharedTool || !inspectSharedDocumentTool || !inspectTool) {
      throw new Error(`expected all injected WebMCP tools to be registered, got ${Array.from(registeredTools.keys()).join(', ')}`)
    }
    if (inspectLocalDocumentTool) {
      throw new Error('expected injected HTML fallback to exclude the browser-local inspect_local_workspace_document tool')
    }
    if (inspectLocalCanvasTool) {
      throw new Error('expected injected HTML fallback to exclude the browser-local inspect_local_canvas_topology tool')
    }
    if (inspectLocalCanvasSnapshotTool) {
      throw new Error('expected injected HTML fallback to exclude the browser-local inspect_local_canvas_snapshot tool')
    }
    if (inspectLocal3dCameraPoseTool) {
      throw new Error('expected injected HTML fallback to exclude the browser-local inspect_local_3d_camera_pose tool')
    }
    if (inspectLocal3dLayoutPositionsTool) {
      throw new Error('expected injected HTML fallback to exclude the browser-local inspect_local_3d_layout_positions tool')
    }
    if (inspectLocal2dZoomViewportTool) {
      throw new Error('expected injected HTML fallback to exclude the browser-local inspect_local_2d_zoom_viewport tool')
    }
    if (inspectLocalSourceFilesSnapshotTool) {
      throw new Error('expected injected HTML fallback to exclude the browser-local inspect_local_source_files_snapshot tool')
    }

    const shareToken = encodePublishedDocShareToken({ canonicalPath: 'docs/shared.md' })
    await listTool.execute()
    await readTool.execute({ canonicalPath: 'docs/example.md' })
    await readSharedTool.execute({ shareUrl: `/knowgrph/share/${shareToken}` })
    const sharedStructure = await inspectSharedDocumentTool.execute({ shareUrl: `/knowgrph/share/${shareToken}` })
    const inspection = await inspectTool.execute()

    if (!fetchCalls.includes('/api/storage/source-files')) {
      throw new Error(`expected injected list_source_files to use same-origin storage path, got ${fetchCalls.join(', ')}`)
    }
    if (!fetchCalls.includes('/api/storage/doc-default/docs%2Fexample.md')) {
      throw new Error(`expected injected read_source_file to use same-origin storage path, got ${fetchCalls.join(', ')}`)
    }
    if (!fetchCalls.includes('/api/storage/doc-default/docs%2Fshared.md')) {
      throw new Error(`expected injected read_shared_document to reuse same-origin storage path, got ${fetchCalls.join(', ')}`)
    }
    if ((sharedStructure as { flowConnectionCount?: unknown }).flowConnectionCount !== 1) {
      throw new Error(`expected injected inspect_shared_document_structure to count flow connections, got ${JSON.stringify(sharedStructure)}`)
    }
    if ((sharedStructure as { headingCount?: unknown }).headingCount !== 2) {
      throw new Error(`expected injected inspect_shared_document_structure to count markdown headings, got ${JSON.stringify(sharedStructure)}`)
    }
    if (!fetchCalls.some((url) => url.endsWith('/knowgrph/health'))) {
      throw new Error(`expected injected inspect_agent_surface to fetch the agent-ready health route, got ${fetchCalls.join(', ')}`)
    }
    if (!fetchCalls.some((url) => url.endsWith('/knowgrph/.well-known/agent-skills/index.json'))) {
      throw new Error(`expected injected inspect_agent_surface to fetch the agent skills index, got ${fetchCalls.join(', ')}`)
    }
    if (String((inspection as { mcpUrl?: unknown }).mcpUrl || '').endsWith('/knowgrph/mcp') !== true) {
      throw new Error(`expected injected inspect_agent_surface to return the MCP URL, got ${JSON.stringify(inspection)}`)
    }
  } finally {
    globalThis.fetch = previousFetch
    restore()
  }
}
