import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import ThreeViewLinksSection from '@/features/panels/views/ThreeViewLinksSection'
import ThreeViewLayoutSection from '@/lib/panels/views/ThreeViewLayoutSection.impl'
import ThreeViewBackgroundFogSection from '@/features/panels/views/ThreeViewBackgroundFogSection'
import ThreeViewStarfieldSection from '@/features/panels/views/ThreeViewStarfieldSection'
import ThreeViewCameraSection from '@/features/panels/views/ThreeViewCameraSection'
import ThreeViewSelectionSection from '@/features/panels/views/ThreeViewSelectionSection'
import ThreeViewGlobeEffectsSection from '@/features/panels/views/ThreeViewGlobeEffectsSection'
import { PANEL_TYPOGRAPHY_DEFAULTS } from 'grph-shared/ui/panelTypography'

interface ThreeGroupsCollapsed {
  links: boolean
  layout: boolean
  backgroundFog: boolean
  starfield: boolean
  camera: boolean
  selection: boolean
}

interface ThreeViewTuningSectionProps {
  schema: GraphSchema
  setThreeConfig: (config: Partial<GraphSchema['three']>) => void
  threeGroupsCollapsed?: ThreeGroupsCollapsed
  onToggleThreeGroup?: (group: keyof ThreeGroupsCollapsed, next: boolean) => void
}

export default function ThreeViewTuningSection({
  schema,
  setThreeConfig,
  threeGroupsCollapsed,
  onToggleThreeGroup,
}: ThreeViewTuningSectionProps) {
  const linksCollapsed = threeGroupsCollapsed?.links ?? false
  const layoutCollapsed = threeGroupsCollapsed?.layout ?? false
  const backgroundFogCollapsed = threeGroupsCollapsed?.backgroundFog ?? false
  const starfieldCollapsed = threeGroupsCollapsed?.starfield ?? false
  const cameraCollapsed = threeGroupsCollapsed?.camera ?? false
  const selectionCollapsed = threeGroupsCollapsed?.selection ?? false

  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass ||
      PANEL_TYPOGRAPHY_DEFAULTS.keyValueInputClass,
  )

  return (
    <section>
      <ThreeViewLinksSection
        schema={schema}
        setThreeConfig={setThreeConfig}
        collapsed={linksCollapsed}
        onToggle={next => onToggleThreeGroup && onToggleThreeGroup('links', next)}
      />
      <ThreeViewGlobeEffectsSection
        schema={schema}
        setThreeConfig={setThreeConfig}
        collapsed={false}
      />
      <ThreeViewLayoutSection
        schema={schema}
        setThreeConfig={setThreeConfig}
        collapsed={layoutCollapsed}
        onToggle={next => onToggleThreeGroup && onToggleThreeGroup('layout', next)}
        uiPanelKeyValueInputClass={uiPanelKeyValueInputClass}
      />
      <ThreeViewBackgroundFogSection
        schema={schema}
        setThreeConfig={setThreeConfig}
        collapsed={backgroundFogCollapsed}
        onToggle={next => onToggleThreeGroup && onToggleThreeGroup('backgroundFog', next)}
        uiPanelKeyValueInputClass={uiPanelKeyValueInputClass}
      />
      <ThreeViewStarfieldSection
        schema={schema}
        setThreeConfig={setThreeConfig}
        collapsed={starfieldCollapsed}
        onToggle={next => onToggleThreeGroup && onToggleThreeGroup('starfield', next)}
        uiPanelKeyValueInputClass={uiPanelKeyValueInputClass}
      />
      <ThreeViewCameraSection
        schema={schema}
        setThreeConfig={setThreeConfig}
        collapsed={cameraCollapsed}
        onToggle={next => onToggleThreeGroup && onToggleThreeGroup('camera', next)}
      />
      <ThreeViewSelectionSection
        schema={schema}
        setThreeConfig={setThreeConfig}
        collapsed={selectionCollapsed}
        onToggle={next => onToggleThreeGroup && onToggleThreeGroup('selection', next)}
      />
    </section>
  )
}
