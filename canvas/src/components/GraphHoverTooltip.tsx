import React from 'react'
import type { GraphNode, GraphEdge, JSONValue } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { summarizePropertySpec, getNodePropSpec, getEdgePropSpec, buildEdgeSchemaBadges } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getBadgeChipClass, getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { GraphFieldKind } from '@/features/graph-fields/graphFields'
import { FieldTypeBadgeIcon } from '@/features/graph-fields/ui/graphFieldIcons'
import Tooltip from '@/features/panels/ui/Tooltip'
import type { GraphHoverPreviewConfig } from '@/hooks/store/types'
import { truncateTextWithEllipsis } from '@/components/GraphCanvas/layout/utils'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

export type HoverKind = 'node' | 'edge' | 'group'


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
  config: GraphHoverPreviewConfig,
  expanded: boolean,
  onToggleExpanded: (() => void) | null,
): React.ReactNode {
  const sorted = sortProps(node.properties || {}, 'node')
  const contentCfg = schema?.behavior?.hover?.content;
  const showProps = contentCfg?.showProps !== false && config.showNodeProperties;
  const showType = contentCfg?.showType !== false && config.showNodeLabel;
  const showId = contentCfg?.showId !== false && config.showNodeId;
  const desc = config.showNodeDescription && node.properties?.description ? String(node.properties.description) : ''
  const descText = expanded ? desc : truncateTextWithEllipsis(desc, 280)

  return (
    <div>
      <div className="font-semibold">
        {config.showNodeName && node.label}{' '}
        {showType && (
          <span className={UI_THEME_TOKENS.tooltip.textSecondary}>
            ({node.type})
          </span>
        )}
      </div>
      {showId && (
        <div className={`text-xs ${UI_THEME_TOKENS.tooltip.textSecondary} break-all`}>
          {node.id}
        </div>
      )}
      {desc ? (
        <button
          type="button"
          className={`mt-1 text-left ${UI_THEME_TOKENS.tooltip.text} break-words leading-tight w-full`}
          onClick={onToggleExpanded ?? undefined}
        >
          <div className={`${expanded ? 'max-h-[220px] overflow-auto pr-1' : ''} text-xs`}>
            {descText}
          </div>
        </button>
      ) : null}
      {showProps && sorted.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {sorted.slice(0, 4).map(([k, v]) => {
            if (k === 'description') return null; // Handled separately if desired, or duplicate? Let's hide if description is shown above
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
                  <span className={`text-xs ${UI_THEME_TOKENS.tooltip.textSecondary} truncate max-w-[80px]`}>
                    {k}:
                  </span>
                  <span className={`text-xs ${UI_THEME_TOKENS.tooltip.text} break-all`}>
                    {formatPropValue(v)}
                  </span>
                </div>
                {description && (
                  <div className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.tooltip.textTertiary} leading-tight break-normal`}>
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
  config: GraphHoverPreviewConfig,
  expanded: boolean,
  onToggleExpanded: (() => void) | null,
): React.ReactNode {
  const sorted = sortProps(edge.properties || {}, 'edge')
  const schemaBadges = buildEdgeSchemaBadges(
    schema,
    edge.label,
    edge.properties as Record<string, unknown> | null | undefined,
  )
  const contentCfg = schema?.behavior?.hover?.content;
  const showProps = contentCfg?.showProps !== false && config.showEdgeProperties;
  const showId = contentCfg?.showId !== false && config.showEdgeId;
  const descRaw = typeof (edge.properties as Record<string, unknown> | null | undefined)?.description === 'string'
    ? String((edge.properties as Record<string, unknown>).description || '')
    : ''
  const desc = showProps ? descRaw : ''
  const descText = expanded ? desc : truncateTextWithEllipsis(desc, 280)

  return (
    <div>
      <div className="font-semibold">
        {config.showEdgeLabel && (
          <span className="block whitespace-normal break-words">
            {edge.label}
          </span>
        )}
      </div>
      {config.showEdgeLabel && (
        <div className={`text-xs ${UI_THEME_TOKENS.tooltip.textSecondary} break-all`}>
          {String(edge.source)} → {String(edge.target)}
        </div>
      )}
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
      {showId && (
        <div className={`text-xs ${UI_THEME_TOKENS.tooltip.textSecondary} break-all`}>
          {edge.id}
        </div>
      )}
      {desc ? (
        <button
          type="button"
          className={`mt-1 text-left ${UI_THEME_TOKENS.tooltip.text} break-words leading-tight w-full`}
          onClick={onToggleExpanded ?? undefined}
        >
          <div className={`${expanded ? 'max-h-[220px] overflow-auto pr-1' : ''} text-xs`}>
            {descText}
          </div>
        </button>
      ) : null}
      {showProps && sorted.length > 0 && (
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
                  <span className={`text-xs ${UI_THEME_TOKENS.tooltip.textSecondary} truncate max-w-[80px]`}>
                    {k}:
                  </span>
                  <span className={`text-xs ${UI_THEME_TOKENS.tooltip.text} break-all`}>
                    {formatPropValue(v)}
                  </span>
                </div>
                {description && (
                  <div className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.tooltip.textTertiary} leading-tight break-normal`}>
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

function buildGroupContent(
  group: GraphGroup,
): React.ReactNode {
  const label = String(group.label || '').trim()
  const memberCount = Array.isArray(group.memberNodeIds) ? group.memberNodeIds.length : 0
  const id = String(group.id || '')
  return (
    <div>
      <div className="font-semibold break-words">{label || id}</div>
      <div className={`text-xs ${UI_THEME_TOKENS.tooltip.textSecondary} break-all`}>{id}</div>
      <div className={`mt-1 text-xs ${UI_THEME_TOKENS.tooltip.text}`}>
        <span className="font-medium">{memberCount}</span> nodes
      </div>
    </div>
  )
}

export type GraphHoverTooltipProps = {
  hoverInfo: HoverInfo | null;
  containerRef: React.RefObject<HTMLElement | null>;
  nodes: GraphNode[] | null | undefined;
  edges: GraphEdge[] | null | undefined;
  schema: GraphSchema | null | undefined;
  onRequestClose?: () => void;
}

export function GraphHoverTooltip({ hoverInfo, containerRef, nodes, edges, schema, onRequestClose }: GraphHoverTooltipProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconBadgeChipClass = useGraphStore(s => s.uiIconBadgeChipClass)
  const uiIconBadgeChipTextSizeClass = useGraphStore(s => s.uiIconBadgeChipTextSizeClass)
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || s.uiIconBadgeChipTextSizeClass || 'text-[9px]',
  )
  const graphHoverPreviewConfig = useGraphStore(s => s.graphHoverPreviewConfig)
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
  const groupMap = React.useMemo(() => {
    if (!nodes || !Array.isArray(nodes)) return null
    const graphData = { type: 'GraphData', nodes, edges: edges && Array.isArray(edges) ? edges : [] }
    const groups = deriveGraphGroups(graphData)
    if (!groups || groups.length === 0) return null
    const m = new Map<string, GraphGroup>()
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i]
      m.set(String(g.id || ''), g)
    }
    return m
  }, [nodes, edges])
  const hoverKind = hoverInfo?.kind
  const hoverId = hoverInfo?.id
  const [expanded, setExpanded] = React.useState(false)
  const expandedKeyRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    const nextKey = hoverKind && hoverId ? `${hoverKind}:${hoverId}` : null
    if (expandedKeyRef.current !== nextKey) {
      expandedKeyRef.current = nextKey
      setExpanded(false)
    }
  }, [hoverKind, hoverId])
  const node = React.useMemo(() => {
    if (hoverKind !== 'node' || !hoverId || !nodeMap) return null
    return nodeMap.get(String(hoverId)) || null
  }, [hoverKind, hoverId, nodeMap])
  const edge = React.useMemo(() => {
    if (hoverKind !== 'edge' || !hoverId || !edgeMap) return null
    return edgeMap.get(String(hoverId)) || null
  }, [hoverKind, hoverId, edgeMap])
  const group = React.useMemo(() => {
    if (hoverKind !== 'group' || !hoverId || !groupMap) return null
    return groupMap.get(String(hoverId)) || null
  }, [hoverKind, hoverId, groupMap])
  const content = React.useMemo(() => {
    const onToggleExpanded = () => setExpanded(v => !v)
    if (node) {
      return buildNodeContent(
        node,
        schema,
        iconSizeClass,
        uiIconBadgeChipClass,
        uiIconBadgeChipTextSizeClass,
        uiPanelMicroLabelTextSizeClass,
        graphHoverPreviewConfig,
        expanded,
        onToggleExpanded,
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
        graphHoverPreviewConfig,
        expanded,
        onToggleExpanded,
      )
    }
    if (group) {
      return buildGroupContent(group)
    }
    return null
  }, [
    edge,
    group,
    iconSizeClass,
    node,
    schema,
    uiIconBadgeChipClass,
    uiIconBadgeChipTextSizeClass,
    uiPanelMicroLabelTextSizeClass,
    graphHoverPreviewConfig,
    expanded,
  ])
  if (!hoverInfo || !container || !content) return null
  const rect = container.getBoundingClientRect()
  const hoverX = hoverInfo.clientX - rect.left + 8
  const hoverY = hoverInfo.clientY - rect.top + 8
  return (
    <Tooltip
      content={content}
      open
      className="absolute z-50 pointer-events-auto"
      anchorStyle={{ left: hoverX, top: hoverY, width: 0, height: 0 }}
      maxWidthPx={260}
      contentClassName="shadow-md max-w-xs text-xs"
      onContentMouseLeave={onRequestClose}
    >
      <span />
    </Tooltip>
  )
}
