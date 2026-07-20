import {
  XR_ANIMATION_PRESETS,
  xrAnimationPresetCompatible,
} from './xrAnimationCatalog'
import {
  buildXrAnimationInvocation,
  buildXrAnimationTransportInvocation,
  inspectLocalAnimation,
} from './xrAnimationMcpRuntime'
import { buildXrPhysicsInvocation } from './xrSceneMcpContract.mjs'
import { inspectLocalXrSceneAssets } from './xrSceneMcpRuntime'
import { readXrMotionReferenceRuntime } from './xrMotionReferenceRuntime'
import { readBoundXrSelectedActorId } from './xrSelectedActorBinding'
import { resolveXrSceneLibraryAsset } from './xrSceneLibrary'
import { MOTION_CONTROL_SURFACE_CATALOG } from './motionControlSurfaceRuntime'

export function buildMotionControlXrControllerInvocation(controller: Readonly<{
  mode: 'ball' | 'rocket'
  phase: 'off' | 'ready' | 'running' | 'paused'
}>): string {
  return controller.phase === 'off'
    ? buildXrPhysicsInvocation('controller', 'develop-run', { mode: controller.mode })
    : buildXrPhysicsInvocation('controller', 'reset')
}

export function inspectMotionControlTargets() {
  const runtime = readXrMotionReferenceRuntime()
  const scene = inspectLocalXrSceneAssets()
  const animation = inspectLocalAnimation()
  const controller = scene.physics.controllerDemo
  const actorId = readBoundXrSelectedActorId()
  const track = runtime.plan.cast.find(candidate => candidate.actorId === actorId)
  const subject = runtime.plan.subjects.find(candidate => candidate.id === actorId)
  const selectedAsset = subject ? resolveXrSceneLibraryAsset(subject.assetId) : null
  const humanoidCompatible = Boolean(track && (!selectedAsset || selectedAsset.shape === 'humanoid'))
  const compatiblePreset = track
    ? XR_ANIMATION_PRESETS.find(preset => xrAnimationPresetCompatible({
      preset,
      assetId: subject?.assetId,
      category: subject?.category,
      graphActor: !subject,
    }))
    : null
  const assignedPreset = track?.animation
    ? XR_ANIMATION_PRESETS.find(preset => preset.id === track.animation?.presetId)
    : null
  const animationPreset = assignedPreset || compatiblePreset
  return {
    selectedHumanoid: {
      actorId,
      label: subject?.label || track?.label || '',
      compatible: humanoidCompatible,
      assignedPresetId: track?.animation?.presetId || '',
    },
    surfaces: {
      xr3d: {
        ...MOTION_CONTROL_SURFACE_CATALOG['xr-3d'],
        sceneReady: scene.sceneReady,
        subjectCount: scene.runtime.subjects.length,
        controllerMode: controller.mode,
        controllerPhase: controller.phase,
        invocation: buildMotionControlXrControllerInvocation(controller),
        webMcpTool: scene.webMcpTools.control,
      },
      animation: {
        ...MOTION_CONTROL_SURFACE_CATALOG.animation,
        sceneReady: animation.sceneReady,
        invocation: animationPreset
          ? buildXrAnimationInvocation(animationPreset.id)
          : buildXrAnimationTransportInvocation('play'),
        webMcpTool: animation.webMcpTools.control,
      },
    },
  }
}
