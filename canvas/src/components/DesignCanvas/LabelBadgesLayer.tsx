import React from 'react'

type RenderNodeRef = {
  id: string
}

type FrameRect = {
  x: number
  y: number
  w: number
  h: number
}

type Chip = {
  boxX: number
  boxY: number
  boxW: number
  boxH: number
  textX: number
  textY: number
  textAnchor: 'start' | 'middle' | 'end'
  text: string
  fontSize: number
  fontWeight?: number
  fill: string
  bgFill: string
  bgOpacity: number
  stroke: string
  strokeOpacity: number
}

type LabelLayout = {
  label?: Chip
  meta?: Chip
}

export function DesignCanvasLabelBadgesLayer(props: {
  enabled: boolean
  renderNodes: RenderNodeRef[]
  positions: Record<string, FrameRect>
  panelOnlyNodeIdSet: Set<string> | null
  labelLayoutById: Map<string, LabelLayout>
}) {
  const { enabled, renderNodes, positions, panelOnlyNodeIdSet, labelLayoutById } = props
  if (!enabled) return null
  return (
    <g style={{ pointerEvents: 'none' }}>
      {renderNodes.map(node => {
        if (panelOnlyNodeIdSet?.has(node.id)) return null
        const position = positions[node.id]
        if (!position) return null
        const layout = labelLayoutById.get(node.id) || null
        if (!layout) return null
        return (
          <g key={`lbl:${node.id}`} transform={`translate(${position.x},${position.y})`}>
            {layout.label ? (
              <g>
                <rect
                  x={layout.label.boxX}
                  y={layout.label.boxY}
                  width={layout.label.boxW}
                  height={layout.label.boxH}
                  rx={4}
                  fill={layout.label.bgFill}
                  opacity={layout.label.bgOpacity}
                  stroke={layout.label.stroke}
                  strokeOpacity={layout.label.strokeOpacity}
                  strokeWidth={1}
                />
                <text
                  x={layout.label.textX}
                  y={layout.label.textY}
                  textAnchor={layout.label.textAnchor}
                  fill={layout.label.fill}
                  fontSize={layout.label.fontSize}
                  fontWeight={layout.label.fontWeight}
                >
                  {layout.label.text}
                </text>
              </g>
            ) : null}
            {layout.meta ? (
              <g>
                <rect
                  x={layout.meta.boxX}
                  y={layout.meta.boxY}
                  width={layout.meta.boxW}
                  height={layout.meta.boxH}
                  rx={4}
                  fill={layout.meta.bgFill}
                  opacity={layout.meta.bgOpacity}
                  stroke={layout.meta.stroke}
                  strokeOpacity={layout.meta.strokeOpacity}
                  strokeWidth={1}
                />
                <text
                  x={layout.meta.textX}
                  y={layout.meta.textY}
                  textAnchor={layout.meta.textAnchor}
                  fill={layout.meta.fill}
                  fontSize={layout.meta.fontSize}
                >
                  {layout.meta.text}
                </text>
              </g>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}
