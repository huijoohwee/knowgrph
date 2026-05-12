import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useLocation } from 'react-router-dom'
import { CanvasViewport } from '@/components/CanvasViewport'
import { VerticalResizeSeparatorHr } from '@/components/ui/VerticalResizeSeparatorHr'
import { CanvasSyncRuntime } from '@/features/canvas/CanvasSyncRuntime'
import { CanvasHotkeysRuntime } from '@/features/canvas/CanvasHotkeysRuntime'
import { CanvasFrontmatterRuntime } from '@/features/canvas/CanvasFrontmatterRuntime'
import { useCanvasWorkspacePaneRuntime } from '@/features/canvas/useCanvasWorkspacePaneRuntime'
import { dispatchRuntimeZoomAction } from '@/lib/canvas/runtimeZoomDispatch'
import { useCanvasGeospatialRuntime } from '@/features/canvas/useCanvasGeospatialRuntime'
import { CanvasQueryBootstrapRuntime, shouldOpenEditorWorkspaceFromSearch } from '@/features/canvas/CanvasQueryBootstrapRuntime'
import { CanvasDocDeepLinkRuntime } from '@/features/canvas/CanvasDocDeepLinkRuntime'
import { CanvasRootRuntime } from '@/features/canvas/CanvasRootRuntime'
import { GraphStoreRuntime } from '@/features/canvas/GraphStoreRuntime'
import { useCanvasEmbeddedPreviewRuntime } from '@/features/canvas/useCanvasEmbeddedPreviewRuntime'
import { QUERY_PARAM_OPEN_EDITOR_WORKSPACE } from '@/lib/routing/queryParams'
import { runGlobalInteractionCleanup } from '@/lib/canvas/interaction-recovery'
import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'

import { CanvasStartupRuntimes } from '@/features/canvas/CanvasStartupRuntimes'

const ToolbarLazy = React.lazy(() => import('@/components/Toolbar'))
const EmbeddedEditorShellLazy = React.lazy(() =>
  import('@/components/EmbeddedEditorShell').then(mod => ({ default: mod.EmbeddedEditorShell })),
)
const ToastHostLazy = React.lazy(() => import('@/components/ui/ToastHost'))

export default function CanvasPage() {
  const location = useLocation()
  const { isEmbeddedPreview, setIsEmbeddedPreview, detectEmbeddedPreviewWriteback } = useCanvasEmbeddedPreviewRuntime(location.search)

  const {
    uiOverlayOpacity,
    uiPanelOpacity,
    uiToolbarOpacity,
    workspaceViewMode,
    workspaceCanvasPaneOpen,
    setWorkspaceViewState,
  } = useGraphStore(
    useShallow(s => ({
      uiOverlayOpacity: s.uiOverlayOpacity,
      uiPanelOpacity: s.uiPanelOpacity,
      uiToolbarOpacity: s.uiToolbarOpacity,
      workspaceViewMode: s.workspaceViewMode,
      workspaceCanvasPaneOpen: s.workspaceCanvasPaneOpen,
      setWorkspaceViewState: s.setWorkspaceViewState,
    })),
  )

  const queryRequestsEditorWorkspace = shouldOpenEditorWorkspaceFromSearch(location.search)
  const launchSpotlightShortcutEnabled = !isEmbeddedPreview && workspaceViewMode !== 'editor'
  const consumedEditorWorkspaceQueryRef = React.useRef(false)

  React.useEffect(() => {
    if (!queryRequestsEditorWorkspace || consumedEditorWorkspaceQueryRef.current) return
    consumedEditorWorkspaceQueryRef.current = true
    try {
      setWorkspaceViewState({ mode: 'editor', paneOpen: true })
    } catch {
      void 0
    }
    try {
      const params = new URLSearchParams(String(location.search || ''))
      if (!String(params.get(QUERY_PARAM_OPEN_EDITOR_WORKSPACE) || '').trim()) return
      params.delete(QUERY_PARAM_OPEN_EDITOR_WORKSPACE)
      const next = params.toString()
      const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`
      window.history.replaceState(null, '', nextUrl)
    } catch {
      void 0
    }
  }, [location.search, queryRequestsEditorWorkspace, setWorkspaceViewState])

  const [editorShellWarmed, setEditorShellWarmed] = React.useState(workspaceViewMode === 'editor')
  React.useEffect(() => {
    if (workspaceViewMode === 'editor') setEditorShellWarmed(true)
  }, [workspaceViewMode])

  const [toolbarHeaderElevated, setToolbarHeaderElevated] = React.useState(false)
  const toolbarHeaderRef = React.useRef<HTMLElement>(null)
  const editorOverlayRef = React.useRef<HTMLElement>(null)
  React.useEffect(() => {
    if (workspaceViewMode !== 'editor') setToolbarHeaderElevated(false)
  }, [workspaceViewMode])

  const { workspacePreviewWidthPx, setResizeHandleEl } = useCanvasWorkspacePaneRuntime()
  const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode, workspaceCanvasPaneOpen })
  const workspaceCanvasPaneVisible = workspaceEditorOverlayOpen && workspaceCanvasPaneOpen
  const workspacePaneBoundaryCss = `min(${workspacePreviewWidthPx}px, calc(100% - 3rem))`

  React.useEffect(() => {
    if (!workspaceEditorOverlayOpen) return
    runGlobalInteractionCleanup({ resetViewportControllers: false })
  }, [workspaceEditorOverlayOpen])

  const { canvasRenderMode, canvas3dMode, canvas2dRenderer } = useGraphStore(
    useShallow(s => ({
      canvasRenderMode: s.canvasRenderMode,
      canvas3dMode: s.canvas3dMode,
      canvas2dRenderer: s.canvas2dRenderer,
    })),
  )
  const geospatialModeEnabled = useCanvasGeospatialRuntime()

  const makeZoomHandler = (type: 'in' | 'out' | 'reset' | 'selection') => () => {
    void dispatchRuntimeZoomAction(type)
  }

  const handleZoomIn = makeZoomHandler('in')
  const handleZoomOut = makeZoomHandler('out')
  const handleReset = makeZoomHandler('reset')
  const handleZoomSelection = makeZoomHandler('selection')

  return (
    <>
      <CanvasRootRuntime
        uiOverlayOpacity={uiOverlayOpacity}
        uiPanelOpacity={uiPanelOpacity}
        uiToolbarOpacity={uiToolbarOpacity}
      />
      <GraphStoreRuntime />
      <CanvasQueryBootstrapRuntime search={location.search} />
      <CanvasFrontmatterRuntime />
      <CanvasHotkeysRuntime
        geospatialModeEnabled={geospatialModeEnabled}
        launchSpotlightShortcutEnabled={launchSpotlightShortcutEnabled}
      />
      <CanvasSyncRuntime
        isEmbeddedPreview={isEmbeddedPreview}
        setIsEmbeddedPreview={setIsEmbeddedPreview}
        detectEmbeddedPreviewWriteback={detectEmbeddedPreviewWriteback}
      />
      <CanvasDocDeepLinkRuntime search={location.search} />
      <CanvasStartupRuntimes />
      <section
        className="relative flex h-[100dvh] min-h-[100dvh] w-full max-w-full flex-col overflow-hidden bg-[var(--kg-canvas-bg)] transition-colors duration-300"
        aria-label="Knowgrph Canvas"
      >
        {isEmbeddedPreview ? (
          <main className="flex-1 relative overflow-hidden" aria-label="Canvas Preview Only">
            <CanvasViewport
              variant="embeddedPreview"
              geospatialModeEnabled={geospatialModeEnabled}
              workspaceEditorOverlayOpen={false}
              canvasRenderMode={canvasRenderMode}
              canvas3dMode={canvas3dMode}
              canvas2dRenderer={canvas2dRenderer}
            />
          </main>
        ) : (
          <>
            {workspaceEditorOverlayOpen ? (
              <header
                ref={toolbarHeaderRef}
                className={`absolute top-0 inset-x-0 pointer-events-none ${toolbarHeaderElevated ? 'z-[400]' : 'z-[300]'}`}
                aria-label="Workspace Toolbar Header"
                onPointerDown={() => setToolbarHeaderElevated(true)}
              >
                <nav className="absolute top-[calc(var(--kg-safe-top)+0.5rem)] right-[calc(var(--kg-safe-right)+0.5rem)] z-[200] flex items-center justify-end bg-transparent" aria-label="Canvas Toolbar" role="navigation">
                  <div className="pointer-events-auto">
                    <React.Suspense fallback={null}>
                      <ToolbarLazy onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={handleReset} onZoomSelection={handleZoomSelection} />
                    </React.Suspense>
                  </div>
                </nav>
              </header>
            ) : null}

            <React.Suspense fallback={null}>
              <ToastHostLazy />
            </React.Suspense>

            <main className="flex-1 flex overflow-hidden" aria-label="Canvas Workspace">
              <section className="flex-1 flex flex-col overflow-hidden" aria-label="Workspace stage">
                <section className="relative flex-1 min-h-0 overflow-hidden" aria-label="Workspace overlay stage">
                  <section
                    className="absolute inset-0 min-h-0 overflow-hidden bg-[var(--kg-canvas-bg)]"
                    aria-label="Canvas pane"
                  >
                    {!workspaceEditorOverlayOpen ? (
                      <nav
                        className="absolute top-0 inset-x-0 z-[200] flex items-center justify-center pt-[calc(var(--kg-safe-top)+0.5rem)] pb-2 bg-transparent pointer-events-none"
                        aria-label="Canvas Toolbar"
                        role="navigation"
                      >
                        <div className="pointer-events-auto">
                          <React.Suspense fallback={null}>
                            <ToolbarLazy onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={handleReset} onZoomSelection={handleZoomSelection} />
                          </React.Suspense>
                        </div>
                      </nav>
                    ) : null}
                    <CanvasViewport
                      variant="workspace"
                      layout="full"
                      geospatialModeEnabled={geospatialModeEnabled}
                      workspaceEditorOverlayOpen={workspaceEditorOverlayOpen}
                      canvasRenderMode={canvasRenderMode}
                      canvas3dMode={canvas3dMode}
                      canvas2dRenderer={canvas2dRenderer}
                    />
                  </section>

                  {workspaceEditorOverlayOpen ? (
                    <section
                      ref={editorOverlayRef}
                      className="absolute inset-0 z-[300] pointer-events-none"
                      aria-label="Workspace editor overlay shell"
                      onPointerDown={() => setToolbarHeaderElevated(false)}
                    >
                      <section
                        className={`absolute inset-y-0 left-0 pointer-events-auto overflow-hidden bg-[var(--kg-panel-bg)] ${workspaceCanvasPaneVisible ? 'border-r border-[var(--kg-border)] shadow-2xl' : ''}`}
                        style={{ width: workspaceCanvasPaneVisible ? workspacePaneBoundaryCss : 'min(100%, var(--kg-workspace-pane-width, 32rem))' }}
                        aria-label="Workspace left pane"
                        data-kg-workspace-left-pane="1"
                      >
                        {editorShellWarmed ? (
                          <React.Suspense fallback={null}>
                            <EmbeddedEditorShellLazy active={workspaceEditorOverlayOpen} />
                          </React.Suspense>
                        ) : null}
                      </section>

                      {workspaceCanvasPaneVisible ? (
                        <VerticalResizeSeparatorHr
                          ref={setResizeHandleEl}
                          ariaLabel="Resize canvas"
                          visualStyle="centerGrip"
                          className="absolute inset-y-0 left-0 z-[301] h-full -translate-x-1/2 pointer-events-auto"
                          style={{ left: workspacePaneBoundaryCss }}
                        />
                      ) : null}
                    </section>
                  ) : null}
                </section>
              </section>
            </main>
          </>
        )}
      </section>
    </>
  )
}
