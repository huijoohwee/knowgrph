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
import { resolveXrMotionReferenceStage } from '@/features/three/xrMotionReferenceModel'
import {
  readXrMotionReferenceRuntime,
  subscribeXrMotionReferenceRuntime,
} from '@/features/three/xrMotionReferenceRuntime'
import {
  XR_MOTION_STAGE_GROUND_Y,
  XR_MOTION_STAGE_SPAN,
} from '@/features/three/xrMotionReferenceCoordinates'
import { stopMotionControl } from '@/features/three/motionControlRuntime'
import { readGameModeSnapshot, subscribeGameModeSnapshot } from '@/features/game-fps/gameModeRuntime'

export { XR_MOTION_STAGE_SPAN } from '@/features/three/xrMotionReferenceCoordinates'
export const XR_MOTION_STAGE_FLOOR_DEPTH = -72

function stopMotionControlAfterXrUnmount() {
  queueMicrotask(() => {
    const state = useGraphStore.getState()
    if (state.canvasRenderMode === '3d' && state.canvas3dMode === 'xr') return
    void stopMotionControl('Motion Control stopped when XR Mode closed.')
  })
}

export function XrGraphStage({ data }: { data: GraphData }) {
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
  const gameMode = React.useSyncExternalStore(
    subscribeGameModeSnapshot,
    readGameModeSnapshot,
    readGameModeSnapshot,
  )
  const stage = resolveXrMotionReferenceStage(runtime.plan.stageId)
  const markdownDocumentName = useGraphStore(state => state.markdownDocumentName)
  const markdownDocumentText = useGraphStore(state => state.markdownDocumentText)
  const runReadyDemo = isXrPhysicsRunReadyDemoActive(markdownDocumentName, markdownDocumentText)
  const stageScale = runReadyDemo
    ? XR_NATIVE_CONTROLLER_DEMO_STAGE_SCALE
    : XR_MOTION_STAGE_SPAN / Math.max(stage.sizeMeters[0], stage.sizeMeters[1], 1)
  const nativeControllerOwnsStage = runReadyDemo || controllerDemo.phase !== 'off'
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
            />
            <XrPhysicsStageRuntime stageScale={stageScale} groundY={XR_MOTION_STAGE_GROUND_Y} />
          </>
        ) : null}
        <XrNativeControllerDemoStage
          inputEnabled={!gameMode.active}
          stageScale={stageScale}
          groundY={XR_MOTION_STAGE_GROUND_Y}
          retainStage={runReadyDemo}
          stage={stage}
        />
      </group>
    </>
  )
}
