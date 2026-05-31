import React from 'react'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { summarizePropertySpec, getNodePropSpec, getEdgePropSpec, buildEdgeSchemaBadges } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import IconButton from '@/components/IconButton'
import { getBadgeChipClass, getIconSizeClass, getPinToggleButtonClassName } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePinnedLs } from '@/lib/ui/panelPinned'
import { LS_KEYS } from '@/lib/config.ls.keys'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import type { GraphFieldKind } from '@/features/graph-fields/graphFields'
import { FieldTypeBadgeIcon } from '@/features/graph-fields/ui/graphFieldIcons'
import Tooltip from '@/features/panels/ui/Tooltip'
import type { GraphHoverPreviewConfig } from '@/hooks/store/types'
import { truncateTextWithEllipsis } from '@/components/GraphCanvas/layout/utils'
import { getNodeLabelFullText2d } from '@/components/GraphCanvas/labelLayout2d'
import { getEdgeLabelForDisplay } from '@/components/GraphCanvas/edgeDisplay'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { CardMediaPreview } from '@/lib/cards/CardMediaPreview'
import { Pin, PinOff, X as CloseIcon } from 'lucide-react'
import { extractVoxelScores, VOXEL_SCORE_DIMENSIONS } from '@/features/three/voxelStyle'
import {
  buildHoverDescription,
  buildHoverImageInfo,
  formatPropValue,
  sortProps,
} from './GraphHoverTooltip.data'

export type HoverKind = 'node' | 'edge' | 'group'

export type HoverInfo = {
  kind: HoverKind;
  id: string;
  clientX: number;
  clientY: number;
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
  const primaryNodeText = getNodeLabelFullText2d(node)
  const voxelScores = extractVoxelScores(node)
  const { imageSrc, imageCount } = buildHoverImageInfo(node)
  const descRaw = config.showNodeDescription ? buildHoverDescription(node) : ''
  const descText = expanded ? descRaw : truncateTextWithEllipsis(descRaw, 280)

  return (
    <div>
      <div className="font-semibold">
        {primaryNodeText}
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
      {voxelScores ? (
        <div className="mt-1 space-y-1">
          {VOXEL_SCORE_DIMENSIONS.map((d) => {
            const v = voxelScores[d.key]
            const pct = Math.round(v * 100)
            return (
              <div key={d.key} className="space-y-0.5">
                <div className={`text-[10px] ${UI_THEME_TOKENS.tooltip.textSecondary} flex justify-between gap-2`}>
                  <span className="font-semibold">{d.label}</span>
                  <span>{`${pct}%`}</span>
                </div>
                <div className="h-2 w-full rounded bg-black/20 overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
      {imageSrc ? (
        <div className="mt-1">
          <div className="flex gap-2 items-start">
            <CardMediaPreview
              kind="image"
              url={imageSrc}
              title={primaryNodeText}
              interactive={false}
              fit="cover"
              className="h-12 w-12 flex-none rounded-lg"
              mediaClassName="h-12 w-12 flex-none rounded-lg"
            />
            <div className="min-w-0 flex-1">
              {imageCount > 1 ? (
                <div className={`text-[10px] ${UI_THEME_TOKENS.tooltip.textTertiary} font-semibold`}>{`+${imageCount - 1}`}</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {descRaw ? (
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
            if (k === 'description' || k === 'chunk_text' || k === 'mdSectionMarkdown') return null
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
  const edgeLabelForDisplay = getEdgeLabelForDisplay(edge)
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
  const primaryEdgeText = edgeLabelForDisplay || String(edge.id || '').trim() || 'Edge'
  const desc = showProps ? descRaw : ''
  const descText = expanded ? desc : truncateTextWithEllipsis(desc, 280)

  return (
    <div>
      <div className="font-semibold">
        {(config.showEdgeLabel || !edgeLabelForDisplay) && (
          <span className="block whitespace-normal break-words">
            {primaryEdgeText}
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
  tooltipInteractive?: boolean;
}

export function GraphHoverTooltip({ hoverInfo, containerRef, nodes, edges, schema, onRequestClose, tooltipInteractive = false }: GraphHoverTooltipProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconBadgeChipClass = useGraphStore(s => s.uiIconBadgeChipClass)
  const uiIconBadgeChipTextSizeClass = useGraphStore(s => s.uiIconBadgeChipTextSizeClass)
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || s.uiIconBadgeChipTextSizeClass || 'text-[9px]',
  )
  const graphHoverPreviewConfig = useGraphStore(s => s.graphHoverPreviewConfig)
  const uiOverlayOpacity = useGraphStore(s => s.uiOverlayOpacity)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const { pinned: tooltipPinned, setPinned } = usePinnedLs(LS_KEYS.hoverTooltipPinned, false)
  const [pinnedKey, setPinnedKey] = React.useState<string | null>(null)
  const [pinnedHoverInfo, setPinnedHoverInfo] = React.useState<HoverInfo | null>(null)
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
  const effectiveHoverInfo = tooltipPinned ? pinnedHoverInfo : hoverInfo
  const hoverKind = effectiveHoverInfo?.kind
  const hoverId = effectiveHoverInfo?.id
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
  React.useEffect(() => {
    if (!tooltipPinned) {
      setPinnedKey(null)
      setPinnedHoverInfo(null)
      return
    }
    if (!hoverInfo) return
    if (pinnedKey) return
    setPinnedKey(`${hoverInfo.kind}:${hoverInfo.id}`)
    setPinnedHoverInfo(hoverInfo)
  }, [hoverInfo, pinnedKey, tooltipPinned])

  const handleTogglePinned = React.useCallback(() => {
    if (!tooltipPinned) {
      if (hoverInfo) {
        setPinnedHoverInfo(hoverInfo)
        setPinnedKey(`${hoverInfo.kind}:${hoverInfo.id}`)
      }
      setPinned(true)
      return
    }
    setPinned(false)
    setPinnedKey(null)
    setPinnedHoverInfo(null)
  }, [hoverInfo, setPinned, tooltipPinned])

  const handleClose = React.useCallback(() => {
    setPinned(false)
    setPinnedKey(null)
    setPinnedHoverInfo(null)
    if (onRequestClose) onRequestClose()
  }, [onRequestClose, setPinned])

  if (!effectiveHoverInfo || !container || !content) return null
  const rect = container.getBoundingClientRect()
  const hoverXRaw = effectiveHoverInfo.clientX - rect.left + 8
  const hoverYRaw = effectiveHoverInfo.clientY - rect.top + 8
  const hoverX = Math.max(8, Math.min(Math.max(8, rect.width - 8), hoverXRaw))
  const hoverY = Math.max(8, Math.min(Math.max(8, rect.height - 8), hoverYRaw))
  const anyPointerDragActive = (() => {
    try {
      const g = globalThis as unknown as { __kgActivePointerDragByKey?: unknown }
      const map = g.__kgActivePointerDragByKey as unknown as Map<string, unknown> | undefined
      return !!(map && typeof map.size === 'number' && map.size > 0)
    } catch {
      return false
    }
  })()
  const effectiveInteractive = (tooltipInteractive === true || tooltipPinned) && anyPointerDragActive !== true

  return (
    <Tooltip
      content={(
        <div data-kg-canvas-wheel-ignore="true" style={{ opacity: uiOverlayOpacity }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">{content}</div>
            <div className="flex flex-col gap-1 flex-none">
              <IconButton
                className={getPinToggleButtonClassName(tooltipPinned)}
                title={tooltipPinned ? UI_COPY.floatingPanelUnpin : UI_COPY.floatingPanelPin}
                onClick={handleTogglePinned}
                showTooltip
                aria-pressed={tooltipPinned}
              >
                {tooltipPinned ? (
                  <Pin className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
                ) : (
                  <PinOff className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
                )}
              </IconButton>
              <IconButton
                className="App-toolbar__btn"
                title={UI_LABELS.close}
                onClick={handleClose}
                showTooltip
              >
                <CloseIcon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
              </IconButton>
            </div>
          </div>
        </div>
      )}
      open
      className={effectiveInteractive ? 'absolute z-50 pointer-events-auto' : 'absolute z-50 pointer-events-none'}
      anchorStyle={{ left: hoverX, top: hoverY, width: 0, height: 0 }}
      maxWidthPx={260}
      contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text} shadow-md max-w-xs text-xs`}
      onContentMouseLeave={tooltipPinned ? undefined : onRequestClose}
      interactive={effectiveInteractive}
    >
      <span />
    </Tooltip>
  )
}
