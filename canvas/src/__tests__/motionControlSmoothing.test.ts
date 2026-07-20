import {
  resolveMotionControlPoseSmoothingAlpha,
  smoothMotionControlPose,
  type MotionControlPoseFrame,
} from '@/features/three/motionControlPose'

const landmark = (x: number) => Object.freeze({
  x,
  y: 0.5,
  z: 0,
  visibility: 1,
  presence: 1,
})

function poseFrame(timestampMs: number, x: number): MotionControlPoseFrame {
  const landmarks = Object.freeze([landmark(x)])
  return Object.freeze({ timestampMs, confidence: 1, landmarks, worldLandmarks: landmarks })
}

function smoothAtRate(framesPerSecond: number): MotionControlPoseFrame {
  const target = poseFrame(1_000, 0.2)
  let current = poseFrame(0, 0)
  for (let index = 1; index <= framesPerSecond; index += 1) {
    current = smoothMotionControlPose(current, Object.freeze({
      ...target,
      timestampMs: index * 1_000 / framesPerSecond,
    }))
  }
  return current
}

export function testMotionControlSmoothingIsInferenceRateInvariant(): void {
  const smoothedAt30 = smoothAtRate(30)
  const smoothedAt120 = smoothAtRate(120)
  if (Math.abs(smoothedAt30.landmarks[0]!.x - smoothedAt120.landmarks[0]!.x) > 1e-9
    || resolveMotionControlPoseSmoothingAlpha(1 / 120) >= resolveMotionControlPoseSmoothingAlpha(1 / 30)
    || smoothMotionControlPose(smoothedAt30, poseFrame(smoothedAt30.timestampMs, 1)) !== smoothedAt30
    || smoothMotionControlPose(smoothedAt30, poseFrame(smoothedAt30.timestampMs - 1, 1)) !== smoothedAt30) {
    throw new Error('expected time-derived pose smoothing to preserve its one-second response across inference rates')
  }
}
