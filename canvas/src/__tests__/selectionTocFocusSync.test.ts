import { useGraphStore } from '@/hooks/useGraphStore'

export function testSelectionDispatchesTocFocusInSplitViews() {
  const g: any = globalThis as any
  const prevWindow = g.window
  const prevCustomEvent = g.CustomEvent
  const events: any[] = []
  try {
    g.CustomEvent = class CustomEvent {
      type: string
      detail: any
      constructor(type: string, init?: any) {
        this.type = type
        this.detail = init?.detail
      }
    }
    g.window = {
      dispatchEvent: (ev: any) => {
        events.push(ev)
        return true
      },
    }

    const store = useGraphStore.getState()
    store.setWorkspaceViewMode('editor')
    store.setGraphData({
      type: 'Graph',
      context: 'test',
      nodes: [{ id: 'n1', type: 'Node', label: 'Hello', properties: { anchorId: 'h-hello' } }],
      edges: [],
    } as never)
    store.setSelectionSource('canvas')
    store.selectNode('n1')

    const ev = events.find(e => e && e.type === 'kg:tocFocus') || null
    if (!ev) throw new Error('expected tocFocus event to be dispatched on node selection')
    if (!ev.detail || ev.detail.id !== 'h-hello') {
      throw new Error(`expected tocFocus id to be h-hello, got ${String(ev?.detail?.id)}`)
    }
  } finally {
    g.window = prevWindow
    g.CustomEvent = prevCustomEvent
  }
}
