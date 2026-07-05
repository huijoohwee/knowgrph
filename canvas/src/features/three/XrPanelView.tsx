import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import { XR_PHYSICS_CONTROLLER_MODES, type XrPhysicsControllerMode } from '@/features/three/xrPhysicsPlaygroundModel'
import {
  readXrPhysicsPlaygroundControls,
  setXrPhysicsPlaygroundMode,
  subscribeXrPhysicsPlaygroundControls,
} from '@/features/three/xrPhysicsPlaygroundControls'
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
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

export type XrPanelSurface = 'bottomPanel' | 'floatingPanel'

function formatBooleanLabel(value: boolean): string {
  return value ? 'On' : 'Off'
}

export function XrPanelView({ surface }: { surface: XrPanelSurface }) {
  const [physicsMode, setPhysicsMode] = React.useState<XrPhysicsControllerMode>(readXrPhysicsPlaygroundControls().activeMode || 'roll')
  const [capabilities, setCapabilities] = React.useState(XR_BROWSER_GRAPHICS_CAPABILITY_DEFAULTS)
  const [spatialTool, setSpatialToolState] = React.useState<SpatialCaptureToolId>(readSpatialCaptureTool())
  const [spatialPrimaryMode, setSpatialPrimaryModeState] = React.useState<SpatialCapturePrimaryModeId>(readSpatialCapturePrimaryMode())
  const [spatialAxis, setSpatialAxisState] = React.useState<SpatialCaptureAxisId>(readSpatialCaptureAxis())
  const [spatialCenterAction, setSpatialCenterActionState] = React.useState<SpatialCaptureCenterActionId>(readSpatialCaptureCenterAction())
  const graphData = useActiveGraphRenderData(true)
  const {
    canvas3dMode,
    canvasRenderMode,
    markdownDocumentName,
    markdownDocumentText,
    setBottomSurfaceCollapsed,
    setBottomSurfaceTab,
    setCanvas3dMode,
    setCanvasRenderMode,
    setFloatingPanelOpen,
    setFloatingPanelView,
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
      setFloatingPanelOpen: state.setFloatingPanelOpen,
      setFloatingPanelView: state.setFloatingPanelView,
    })),
  )
  React.useEffect(() => {
    return subscribeXrPhysicsPlaygroundControls(controls => {
      setPhysicsMode(controls.activeMode || 'roll')
    })
  }, [])
  React.useEffect(() => subscribeSpatialCaptureTool(setSpatialToolState), [])
  React.useEffect(() => subscribeSpatialCapturePrimaryMode(setSpatialPrimaryModeState), [])
  React.useEffect(() => subscribeSpatialCaptureAxis(setSpatialAxisState), [])
  React.useEffect(() => subscribeSpatialCaptureCenterAction(setSpatialCenterActionState), [])
  React.useEffect(() => {
    setCapabilities(readBrowserXrGraphicsCapabilities())
  }, [])

  const activateXrMode = React.useCallback(() => {
    setCanvas3dMode('xr')
    setCanvasRenderMode('3d')
  }, [setCanvas3dMode, setCanvasRenderMode])

  const openBottomXr = React.useCallback(() => {
    setBottomSurfaceTab('xr')
    setBottomSurfaceCollapsed(false)
  }, [setBottomSurfaceCollapsed, setBottomSurfaceTab])

  const openFloatingXr = React.useCallback(() => {
    setFloatingPanelView('xr')
    setFloatingPanelOpen(true)
  }, [setFloatingPanelOpen, setFloatingPanelView])

  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes.length : 0
  const edges = Array.isArray(graphData?.edges) ? graphData.edges.length : 0
  const xrActive = canvasRenderMode === '3d' && canvas3dMode === 'xr'
  const sourceProfile = React.useMemo(() => resolveXrPanelSourceProfile(markdownDocumentText || ''), [markdownDocumentText])
  const runtimeStack = React.useMemo(() => resolveXrPanelRuntimeStack({ capabilities, profile: sourceProfile, xrActive }), [capabilities, sourceProfile, xrActive])

  return (
    <section
      className={cn('flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-2', UI_THEME_TOKENS.text.primary)}
      aria-label={surface === 'bottomPanel' ? 'BottomPanel XR' : 'FloatingPanel XR'}
      data-kg-xr-panel="1"
      data-kg-xr-panel-surface={surface}
      data-kg-xr-panel-active={xrActive ? '1' : '0'}
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
            {xrActive ? 'Surface Mode active' : 'Native 3D Surface Mode available'}
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
          {surface !== 'bottomPanel' ? (
            <button type="button" className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.hoverBg)} onClick={openBottomXr} data-kg-xr-panel-open-bottom="1">
              Bottom
            </button>
          ) : null}
          {surface !== 'floatingPanel' ? (
            <button type="button" className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.hoverBg)} onClick={openFloatingXr} data-kg-xr-panel-open-floating="1">
              Floating
            </button>
          ) : null}
        </nav>
      </header>

      <section className="grid min-w-0 gap-2 sm:grid-cols-2" aria-label="XR status">
        <section className={cn('rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg)} data-kg-xr-panel-scene="1">
          <h3 className="text-[11px] font-semibold uppercase">Scene</h3>
          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[11px]">
            <dt className={UI_THEME_TOKENS.text.tertiary}>Document</dt>
            <dd className="min-w-0 truncate">{markdownDocumentName || 'Untitled'}</dd>
            <dt className={UI_THEME_TOKENS.text.tertiary}>Nodes</dt>
            <dd>{nodes}</dd>
            <dt className={UI_THEME_TOKENS.text.tertiary}>Edges</dt>
            <dd>{edges}</dd>
            <dt className={UI_THEME_TOKENS.text.tertiary}>Capture</dt>
            <dd>{sourceProfile.kind}</dd>
            <dt className={UI_THEME_TOKENS.text.tertiary}>Format</dt>
            <dd>{sourceProfile.format}</dd>
            <dt className={UI_THEME_TOKENS.text.tertiary}>Source</dt>
            <dd>{sourceProfile.renderPath}</dd>
            <dt className={UI_THEME_TOKENS.text.tertiary}>Cache</dt>
            <dd>{sourceProfile.renderCacheKey ? 'Source keyed' : 'Graph keyed'}</dd>
          </dl>
        </section>

        <section className={cn('rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg)} data-kg-xr-panel-runtime="1">
          <h3 className="text-[11px] font-semibold uppercase">Runtime</h3>
          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[11px]">
            <dt className={UI_THEME_TOKENS.text.tertiary}>Native XR</dt>
            <dd>{formatBooleanLabel(xrActive)}</dd>
            <dt className={UI_THEME_TOKENS.text.tertiary}>Session</dt>
            <dd>AR first, VR fallback</dd>
            <dt className={UI_THEME_TOKENS.text.tertiary}>Renderer</dt>
            <dd>ThreeGraph</dd>
            <dt className={UI_THEME_TOKENS.text.tertiary}>External runtime</dt>
            <dd>None</dd>
          </dl>
        </section>
      </section>

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

      <section className={cn('rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg)} aria-label="XR physics controls" data-kg-xr-panel-physics="1">
        <header className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase">Controls</h3>
        </header>
        <nav className="mt-2 flex flex-wrap gap-1" aria-label="XR physics modes">
          {XR_PHYSICS_CONTROLLER_MODES.map(mode => (
            <button
              key={mode}
              type="button"
              aria-pressed={physicsMode === mode}
              className={cn('App-toolbar__btn capitalize', physicsMode === mode ? UI_THEME_TOKENS.button.activeBg : UI_THEME_TOKENS.button.hoverBg)}
              onClick={() => setXrPhysicsPlaygroundMode(mode)}
              data-kg-xr-panel-physics-mode={mode}
            >
              {mode}
            </button>
          ))}
        </nav>
      </section>
    </section>
  )
}
