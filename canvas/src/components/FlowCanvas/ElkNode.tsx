import React from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import type { FlowNodeHandles } from './handles'
import type { FlowConfig } from './config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type ElkNodeData = {
  label: string
  handles: FlowNodeHandles
  config: Pick<FlowConfig, 'node' | 'handle'>
}

export function ElkNode(props: NodeProps<ElkNodeData>) {
  const data = props.data
  const label = String(data?.label || '')
  const handles = data?.handles
  const cfg = data?.config
  const widthPx = typeof cfg?.node?.widthPx === 'number' ? cfg.node.widthPx : 180
  const heightPx = typeof cfg?.node?.heightPx === 'number' ? cfg.node.heightPx : 48
  const paddingX = typeof cfg?.node?.paddingX === 'number' ? cfg.node.paddingX : 12
  const paddingY = typeof cfg?.node?.paddingY === 'number' ? cfg.node.paddingY : 8
  const handleSize = typeof cfg?.handle?.sizePx === 'number' ? cfg.handle.sizePx : 10
  const lineHeightPx = typeof cfg?.handle?.lineHeightPx === 'number' ? cfg.handle.lineHeightPx : 16

  const inHandles = Array.isArray(handles?.in) ? handles!.in : []
  const outHandles = Array.isArray(handles?.out) ? handles!.out : []

  return (
    <section
      className={[
        'rounded-md border shadow-sm',
        UI_THEME_TOKENS.panel.bg,
        UI_THEME_TOKENS.panel.border,
        UI_THEME_TOKENS.text.primary,
        'flex items-center justify-center text-sm select-none',
      ].join(' ')}
      style={{ width: `${widthPx}px`, height: `${heightPx}px` }}
    >
      {inHandles.map(h => (
        <Handle
          key={h.id}
          id={h.id}
          type="target"
          position={Position.Left}
          style={{
            top: `${h.topPct}%`,
            width: `${handleSize}px`,
            height: `${handleSize}px`,
            background: 'var(--kg-canvas-accent)',
            border: '1px solid var(--kg-border)',
          }}
        />
      ))}
      {outHandles.map(h => (
        <Handle
          key={h.id}
          id={h.id}
          type="source"
          position={Position.Right}
          style={{
            top: `${h.topPct}%`,
            width: `${handleSize}px`,
            height: `${handleSize}px`,
            background: 'var(--kg-canvas-accent)',
            border: '1px solid var(--kg-border)',
          }}
        />
      ))}
      <span
        className="truncate max-w-full"
        style={{
          paddingLeft: `${Math.max(0, paddingX)}px`,
          paddingRight: `${Math.max(0, paddingX)}px`,
          paddingTop: `${Math.max(0, paddingY)}px`,
          paddingBottom: `${Math.max(0, paddingY)}px`,
          lineHeight: `${Math.max(8, lineHeightPx)}px`,
        }}
      >
        {label}
      </span>
    </section>
  )
}
