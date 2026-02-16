import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useGraphStore } from '@/hooks/useGraphStore'
import Toolbar from '@/components/Toolbar'
import { EmbeddedEditorShell } from '@/components/EmbeddedEditorShell'
import { EmbeddedCanvasPreviewFrame } from '@/components/EmbeddedCanvasPreviewFrame'
import { ToolbarToolMenu } from '@/features/toolbar/ToolbarToolMenu'
import { FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID } from '@/lib/config'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testToolbarEditorButtonTogglesWorkspaceViewMode() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    useGraphStore.getState().setWorkspaceViewMode('canvas')

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const root = createRoot(container)
    root.render(
      <Toolbar onZoomIn={() => {}} onZoomOut={() => {}} onReset={() => {}} onZoomSelection={() => {}} />,
    )

    await tick()

    const editorBtn = dom.window.document.querySelector('button[aria-label="Editor"]') as HTMLButtonElement | null
    const statusBtn = dom.window.document.querySelector('button[aria-label="Status"]') as HTMLButtonElement | null
    if (!editorBtn) throw new Error('expected Editor button')
    if (!statusBtn) throw new Error('expected Status button')

    editorBtn.click()
    await tick()
    if (useGraphStore.getState().workspaceViewMode !== 'editor') throw new Error('expected workspaceViewMode to be editor after click')

    editorBtn.click()
    await tick()
    if (useGraphStore.getState().workspaceViewMode !== 'canvas') throw new Error('expected workspaceViewMode to be canvas after second click')

    root.unmount()
  } finally {
    try {
      useGraphStore.getState().setWorkspaceViewMode('canvas')
    } catch {
      void 0
    }
    restore()
  }
}

export async function testEmbeddedEditorShellRendersCanvasPreviewIframe() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const root = createRoot(container)
    root.render(<EmbeddedEditorShell previewSrc="/" />)
    await tick()

    const iframe = dom.window.document.querySelector('iframe[title="Canvas Preview"]') as HTMLIFrameElement | null
    if (!iframe) throw new Error('expected Canvas Preview iframe')
    const src = String(iframe.getAttribute('src') || '')
    if (src !== '/') throw new Error(`expected iframe src to be /, got ${src}`)
    const marker = String(iframe.getAttribute('data-kg-preview') || '')
    if (marker !== '1') throw new Error(`expected iframe to include data-kg-preview=1, got ${marker}`)

    root.unmount()
  } finally {
    restore()
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
