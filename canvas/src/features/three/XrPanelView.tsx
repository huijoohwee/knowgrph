import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { activateCanvasGraphSurfaceMode } from '@/lib/canvas/canvas3dMode'
import {
  XR_BROWSER_GRAPHICS_CAPABILITY_DEFAULTS,
  readBrowserXrGraphicsCapabilities,
  resolveXrPanelRuntimeStack,
  resolveXrPanelSourceProfile,
} from '@/features/three/xrPanelModel'
import {
  SPATIAL_CAPTURE_RAIL_BUTTONS,
  SPATIAL_CAPTURE_TOOL_BUTTONS,
  readSpatialCaptureAxis,
  readSpatialCaptureCenterAction,
  readSpatialCapturePrimaryMode,
  readSpatialCaptureTool,
  readSpatialCaptureToolLabel,
  setSpatialCaptureAxis,
  setSpatialCaptureCenterAction,
  setSpatialCapturePrimaryMode,
  setSpatialCaptureTool,
  subscribeSpatialCaptureAxis,
  subscribeSpatialCaptureCenterAction,
  subscribeSpatialCapturePrimaryMode,
  subscribeSpatialCaptureTool,
} from '@/features/three/xrSpatialCaptureTools'
import type { SpatialCaptureAxisId, SpatialCaptureCenterActionId, SpatialCapturePrimaryModeId, SpatialCaptureToolId } from '@/features/three/xrSpatialCaptureTools'
import { XrGaussianSplatEditorSection } from '@/features/three/XrGaussianSplatEditorSection'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

export function XrPanelView() {
  const [capabilities, setCapabilities] = React.useState(XR_BROWSER_GRAPHICS_CAPABILITY_DEFAULTS)
  const [spatialTool, setSpatialToolState] = React.useState<SpatialCaptureToolId>(readSpatialCaptureTool())
  const [spatialPrimaryMode, setSpatialPrimaryModeState] = React.useState<SpatialCapturePrimaryModeId>(readSpatialCapturePrimaryMode())
  const [spatialAxis, setSpatialAxisState] = React.useState<SpatialCaptureAxisId>(readSpatialCaptureAxis())
  const [spatialCenterAction, setSpatialCenterActionState] = React.useState<SpatialCaptureCenterActionId>(readSpatialCaptureCenterAction())
  const {
    canvas3dMode,
    canvasRenderMode,
    markdownDocumentName,
    markdownDocumentText,
    setBottomSurfaceCollapsed,
    setBottomSurfaceTab,
    setCanvas3dMode,
    setCanvasRenderMode,
  } = useGraphStore(
    useShallow(state => ({
      canvas3dMode: state.canvas3dMode,
      canvasRenderMode: state.canvasRenderMode,
      markdownDocumentName: state.markdownDocumentName,
      markdownDocumentText: state.markdownDocumentText,
      setBottomSurfaceCollapsed: state.setBottomSurfaceCollapsed,
      setBottomSurfaceTab: state.setBottomSurfaceTab,
      setCanvas3dMode: state.setCanvas3dMode,
      setCanvasRenderMode: state.setCanvasRenderMode,
    })),
  )
  React.useEffect(() => subscribeSpatialCaptureTool(setSpatialToolState), [])
  React.useEffect(() => subscribeSpatialCapturePrimaryMode(setSpatialPrimaryModeState), [])
  React.useEffect(() => subscribeSpatialCaptureAxis(setSpatialAxisState), [])
  React.useEffect(() => subscribeSpatialCaptureCenterAction(setSpatialCenterActionState), [])
  React.useEffect(() => {
    setCapabilities(readBrowserXrGraphicsCapabilities())
  }, [])

  const openXrTimeline = React.useCallback(() => {
    setBottomSurfaceTab('timeline')
    setBottomSurfaceCollapsed(false)
  }, [setBottomSurfaceCollapsed, setBottomSurfaceTab])

  const activateXrMode = React.useCallback(() => {
    activateCanvasGraphSurfaceMode({
      mode: 'xr',
      setCanvas3dMode,
      setCanvasRenderMode,
    })
    openXrTimeline()
  }, [openXrTimeline, setCanvas3dMode, setCanvasRenderMode])

  const xrDocumentLoaded = Boolean(
    String(markdownDocumentName || '').trim()
    && String(markdownDocumentText || '').trim(),
  )
  const xrActive = canvasRenderMode === '3d' && canvas3dMode === 'xr'
  const sourceProfile = React.useMemo(() => resolveXrPanelSourceProfile(markdownDocumentText || ''), [markdownDocumentText])
  const runtimeStack = React.useMemo(() => resolveXrPanelRuntimeStack({ capabilities, profile: sourceProfile, xrActive }), [capabilities, sourceProfile, xrActive])

  return (
    <section
      className={cn('flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-2', UI_THEME_TOKENS.text.primary)}
      aria-label="FloatingPanel XR"
      data-kg-xr-panel="1"
      data-kg-xr-panel-surface="floatingPanel"
      data-kg-xr-panel-active={xrActive ? '1' : '0'}
      data-kg-xr-panel-document-loaded={xrDocumentLoaded ? '1' : '0'}
      data-kg-xr-panel-spatial-status={sourceProfile.kind}
      data-kg-xr-panel-source-format={sourceProfile.format}
      data-kg-xr-panel-ingestion-cache={sourceProfile.ingestionCacheKey ? '1' : '0'}
      data-kg-xr-panel-render-cache={sourceProfile.renderCacheKey ? '1' : '0'}
      data-kg-xr-panel-runtime-stack={runtimeStack.map(item => `${item.id}:${item.state}`).join('|')}
    >
      <header className={cn('flex flex-wrap items-center justify-between gap-2 border-b pb-2', UI_THEME_TOKENS.panel.divider)}>
        <section className="min-w-0">
          <h2 className="truncate text-xs font-semibold">XR</h2>
          <p className={cn('text-[11px]', UI_THEME_TOKENS.text.tertiary)}>
            {xrActive ? 'XR Surface Mode active' : 'Native 3D Surface Mode available'}
          </p>
        </section>
        <nav className="flex min-w-0 flex-wrap items-center gap-1" aria-label="XR panel actions">
          <button
            type="button"
            className={cn('App-toolbar__btn', xrActive ? UI_THEME_TOKENS.button.activeBg : UI_THEME_TOKENS.button.hoverBg)}
            onClick={activateXrMode}
            data-kg-xr-panel-activate="1"
          >
            Activate
          </button>
          <button
            type="button"
            className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.hoverBg)}
            onClick={openXrTimeline}
            data-kg-xr-panel-open-timeline="1"
          >
            Timeline
          </button>
        </nav>
      </header>

      {sourceProfile.kind === 'spatial-capture' ? (
        <XrGaussianSplatEditorSection
          documentName={markdownDocumentName || 'spatial-capture'}
          sourceFormat={sourceProfile.format}
        />
      ) : null}

      <section className={cn('rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg)} aria-label="XR graphics stack" data-kg-xr-panel-graphics-stack="1">
        <h3 className="text-[11px] font-semibold uppercase">Graphics</h3>
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[11px]">
          {runtimeStack.map(item => (
            <React.Fragment key={item.id}>
              <dt className={UI_THEME_TOKENS.text.tertiary}>{item.label}</dt>
              <dd>{item.value}</dd>
              <dd data-kg-xr-panel-capability={item.id} data-kg-xr-panel-capability-state={item.state}>{item.state}</dd>
            </React.Fragment>
          ))}
        </dl>
      </section>

      {sourceProfile.kind === 'spatial-capture' ? (
        <section
          className={cn('rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg)}
          aria-label="XR spatial capture tools"
          data-kg-xr-panel-spatial-tools="1"
          data-kg-xr-panel-spatial-tool-active={spatialTool}
        >
          <header className="flex flex-wrap items-center justify-between gap-2">
            <section className="min-w-0">
              <h3 className="text-[11px] font-semibold uppercase">Spatial Tools</h3>
              <output className={cn('block truncate text-[11px]', UI_THEME_TOKENS.text.tertiary)} data-kg-xr-panel-spatial-tool-label="1">
                {readSpatialCaptureToolLabel(spatialTool)}
              </output>
            </section>
            <aside className="flex shrink-0 items-center gap-1" aria-label="XR spatial axes" data-kg-xr-panel-axis-widget="1">
              {(['x', 'y', 'z'] as const).map(axis => (
                <button
                  key={axis}
                  type="button"
                  aria-label={`XR ${axis.toUpperCase()} axis`}
                  aria-pressed={spatialAxis === axis}
                  className={cn(
                    'grid size-6 place-items-center rounded-full border text-[10px] font-semibold',
                    UI_THEME_TOKENS.panel.border,
                    spatialAxis === axis ? 'ring-2 ring-sky-300' : '',
                    axis === 'x' ? 'bg-rose-400/80 text-white' : axis === 'y' ? 'bg-emerald-400/80 text-slate-950' : 'bg-indigo-500/80 text-white',
                  )}
                  onClick={() => setSpatialCaptureAxis(axis)}
                  data-kg-xr-panel-axis={axis}
                >
                  {axis.toUpperCase()}
                </button>
              ))}
            </aside>
            <fieldset className="flex shrink-0 items-center gap-1" aria-label="XR center actions" data-kg-xr-panel-center-controls="1" data-kg-xr-panel-center-action-active={spatialCenterAction}>
              {(['set', 'add', 'remove'] as const).map(action => (
                <button
                  key={action}
                  type="button"
                  aria-pressed={spatialCenterAction === action}
                  className={cn('App-toolbar__btn capitalize', spatialCenterAction === action ? UI_THEME_TOKENS.button.activeBg : UI_THEME_TOKENS.button.hoverBg)}
                  data-kg-xr-panel-center-action={action}
                  onClick={() => setSpatialCaptureCenterAction(action)}
                >
                  {action}
                </button>
              ))}
              <output className={cn('rounded border px-2 py-1 text-[11px]', UI_THEME_TOKENS.panel.border)} data-kg-xr-panel-center-radius="1">1</output>
              <output className={cn('text-[11px]', UI_THEME_TOKENS.text.tertiary)}>Radius</output>
            </fieldset>
          </header>
          <nav className="mt-2 flex max-w-full items-center gap-1 overflow-x-auto pb-1" aria-label="XR spatial capture primary modes" data-kg-xr-panel-primary-modes="1" data-kg-xr-panel-primary-mode-active={spatialPrimaryMode}>
            {SPATIAL_CAPTURE_RAIL_BUTTONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                aria-label={`XR ${label}`}
                aria-pressed={spatialPrimaryMode === id}
                title={label}
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded border',
                  UI_THEME_TOKENS.panel.border,
                  spatialPrimaryMode === id ? UI_THEME_TOKENS.button.activeBg : UI_THEME_TOKENS.button.hoverBg,
                )}
                onClick={() => setSpatialCapturePrimaryMode(id)}
                data-kg-xr-panel-primary-mode={id}
              >
                <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
              </button>
            ))}
          </nav>
          <nav className="mt-2 flex max-w-full items-center gap-1 overflow-x-auto pb-1" aria-label="XR spatial capture viewport tools" data-kg-xr-panel-bottom-toolbar="1">
            {SPATIAL_CAPTURE_TOOL_BUTTONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                aria-label={`XR ${label}`}
                aria-pressed={spatialTool === id}
                title={label}
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded border',
                  UI_THEME_TOKENS.panel.border,
                  spatialTool === id ? UI_THEME_TOKENS.button.activeBg : UI_THEME_TOKENS.button.hoverBg,
                )}
                onClick={() => setSpatialCaptureTool(id)}
                data-kg-xr-panel-bottom-tool={id}
              >
                <Icon className="size-4" strokeWidth={1.7} aria-hidden="true" />
              </button>
            ))}
          </nav>
        </section>
      ) : null}

    </section>
  )
}
