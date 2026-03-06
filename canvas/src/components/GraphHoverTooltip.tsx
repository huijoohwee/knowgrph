import React from 'react'
import type { GraphNode, GraphEdge, JSONValue } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { summarizePropertySpec, getNodePropSpec, getEdgePropSpec, buildEdgeSchemaBadges } from '@/lib/graph/schema'
import { readFlowEdgeDisplayLabel } from '@/lib/graph/flowPorts'
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
  'keyword:key',
  'keyword:role',
  'keyword:ner',
  'keyword:frequency',
  'keyword:pagerank',
  'visual:importance',
  'visual:nodeSize',
  'visual:layer',
]
const EDGE_PROP_PRIORITY = [
  'strength:score',
  'strength:ppmi',
  'strength:count',
  'keyword:predicate',
  'keyword:verbLike',
  'keyword:directed',
  'weight',
  'score',
  'confidence',
  'count',
]

function markdownToPlainText(markdown: string): string {
  const raw = String(markdown || '')
  if (!raw.trim()) return ''

  let text = raw
  text = text.replace(/```[\s\S]*?```/g, ' ')
  text = text.replace(/`[^`]*`/g, ' ')
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '')
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/\*([^*]+)\*/g, '$1')
  text = text.replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
  text = text.replace(/\s+/g, ' ')
  return text.trim()
}

function firstString(obj: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!obj) return null
  for (const key of keys) {
    const v = obj[key]
    const s = typeof v === 'string' ? v.trim() : ''
    if (s) return s
  }
  return null
}

function collectImageUrls(obj: Record<string, unknown> | null | undefined): string[] {
  if (!obj) return []
  const seen = new Set<string>()
  const out: string[] = []
  const rec = obj as Record<string, unknown>
  const push = (v: unknown) => {
    const s = typeof v === 'string' ? v.trim() : ''
    if (!s) return
    if (seen.has(s)) return
    seen.add(s)
    out.push(s)
  }

  const mdImages = rec.mdImagesJson
  if (typeof mdImages === 'string' && mdImages.trim()) {
    try {
      const parsed = JSON.parse(mdImages) as unknown
      if (Array.isArray(parsed)) {
        for (const v of parsed) push(v)
      }
    } catch {
      void 0
    }
  } else if (Array.isArray(mdImages)) {
    for (const v of mdImages) push(v)
  }

  const arrays = [
    rec.images,
    rec.imageUrls,
    rec.image_urls,
    rec.media,
    rec.mediaUrls,
    rec.thumbnails,
  ]
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue
    for (const v of arr) push(v)
  }

  const singles = [
    rec.image,
    rec.image_url,
    rec.media_url,
    rec.thumbnail,
    rec.thumbnail_url,
    rec.hero_image,
  ]
  for (const v of singles) push(v)
  return out
}

function buildHoverDescription(node: GraphNode): string {
  const props = (node.properties || {}) as unknown as Record<string, unknown>
  const meta = (node.metadata || {}) as unknown as Record<string, unknown>
  const raw =
    firstString(props, ['description', 'summary', 'chunk_text', 'text', 'markdown', 'mdSectionMarkdown', 'sectionMarkdown']) ||
    firstString(meta, ['mdSectionMarkdown', 'sectionMarkdown', 'markdown', 'description', 'summary', 'text']) ||
    ''
  return markdownToPlainText(raw)
}

function buildHoverImageInfo(node: GraphNode): { imageSrc: string | null; imageCount: number } {
  const props = (node.properties || {}) as unknown as Record<string, unknown>
  const meta = (node.metadata || {}) as unknown as Record<string, unknown>
  const urls = [...collectImageUrls(props), ...collectImageUrls(meta)].filter(Boolean).slice(0, 8)
  return { imageSrc: urls.length > 0 ? urls[0] : null, imageCount: urls.length }
}

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
  const primaryNodeText = String(node.label || '').trim() || String(node.id || '').trim() || 'Node'
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
      {imageSrc ? (
        <div className="mt-1">
          <div className="flex gap-2 items-start">
            <img src={imageSrc} alt="" className="w-12 h-12 rounded-lg object-cover flex-none" />
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
            if (k === 'description' || k === 'chunk_text' || k === 'mdSectionMarkdown' || k === 'mdImagesJson') return null
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
  const edgeLabelForDisplay = (() => {
    const flowLabel = String(readFlowEdgeDisplayLabel(edge) || '').trim()
    if (flowLabel) return flowLabel
    const label = String(edge.label || '').trim()
    const props = (edge.properties || {}) as Record<string, unknown>
    const keywordKind = typeof props['keyword:kind'] === 'string' ? String(props['keyword:kind']).trim() : ''
    if (!keywordKind) return label
    const clean = label.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
    return clean || label
  })()
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

export function GraphHoverTooltip({ hoverInfo, containerRef, nodes, edges, schema, onRequestClose, tooltipInteractive = true }: GraphHoverTooltipProps) {
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
  const hoverXRaw = hoverInfo.clientX - rect.left + 8
  const hoverYRaw = hoverInfo.clientY - rect.top + 8
  const hoverX = Math.max(8, Math.min(Math.max(8, rect.width - 8), hoverXRaw))
  const hoverY = Math.max(8, Math.min(Math.max(8, rect.height - 8), hoverYRaw))
  return (
    <Tooltip
      content={content}
      open
      className={tooltipInteractive ? 'absolute z-50 pointer-events-auto' : 'absolute z-50 pointer-events-none'}
      anchorStyle={{ left: hoverX, top: hoverY, width: 0, height: 0 }}
      maxWidthPx={260}
      contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text} shadow-md max-w-xs text-xs`}
      onContentMouseLeave={onRequestClose}
      interactive={tooltipInteractive}
    >
      <span />
    </Tooltip>
  )
}
