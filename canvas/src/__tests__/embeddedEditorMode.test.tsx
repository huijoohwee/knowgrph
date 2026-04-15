import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { useGraphStore } from '@/hooks/useGraphStore'
import Toolbar from '@/components/Toolbar'
import { EmbeddedEditorShell } from '@/components/EmbeddedEditorShell'
import { EmbeddedCanvasPreviewFrame } from '@/components/EmbeddedCanvasPreviewFrame'
import { ToolbarToolMenu } from '@/features/toolbar/ToolbarToolMenu'
import { EditorWorkspaceSelect } from '@/components/toolbar/EditorWorkspaceSelect'
import { FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID } from '@/lib/config'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testToolbarWorkspaceViewDropdownSelectsEditorWorkspace() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    useGraphStore.getState().resetAll()
    useGraphStore.getState().setWorkspaceViewMode('canvas')

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const root = createRoot(container)
    await act(async () => {
      root.render(<EditorWorkspaceSelect iconSizeClass="h-4 w-4" iconStrokeWidth={1.6} />)
    })

    await tick()

    const workspaceViewBtn = dom.window.document.querySelector('button[aria-label="Workspace View"]') as HTMLButtonElement | null
    if (!workspaceViewBtn) {
      const html = String(container.innerHTML || '')
      throw new Error(`expected Workspace View button. root.innerHTML=${html.slice(0, 1200)}`)
    }

    await act(async () => {
      workspaceViewBtn.click()
    })
    await tick()

    const menuButtons = Array.from(dom.window.document.querySelectorAll('menu button')) as HTMLButtonElement[]
    const editorOption =
      menuButtons.find(btn => String(btn.title || '').trim() === 'Editor Workspace') ||
      menuButtons.find(btn => String(btn.textContent || '').includes('Editor Workspace')) ||
      null
    if (!editorOption) throw new Error('expected Editor Workspace option')

    await act(async () => {
      editorOption.click()
    })
    await tick()
    if (useGraphStore.getState().workspaceViewMode !== 'editor') {
      throw new Error('expected workspaceViewMode to be editor after selecting Editor Workspace')
    }

    root.unmount()
  } finally {
    try {
      useGraphStore.getState().setWorkspaceViewMode('canvas')
    } catch {
      void 0
    }
    restore()
    restoreWindow()
  }
}

export async function testEmbeddedEditorShellRendersMarkdownWorkspace() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    useGraphStore.getState().resetAll()

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const root = createRoot(container)
    await act(async () => {
      root.render(<EmbeddedEditorShell active={true} />)
    })

    const workspace = dom.window.document.querySelector('section[aria-label="Markdown Workspace"]') as HTMLElement | null
    if (!workspace) throw new Error('expected Markdown Workspace to render')

    await act(async () => {
      root.unmount()
    })
    await tick()
  } finally {
    restore()
    restoreWindow()
  }
}

export async function testEditorWorkspaceInspectorUsesSelectionInspectorWhenFlowEditorNotMounted() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  const store = useGraphStore.getState()
  let root: ReturnType<typeof createRoot> | null = null
  try {
    store.setWorkspaceViewMode('editor')
    store.setCanvasRenderMode('2d')
    store.setCanvas2dRenderer('flowEditor')
    store.selectNode(null)
    store.selectEdge(null)
    store.selectGroup(null)

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    root = createRoot(container)
    root.render(
      <ToolbarToolMenu
        pipelineStatus={null}
        exportStatus={null}
        toolMenuCardRef={{ current: null }}
        toolMenuCardStyle={{ top: 0, left: 0 }}
        onHeaderPointerDown={() => void 0}
        requestedFloatingPanelView="inspector"
        requestedFloatingPanelViewSeq={1}
        onClose={() => void 0}
      />,
    )

    let inspector: Element | null = null
    for (let i = 0; i < 60; i++) {
      await tick()
      inspector = dom.window.document.querySelector('[aria-label="Record inspector"]')
      if (inspector) break
    }

    const portalSlot = dom.window.document.getElementById(FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID)
    if (portalSlot) throw new Error('expected Flow Editor inspector portal slot to be absent in editor workspace')

    if (!inspector) throw new Error('expected selection inspector to render in editor workspace')
  } finally {
    try {
      store.setWorkspaceViewMode('canvas')
    } catch {
      void 0
    }
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restore()
  }
}

export async function testEmbeddedPreviewGraphUpdatesApplyToParentStore() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  const store = useGraphStore.getState()
  let root: ReturnType<typeof createRoot> | null = null
  try {
    store.resetAll()

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    root = createRoot(container)
    root.render(<EmbeddedCanvasPreviewFrame previewSrc="/" />)
    await tick()
    await tick()

    const graphData = {
      type: 'Graph',
      nodes: [{ id: 'n1', type: 'Entity', label: 'Node', x: 0, y: 0, properties: {} }],
      edges: [],
    }
    dom.window.dispatchEvent(
      new dom.window.MessageEvent('message', {
        origin: dom.window.location.origin,
        data: { kind: 'kg-preview-graph', payload: { graphData } },
      }),
    )
    await tick()

    const next = useGraphStore.getState().graphData as { nodes?: Array<{ id?: unknown }> } | null
    const ids = new Set((next?.nodes || []).map(n => String(n.id || '')))
    if (!ids.has('n1')) throw new Error('expected parent store graphData to apply iframe graph update')
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restore()
  }
}
