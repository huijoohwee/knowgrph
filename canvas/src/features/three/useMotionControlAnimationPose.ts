import React from 'react'
import { motionControlPoseToAnimationPose } from './motionControlPose'
import { readMotionControlSnapshot, subscribeMotionControl } from './motionControlRuntime'
import type { XrMotionReferenceSubject } from './xrMotionReferenceModel'
import { resolveXrSceneLibraryAsset } from './xrSceneLibrary'
import { readBoundXrSelectedActorId } from './xrSelectedActorBinding'

export function resolveMotionControlSubjectPose(
  subject: Pick<XrMotionReferenceSubject, 'id' | 'assetId'>,
  motionActorId: string,
  livePose: ReturnType<typeof motionControlPoseToAnimationPose>,
) {
  return livePose && subject.id === motionActorId && resolveXrSceneLibraryAsset(subject.assetId).shape === 'humanoid'
    ? livePose
    : null
}

export function useMotionControlAnimationPose() {
  const motionControl = React.useSyncExternalStore(
    subscribeMotionControl,
    readMotionControlSnapshot,
    readMotionControlSnapshot,
  )
  return {
    motionActorId: readBoundXrSelectedActorId(),
    livePose: motionControlPoseToAnimationPose(motionControl.pose),
  }
}
