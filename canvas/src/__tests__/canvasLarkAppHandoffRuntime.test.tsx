import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { CanvasQueryBootstrapRuntime } from '@/features/canvas/CanvasQueryBootstrapRuntime'
import { buildLarkAppCanvasHandoffQuery } from '@/features/canvas/larkAppCanvasHandoff'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { mountReactRoot, unmountReactRoot, waitForTasks } from '@/tests/lib/reactRootHarness'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { FeishuBaseSourceAdapterInput } from '@/features/source-files/feishuBaseSourceAdapter'
import type { FeishuBaseSourceImportRequest, FeishuBaseSourceImportResult } from '@/features/source-files/feishuBaseSourceImportContract'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

const SNAPSHOT_FIXTURE: FeishuBaseSourceAdapterInput = {
  selection: {
    baseToken: 'bascn_runtime_fixture',
    tableId: 'tbl_runtime_fixture',
    viewId: 'vew_runtime_fixture',
    baseTitle: 'Runtime Fixture Base',
    tableName: 'Tasks',
    viewName: 'Open',
  },
  fields: [
    { id: 'fld_title', name: 'Title', type: 'text', isPrimary: true },
  ],
  records: [
    { id: 'rec_runtime', title: 'Runtime Row', fields: { Title: 'Runtime Row' } },
  ],
}

const waitUntil = async (predicate: () => boolean, timeoutMs = 1200): Promise<void> => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('timed out waiting for Lark Canvas handoff runtime state')
}

const withRenderedRuntime = async (
  search: string,
  assertions: (dom: Window) => Promise<void> | void,
  setup?: (dom: Window) => void,
): Promise<void> => {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  let root: ReturnType<typeof createRoot> | null = null

  try {
    useGraphStore.getState().resetAll()
    dom.window.history.replaceState(null, '', `/${search}`)
    ;(dom.window as Window & { __KG_MAIN_PANEL_OPEN_READY__?: boolean }).__KG_MAIN_PANEL_OPEN_READY__ = true
    setup?.(dom.window)

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')
    root = createRoot(container)
    await mountReactRoot(root, React.createElement(CanvasQueryBootstrapRuntime, { search }), {
      window: dom.window,
      frames: 3,
      tasks: 2,
    })
    await waitForTasks(2)
    await assertions(dom.window)
  } finally {
    try {
      if (root) await unmountReactRoot(root, { window: dom.window, tasks: 1 })
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testCanvasQueryBootstrapHandlesLarkReviewHandoff() {
  const events: Array<Record<string, unknown>> = []
  const search = buildLarkAppCanvasHandoffQuery({
    surface: 'webpage',
    intent: 'review',
    openMainPanelTab: 'mcp',
    openEditorWorkspace: true,
    openCanvas: true,
  })

  await withRenderedRuntime(search, async domWindow => {
    await waitUntil(() => useGraphStore.getState().workspaceViewMode === 'editor' && events.some(event => String(event.tab || '') === 'mcp'))
    if (useGraphStore.getState().workspaceCanvasPaneOpen !== true) {
      throw new Error(`expected Editor Workspace pane to be open, got ${JSON.stringify(useGraphStore.getState())}`)
    }
    if (!events.some(event => String(event.tab || '') === 'mcp')) {
      throw new Error(`expected review handoff to open MainPanel MCP, got ${JSON.stringify(events)}`)
    }
    if (String(domWindow.location.search || '').includes('kgLarkHandoff')) {
      throw new Error(`expected Lark handoff query to be consumed, got ${JSON.stringify(domWindow.location.search)}`)
    }
  }, domWindow => {
    const listener = (event: Event) => {
      const custom = event as CustomEvent<Record<string, unknown>>
      events.push(custom.detail || {})
    }
    domWindow.addEventListener(MAIN_PANEL_OPEN_EVENT, listener as EventListener)
  })
}

export async function testCanvasQueryBootstrapHandlesLarkImportHandoffWithoutGraphBypass() {
  const search = buildLarkAppCanvasHandoffQuery({
    surface: 'webpage',
    intent: 'import',
    openMainPanelTab: 'mcp',
    openEditorWorkspace: true,
    openCanvas: true,
    fileId: null,
    snapshot: SNAPSHOT_FIXTURE,
  })

  let capturedRequest: FeishuBaseSourceImportRequest | null = null

  await withRenderedRuntime(search, async domWindow => {
    await waitUntil(() => capturedRequest !== null)
    if (!capturedRequest || capturedRequest.snapshot.selection.baseToken !== SNAPSHOT_FIXTURE.selection.baseToken) {
      throw new Error(`expected import handoff to reuse the structured snapshot seam, got ${JSON.stringify(capturedRequest)}`)
    }
    const state = useGraphStore.getState()
    if (state.workspaceViewMode !== 'editor' || state.workspaceCanvasPaneOpen !== true) {
      throw new Error(`expected import handoff to open Editor Workspace, got ${JSON.stringify({ workspaceViewMode: state.workspaceViewMode, workspaceCanvasPaneOpen: state.workspaceCanvasPaneOpen })}`)
    }
    if (!state.uiToasts.some(toast => toast.kind === 'success' && toast.message.includes('Imported Lark handoff'))) {
      throw new Error(`expected import handoff success toast, got ${JSON.stringify(state.uiToasts)}`)
    }
    if (String(domWindow.location.search || '').includes('kgLarkHandoff')) {
      throw new Error(`expected import handoff query to be consumed, got ${JSON.stringify(domWindow.location.search)}`)
    }
  }, domWindow => {
    ;(domWindow as Window & {
      knowgrphFeishuBaseSourceImportCommand?: { importSnapshot: (args: FeishuBaseSourceImportRequest) => Promise<FeishuBaseSourceImportResult> }
    }).knowgrphFeishuBaseSourceImportCommand = {
      importSnapshot: async (args: FeishuBaseSourceImportRequest) => {
        capturedRequest = args
        return {
          ok: true,
          fileId: 'kg-lark-runtime',
          name: 'Runtime Imported Snapshot',
          warnings: [],
        }
      },
    }
  })
}

export function testCanvasQueryBootstrapDoesNotTreatWebpageAsMcpEndpoint() {
  const text = readUtf8('src/features/canvas/CanvasQueryBootstrapRuntime.tsx')
  if (!text.includes("parseLarkAppCanvasHandoffFromSearch")) {
    throw new Error('expected CanvasQueryBootstrapRuntime to use the shared Lark handoff parser')
  }
  if (!text.includes("consumeLarkAppCanvasHandoffParams")) {
    throw new Error('expected CanvasQueryBootstrapRuntime to consume handled Lark handoff params')
  }
  if (!text.includes("importFeishuBaseSnapshotFromLarkHandoff")) {
    throw new Error('expected CanvasQueryBootstrapRuntime to reuse the existing Base import seam for Lark import intent')
  }
  if (text.includes('https://open.larksuite.com/app/cli_a7ddaa5aeff89010/webpage') || text.includes('https://airvio.co/knowgrph/mcp')) {
    throw new Error('expected CanvasQueryBootstrapRuntime not to hardcode webpage or MCP endpoint URLs')
  }
  if (text.includes('applyWorkspaceImportToCanvas') || text.includes('setActiveMarkdownDocument(')) {
    throw new Error('expected CanvasQueryBootstrapRuntime not to bypass import/validation owners with direct graph application')
  }
}
