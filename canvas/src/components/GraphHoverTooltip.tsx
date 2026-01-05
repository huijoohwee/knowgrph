import React from 'react'
import type { GraphNode, GraphEdge, JSONValue } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { summarizePropertySpec, getNodePropSpec, getEdgePropSpec, buildEdgeSchemaBadges } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getBadgeChipClass, getIconSizeClass } from '@/lib/ui'
import type { GraphFieldKind } from '@/features/graph-fields/graphFields'
import { FieldTypeBadgeIcon } from '@/features/graph-fields/ui/graphFieldIcons'
import Tooltip from '@/features/panels/ui/Tooltip'

export type HoverKind = 'node' | 'edge'

export type HoverInfo = {
  kind: HoverKind;
  id: string;
  clientX: number;
  clientY: number;
}

const NODE_PROP_PRIORITY = [
  'name',
  'title',
  'description',
  'summary',
  'category',
  'role',
  'visual:importance',
  'visual:nodeSize',
  'visual:layer',
]
const EDGE_PROP_PRIORITY = ['weight', 'score', 'confidence', 'count']

function formatPropValue(v: unknown): string {
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return JSON.stringify(v.slice(0, 3))
  return JSON.stringify(v)
}

function sortProps(props: Record<string, JSONValue>, kind: HoverKind): [string, JSONValue][] {
  const entries = Object.entries(props || {})
  const priority = kind === 'node' ? NODE_PROP_PRIORITY : EDGE_PROP_PRIORITY
  const rank = (key: string) => {
    const idx = priority.indexOf(key)
    return idx === -1 ? priority.length : idx
  }
  return entries
    .slice()
    .sort(([a], [b]) => {
      const ra = rank(a)
      const rb = rank(b)
      if (ra !== rb) return ra - rb
      return a.localeCompare(b)
    })
}

function buildNodeContent(
  node: GraphNode,
  schema: GraphSchema | null | undefined,
  iconClassName: string,
  uiIconBadgeChipClass: string,
  uiIconBadgeChipTextSizeClass: string,
  uiPanelMicroLabelTextSizeClass: string,
): React.ReactNode {
  const sorted = sortProps(node.properties || {}, 'node')
  return (
    <div>
      <div className="font-semibold">
        {node.label}{' '}
        <span className="text-gray-300">
          ({node.type})
        </span>
      </div>
      <div className="text-xs text-gray-300 break-all">
        {node.id}
      </div>
      {sorted.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {sorted.slice(0, 4).map(([k, v]) => {
            const spec = getNodePropSpec(schema, node.type, k)
            const description = spec && typeof spec.description === 'string' ? spec.description.trim() : ''
            const badges = summarizePropertySpec(spec)
            return (
              <div key={k} className="space-y-0.5">
                <div className="flex gap-1 items-center">
                  {spec ? (
                    <FieldTypeBadgeIcon
                      kind={spec.type as GraphFieldKind}
                      className={iconClassName}
                    />
                  ) : null}
                  <span className="text-xs text-gray-300 truncate max-w-[80px]">
                    {k}:
                  </span>
                  <span className="text-xs text-gray-100 break-all">
                    {formatPropValue(v)}
                  </span>
                </div>
                {description && (
                  <div className={`${uiPanelMicroLabelTextSizeClass} text-gray-400 leading-tight break-normal`}>
                    {description}
                  </div>
                )}
                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {badges.map(badge => (
                      <span
                        key={badge}
                        className={getBadgeChipClass('default', {
                          baseClass: uiIconBadgeChipClass,
                          textSizeClass: uiIconBadgeChipTextSizeClass,
                        })}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function buildEdgeContent(
  edge: GraphEdge,
  schema: GraphSchema | null | undefined,
  iconClassName: string,
  uiIconBadgeChipClass: string,
  uiIconBadgeChipTextSizeClass: string,
  uiPanelMicroLabelTextSizeClass: string,
): React.ReactNode {
  const sorted = sortProps(edge.properties || {}, 'edge')
  const schemaBadges = buildEdgeSchemaBadges(
    schema,
    edge.label,
    edge.properties as Record<string, unknown> | null | undefined,
  )
  return (
    <div>
      <div className="font-semibold">
        {edge.label}
      </div>
      <div className="text-xs text-gray-300 break-all">
        {String(edge.source)} → {String(edge.target)}
      </div>
      {schemaBadges.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {schemaBadges.map(badge => (
            <span
              key={badge.badge}
              className={getBadgeChipClass('default', {
                baseClass: uiIconBadgeChipClass,
                textSizeClass: uiIconBadgeChipTextSizeClass,
              })}
            >
              {badge.label}
            </span>
          ))}
        </div>
      )}
      <div className="text-xs text-gray-400 break-all">
        {edge.id}
      </div>
          {sorted.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {sorted.slice(0, 4).map(([k, v]) => {
            const spec = getEdgePropSpec(schema, edge.label, k)
            const description = spec && typeof spec.description === 'string' ? spec.description.trim() : ''
            const badges = summarizePropertySpec(spec)
            return (
              <div key={k} className="space-y-0.5">
                <div className="flex gap-1 items-center">
                  {spec ? (
                    <FieldTypeBadgeIcon
                      kind={spec.type as GraphFieldKind}
                      className={iconClassName}
                    />
                  ) : null}
                  <span className="text-xs text-gray-300 truncate max-w-[80px]">
                    {k}:
                  </span>
                  <span className="text-xs text-gray-100 break-all">
                    {formatPropValue(v)}
                  </span>
                </div>
                {description && (
                  <div className={`${uiPanelMicroLabelTextSizeClass} text-gray-400 leading-tight break-normal`}>
                    {description}
                  </div>
                )}
                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {badges.map(badge => (
                      <span
                        key={badge}
                        className={getBadgeChipClass('default', {
                          baseClass: uiIconBadgeChipClass,
                          textSizeClass: uiIconBadgeChipTextSizeClass,
                        })}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export type GraphHoverTooltipProps = {
  hoverInfo: HoverInfo | null;
  containerRef: React.RefObject<HTMLElement | null>;
  nodes: GraphNode[] | null | undefined;
  edges: GraphEdge[] | null | undefined;
  schema: GraphSchema | null | undefined;
}

export function GraphHoverTooltip({ hoverInfo, containerRef, nodes, edges, schema }: GraphHoverTooltipProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconBadgeChipClass = useGraphStore(s => s.uiIconBadgeChipClass)
  const uiIconBadgeChipTextSizeClass = useGraphStore(s => s.uiIconBadgeChipTextSizeClass)
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || s.uiIconBadgeChipTextSizeClass || 'text-[9px]',
  )
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const container = containerRef.current
  const nodeMap = React.useMemo(() => {
    if (!nodes || !Array.isArray(nodes)) return null
    const m = new Map<string, GraphNode>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      m.set(String(n.id), n)
    }
    return m
  }, [nodes])
  const edgeMap = React.useMemo(() => {
    if (!edges || !Array.isArray(edges)) return null
    const m = new Map<string, GraphEdge>()
    for (let i = 0; i < edges.length; i += 1) {
      const e = edges[i]
      m.set(String(e.id), e)
    }
    return m
  }, [edges])
  const hoverKind = hoverInfo?.kind
  const hoverId = hoverInfo?.id
  const node = React.useMemo(() => {
    if (hoverKind !== 'node' || !hoverId || !nodeMap) return null
    return nodeMap.get(String(hoverId)) || null
  }, [hoverKind, hoverId, nodeMap])
  const edge = React.useMemo(() => {
    if (hoverKind !== 'edge' || !hoverId || !edgeMap) return null
    return edgeMap.get(String(hoverId)) || null
  }, [hoverKind, hoverId, edgeMap])
  const content = React.useMemo(() => {
    if (node) {
      return buildNodeContent(
        node,
        schema,
        iconSizeClass,
        uiIconBadgeChipClass,
        uiIconBadgeChipTextSizeClass,
        uiPanelMicroLabelTextSizeClass,
      )
    }
    if (edge) {
      return buildEdgeContent(
        edge,
        schema,
        iconSizeClass,
        uiIconBadgeChipClass,
        uiIconBadgeChipTextSizeClass,
        uiPanelMicroLabelTextSizeClass,
      )
    }
    return null
  }, [
    edge,
    iconSizeClass,
    node,
    schema,
    uiIconBadgeChipClass,
    uiIconBadgeChipTextSizeClass,
    uiPanelMicroLabelTextSizeClass,
  ])
  if (!hoverInfo || !container || !content) return null
  const rect = container.getBoundingClientRect()
  const hoverX = hoverInfo.clientX - rect.left + 8
  const hoverY = hoverInfo.clientY - rect.top + 8
  return (
    <Tooltip
      content={content}
      open
      className="absolute z-50 pointer-events-none"
      anchorStyle={{ left: hoverX, top: hoverY, width: 0, height: 0 }}
      maxWidthPx={260}
      contentClassName="shadow-md max-w-xs text-xs"
    >
      <span />
    </Tooltip>
  )
}
