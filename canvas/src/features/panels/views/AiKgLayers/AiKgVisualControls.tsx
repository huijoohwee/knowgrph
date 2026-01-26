import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import ThreeSizingAndWidthControls from '@/features/panels/views/shared/ThreeSizingAndWidthControls'

type AiKgVisualControlsProps = {
  schema: GraphSchema
  setThreeConfig: (config: Partial<GraphSchema['three']>) => void
  uiPanelKeyValueInputClass: string
}

export default function AiKgVisualControls({
  schema,
  setThreeConfig,
  uiPanelKeyValueInputClass,
}: AiKgVisualControlsProps) {
  return (
    <>
      <ThreeSizingAndWidthControls
        schema={schema}
        setThreeConfig={setThreeConfig}
        uiPanelKeyValueInputClass={uiPanelKeyValueInputClass}
        variant="aiKg"
      />
    </>
  )
}
