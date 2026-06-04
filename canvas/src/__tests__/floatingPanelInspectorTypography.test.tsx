import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { GraphTableInspector, type GraphTableInspectorRow } from '@/features/graph-table/ui/GraphTableInspector'
import FlowEditorInspector from '@/components/FlowEditor/FlowEditorInspector'
import type { GraphColumnDoc } from '@/features/graph-table-db/graphTableDb'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { useGraphStore } from '@/hooks/useGraphStore'

export async function testInspectorTypographyUsesUiSettings() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const api = useGraphStore.getState()
    api.resetAll()
    api.setUiPanelTextFontClass('font-serif')
    api.setUiPanelKeyValueTextSizeClass('text-[15px]')
    api.setUiPanelMicroLabelTextSizeClass('text-[10px]')
    api.setUiPanelMonospaceTextClass('font-mono text-[13px]')

    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    const columns: GraphColumnDoc[] = [
      {
        pk: 'nodes:label',
        tableId: 'nodes',
        columnId: 'label',
        name: 'Label',
        kind: 'text',
        order: 1,
        hidden: false,
        createdAtMs: 0,
        updatedAtMs: 0,
      },
    ]

    const row: GraphTableInspectorRow = {
      tableId: 'nodes',
      rowId: 'n1',
      order: 0,
      data: { id: 'n1', label: 'Hello' },
    }

    await act(async () => {
      root.render(
        React.createElement(
          'div',
          {},
          React.createElement(GraphTableInspector, {
            columns,
            row,
            onClose: () => void 0,
            onDeleteRow: () => void 0,
            onChangeCell: () => void 0,
          }),
          React.createElement(FlowEditorInspector, {
            active: true,
            tab: 'node',
            setTab: () => void 0,
            selectedNode: { id: 'n1', label: 'Node', type: 'Node', properties: {} },
            selectedEdge: null,
            workflowNodes: [],
            workflowSelectedNodeId: null,
            onWorkflowSelectNode: () => void 0,
            onWorkflowRunNode: () => void 0,
            jsonError: null,
            nodePropsJson: '{"a":1}',
            setNodePropsJson: () => void 0,
            nodeMetaJson: '{"b":2}',
            setNodeMetaJson: () => void 0,
            edgePropsJson: '{}',
            setEdgePropsJson: () => void 0,
            edgeMetaJson: '{}',
            setEdgeMetaJson: () => void 0,
            workflowMetaJson: '{}',
            setWorkflowMetaJson: () => void 0,
            workflowContextJson: '{}',
            setWorkflowContextJson: () => void 0,
            onSetNodeLabel: () => void 0,
            onSetNodeType: () => void 0,
            onSetEdgeLabel: () => void 0,
            onApplyJson: () => void 0,
          } as never),
        ) as never,
      )
      await Promise.resolve()
    })

    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (typeof raf === 'function') raf(() => resolve())
        else setTimeout(() => resolve(), 0)
      })

    await act(async () => {
      await tick()
    })

    const dt = container.querySelector('dt')
    if (!dt) throw new Error('expected inspector to render a dt element')
    const dtClass = String(dt.getAttribute('class') || '')
    if (!dtClass.includes('text-[15px]')) {
      throw new Error(`expected dt to use key/value size class, got ${JSON.stringify(dtClass)}`)
    }

    const textarea = container.querySelector('textarea')
    if (!textarea) throw new Error('expected Flow Editor inspector to render a textarea')
    const taClass = String(textarea.getAttribute('class') || '')
    if (!taClass.includes('text-[13px]')) {
      throw new Error(`expected textarea to use monospace size class, got ${JSON.stringify(taClass)}`)
    }
  } finally {
    try {
      await act(async () => {
        root?.unmount()
      })
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}
