import { useEffect, type RefObject } from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { emitPropsPanelOpen } from '@/features/canvas/utils'

export function useCanvasContextMenu(args: { svgRef: RefObject<SVGSVGElement | null> }): void {
  const { svgRef } = args

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onContextMenu = (ev: MouseEvent) => {
      if (ev.defaultPrevented) return
      ev.preventDefault()
      const state = useGraphStore.getState()
      state.setSelectionSource('menu')
      state.selectNode(null)
      state.selectEdge(null)
      emitPropsPanelOpen({ clientX: ev.clientX, clientY: ev.clientY })
    }
    el.addEventListener('contextmenu', onContextMenu)
    return () => {
      el.removeEventListener('contextmenu', onContextMenu)
    }
  }, [svgRef])
}

