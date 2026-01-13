import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphSchema } from '@/lib/graph/schema'
import { getRendererPalette } from '@/lib/graph/schema'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import AiKgLayersControls from '@/features/panels/views/AiKgLayersSectionControls'
import { GraphLayerMetadataPresetsSection } from '@/features/panels/views/graph-fields/FieldGraphLayersSection'
import { UI_LABELS } from '@/lib/config'
import Tooltip from '@/features/panels/ui/Tooltip'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export default function GraphLayerView() {
  const {
    schema,
    setSchema,
    setThreeConfig,
    setCharge,
    setCollisionByType,
    graphLayersVisible,
    setGraphLayersVisible,
    activeLayerBandIndex,
    setActiveLayerBandIndex,
    graphData,
    selectedNodeId,
    updateNode,
  } = useGraphStore(
    useShallow(s => ({
      schema: s.schema as GraphSchema,
      setSchema: s.setSchema,
      setThreeConfig: s.setThreeConfig,
      setCharge: s.setCharge,
      setCollisionByType: s.setCollisionByType,
      graphLayersVisible: s.graphLayersVisible,
      setGraphLayersVisible: s.setGraphLayersVisible,
      activeLayerBandIndex: s.activeLayerBandIndex,
      setActiveLayerBandIndex: s.setActiveLayerBandIndex,
      graphData: s.graphData as GraphData | null,
      selectedNodeId: s.selectedNodeId,
      updateNode: s.updateNode,
    })),
  )

  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  )
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass ||
      `w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} rounded text-right`,
  )

  const [traversalDelayMs, setTraversalDelayMs] = React.useState<number>(0)

  return (
    <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden px-1 py-1 space-y-3">
      <div className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.primary}`}>
            {UI_LABELS.graphLayersMode}
          </div>
          <button
            type="button"
            className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.primary}`}
            onClick={() => setGraphLayersVisible(!graphLayersVisible)}
          >
            {graphLayersVisible ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className={`${uiPanelKeyValueTextSizeClass} mb-2 ${UI_THEME_TOKENS.text.secondary}`}>
          Use this tab to configure graph layers, semantic overlays, and renderer behavior. All layer controls now live here for the Floating Panel.
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-pink-300 bg-pink-50 px-2 py-0.5 text-[10px] font-medium text-pink-800">
            <span className="mr-1 h-2 w-2 rounded-full bg-pink-500" />
            Mermaid Layer · MermaidSubgraph
          </span>
          <div className={`flex items-center gap-1 text-[10px] ${UI_THEME_TOKENS.text.secondary}`}>
            <span>Layer band</span>
            <input
              type="number"
              min={1}
              className={`${uiPanelKeyValueInputClass} w-14 h-5 px-1 text-[10px] ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`}
              value={activeLayerBandIndex ?? ''}
              onChange={e => {
                const raw = e.target.value
                if (!raw) {
                  setActiveLayerBandIndex(null)
                  return
                }
                const n = Number(raw)
                if (!Number.isFinite(n) || n <= 0) {
                  setActiveLayerBandIndex(null)
                  return
                }
                setActiveLayerBandIndex(n)
              }}
            />
            <button
              type="button"
              className={`App-toolbar__btn text-[10px] ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.primary}`}
              onClick={() => setActiveLayerBandIndex(null)}
            >
              Clear
            </button>
          </div>
        </div>
        <AiKgLayersControls
          schema={schema}
          setSchema={setSchema}
          setThreeConfig={setThreeConfig}
          setCharge={setCharge}
          setCollisionByType={setCollisionByType}
          traversalDelayMs={traversalDelayMs}
          setTraversalDelayMs={setTraversalDelayMs}
          uiPanelKeyValueInputClass={uiPanelKeyValueInputClass}
        />
      </div>
      <GraphLayerMetadataPresetsSection
        schema={schema}
        uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
      />
      <LifecycleTagHelper
        schema={schema}
        graphData={graphData}
        selectedNodeId={selectedNodeId}
        updateNode={updateNode}
        uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
      />
    </div>
  )
}

type LifecycleTagHelperProps = {
  schema: GraphSchema
  graphData: GraphData | null
  selectedNodeId: string | null
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  uiPanelKeyValueTextSizeClass: string
}

const LIFECYCLE_TAGS: readonly string[] = ['idea', 'hypothesis', 'execution', 'pivot', 'alert'] as const

function LifecycleTagHelper({
  schema,
  graphData,
  selectedNodeId,
  updateNode,
  uiPanelKeyValueTextSizeClass,
}: LifecycleTagHelperProps) {
  const palette = React.useMemo(() => getRendererPalette(schema), [schema])

  const selectedNode: GraphNode | null = React.useMemo(() => {
    if (!graphData || !selectedNodeId) return null
    const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
    const id = String(selectedNodeId)
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      if (String(n.id) === id) return n
    }
    return null
  }, [graphData, selectedNodeId])

  const currentTag = React.useMemo((): string | null => {
    if (!selectedNode) return null
    const props = selectedNode.properties || {}
    const raw = (props as Record<string, unknown>).tags
    if (!Array.isArray(raw)) return null
    const tags: string[] = []
    for (let i = 0; i < raw.length; i += 1) {
      const v = raw[i]
      if (typeof v === 'string' || typeof v === 'number') {
        const s = String(v).trim().toLowerCase()
        if (s) tags.push(s)
      }
    }
    if (!tags.length) return null
    for (let i = 0; i < LIFECYCLE_TAGS.length; i += 1) {
      const t = LIFECYCLE_TAGS[i]
      if (tags.includes(t)) return t
    }
    return null
  }, [selectedNode])

  const handleSetTag = React.useCallback(
    (tag: string) => {
      if (!selectedNode) return
      const id = String(selectedNode.id)
      const baseProps = (selectedNode.properties || {}) as GraphNode['properties']
      const nextProps: GraphNode['properties'] = { ...baseProps }
      if (currentTag === tag) {
        const clone: GraphNode['properties'] = {}
        const keys = Object.keys(nextProps || {})
        for (let i = 0; i < keys.length; i += 1) {
          const k = keys[i]
          if (k === 'tags') continue
          clone[k] = nextProps[k]
        }
        updateNode(id, { properties: clone })
        return
      }
      const tags: Array<string> = [tag]
      const updated: GraphNode['properties'] = { ...nextProps, tags }
      updateNode(id, { properties: updated })
    },
    [currentTag, selectedNode, updateNode],
  )

  const label = selectedNode ? String(selectedNode.label || selectedNode.id || '') : ''

  return (
    <div className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3 space-y-2`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`${uiPanelKeyValueTextSizeClass} font-semibold ${UI_THEME_TOKENS.text.primary}`}>
          Lifecycle tags for layers
        </div>
        <Tooltip
          content="Lifecycle tags set on the selected owner node write into properties.tags and reuse renderer:palette.nodes.idea/hypothesis/execution/pivot/alert so graph layer hull overlays and node fills share the same lifecycle colors."
          maxWidthPx={260}
          contentClassName={UI_THEME_TOKENS.tooltip.bg}
        >
          <span className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary} underline decoration-dotted cursor-help`}>
            how it maps
          </span>
        </Tooltip>
      </div>
      <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
        Set lifecycle tags on the selected node so graph layer hulls and node fills reuse the corresponding renderer palette color.
      </div>
      {!selectedNode ? (
        <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
          Select a node in the canvas to edit lifecycle tags.
        </div>
      ) : (
        <>
          <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.secondary} truncate`}>
            Selected node: {label}
          </div>
          <div className="flex flex-wrap gap-2">
            {LIFECYCLE_TAGS.map(tag => {
              const key = String(tag)
              const color = palette.nodes && typeof palette.nodes[key] === 'string' ? palette.nodes[key] : ''
              const isActive = currentTag === key
              const baseClasses = isActive
                ? 'border-transparent text-white'
                : `${UI_THEME_TOKENS.pill.base} ${UI_THEME_TOKENS.table.text}`
              const bgStyle = isActive && color
                ? { backgroundColor: color }
                : color
                  ? { borderColor: color }
                  : undefined
              return (
                <button
                  key={key}
                  type="button"
                  className={[
                    'px-2 py-0.5 rounded-full border text-[11px] font-medium',
                    'flex items-center gap-1',
                    baseClasses,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={bgStyle}
                  onClick={() => handleSetTag(key)}
                >
                  <span className="truncate">{key}</span>
                  {isActive ? <span>· active</span> : null}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
