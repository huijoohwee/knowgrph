import React from 'react'
import { sampleXrAnimationPose } from './xrAnimationCatalog'
import {
  sampleXrMotionReferenceFacingY,
  sampleXrMotionReferenceMarks,
} from './xrMotionReferenceModel'
import {
  readXrMotionReferenceRuntime,
  subscribeXrMotionReferenceRuntime,
} from './xrMotionReferenceRuntime'
import { selectBoundXrShotTarget } from './xrSelectedActorBinding'
import { XrSceneLibrarySubject } from './XrSceneLibrarySubject'
import { xrMotionReferenceWorldPosition } from './xrMotionReferenceCoordinates'

export function XrNativeControllerAuthoredSubjects() {
  const runtime = React.useSyncExternalStore(
    subscribeXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
  )
  return (
    <group
      name="kg_xr_native_controller_authored_subjects"
      userData={{ source: runtime.plan.schema, subjectCount: runtime.plan.subjects.length }}
    >
      {runtime.plan.subjects.map(subject => {
        const track = runtime.plan.cast.find(candidate => candidate.actorId === subject.id)
        const subjectPosition = track
          ? sampleXrMotionReferenceMarks(track.marks, runtime.playheadSeconds)
          : subject.position
        return (
          <XrSceneLibrarySubject
            key={subject.id}
            animationPose={sampleXrAnimationPose(track?.animation || null, runtime.playheadSeconds)}
            facingYRadians={track ? sampleXrMotionReferenceFacingY(track.marks, runtime.playheadSeconds) : 0}
            subject={subject}
            position={xrMotionReferenceWorldPosition(subjectPosition, 1, 0)}
            stageScale={1}
            selected={runtime.selectedShotTargetId === subject.id}
            onSelect={() => selectBoundXrShotTarget(subject.id)}
          />
        )
      })}
    </group>
  )
}
