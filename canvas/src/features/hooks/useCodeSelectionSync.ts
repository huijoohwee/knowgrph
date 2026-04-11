import { useEffect, useRef } from 'react'
import { createTabSync, buildEnvelope } from '@/lib/tabSync'
import { STORAGE_CHANNELS } from '@/lib/config'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'

export function useCodeSelectionSync({
  enableTabSync,
  graphId,
  tabId,
  isGraphJsonView,
  codeRef,
}: {
  enableTabSync: boolean
  graphId: string
  tabId: string
  isGraphJsonView: boolean
  codeRef: React.RefObject<MonacoTextEditorHandle | null>
}) {
  const syncRef = useRef<ReturnType<typeof createTabSync> | null>(null)
  useEffect(() => {
    if (!enableTabSync) return
    syncRef.current = createTabSync(STORAGE_CHANNELS.tabSync)
    return () => { const s = syncRef.current; syncRef.current = null; if (s) s.destroy() }
  }, [enableTabSync])
  useEffect(() => {
    if (!enableTabSync || !syncRef.current) return
    const sync = syncRef.current
    const unsub = sync.subscribe((msg) => {
      if (msg.graphId !== graphId || msg.sourceTabId === tabId) return
      if (msg.kind === 'CodeCaretChanged' && codeRef.current && isGraphJsonView) {
        const p = msg.payload as Record<string, unknown>
        const pos = typeof p.pos === 'number' ? p.pos : 0
        const end = typeof p.end === 'number' ? p.end : pos
        try {
          codeRef.current.focus()
          codeRef.current.setSelectionOffsets(pos, end)
        } catch { void 0 }
      }
    })
    return () => { unsub() }
  }, [enableTabSync, graphId, tabId, isGraphJsonView, codeRef])
  const publishCaret = (pos: number, end: number) => {
    if (!enableTabSync || !syncRef.current) return
    const sig = `${pos}:${end}`
    syncRef.current.publish(buildEnvelope('CodeCaretChanged', graphId, tabId, { pos, end }, { sig }))
  }
  return { publishCaret }
}
