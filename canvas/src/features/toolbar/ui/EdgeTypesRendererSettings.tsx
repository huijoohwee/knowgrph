import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphSchema } from '@/lib/graph/schema'
import { readGlobalEdgeType, type GlobalEdgeType } from '@/lib/graph/edgeTypes'

const EDGE_TYPE_OPTIONS: Array<{ value: GlobalEdgeType; label: string }> = [
  { value: 'bezier', label: 'Bezier (default)' },
  { value: 'straight', label: 'Straight' },
  { value: 'step', label: 'Step' },
  { value: 'smoothstep', label: 'Smoothstep' },
]

type ThreeEdgeRendererType = 'mesh' | 'shaderLine' | 'tubeBridge'

const THREE_EDGE_RENDERER_OPTIONS: Array<{ value: ThreeEdgeRendererType; label: string }> = [
  { value: 'mesh', label: 'Mesh' },
  { value: 'shaderLine', label: 'Shader Line' },
  { value: 'tubeBridge', label: 'Bridge Tubes' },
]

export function EdgeTypesRendererSettings(props: {
  selectedEdgeType?: GlobalEdgeType
  onSelectEdgeType?: (next: GlobalEdgeType) => void
}) {
  const onSelectEdgeTypeProp = props.onSelectEdgeType
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || '')
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const schema = useGraphStore(s => s.schema)
  const canvasRenderMode = useGraphStore(s => s.canvasRenderMode)
  const canvas3dMode = useGraphStore(s => s.canvas3dMode)
  const threeEdgeRenderer = useGraphStore(s => s.threeEdgeRenderer)
  const setThreeEdgeRenderer = useGraphStore(s => s.setThreeEdgeRenderer)
  const setSchema = useGraphStore(s => s.setSchema)
  const edgeType = readGlobalEdgeType(schema)
  const selectedEdgeType = props.selectedEdgeType ?? edgeType

  const setEdgeType = React.useCallback((next: GlobalEdgeType) => {
    const current = useGraphStore.getState().schema as GraphSchema
    const layout = current.layout || {}
    const edges = layout.edges || {}
    setSchema({
      ...current,
      layout: {
        ...layout,
        edges: {
          ...edges,
          type: next,
        },
      },
    })
  }, [setSchema])

  const onSelectEdgeType = React.useCallback((next: GlobalEdgeType) => {
    if (onSelectEdgeTypeProp) {
      onSelectEdgeTypeProp(next)
      return
    }
    setEdgeType(next)
  }, [onSelectEdgeTypeProp, setEdgeType])

  const onSelectThreeEdgeRenderer = React.useCallback((next: string) => {
    const value = String(next || '').trim()
    const normalized: ThreeEdgeRendererType = value === 'shaderLine' || value === 'tubeBridge' ? value : 'mesh'
    setThreeEdgeRenderer(normalized)
  }, [setThreeEdgeRenderer])

  return (
    <CollapsibleSection title="Edge Types" defaultCollapsed={false} stickyHeader={false} headerClassName={`px-2 ${uiPanelTextFontClass}`}>
      <div className="px-3 py-2 space-y-2">
        <div className={`text-[10px] ${UI_THEME_TOKENS.text.secondary} leading-snug`}>
          Applies globally to D3, D3 Bipartite, Flow, Design, Flow Editor, and 3D edge rendering.
        </div>
        <div className="flex items-center gap-2">
          <label className={`w-[50%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}>
            Type
          </label>
          <select
            className={`w-[50%] h-6 px-2 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} rounded`}
            value={selectedEdgeType}
            onChange={e => onSelectEdgeType((String(e.target.value || '').trim().toLowerCase() as GlobalEdgeType))}
          >
            {EDGE_TYPE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {canvasRenderMode === '3d' || (canvasRenderMode === '2d' && canvas3dMode === 'voxel') ? (
          <div className="flex items-center gap-2">
            <label className={`w-[50%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}>
              3D/Voxel
            </label>
            <select
              className={`w-[50%] h-6 px-2 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} rounded`}
              value={threeEdgeRenderer}
              onChange={e => onSelectThreeEdgeRenderer(e.target.value)}
            >
              {THREE_EDGE_RENDERER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
    </CollapsibleSection>
  )
}
