import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { UI_ANCHORS, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import AiKgLayersControls from '@/features/panels/views/AiKgLayersSectionControls'
interface AiKgLayersSectionProps {
  schema: GraphSchema
  setSchema: (schema: GraphSchema) => void
  setThreeConfig: (config: Partial<GraphSchema['three']>) => void
  setCharge: (charge: number) => void
  setCollisionByType: (type: string, radius: number) => void
  traversalDelayMs: number
  setTraversalDelayMs: (ms: number) => void
}

export default function AiKgLayersSection({
  schema,
  setSchema,
  setThreeConfig,
  setCharge,
  setCollisionByType,
  traversalDelayMs,
  setTraversalDelayMs,
}: AiKgLayersSectionProps) {
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass ||
      'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right',
  )
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )

  return (
    <div
      className="mt-2 border border-gray-200 rounded px-2 py-1"
      data-kg-anchor={UI_ANCHORS.ragGraphRAGWorkflow}
    >
      <div
        className={[
          uiPanelKeyValueTextSizeClass,
          uiPanelTextFontClass,
          'font-semibold uppercase tracking-wide text-gray-500 mb-1',
        ].join(' ')}
      >
        {UI_LABELS.ragGraphRAGWorkflow}
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
  )
}
