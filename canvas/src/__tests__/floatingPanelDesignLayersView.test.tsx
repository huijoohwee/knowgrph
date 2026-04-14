import React from 'react'
import { createRoot } from 'react-dom/client'

import { ToolbarToolMenu } from '@/features/toolbar/ToolbarToolMenu'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_LABELS } from '@/lib/config'
import { LS_KEYS } from '@/lib/config.ls.keys'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testFloatingPanelDesignLayersViewRendersAsDiv() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  const store = useGraphStore.getState()
  try {
    try {
      dom.window.localStorage.setItem(LS_KEYS.geospatialOverlayEnabled, '0')
      ;(globalThis as unknown as { localStorage?: Storage }).localStorage?.setItem(LS_KEYS.geospatialOverlayEnabled, '0')
    } catch {
      void 0
    }
    store.setWorkspaceViewMode('canvas')
    store.setCanvasRenderMode('2d')
    store.setCanvas2dRenderer('design')

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const root = createRoot(container)
    root.render(
      <ToolbarToolMenu
        pipelineStatus={null}
        exportStatus={null}
        toolMenuCardRef={{ current: null }}
        toolMenuCardStyle={{ top: 0, left: 0 }}
        onHeaderPointerDown={() => void 0}
        requestedFloatingPanelView="designLayers"
        requestedFloatingPanelViewSeq={1}
        onClose={() => void 0}
      />,
    )

    for (let i = 0; i < 10; i++) await tick()

    const nav = dom.window.document.querySelector('nav[aria-label="Floating panel views"]')
    if (!nav) throw new Error('expected Floating panel views nav')

    const buttons = Array.from(nav.querySelectorAll('button')) as HTMLButtonElement[]
    const labels = buttons.map(b => String(b.getAttribute('aria-label') || ''))
    if (labels[0] !== UI_LABELS.propsPanel) {
      throw new Error(`expected first floating panel view to be ${UI_LABELS.propsPanel}, got ${labels[0]}`)
    }
    if (labels[1] !== UI_LABELS.layerMode) {
      throw new Error(`expected second floating panel view to be ${UI_LABELS.layerMode}, got ${labels[1]}`)
    }

    let designLayers: HTMLElement | null = null
    for (let i = 0; i < 30; i++) {
      await tick()
      designLayers = dom.window.document.querySelector('[aria-label="Design Layers"]') as HTMLElement | null
      if (designLayers) break
    }

    if (!designLayers) throw new Error('expected Design Layers view to render')
    const tag = designLayers.tagName.toLowerCase()
    if (tag !== 'div') {
      throw new Error(`expected Design Layers root tag to be div in floating panel, got ${tag}`)
    }

    root.unmount()
  } finally {
    restore()
  }
}

export async function testFloatingPanelInteractionViewUsesFullHeightShellBody() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  const store = useGraphStore.getState()
  try {
    try {
      dom.window.localStorage.setItem(LS_KEYS.geospatialOverlayEnabled, '0')
      ;(globalThis as unknown as { localStorage?: Storage }).localStorage?.setItem(LS_KEYS.geospatialOverlayEnabled, '0')
    } catch {
      void 0
    }
    store.setWorkspaceViewMode('canvas')
    store.setCanvasRenderMode('2d')
    store.setCanvas2dRenderer('d3')

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const root = createRoot(container)
    root.render(
      <ToolbarToolMenu
        pipelineStatus="ingest->parse->render"
        exportStatus={null}
        toolMenuCardRef={{ current: null }}
        toolMenuCardStyle={{ top: 0, left: 0 }}
        onHeaderPointerDown={() => void 0}
        requestedFloatingPanelView="interaction"
        requestedFloatingPanelViewSeq={2}
        onClose={() => void 0}
      />,
    )

    for (let i = 0; i < 10; i++) await tick()

    const shellBodies = Array.from(
      dom.window.document.querySelectorAll(`[aria-label="${UI_LABELS.floatingPanel}"]`),
    ) as HTMLElement[]
    const shellBody = shellBodies.find((el): el is HTMLElement =>
      String(el.getAttribute('class') || '').includes('mt-1'),
    )
    if (!(shellBody instanceof dom.window.HTMLElement)) {
      throw new Error('expected floating panel shell body')
    }
    const shellClass = String(shellBody.getAttribute('class') || '')
    if (!shellClass.includes('overflow-hidden')) {
      throw new Error(`expected interaction view shell body to use overflow-hidden, got ${JSON.stringify(shellClass)}`)
    }

    const interactionPanel = dom.window.document.querySelector('[aria-label="Interaction panel"]')
    if (!(interactionPanel instanceof dom.window.HTMLElement)) {
      throw new Error('expected interaction panel to render')
    }
    const interactionContent = dom.window.document.querySelector('[aria-label="Interaction panel content"]')
    if (!(interactionContent instanceof dom.window.HTMLElement)) {
      throw new Error('expected interaction panel content to render')
    }

    root.unmount()
  } finally {
    restore()
  }
}
