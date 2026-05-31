import React from 'react'
import RichMediaPanel from '@/components/RichMediaPanel'
import type { MediaOverlayNode } from '@/lib/render/mediaOverlayPool'
import { commitRichMediaPanelChange, resolveRichMediaPanelInteractive } from '@/lib/render/richMediaSsot'
import { useGraphStore } from '@/hooks/useGraphStore'

export function DesignCanvasMediaOverlay(props: {
  active: boolean
  designMediaOverlayNodes: MediaOverlayNode[]
  renderMediaAsNodes: boolean
  onRegisterOverlayEl: (id: string, el: HTMLElement | null) => void
  forwardWheelTo: () => SVGSVGElement | null
  shouldStartHeaderDrag: () => boolean
  onOverlayPanStart: (args: { pointerId: number; buttons: number }) => void
  onOverlayPan: (args: { pointerId: number; dx: number; dy: number }) => void
  onOverlayPanEnd: (args: { pointerId: number }) => void
  onHeaderDragStart: (args: { nodeId: string; pointerId: number }) => void
  onHeaderDrag: (args: { nodeId: string; dx: number; dy: number; pointerId: number }) => void
  onHeaderDragEnd: (args: { nodeId: string; pointerId: number }) => void
}) {
  const {
    active,
    designMediaOverlayNodes,
    renderMediaAsNodes,
    onRegisterOverlayEl,
    forwardWheelTo,
    shouldStartHeaderDrag,
    onOverlayPanStart,
    onOverlayPan,
    onOverlayPanEnd,
    onHeaderDragStart,
    onHeaderDrag,
    onHeaderDragEnd,
  } = props
  const updateNode = useGraphStore(s => s.updateNode)
  const infiniteCanvasInteractionMode = useGraphStore(s => s.infiniteCanvasInteractionMode || 'static')
  if (!active || designMediaOverlayNodes.length === 0) return null
  return (
    <section aria-label="Design media overlay" className="absolute inset-0 z-[80] pointer-events-none">
      {designMediaOverlayNodes.map(node => (
        <RichMediaPanel
          key={node.id}
          ref={el => onRegisterOverlayEl(node.id, el)}
          className="absolute left-0 top-0 pointer-events-auto"
          title={node.title}
          url={node.url}
          srcDoc={node.srcDoc}
          openUrl={node.openUrl}
          kind={node.kind}
          panelChrome="flowEditor"
          interactive={resolveRichMediaPanelInteractive({
            nodeInteractive: node.interactive,
            renderMediaAsNodes,
            infiniteCanvasInteractionMode,
            canvas2dRenderer: 'design',
          })}
          hideUntilReady={true}
          panel={node.panel}
          onPanelChange={next => {
            if (!node.panel) return
            commitRichMediaPanelChange({
              nodeId: node.id,
              next,
              updateNode: (id, patch) => updateNode(id, patch as Partial<import('@/lib/graph/types').GraphNode>),
            })
          }}
          forwardWheelTo={forwardWheelTo}
          shouldStartHeaderDrag={shouldStartHeaderDrag}
          onOverlayPanStart={onOverlayPanStart}
          onOverlayPan={onOverlayPan}
          onOverlayPanEnd={onOverlayPanEnd}
          onHeaderDragStart={({ pointerId }) => onHeaderDragStart({ nodeId: node.id, pointerId })}
          onHeaderDrag={({ dx, dy, pointerId }) => onHeaderDrag({ nodeId: node.id, dx, dy, pointerId })}
          onHeaderDragEnd={({ pointerId }) => onHeaderDragEnd({ nodeId: node.id, pointerId })}
          style={{
            transform: 'translate(-99999px, -99999px)',
            width: 1,
            height: 1,
          }}
        />
      ))}
    </section>
  )
}
