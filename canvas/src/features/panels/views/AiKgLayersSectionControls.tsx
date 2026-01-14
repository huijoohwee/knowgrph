import type { GraphSchema } from '@/lib/graph/schema'
import AiKgLayerModeControls from './AiKgLayers/AiKgLayerModeControls'
import AiKgSemanticControls from './AiKgLayers/AiKgSemanticControls'
import AiKgOpacityControls from './AiKgLayers/AiKgOpacityControls'
import AiKgForceControls from './AiKgLayers/AiKgForceControls'
import AiKgVisualControls from './AiKgLayers/AiKgVisualControls'

type AiKgLayersControlsProps = {
  schema: GraphSchema
  setSchema: (schema: GraphSchema) => void
  setThreeConfig: (config: Partial<GraphSchema['three']>) => void
  setCharge: (charge: number) => void
  setCollisionByType: (type: string, radius: number) => void
  traversalDelayMs: number
  setTraversalDelayMs: (ms: number) => void
  uiPanelKeyValueInputClass: string
}

export default function AiKgLayersControls({
  schema,
  setSchema,
  setThreeConfig,
  setCharge,
  setCollisionByType,
  traversalDelayMs,
  setTraversalDelayMs,
  uiPanelKeyValueInputClass,
}: AiKgLayersControlsProps) {
  return (
    <div className="mt-1 space-y-1">
      <AiKgLayerModeControls
        schema={schema}
        setSchema={setSchema}
        uiPanelKeyValueInputClass={uiPanelKeyValueInputClass}
      />
      <AiKgSemanticControls
        schema={schema}
        setSchema={setSchema}
        uiPanelKeyValueInputClass={uiPanelKeyValueInputClass}
      />
      <AiKgOpacityControls
        schema={schema}
        setThreeConfig={setThreeConfig}
        uiPanelKeyValueInputClass={uiPanelKeyValueInputClass}
      />
      <AiKgForceControls
        schema={schema}
        setSchema={setSchema}
        setCharge={setCharge}
        setCollisionByType={setCollisionByType}
        traversalDelayMs={traversalDelayMs}
        setTraversalDelayMs={setTraversalDelayMs}
        uiPanelKeyValueInputClass={uiPanelKeyValueInputClass}
      />
      <AiKgVisualControls
        schema={schema}
        setSchema={setSchema}
        setThreeConfig={setThreeConfig}
        uiPanelKeyValueInputClass={uiPanelKeyValueInputClass}
      />
    </div>
  )
}
