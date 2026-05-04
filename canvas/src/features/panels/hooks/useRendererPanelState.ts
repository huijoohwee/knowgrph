import { useCallback, useMemo } from 'react'
import {
  LS_KEYS,
  buildRenderSectionToggleAnalyticsEvent,
  type RenderSectionToggleAnalyticsEvent,
  type RenderSectionId,
} from '@/lib/config'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'

interface RendererPanelSections {
  byKey: {
    links: boolean
    layout: boolean
    backgroundFog: boolean
    starfield: boolean
    camera: boolean
    selection: boolean
    presets: boolean
    datasetInspector: boolean
    codebaseIndex: boolean
  }
  setters: {
    links: (next: boolean) => void
    layout: (next: boolean) => void
    backgroundFog: (next: boolean) => void
    starfield: (next: boolean) => void
    camera: (next: boolean) => void
    selection: (next: boolean) => void
    presets: (next: boolean) => void
    datasetInspector: (next: boolean) => void
    codebaseIndex: (next: boolean) => void
  }
}

export interface RendererPanelState {
  renderUiEditorOpen: boolean
  setRenderUiEditorOpen: (next: boolean) => void
  sections: RendererPanelSections
  allSectionsCollapsed: boolean
  collapseAllSections: () => void
  expandAllSections: () => void
}

type RenderSectionToggleSource = 'floatingPanel' | 'panel'

type RenderSectionToggleEventDetail = RenderSectionToggleAnalyticsEvent & {
  source: RenderSectionToggleSource
}

function emitRenderSectionToggle(sectionId: RenderSectionId, collapsed: boolean, source: RenderSectionToggleSource) {
  if (typeof window === 'undefined') return
  try {
    const payload = buildRenderSectionToggleAnalyticsEvent(sectionId, collapsed)
    if (!payload) return
    const event = new CustomEvent<RenderSectionToggleEventDetail>('kg-render-section-toggle', {
      detail: { ...payload, collapsed, source },
    })
    window.dispatchEvent(event)
  } catch {
    void 0
  }
}

export function useRendererPanelState(options?: { source?: RenderSectionToggleSource }): RendererPanelState {
  const source: RenderSectionToggleSource = options?.source ?? 'panel'
  const [renderUiEditorOpen, setRenderUiEditorOpen] = usePersistedBoolean(LS_KEYS.renderUiEditorOpen, true)
  const [linksCollapsed, setLinksCollapsed] = usePersistedBoolean(LS_KEYS.renderThreeLinksCollapsed, false)
  const [layoutCollapsed, setLayoutCollapsed] = usePersistedBoolean(LS_KEYS.renderThreeLayoutCollapsed, false)
  const [backgroundFogCollapsed, setBackgroundFogCollapsed] = usePersistedBoolean(
    LS_KEYS.renderThreeBackgroundFogCollapsed,
    false,
  )
  const [starfieldCollapsed, setStarfieldCollapsed] = usePersistedBoolean(LS_KEYS.renderThreeStarfieldCollapsed, false)
  const [cameraCollapsed, setCameraCollapsed] = usePersistedBoolean(LS_KEYS.renderThreeCameraCollapsed, false)
  const [selectionCollapsed, setSelectionCollapsed] = usePersistedBoolean(LS_KEYS.renderThreeSelectionCollapsed, false)
  const [presetsCollapsed, setPresetsCollapsed] = usePersistedBoolean(LS_KEYS.renderPresetsCollapsed, true)
  const [datasetInspectorCollapsed, setDatasetInspectorCollapsed] = usePersistedBoolean(
    LS_KEYS.renderDatasetInspectorCollapsed,
    true,
  )
  const [codebaseIndexCollapsed, setCodebaseIndexCollapsed] = usePersistedBoolean(
    LS_KEYS.renderCodebaseIndexCollapsed,
    true,
  )

  const handleSetLinksCollapsed = useCallback(
    (next: boolean) => {
      emitRenderSectionToggle('threeLinks', next, source)
      setLinksCollapsed(next)
    },
    [setLinksCollapsed, source],
  )

  const handleSetLayoutCollapsed = useCallback(
    (next: boolean) => {
      emitRenderSectionToggle('threeLayout', next, source)
      setLayoutCollapsed(next)
    },
    [setLayoutCollapsed, source],
  )

  const handleSetBackgroundFogCollapsed = useCallback(
    (next: boolean) => {
      emitRenderSectionToggle('threeBackgroundFog', next, source)
      setBackgroundFogCollapsed(next)
    },
    [setBackgroundFogCollapsed, source],
  )

  const handleSetStarfieldCollapsed = useCallback(
    (next: boolean) => {
      emitRenderSectionToggle('threeStarfield', next, source)
      setStarfieldCollapsed(next)
    },
    [setStarfieldCollapsed, source],
  )

  const handleSetCameraCollapsed = useCallback(
    (next: boolean) => {
      emitRenderSectionToggle('threeCamera', next, source)
      setCameraCollapsed(next)
    },
    [setCameraCollapsed, source],
  )

  const handleSetSelectionCollapsed = useCallback(
    (next: boolean) => {
      emitRenderSectionToggle('threeSelection', next, source)
      setSelectionCollapsed(next)
    },
    [setSelectionCollapsed, source],
  )

  const handleSetPresetsCollapsed = useCallback(
    (next: boolean) => {
      emitRenderSectionToggle('renderPresets', next, source)
      setPresetsCollapsed(next)
    },
    [setPresetsCollapsed, source],
  )

  const handleSetDatasetInspectorCollapsed = useCallback(
    (next: boolean) => {
      emitRenderSectionToggle('datasetInspector', next, source)
      setDatasetInspectorCollapsed(next)
    },
    [setDatasetInspectorCollapsed, source],
  )

  const handleSetCodebaseIndexCollapsed = useCallback(
    (next: boolean) => {
      emitRenderSectionToggle('codebaseIndexPipeline', next, source)
      setCodebaseIndexCollapsed(next)
    },
    [setCodebaseIndexCollapsed, source],
  )

  const sections: RendererPanelSections = useMemo(
    () => ({
      byKey: {
        links: linksCollapsed,
        layout: layoutCollapsed,
        backgroundFog: backgroundFogCollapsed,
        starfield: starfieldCollapsed,
        camera: cameraCollapsed,
        selection: selectionCollapsed,
        presets: presetsCollapsed,
        datasetInspector: datasetInspectorCollapsed,
        codebaseIndex: codebaseIndexCollapsed,
      },
      setters: {
        links: handleSetLinksCollapsed,
        layout: handleSetLayoutCollapsed,
        backgroundFog: handleSetBackgroundFogCollapsed,
        starfield: handleSetStarfieldCollapsed,
        camera: handleSetCameraCollapsed,
        selection: handleSetSelectionCollapsed,
        presets: handleSetPresetsCollapsed,
        datasetInspector: handleSetDatasetInspectorCollapsed,
        codebaseIndex: handleSetCodebaseIndexCollapsed,
      },
    }),
    [
      linksCollapsed,
      layoutCollapsed,
      backgroundFogCollapsed,
      starfieldCollapsed,
      cameraCollapsed,
      selectionCollapsed,
      presetsCollapsed,
      datasetInspectorCollapsed,
      codebaseIndexCollapsed,
      handleSetLinksCollapsed,
      handleSetLayoutCollapsed,
      handleSetBackgroundFogCollapsed,
      handleSetStarfieldCollapsed,
      handleSetCameraCollapsed,
      handleSetSelectionCollapsed,
      handleSetPresetsCollapsed,
      handleSetDatasetInspectorCollapsed,
      handleSetCodebaseIndexCollapsed,
    ],
  )

  const allSectionsCollapsed = useMemo(
    () =>
      sections.byKey.links &&
      sections.byKey.layout &&
      sections.byKey.backgroundFog &&
      sections.byKey.starfield &&
      sections.byKey.camera &&
      sections.byKey.selection &&
      sections.byKey.presets &&
      sections.byKey.datasetInspector &&
      sections.byKey.codebaseIndex,
    [sections],
  )

  const collapseAllSections = useCallback(() => {
    sections.setters.links(true)
    sections.setters.layout(true)
    sections.setters.backgroundFog(true)
    sections.setters.starfield(true)
    sections.setters.camera(true)
    sections.setters.selection(true)
    sections.setters.presets(true)
    sections.setters.datasetInspector(true)
    sections.setters.codebaseIndex(true)
  }, [sections])

  const expandAllSections = useCallback(() => {
    sections.setters.links(false)
    sections.setters.layout(false)
    sections.setters.backgroundFog(false)
    sections.setters.starfield(false)
    sections.setters.camera(false)
    sections.setters.selection(false)
    sections.setters.presets(false)
    sections.setters.datasetInspector(false)
    sections.setters.codebaseIndex(false)
  }, [sections])

  return {
    renderUiEditorOpen,
    setRenderUiEditorOpen,
    sections,
    allSectionsCollapsed,
    collapseAllSections,
    expandAllSections,
  }
}
