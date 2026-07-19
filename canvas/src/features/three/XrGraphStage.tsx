import React from 'react'
import type { Group } from 'three'
import type { GraphData } from '@/lib/graph/types'
import { XrMotionReferenceStage } from '@/features/three/XrMotionReferenceStage'
import { XrPhysicsStageRuntime } from '@/features/three/XrPhysicsStageRuntime'
import { XrNativeControllerDemoStage } from '@/features/three/XrNativeControllerDemoStage'
import { XrNativeControllerDemoSceneAtmosphere } from '@/features/three/XrNativeControllerDemoEnvironment'
import {
  readXrNativeControllerDemo,
  subscribeXrNativeControllerDemo,
} from '@/features/three/xrNativeControllerDemoRuntime'
import { resolveXrMotionReferenceStage } from '@/features/three/xrMotionReferenceModel'
import {
  readXrMotionReferenceRuntime,
  subscribeXrMotionReferenceRuntime,
} from '@/features/three/xrMotionReferenceRuntime'
import {
  XR_MOTION_STAGE_GROUND_Y,
  XR_MOTION_STAGE_SPAN,
} from '@/features/three/xrMotionReferenceCoordinates'

export { XR_MOTION_STAGE_SPAN } from '@/features/three/xrMotionReferenceCoordinates'
export const XR_MOTION_STAGE_FLOOR_DEPTH = -72

export function XrGraphStage({ data }: { data: GraphData }) {
  const stageRootRef = React.useRef<Group | null>(null)
  const runtime = React.useSyncExternalStore(
    subscribeXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
  )
  const controllerDemo = React.useSyncExternalStore(
    subscribeXrNativeControllerDemo,
    readXrNativeControllerDemo,
    readXrNativeControllerDemo,
  )
  const stage = resolveXrMotionReferenceStage(runtime.plan.stageId)
  const stageScale = XR_MOTION_STAGE_SPAN / Math.max(stage.sizeMeters[0], stage.sizeMeters[1], 1)
  return (
    <>
      {controllerDemo.phase !== 'off' ? (
        <XrNativeControllerDemoSceneAtmosphere stageScale={stageScale} />
      ) : null}
      <group ref={stageRootRef} name="kg_graph_xr_stage">
        {controllerDemo.phase === 'off' ? (
          <>
            <XrMotionReferenceStage
              graphData={data}
              span={XR_MOTION_STAGE_SPAN}
              groundY={XR_MOTION_STAGE_GROUND_Y}
              coordinateRootRef={stageRootRef}
            />
            <XrPhysicsStageRuntime stageScale={stageScale} groundY={XR_MOTION_STAGE_GROUND_Y} />
          </>
        ) : null}
        <XrNativeControllerDemoStage stageScale={stageScale} groundY={XR_MOTION_STAGE_GROUND_Y} />
      </group>
    </>
  )
}
