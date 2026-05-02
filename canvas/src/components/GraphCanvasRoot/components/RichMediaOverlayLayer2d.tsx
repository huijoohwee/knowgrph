import type { RefObject, SyntheticEvent } from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { Z_INDEX_GRAPH_MEDIA_LAYER } from '@/lib/ui/zIndex'
import RichMediaPanel from '@/components/RichMediaPanel'
import type { MediaOverlayNode } from '@/lib/render/mediaOverlayPool'
import type { GraphNode } from '@/lib/graph/types'
import { commitRichMediaPanelChange, resolveRichMediaPanelInteractive } from '@/lib/render/richMediaSsot'

export function RichMediaOverlayLayer2d(props: {
  active: boolean
  mediaOverlayNodes: MediaOverlayNode[]
  getOverlayRefForId: (id: string) => (el: HTMLDivElement | null) => void
  svgRef: RefObject<SVGSVGElement | null>
  renderMediaAsNodes: boolean
  stopEvent: (event: SyntheticEvent) => void
  onOverlayPanStart: (args: { pointerId: number; clientX: number; clientY: number }) => void
  onOverlayPan: (args: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number }) => void
  onOverlayPanEnd: (args: { pointerId: number }) => void
  onHeaderDragStart: (args: { id: string; clientX: number; clientY: number }) => void
  onHeaderDrag: (args: { dx: number; dy: number }) => void
  onHeaderDragEnd: () => void
}) {
  const {
    active,
    mediaOverlayNodes,
    getOverlayRefForId,
    svgRef,
    renderMediaAsNodes,
    stopEvent,
    onOverlayPanStart,
    onOverlayPan,
    onOverlayPanEnd,
    onHeaderDragStart,
    onHeaderDrag,
    onHeaderDragEnd,
  } = props

  const infiniteCanvasInteractionMode = useGraphStore(s => s.infiniteCanvasInteractionMode)
  const allowEmbeddedMediaInteraction = infiniteCanvasInteractionMode === 'interactive'

  if (!active) return null
  if (mediaOverlayNodes.length === 0) return null

  const updateNode = useGraphStore(s => s.updateNode)

  return (
    <section
      aria-label="D3 rich media overlay"
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: Z_INDEX_GRAPH_MEDIA_LAYER }}
    >
      {mediaOverlayNodes.map(n => {
        const kind = n.kind === 'iframe' || n.kind === 'image' || n.kind === 'svg' || n.kind === 'video' ? n.kind : undefined
        return (
          <RichMediaPanel
            key={n.id}
            ref={getOverlayRefForId(n.id)}
            overlayId={n.id}
            className="absolute left-0 top-0 pointer-events-auto"
            title={n.title}
            url={n.url}
            srcDoc={n.srcDoc}
            openUrl={n.openUrl}
            kind={kind}
            interactive={resolveRichMediaPanelInteractive({
              nodeInteractive: n.interactive,
              renderMediaAsNodes,
              infiniteCanvasInteractionMode,
            })}
            panel={n.panel}
            onPanelChange={next => {
              if (!n.panel) return
              commitRichMediaPanelChange({
                nodeId: n.id,
                next,
                updateNode: (id, patch) => updateNode(id, patch as Partial<import('@/lib/graph/types').GraphNode>),
              })
            }}
            forwardWheelTo={allowEmbeddedMediaInteraction ? undefined : (() => svgRef.current)}
            shouldStartHeaderDrag={() => {
              if (useGraphStore.getState().canvasPointerMode2d === 'pan') return false
              if (isSpacePanHeld()) return false
              return true
            }}
            onOverlayPanStart={({ pointerId, clientX, clientY, buttons }) => {
              if ((buttons & 1) !== 1 && (buttons & 4) !== 4) return
              onOverlayPanStart({ pointerId, clientX, clientY })
            }}
            onOverlayPan={({ pointerId, clientX, clientY, dx, dy }) => onOverlayPan({ pointerId, clientX, clientY, dx, dy })}
            onOverlayPanEnd={({ pointerId }) => onOverlayPanEnd({ pointerId })}
            onHeaderDragStart={({ clientX, clientY }) => onHeaderDragStart({ id: n.id, clientX, clientY })}
            onHeaderDrag={({ dx, dy }) => onHeaderDrag({ dx, dy })}
            onHeaderDragEnd={() => onHeaderDragEnd()}
            onWheelCapture={stopEvent}
            onClickCapture={stopEvent}
            onDoubleClickCapture={stopEvent}
            onContextMenuCapture={stopEvent}
          />
        )
      })}
    </section>
  )
}
