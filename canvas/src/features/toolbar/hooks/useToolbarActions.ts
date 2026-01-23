import { useCallback } from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { emitPropsPanelOpen, emitSidePanelOpen } from '@/features/canvas/utils'
import { getNextThemeMode, type ThemeMode } from '@/lib/ui/theme'
import { type GraphSchema } from '@/lib/graph/schema'

export function useToolbarActions(
  schema: GraphSchema,
  setSchema: (s: GraphSchema) => void,
  setCanvasRenderMode: (m: '2d' | '3d') => void,
  themeMode: ThemeMode,
  setThemeMode: (mode: ThemeMode) => void,
  launchSpotlight: (mode?: string) => void,
  openMainPanel: (tab: 'workflow' | 'help' | 'graphFields' | 'preview' | 'settings') => void,
  onZoomIn?: () => void,
  onZoomOut?: () => void,
  onReset?: () => void,
  onZoomSelection?: () => void,
  setZoomToSelectionMode?: (v: boolean) => void,
  setFitToScreenMode?: (v: boolean) => void,
  toggleFitToScreenMode?: () => void,
  fitToScreenMode?: boolean,
  zoomToSelectionMode?: boolean,
  renderMediaAsNodes?: boolean,
  setRenderMediaAsNodes?: (v: boolean) => void,
  canvasRenderMode?: '2d' | '3d',
) {
  const handleLaunchStats = useCallback(() => {
    launchSpotlight('stats')
  }, [launchSpotlight])

  const handleLaunch = useCallback(() => {
    launchSpotlight()
  }, [launchSpotlight])

  const handleTogglePortHandles = useCallback(() => {
    const current = schema
    const behavior = current.behavior
    const portHandles = behavior.portHandles || {}
    const enabled = Boolean(portHandles.enabled)
    const next = {
      ...current,
      behavior: {
        ...behavior,
        portHandles: {
          ...portHandles,
          enabled: !enabled,
        },
      },
    }
    setSchema(next as GraphSchema)
  }, [schema, setSchema])

  const handleToggleNodeShapeMode = useCallback(() => {
    const current = schema
    const behavior = current.behavior
    const rawCur = behavior.nodeShapeMode
    const cur: NonNullable<NonNullable<GraphSchema['behavior']>['nodeShapeMode']> =
      rawCur === 'rect' || rawCur === 'diamond' || rawCur === 'hex' ? rawCur : 'circle'
    const order: ReadonlyArray<NonNullable<NonNullable<GraphSchema['behavior']>['nodeShapeMode']>> = [
      'circle',
      'rect',
      'diamond',
      'hex',
    ]
    const idx = order.indexOf(cur)
    const nextMode = order[(idx >= 0 ? idx + 1 : 0) % order.length]
    const next = {
      ...current,
      behavior: {
        ...behavior,
        nodeShapeMode: nextMode,
      },
    }
    setSchema(next as GraphSchema)
  }, [schema, setSchema])

  const handleToggleGroupShapeMode = useCallback(() => {
    const current = schema
    const layout = current.layout || {}
    const groups = layout.groups || {}
    const cur = groups.shape === 'rect' ? 'rect' : 'geo'
    const nextShape = cur === 'rect' ? 'geo' : 'rect'
    const next = {
      ...current,
      layout: {
        ...layout,
        groups: {
          ...groups,
          shape: nextShape,
        },
      },
    }
    setSchema(next as GraphSchema)
  }, [schema, setSchema])

  const handleToggleRadialLayout = useCallback(() => {
    const current = schema
    const layout = current.layout || {}
    const nextMode: NonNullable<NonNullable<GraphSchema['layout']>['mode']> =
      layout.mode === 'radial' ? 'force' : 'radial'
    const next = {
      ...current,
      layout: { ...layout, mode: nextMode },
    }
    setSchema(next as GraphSchema)
    if (nextMode === 'radial') {
      setCanvasRenderMode('2d')
    }
  }, [schema, setSchema, setCanvasRenderMode])

  const handleOpenGraphFields = useCallback(() => {
    openMainPanel('graphFields')
  }, [openMainPanel])

  const handleOpenSettings = useCallback(() => {
    openMainPanel('settings')
  }, [openMainPanel])

  const handleOpenHistory = useCallback(() => {
    openMainPanel('workflow')
  }, [openMainPanel])

  const handleOpenHelp = useCallback(() => {
    openMainPanel('help')
  }, [openMainPanel])

  const handleOpenPropsPanel = useCallback(() => {
    emitPropsPanelOpen()
  }, [])

  const handleReset = useCallback(() => {
    if (onReset) {
      onReset()
    } else {
      try {
        useGraphStore.getState().resetAll()
      } catch {
        void 0
      }
    }
  }, [onReset])

  const handleToggleFitToScreen = useCallback(() => {
    if (!toggleFitToScreenMode || !setZoomToSelectionMode) return
    const next = !fitToScreenMode
    toggleFitToScreenMode()
    if (next) {
      setZoomToSelectionMode(false)
      try { useGraphStore.getState().setViewPinned(false) } catch { void 0 }
    }
  }, [fitToScreenMode, toggleFitToScreenMode, setZoomToSelectionMode])

  const handleToggleZoomToSelection = useCallback(() => {
    if (!setZoomToSelectionMode || !setFitToScreenMode) return
    const next = !zoomToSelectionMode
    setZoomToSelectionMode(next)
    if (next) {
      setFitToScreenMode(false)
      try { useGraphStore.getState().setViewPinned(false) } catch { void 0 }
      if (onZoomSelection) {
        onZoomSelection()
      }
    }
  }, [zoomToSelectionMode, setZoomToSelectionMode, setFitToScreenMode, onZoomSelection])

  const handleToggleRenderMedia = useCallback(() => {
    if (setRenderMediaAsNodes) setRenderMediaAsNodes(!renderMediaAsNodes)
  }, [renderMediaAsNodes, setRenderMediaAsNodes])

  const handleToggle3DMode = useCallback(() => {
    setCanvasRenderMode(canvasRenderMode === '3d' ? '2d' : '3d')
  }, [canvasRenderMode, setCanvasRenderMode])

  const handleOpenChat = useCallback(() => {
    emitSidePanelOpen({ tab: 'chat', open: true })
  }, [])

  const handleToggleTheme = useCallback(() => {
    setThemeMode(getNextThemeMode(themeMode))
  }, [setThemeMode, themeMode])

  return {
    handleLaunchStats,
    handleLaunch,
    handleToggleNodeShapeMode,
    handleToggleGroupShapeMode,
    handleTogglePortHandles,
    handleToggleRadialLayout,
    handleOpenGraphFields,
    handleOpenSettings,
    handleOpenHistory,
    handleOpenHelp,
    handleOpenPropsPanel,
    handleReset,
    handleToggleFitToScreen,
    handleToggleZoomToSelection,
    handleToggleRenderMedia,
    handleToggle3DMode,
    handleOpenChat,
    handleToggleTheme,
  }
}
