import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testSelectionDispatchesTocFocusInSplitViews() {
  const g: any = globalThis as any
  const prevCustomEvent = g.CustomEvent
  const events: any[] = []
  const bootstrap = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    g.CustomEvent = class CustomEvent {
      type: string
      detail: any
      constructor(type: string, init?: any) {
        this.type = type
        this.detail = init?.detail
      }
    }
    const w = bootstrap.dom.window as unknown as Window
    const prevDispatch = w.dispatchEvent.bind(w)
    w.dispatchEvent = (ev: any) => {
      events.push(ev)
      return prevDispatch(ev)
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
    g.CustomEvent = prevCustomEvent
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    bootstrap.restore()
  }
}
