import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphSchema } from '@/lib/graph/schema'
import AiKgLayersControls from '@/features/panels/views/AiKgLayersSectionControls'
import { PolygonMetadataPresetsSection } from '@/features/panels/views/graph-fields/FieldPolygonsSection'
import { UI_LABELS } from '@/lib/config'

export default function GraphLayerView() {
  const {
    schema,
    setSchema,
    setThreeConfig,
    setCharge,
    setCollisionByType,
    polygonGroupsVisible,
    setPolygonGroupsVisible,
  } = useGraphStore(
    useShallow(s => ({
      schema: s.schema as GraphSchema,
      setSchema: s.setSchema,
      setThreeConfig: s.setThreeConfig,
      setCharge: s.setCharge,
      setCollisionByType: s.setCollisionByType,
      polygonGroupsVisible: s.polygonGroupsVisible,
      setPolygonGroupsVisible: s.setPolygonGroupsVisible,
    })),
  )

  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  )
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass ||
      'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right',
  )

  const [traversalDelayMs, setTraversalDelayMs] = React.useState<number>(0)

  return (
    <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden px-1 py-1 space-y-3">
      <div className="rounded border border-gray-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
            {UI_LABELS.polygonGroupsMode}
          </div>
          <button
            type="button"
            className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
            onClick={() => setPolygonGroupsVisible(!polygonGroupsVisible)}
          >
            {polygonGroupsVisible ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className={`${uiPanelKeyValueTextSizeClass} mb-2 text-gray-500`}>
          Use this tab to configure layer mode, semantic overlays, physics, and polygon groups. All polygon and layer controls now live here for both the Main Panel and Floating Panel.
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
      <PolygonMetadataPresetsSection
        schema={schema}
        uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
      />
    </div>
  )
}
