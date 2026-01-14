import { useCallback } from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { deriveTreeDerivation } from '@/components/GraphCanvas/layout/treeHelpers'
import { normalizeEdgesForSim } from '@/components/GraphCanvas/simulation'
import { emitPropsPanelOpen, emitSidePanelOpen } from '@/features/canvas/utils'
import { getNextThemeMode, type ThemeMode } from '@/lib/ui/theme'
import type { GraphSchema } from '@/lib/graph/schema'

export function useToolbarActions(
  schema: GraphSchema,
  setSchema: (s: GraphSchema) => void,
  setCanvasRenderMode: (m: '2d' | '3d') => void,
  setThemeMode: React.Dispatch<React.SetStateAction<ThemeMode>>,
  launchSpotlight: (mode?: string) => void,
  openMainPanel: (tab: 'workflow' | 'help' | 'graphFields' | 'graphLayer' | 'preview' | 'settings') => void,
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

  const handleToggleLayerMode = useCallback(() => {
    const currentLayers = schema.layers || {}
    const currentMode = (currentLayers.mode || 'semantic') as NonNullable<NonNullable<GraphSchema['layers']>['mode']>
    const nextMode: NonNullable<NonNullable<GraphSchema['layers']>['mode']> =
      currentMode === 'semantic'
        ? 'document-structure'
        : currentMode === 'document-structure'
          ? 'property'
          : 'semantic'
    const next = {
      ...schema,
      layers: {
        ...currentLayers,
        mode: nextMode,
      },
    }
    setSchema(next as GraphSchema)
  }, [schema, setSchema])

  const handleToggleTreeLayout = useCallback(() => {
    const current = schema
    const layout = current.layout || {}
    const nextMode: NonNullable<NonNullable<GraphSchema['layout']>['mode']> =
      layout.mode === 'tree' ? 'force' : 'tree'
    const baseNext = {
      ...current,
      layout: { ...layout, mode: nextMode },
    } as GraphSchema

    const next = (() => {
      if (nextMode !== 'tree') return baseNext
      const treeCfg = baseNext.layout?.tree
      const rawEdgeLabels = treeCfg?.edgeLabels
      const configuredLabels = Array.isArray(rawEdgeLabels)
        ? rawEdgeLabels.map((v: string) => String(v || '').trim()).filter(Boolean)
        : []
      const shouldResolveLabels = configuredLabels.length === 0
      const shouldResolveDirection = !treeCfg?.direction || treeCfg.direction === 'auto'
      if (!shouldResolveLabels && !shouldResolveDirection) return baseNext

      try {
        const graphData = useGraphStore.getState().graphData
        const nodes = graphData?.nodes || []
        const edges = graphData?.edges || []
        if (!nodes.length) return baseNext

        const edgesForSim = normalizeEdgesForSim(nodes, edges)
        const nodeIds = new Set<string>(nodes.map(n => String(n.id)))
        const derivation = deriveTreeDerivation(edgesForSim, baseNext, nodeIds)
        if (!derivation) return baseNext

        const nextTree = { ...(treeCfg || {}) }
        let changed = false

        if (shouldResolveLabels && derivation.labelSet.size > 0) {
          nextTree.edgeLabels = Array.from(derivation.labelSet).sort((a, b) => a.localeCompare(b))
          changed = true
        }
        if (shouldResolveDirection) {
          nextTree.direction = derivation.direction
          changed = true
        }
        if (!changed) return baseNext

        return {
          ...baseNext,
          layout: { ...(baseNext.layout || {}), tree: nextTree },
        } as GraphSchema
      } catch {
        return baseNext
      }
    })()

    setSchema(next)
    if (nextMode === 'tree') {
      setCanvasRenderMode('2d')
    }
  }, [schema, setSchema, setCanvasRenderMode])

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

  const handleToggleMermaidLayout = useCallback(() => {
    const current = schema
    const layout = current.layout || {}
    const nextMode: NonNullable<NonNullable<GraphSchema['layout']>['mode']> =
      layout.mode === 'mermaid' ? 'force' : 'mermaid'
    const next = {
      ...current,
      layout: { ...layout, mode: nextMode },
    }
    setSchema(next as GraphSchema)
    if (nextMode === 'mermaid') {
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
    }
  }, [fitToScreenMode, toggleFitToScreenMode, setZoomToSelectionMode])

  const handleToggleZoomToSelection = useCallback(() => {
    if (!setZoomToSelectionMode || !setFitToScreenMode) return
    const next = !zoomToSelectionMode
    setZoomToSelectionMode(next)
    if (next) {
      setFitToScreenMode(false)
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
    setThemeMode(prev => getNextThemeMode(prev))
  }, [setThemeMode])

  return {
    handleLaunchStats,
    handleLaunch,
    handleToggleLayerMode,
    handleToggleTreeLayout,
    handleToggleRadialLayout,
    handleToggleMermaidLayout,
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
