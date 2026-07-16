import React from 'react'
import type { GraphData } from '@/lib/graph/types'
import { XrMotionReferenceStage } from '@/features/three/XrMotionReferenceStage'
import {
  XR_MOTION_STAGE_GROUND_Y,
  XR_MOTION_STAGE_SPAN,
} from '@/features/three/xrMotionReferenceCoordinates'

export { XR_MOTION_STAGE_SPAN } from '@/features/three/xrMotionReferenceCoordinates'
export const XR_MOTION_STAGE_FLOOR_DEPTH = -72

export function XrGraphStage({ data }: { data: GraphData }) {
  return (
    <group name="kg_graph_xr_stage">
      <XrMotionReferenceStage
        graphData={data}
        span={XR_MOTION_STAGE_SPAN}
        groundY={XR_MOTION_STAGE_GROUND_Y}
      />
    </group>
  )
}
