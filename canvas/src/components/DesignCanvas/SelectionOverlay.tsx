import React from 'react'
import type { DesignCanvasFrameRect, DesignCanvasMarqueeBox, DesignCanvasResizeHandle } from '@/components/DesignCanvas/types'

const RESIZE_HANDLES: Array<{ k: DesignCanvasResizeHandle; x: (w: number) => number; y: (h: number) => number; cursor: string }> = [
  { k: 'nw', x: () => 0, y: () => 0, cursor: 'nwse-resize' },
  { k: 'n', x: w => w / 2, y: () => 0, cursor: 'ns-resize' },
  { k: 'ne', x: w => w, y: () => 0, cursor: 'nesw-resize' },
  { k: 'e', x: w => w, y: h => h / 2, cursor: 'ew-resize' },
  { k: 'se', x: w => w, y: h => h, cursor: 'nwse-resize' },
  { k: 's', x: w => w / 2, y: h => h, cursor: 'ns-resize' },
  { k: 'sw', x: () => 0, y: h => h, cursor: 'nesw-resize' },
  { k: 'w', x: () => 0, y: h => h / 2, cursor: 'ew-resize' },
]

export function DesignCanvasSelectionOverlay(props: {
  active: boolean
  selectedNodeId: string | null
  positions: Record<string, DesignCanvasFrameRect>
  marqueeBox: DesignCanvasMarqueeBox | null
  resizeOverlayRef: React.MutableRefObject<SVGGElement | null>
  onBeginResize: (event: React.PointerEvent<SVGRectElement>, args: { id: string; handle: DesignCanvasResizeHandle; rect: DesignCanvasFrameRect }) => void
}) {
  const { active, selectedNodeId, positions, marqueeBox, resizeOverlayRef, onBeginResize } = props
  const id = active ? String(selectedNodeId || '').trim() : ''
  const position = id ? positions[id] : null
  const handleSize = 9
  const handleOffset = handleSize / 2
  return (
    <>
      {position ? (
        <g
          ref={el => {
            resizeOverlayRef.current = el
          }}
          data-kg-layer="wireframe-resize"
          transform={`translate(${position.x},${position.y})`}
        >
          <rect
            data-kg-resize-outline="1"
            x={-1}
            y={-1}
            width={position.w + 2}
            height={position.h + 2}
            fill="rgba(0,0,0,0)"
            stroke="var(--kg-canvas-accent)"
            strokeWidth={1}
            opacity={0.45}
            style={{ pointerEvents: 'none' }}
          />
          {RESIZE_HANDLES.map(handle => (
            <rect
              key={`${id}:${handle.k}`}
              data-kg-resize-handle={handle.k}
              x={handle.x(position.w) - handleOffset}
              y={handle.y(position.h) - handleOffset}
              width={handleSize}
              height={handleSize}
              rx={2}
              fill="var(--kg-canvas-accent)"
              stroke="var(--kg-panel-bg)"
              strokeWidth={1}
              style={{ cursor: handle.cursor }}
              onPointerDown={event => onBeginResize(event, { id, handle: handle.k, rect: position })}
            />
          ))}
        </g>
      ) : null}
      {marqueeBox ? (
        <rect
          x={marqueeBox.x}
          y={marqueeBox.y}
          width={Math.max(0, marqueeBox.w)}
          height={Math.max(0, marqueeBox.h)}
          fill="var(--kg-canvas-accent)"
          opacity="0.08"
          stroke="var(--kg-canvas-accent)"
          strokeWidth={1}
          strokeDasharray="4 3"
          style={{ pointerEvents: 'none' }}
        />
      ) : null}
    </>
  )
}
