import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  ensureEdgeAnimationStyleElement,
  GLOBAL_EDGE_COLOR_OPTIONS,
  getGlobalEdgeTypeOptionsFor2dRenderer,
  readGlobalEdgeAnimationEnabled,
  readEffectiveEdgeTypeFor2dRenderer,
  readGlobalEdgeColor,
  readGlobalEdgeThicknessPx,
  readGlobalEdgeType,
  type GlobalEdgeType,
  withGlobalEdgeAnimationEnabled,
  withGlobalEdgeColor,
  withGlobalEdgeThicknessPx,
  withGlobalEdgeType,
} from '@/lib/graph/edgeTypes'
import { scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import {
  WORKSPACE_SYNC_SCOPE_RENDERER_EDGE_TYPE_RUNTIME_PERSISTENCE,
  WORKSPACE_SYNC_TASK_RENDERER_EDGE_TYPE_VIEW_STATE,
} from '@/lib/async/workspaceSyncKeys'

type ThreeEdgeRendererType = 'mesh' | 'shaderLine' | 'tubeBridge'

const THREE_EDGE_RENDERER_OPTIONS: Array<{ value: ThreeEdgeRendererType; label: string }> = [
  { value: 'mesh', label: 'Mesh' },
  { value: 'shaderLine', label: 'Shader Line' },
  { value: 'tubeBridge', label: 'Bridge Tubes' },
]

const EDGE_THICKNESS_OPTIONS = [1, 1.5, 2, 2.5, 3, 4, 5] as const

export function EdgeTypesRendererSettings(props: {
  selectedEdgeType?: GlobalEdgeType
  onSelectEdgeType?: (next: GlobalEdgeType) => void
}) {
  const onSelectEdgeTypeProp = props.onSelectEdgeType
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || '')
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const schema = useGraphStore(s => s.schema)
  const canvasRenderMode = useGraphStore(s => s.canvasRenderMode)
  const canvas2dRenderer = useGraphStore(s => s.canvas2dRenderer)
  const canvas3dMode = useGraphStore(s => s.canvas3dMode)
  const threeEdgeRenderer = useGraphStore(s => s.threeEdgeRenderer)
  const setThreeEdgeRenderer = useGraphStore(s => s.setThreeEdgeRenderer)
  const setSchema = useGraphStore(s => s.setSchema)
  const edgeType = readGlobalEdgeType(schema)
  const edgeColor = readGlobalEdgeColor(schema)
  const edgeThicknessPx = readGlobalEdgeThicknessPx(schema)
  const edgeAnimated = readGlobalEdgeAnimationEnabled(schema)
  const selectedEdgeType = props.selectedEdgeType ?? edgeType
  const effectiveEdgeType =
    canvasRenderMode === '2d'
      ? readEffectiveEdgeTypeFor2dRenderer({ schema, canvas2dRenderer })
      : edgeType
  const options = React.useMemo(
    () => (canvasRenderMode === '2d' ? getGlobalEdgeTypeOptionsFor2dRenderer(canvas2dRenderer) : getGlobalEdgeTypeOptionsFor2dRenderer(null)),
    [canvas2dRenderer, canvasRenderMode],
  )

  const setEdgeType = React.useCallback((next: GlobalEdgeType) => {
    scheduleWorkspaceSyncTask(
      WORKSPACE_SYNC_TASK_RENDERER_EDGE_TYPE_VIEW_STATE,
      () => {
        const current = useGraphStore.getState().schema as GraphSchema
        const nextSchema = withGlobalEdgeType(current, next)
        if (nextSchema === current) return
        setSchema(nextSchema)
      },
      0,
      {
        scopeKey: WORKSPACE_SYNC_SCOPE_RENDERER_EDGE_TYPE_RUNTIME_PERSISTENCE,
      },
    )
  }, [setSchema])

  const setEdgeThicknessPx = React.useCallback((nextRaw: unknown) => {
    scheduleWorkspaceSyncTask(
      WORKSPACE_SYNC_TASK_RENDERER_EDGE_TYPE_VIEW_STATE,
      () => {
        const current = useGraphStore.getState().schema as GraphSchema
        const nextSchema = withGlobalEdgeThicknessPx(current, nextRaw)
        if (nextSchema === current) return
        setSchema(nextSchema)
      },
      0,
      {
        scopeKey: WORKSPACE_SYNC_SCOPE_RENDERER_EDGE_TYPE_RUNTIME_PERSISTENCE,
      },
    )
  }, [setSchema])

  const setEdgeColor = React.useCallback((nextRaw: unknown) => {
    scheduleWorkspaceSyncTask(
      WORKSPACE_SYNC_TASK_RENDERER_EDGE_TYPE_VIEW_STATE,
      () => {
        const current = useGraphStore.getState().schema as GraphSchema
        const nextSchema = withGlobalEdgeColor(current, nextRaw)
        if (nextSchema === current) return
        setSchema(nextSchema)
      },
      0,
      {
        scopeKey: WORKSPACE_SYNC_SCOPE_RENDERER_EDGE_TYPE_RUNTIME_PERSISTENCE,
      },
    )
  }, [setSchema])

  const setEdgeAnimated = React.useCallback((next: boolean) => {
    scheduleWorkspaceSyncTask(
      WORKSPACE_SYNC_TASK_RENDERER_EDGE_TYPE_VIEW_STATE,
      () => {
        const current = useGraphStore.getState().schema as GraphSchema
        const nextSchema = withGlobalEdgeAnimationEnabled(current, next)
        if (nextSchema === current) return
        setSchema(nextSchema)
      },
      0,
      {
        scopeKey: WORKSPACE_SYNC_SCOPE_RENDERER_EDGE_TYPE_RUNTIME_PERSISTENCE,
      },
    )
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

  React.useEffect(() => {
    if (!edgeAnimated) return
    ensureEdgeAnimationStyleElement(typeof document !== 'undefined' ? document : null)
  }, [edgeAnimated])

  return (
    <CollapsibleSection title="Edge Types" defaultCollapsed={false} stickyHeader={false} headerClassName={`px-2 ${uiPanelTextFontClass}`}>
      <div className="px-3 py-2 space-y-2">
        <div className={`text-[10px] ${UI_THEME_TOKENS.text.secondary} leading-snug`}>
          Applies globally to Flowchart, Flow Canvas, Design, Flow Editor, document modes, 2D/3D/geospatial surfaces, and Text/Image/Video widgets. Default is Bezier with animated blue edges.
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
            {options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className={`w-[50%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}>
            Color
          </label>
          <select
            className={`w-[50%] h-6 px-2 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} rounded`}
            value={edgeColor}
            onChange={e => setEdgeColor(e.target.value)}
          >
            {GLOBAL_EDGE_COLOR_OPTIONS.map(option => (
              <option key={option.key} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className={`w-[50%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}>
            Thickness
          </label>
          <select
            className={`w-[50%] h-6 px-2 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} rounded`}
            value={String(edgeThicknessPx)}
            onChange={e => setEdgeThicknessPx(e.target.value)}
          >
            {EDGE_THICKNESS_OPTIONS.map(v => (
              <option key={v} value={String(v)}>
                {`${v}px`}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className={`w-[50%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}>
            Animate
          </label>
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={edgeAnimated}
            onChange={e => setEdgeAnimated(e.target.checked)}
          />
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
