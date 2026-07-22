import React from 'react'
import type { GraphData } from '@/lib/graph/types'
import { XrCanonicalPhysicsStage } from '@/features/three/XrCanonicalPhysicsStage'

const XrMotionReferenceGraphStageLazy = React.lazy(() =>
  import('@/features/three/XrMotionReferenceGraphStage').then(mod => ({
    default: mod.XrMotionReferenceGraphStage,
  })),
)

export type XrGraphStageAuthority = 'native-controller' | 'motion-reference'

export function XrSceneStage({
  authority,
  data,
  paused,
}: {
  authority?: XrGraphStageAuthority
  data: GraphData
  paused: boolean
}) {
  if (authority === 'native-controller') return <XrCanonicalPhysicsStage paused={paused} />
  if (authority === 'motion-reference') return <XrMotionReferenceGraphStageLazy data={data} paused={paused} />
  return null
}
