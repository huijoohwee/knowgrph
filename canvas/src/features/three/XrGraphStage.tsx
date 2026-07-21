import React from 'react'
import type { Group } from 'three'
import type { GraphData } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isXrPhysicsRunReadyDemoActive } from '@/features/workspace-fs/workspaceRunReadyDemos'
import { XrMotionReferenceStage } from '@/features/three/XrMotionReferenceStage'
import { XrPhysicsStageRuntime } from '@/features/three/XrPhysicsStageRuntime'
import { XrNativeControllerDemoStage } from '@/features/three/XrNativeControllerDemoStage'
import { XrNativeControllerDemoSceneAtmosphere } from '@/features/three/XrNativeControllerDemoEnvironment'
import {
  XR_NATIVE_CONTROLLER_DEMO_STAGE_SCALE,
  readXrNativeControllerDemo,
  setSharedXrNativeControllerDemoTerrain,
  subscribeXrNativeControllerDemo,
} from '@/features/three/xrNativeControllerDemoRuntime'
import {
  readXrMotionReferenceRuntime,
  subscribeXrMotionReferenceRuntime,
} from '@/features/three/xrMotionReferenceRuntime'
import {
  XR_MOTION_STAGE_GROUND_Y,
  XR_MOTION_STAGE_SPAN,
} from '@/features/three/xrMotionReferenceCoordinates'
import { stopMotionControl } from '@/features/three/motionControlRuntime'
import {
  resolveXrCanonicalSceneProjection,
  resolveXrCanonicalSceneSpatialSource,
} from './xrCanonicalSceneSpatialSource'

export { XR_MOTION_STAGE_SPAN } from '@/features/three/xrMotionReferenceCoordinates'
export const XR_MOTION_STAGE_FLOOR_DEPTH = -72

function stopMotionControlAfterXrUnmount() {
  queueMicrotask(() => {
    const state = useGraphStore.getState()
    if (state.canvasRenderMode === '3d' && state.canvas3dMode === 'xr') return
    void stopMotionControl('Motion Control stopped when XR Mode closed.')
  })
}

export function XrGraphStage({ data, paused = false }: { data: GraphData; paused?: boolean }) {
  React.useEffect(() => stopMotionControlAfterXrUnmount, [])
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
  const markdownDocumentName = useGraphStore(state => state.markdownDocumentName)
  const markdownDocumentText = useGraphStore(state => state.markdownDocumentText)
  const runReadyDemo = isXrPhysicsRunReadyDemoActive(markdownDocumentName, markdownDocumentText)
  const projection = resolveXrCanonicalSceneProjection({
    controllerPhase: controllerDemo.phase,
    physicsRunReady: runReadyDemo,
  })
  const { stage } = resolveXrCanonicalSceneSpatialSource({
    projection,
    stageId: runtime.plan.stageId,
  })
  const stageScale = runReadyDemo
    ? XR_NATIVE_CONTROLLER_DEMO_STAGE_SCALE
    : XR_MOTION_STAGE_SPAN / Math.max(stage.sizeMeters[0], stage.sizeMeters[1], 1)
  const nativeControllerOwnsStage = projection === 'native-controller'
  React.useEffect(() => {
    if (nativeControllerOwnsStage) setSharedXrNativeControllerDemoTerrain(stage.id)
  }, [nativeControllerOwnsStage, stage.id])
  return (
    <>
      {nativeControllerOwnsStage ? (
        <XrNativeControllerDemoSceneAtmosphere stageScale={stageScale} />
      ) : null}
      <group ref={stageRootRef} name="kg_graph_xr_stage">
        {!nativeControllerOwnsStage ? (
          <>
            <XrMotionReferenceStage
              graphData={data}
              span={XR_MOTION_STAGE_SPAN}
              groundY={XR_MOTION_STAGE_GROUND_Y}
              coordinateRootRef={stageRootRef}
              paused={paused}
            />
            <XrPhysicsStageRuntime
              stageScale={stageScale}
              groundY={XR_MOTION_STAGE_GROUND_Y}
              paused={paused}
            />
          </>
        ) : null}
        <XrNativeControllerDemoStage
          inputEnabled={!paused}
          stageScale={stageScale}
          groundY={XR_MOTION_STAGE_GROUND_Y}
          retainStage={runReadyDemo}
          stage={stage}
        />
      </group>
    </>
  )
}
