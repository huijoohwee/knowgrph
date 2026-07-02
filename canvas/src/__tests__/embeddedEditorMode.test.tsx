import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { unmountReactRoot } from '@/tests/lib/reactRootHarness'
import { useGraphStore } from '@/hooks/useGraphStore'
import { EmbeddedEditorShell } from '@/components/EmbeddedEditorShell'
import { EmbeddedCanvasPreviewFrame } from '@/components/EmbeddedCanvasPreviewFrame'
import { EditorWorkspaceSelect } from '@/components/toolbar/EditorWorkspaceSelect'
import WorkflowManagerInspectorPanel from '@/features/storyboard-widget-manager/WorkflowManagerInspectorPanel'
import { closeWorkspaceView } from '@/features/workspace-table/workspaceTableSsot'
import { STORYBOARD_WIDGET_INSPECTOR_PORTAL_SLOT_ID } from '@/lib/config'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testToolbarWorkspaceViewDropdownSelectsEditorWorkspace() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
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

    await act(async () => {
      root.unmount()
    })
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

export async function testToolbarWorkspaceViewReopensEditorWorkspaceAfterInitialOpenClose() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    useGraphStore.getState().resetAll()
    useGraphStore.getState().setWorkspaceViewMode('editor')

    const initiallyOpen = useGraphStore.getState()
    if (initiallyOpen.workspaceViewMode !== 'editor' || initiallyOpen.workspaceCanvasPaneOpen !== true) {
      throw new Error('expected test to initialize with Editor Workspace open')
    }

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const root = createRoot(container)
    await act(async () => {
      root.render(<EditorWorkspaceSelect iconSizeClass="h-4 w-4" iconStrokeWidth={1.6} />)
    })

    const selectEditorWorkspace = async () => {
      const workspaceViewBtn = dom.window.document.querySelector('button[aria-label="Workspace View"]') as HTMLButtonElement | null
      if (!workspaceViewBtn) throw new Error('expected Workspace View button')
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
    }

    await act(async () => {
      closeWorkspaceView({
        workspaceViewMode: initiallyOpen.workspaceViewMode,
        workspaceCanvasPaneOpen: initiallyOpen.workspaceCanvasPaneOpen,
        setWorkspaceViewMode: initiallyOpen.setWorkspaceViewMode,
        setWorkspaceCanvasPaneOpen: initiallyOpen.setWorkspaceCanvasPaneOpen,
      })
    })
    await tick()
    const closed = useGraphStore.getState()
    if (closed.workspaceViewMode !== 'canvas' || closed.workspaceCanvasPaneOpen !== false) {
      throw new Error('expected workspace close to clear pane-open residue before toolbar reopen')
    }

    await selectEditorWorkspace()
    const reopened = useGraphStore.getState()
    if (reopened.workspaceViewMode !== 'editor' || reopened.workspaceCanvasPaneOpen !== true) {
      throw new Error('expected toolbar reopen to restore editor workspace with a clean pane-open transition')
    }

    await act(async () => {
      root.unmount()
    })
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

export async function testToolbarWorkspaceViewButtonReopensClosedEditorPane() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    useGraphStore.getState().resetAll()
    useGraphStore.setState({ workspaceViewMode: 'editor', workspaceCanvasPaneOpen: false })

    const staleClosed = useGraphStore.getState()
    if (staleClosed.workspaceViewMode !== 'editor' || staleClosed.workspaceCanvasPaneOpen !== false) {
      throw new Error('expected test to initialize with active Editor Workspace mode but closed pane')
    }

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const root = createRoot(container)
    await act(async () => {
      root.render(<EditorWorkspaceSelect iconSizeClass="h-4 w-4" iconStrokeWidth={1.6} />)
    })

    const workspaceViewBtn = dom.window.document.querySelector('button[aria-label="Workspace View"]') as HTMLButtonElement | null
    if (!workspaceViewBtn) throw new Error('expected Workspace View button')

    await act(async () => {
      workspaceViewBtn.click()
    })
    await tick()

    const reopened = useGraphStore.getState()
    if (reopened.workspaceViewMode !== 'editor' || reopened.workspaceCanvasPaneOpen !== true) {
      throw new Error('expected selected Workspace View button click to reopen the stale closed editor pane')
    }
    const menu = dom.window.document.querySelector('menu')
    if (menu) throw new Error('expected stale closed editor pane repair not to leave a dropdown open')

    await act(async () => {
      root.unmount()
    })
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
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    useGraphStore.getState().resetAll()

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const root = createRoot(container)
    root.render(<EmbeddedEditorShell active={true} />)
    let workspace: HTMLElement | null = null
    for (let i = 0; i < 60; i += 1) {
      await tick()
      workspace = dom.window.document.querySelector('section[aria-label="Markdown Workspace"]') as HTMLElement | null
      if (workspace) break
    }
    if (!workspace) throw new Error('expected Markdown Workspace to render')

    await unmountReactRoot(root, { tasks: 2 })
  } finally {
    restore()
    restoreWindow()
  }
}

export async function testEditorWorkspaceInspectorUsesSelectionInspectorWhenStoryboardWidgetNotMounted() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  const store = useGraphStore.getState()
  let root: ReturnType<typeof createRoot> | null = null
  try {
    store.setWorkspaceViewMode('editor')
    store.setCanvasRenderMode('2d')
    store.setCanvas2dRenderer('storyboard')
    store.selectNode(null)
    store.selectEdge(null)
    store.selectGroup(null)

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    root = createRoot(container)
    await act(async () => {
      root.render(<WorkflowManagerInspectorPanel />)
    })

    let inspector: Element | null = null
    for (let i = 0; i < 60; i++) {
      await act(async () => {
        await tick()
      })
      inspector = dom.window.document.querySelector('[aria-label="Record inspector"]')
      if (inspector) break
    }

    const portalSlot = dom.window.document.getElementById(STORYBOARD_WIDGET_INSPECTOR_PORTAL_SLOT_ID)
    if (portalSlot) throw new Error('expected Storyboard Widget inspector portal slot to be absent in editor workspace')

    if (!inspector) throw new Error('expected selection inspector to render in editor workspace')
  } finally {
    try {
      store.setWorkspaceViewMode('canvas')
    } catch {
      void 0
    }
    try {
      await act(async () => {
        root?.unmount()
      })
    } catch {
      void 0
    }
    restore()
  }
}

export async function testEmbeddedPreviewGraphUpdatesApplyToParentStore() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
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
