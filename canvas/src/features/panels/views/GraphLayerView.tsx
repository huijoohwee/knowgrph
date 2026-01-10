import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphSchema } from '@/lib/graph/schema'
import AiKgLayersControls from '@/features/panels/views/AiKgLayersSectionControls'
import { GraphLayerMetadataPresetsSection } from '@/features/panels/views/graph-fields/FieldGraphLayersSection'
import { UI_LABELS } from '@/lib/config'

export default function GraphLayerView() {
  const {
    schema,
    setSchema,
    setThreeConfig,
    setCharge,
    setCollisionByType,
    graphLayersVisible,
    setGraphLayersVisible,
    activeLayerBandIndex,
    setActiveLayerBandIndex,
  } = useGraphStore(
    useShallow(s => ({
      schema: s.schema as GraphSchema,
      setSchema: s.setSchema,
      setThreeConfig: s.setThreeConfig,
      setCharge: s.setCharge,
      setCollisionByType: s.setCollisionByType,
      graphLayersVisible: s.graphLayersVisible,
      setGraphLayersVisible: s.setGraphLayersVisible,
      activeLayerBandIndex: s.activeLayerBandIndex,
      setActiveLayerBandIndex: s.setActiveLayerBandIndex,
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
            {UI_LABELS.graphLayersMode}
          </div>
          <button
            type="button"
            className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
            onClick={() => setGraphLayersVisible(!graphLayersVisible)}
          >
            {graphLayersVisible ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className={`${uiPanelKeyValueTextSizeClass} mb-2 text-gray-500`}>
          Use this tab to configure graph layers, semantic overlays, and renderer behavior. All layer controls now live here for the Floating Panel.
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-pink-300 bg-pink-50 px-2 py-0.5 text-[10px] font-medium text-pink-800">
            <span className="mr-1 h-2 w-2 rounded-full bg-pink-500" />
            Mermaid Layer · MermaidSubgraph
          </span>
          <div className="flex items-center gap-1 text-[10px] text-gray-600">
            <span>Layer band</span>
            <input
              type="number"
              min={1}
              className={`${uiPanelKeyValueInputClass} w-14 h-5 px-1 text-[10px]`}
              value={activeLayerBandIndex ?? ''}
              onChange={e => {
                const raw = e.target.value
                if (!raw) {
                  setActiveLayerBandIndex(null)
                  return
                }
                const n = Number(raw)
                if (!Number.isFinite(n) || n <= 0) {
                  setActiveLayerBandIndex(null)
                  return
                }
                setActiveLayerBandIndex(n)
              }}
            />
            <button
              type="button"
              className="App-toolbar__btn text-[10px] bg-gray-100 text-gray-700"
              onClick={() => setActiveLayerBandIndex(null)}
            >
              Clear
            </button>
          </div>
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
      <GraphLayerMetadataPresetsSection
        schema={schema}
        uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
      />
    </div>
  )
}
