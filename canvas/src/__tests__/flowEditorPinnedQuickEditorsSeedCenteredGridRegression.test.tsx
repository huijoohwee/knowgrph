import React from 'react'
import { createRoot } from 'react-dom/client'

import FlowEditorCanvas from '@/components/FlowEditorCanvas'
import { computeNodeQuickEditorScale, computeNodeQuickEditorScaledSize } from '@/components/FlowEditor/nodeQuickEditorZoom'
import { useGraphStore } from '@/hooks/useGraphStore'
import { viewportCenterToWorld } from '@/lib/zoom/viewport'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'

export async function testFlowEditorPinnedQuickEditorsInitCenteredEvenGrid() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame = anyWindow.requestAnimationFrame

    const api = useGraphStore.getState()
    api.resetAll()

    useGraphStore.setState(s => ({
      ...s,
      graphData: {
        type: 'Graph',
        nodes: [
          { id: 'n1', label: 'n1', type: 'Anchor', x: 0, y: 0, properties: {} },
          { id: 'n2', label: 'n2', type: 'Anchor', x: 0, y: 0, properties: {} },
          { id: 'n3', label: 'n3', type: 'Anchor', x: 0, y: 0, properties: {} },
          { id: 'n4', label: 'n4', type: 'Anchor', x: 0, y: 0, properties: {} },
        ],
        edges: [],
        metadata: { kind: 'test', source: 'flowEditorPinnedQuickEditorsSeed' },
      },
      graphDataRevision: (s.graphDataRevision || 0) + 1,
      canvasRenderMode: '2d',
      canvas2dRenderer: 'flow',
      frontmatterModeEnabled: false,
      documentSemanticMode: 'document',
      documentStructureBaselineLock: false,
    }))

    api.setZoomState({ k: 1, x: 0, y: 0 })
    api.setOpenQuickEditorNodeIds(['n1', 'n2', 'n3', 'n4'])
    api.setFlowNodeQuickEditorWorldPosByNodeId({})
    api.setFlowNodeQuickEditorPinnedByNodeId({})

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    root.render(React.createElement(FlowEditorCanvas, { active: true } as never))

    const ids = ['n1', 'n2', 'n3', 'n4']
    const waitForSeed = async () => {
      const deadline = Date.now() + 800
      while (Date.now() < deadline) {
        const st = useGraphStore.getState()
        const worldById =
          (st as unknown as { flowNodeQuickEditorWorldPosByNodeId?: Record<string, { x: number; y: number }> })
            .flowNodeQuickEditorWorldPosByNodeId || {}
        const ok = ids.every(id => {
          const w = worldById[id]
          return w && Number.isFinite(w.x) && Number.isFinite(w.y)
        })
        if (ok) return worldById
        await new Promise<void>(resolve => setTimeout(() => resolve(), 5))
      }
      throw new Error('expected seeded world positions')
    }
    const worldById = await waitForSeed()

    const z = { k: 1, x: 0, y: 0 }
    const viewportW = 800
    const viewportH = 600
    const center = viewportCenterToWorld({ transform: z, viewportW, viewportH })
    const panelScale = computeNodeQuickEditorScale(z.k, null, { mode: 'pinnedInCanvas' })
    const panelScreen = computeNodeQuickEditorScaledSize(panelScale)
    const panelWorldW = panelScreen.width / z.k
    const panelWorldH = panelScreen.height / z.k

    const centers = ids.map(id => {
      const p = worldById[id]!
      return { x: p.x + panelWorldW / 2, y: p.y + panelWorldH / 2 }
    })
    const centroid = centers.reduce((acc, c) => ({ x: acc.x + c.x, y: acc.y + c.y }), { x: 0, y: 0 })
    centroid.x /= centers.length
    centroid.y /= centers.length

    if (Math.abs(centroid.x - center.x) > 2 || Math.abs(centroid.y - center.y) > 2) {
      throw new Error(`expected centroid ~${center.x},${center.y} got ${centroid.x},${centroid.y}`)
    }

    const rects = ids.map(id => {
      const p = worldById[id]!
      const left = p.x * z.k + z.x
      const top = p.y * z.k + z.y
      return { id, left, top, right: left + panelScreen.width, bottom: top + panelScreen.height }
    })
    for (let i = 0; i < rects.length; i += 1) {
      const a = rects[i]!
      for (let j = i + 1; j < rects.length; j += 1) {
        const b = rects[j]!
        const overlapX = a.left < b.right && b.left < a.right
        const overlapY = a.top < b.bottom && b.top < a.bottom
        if (overlapX && overlapY) throw new Error(`expected no overlap: ${a.id} vs ${b.id}`)
      }
    }
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}
