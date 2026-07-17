import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { readStrybldrCameraSettings } from '@/features/strybldr/strybldrCamera'
import {
  XR_CAMERA_MOVE_PRESETS,
  buildXrCameraMoveMarkDrafts,
} from '@/features/three/xrCameraMoveCatalog'
import {
  readXrMotionReferencePlan,
  sampleXrMotionReferenceCameraPose,
  serializeXrMotionReferencePlan,
} from '@/features/three/xrMotionReferenceModel'
import { buildXrMotionReferencePackage } from '@/features/three/xrMotionReferencePackage'

const nodes: readonly GraphNode[] = [
  { id: 'actor-a', label: 'Lead', type: 'Person', properties: {} },
]

const graphData: GraphData = {
  type: 'Graph',
  nodes: [...nodes],
  edges: [],
  metadata: {},
}

const baseSettings = readStrybldrCameraSettings({ shot: 'medium', focalLengthMm: 50 })

function movingActorPlan(moveId: (typeof XR_CAMERA_MOVE_PRESETS)[number]['id']) {
  const camera = buildXrCameraMoveMarkDrafts({
    moveId,
    anchorId: 'actor-a',
    playheadSeconds: 0,
    moveDurationSeconds: 4,
    planDurationSeconds: 4,
    settings: baseSettings,
  })
  return readXrMotionReferencePlan({
    durationSeconds: 4,
    fps: 6,
    cast: [{
      actorId: 'actor-a',
      marks: [
        { timeSeconds: 0, position: [0, 0, 0], transition: 'linear', gait: 'walk' },
        { timeSeconds: 4, position: [4, 0, 0], transition: 'linear', gait: 'walk' },
      ],
    }],
    camera,
  }, nodes)
}

function distance(pose: NonNullable<ReturnType<typeof sampleXrMotionReferenceCameraPose>>): number {
  return Math.hypot(
    pose.position[0] - pose.target[0],
    pose.position[1] - pose.target[1],
    pose.position[2] - pose.target[2],
  )
}

function assertNear(actual: number, expected: number, message: string, epsilon = 0.002): void {
  if (Math.abs(actual - expected) > epsilon) throw new Error(`${message}: expected ${expected}, got ${actual}`)
}

export function testXrCameraMovesRideSubjectsAndExport() {
  const expectedMoveIds = [
    'orbit-clockwise',
    'orbit-counterclockwise',
    'crane-rise',
    'crane-descend',
    'drone-follow',
    'vertigo-dolly-zoom',
  ]
  if (JSON.stringify(XR_CAMERA_MOVE_PRESETS.map(preset => preset.id)) !== JSON.stringify(expectedMoveIds)) {
    throw new Error('expected the native XR Camera move catalog to expose all six documented presets')
  }

  for (const preset of XR_CAMERA_MOVE_PRESETS) {
    const plan = movingActorPlan(preset.id)
    if (plan.camera.length !== 2 || plan.camera.some(mark => mark.anchorId !== 'actor-a' || mark.moveId !== preset.id)) {
      throw new Error(`expected ${preset.id} to author two subject-bound Camera marks`)
    }
  }

  const followPlan = movingActorPlan('drone-follow')
  const followStart = sampleXrMotionReferenceCameraPose(followPlan.camera, 0, followPlan.cast)
  const followMiddle = sampleXrMotionReferenceCameraPose(followPlan.camera, 2, followPlan.cast)
  if (!followStart || !followMiddle) throw new Error('expected drone follow poses')
  assertNear(followMiddle.target[0], 2, 'drone follow target must ride the moving actor')
  for (let axis = 0; axis < 3; axis += 1) {
    assertNear(
      followMiddle.position[axis]! - followMiddle.target[axis]!,
      followStart.position[axis]! - followStart.target[axis]!,
      `drone follow must retain its relative offset on axis ${axis}`,
    )
  }

  const orbitPlan = movingActorPlan('orbit-clockwise')
  const orbitStart = sampleXrMotionReferenceCameraPose(orbitPlan.camera, 0, orbitPlan.cast)
  const orbitMiddle = sampleXrMotionReferenceCameraPose(orbitPlan.camera, 2, orbitPlan.cast)
  const orbitEnd = sampleXrMotionReferenceCameraPose(orbitPlan.camera, 4, orbitPlan.cast)
  if (!orbitStart || !orbitMiddle || !orbitEnd) throw new Error('expected orbit poses')
  assertNear(orbitMiddle.target[0], 2, 'orbit target must ride the moving actor')
  assertNear(distance(orbitMiddle), distance(orbitStart), 'orbit must retain its subject radius')
  assertNear(distance(orbitEnd), distance(orbitStart), 'orbit end must retain its subject radius')

  const vertigoPlan = movingActorPlan('vertigo-dolly-zoom')
  const vertigoStart = sampleXrMotionReferenceCameraPose(vertigoPlan.camera, 0, vertigoPlan.cast)
  const vertigoEnd = sampleXrMotionReferenceCameraPose(vertigoPlan.camera, 4, vertigoPlan.cast)
  if (!vertigoStart || !vertigoEnd) throw new Error('expected vertigo dolly-zoom poses')
  const startLens = vertigoPlan.camera[0]!.settings.focalLengthMm
  const endLens = vertigoPlan.camera[1]!.settings.focalLengthMm
  if (startLens !== 28 || endLens !== 105 || !(distance(vertigoEnd) > distance(vertigoStart))) {
    throw new Error('expected vertigo dolly-zoom to zoom in while dollying away')
  }
  assertNear(distance(vertigoStart) / startLens, distance(vertigoEnd) / endLens, 'vertigo subject-scale ratio')

  const roundTrip = readXrMotionReferencePlan(serializeXrMotionReferencePlan(vertigoPlan), nodes)
  if (roundTrip.camera.some(mark => mark.moveId !== 'vertigo-dolly-zoom')) {
    throw new Error('expected Camera move identity to survive serialization')
  }
  const bundle = buildXrMotionReferencePackage({ plan: followPlan, graphData, documentName: 'Subject follow.md' })
  const manifest = JSON.parse(bundle.files.find(file => file.path === 'reference/manifest.json')?.text || '{}') as { cameraMoves?: unknown }
  const frames = JSON.parse(bundle.files.find(file => file.path === 'reference/frame-samples.json')?.text || '[]') as Array<Record<string, unknown>>
  const middleFrame = frames.find(frame => frame.timeSeconds === 2)
  if (JSON.stringify(manifest.cameraMoves) !== JSON.stringify(['drone-follow'])
    || middleFrame?.cameraMove !== 'drone-follow'
    || (middleFrame?.camera as { target?: number[] } | undefined)?.target?.[0] !== 2) {
    throw new Error('expected the video-generator package to export the moving-subject Camera move per frame')
  }

  const source = (...parts: string[]) => readFileSync(resolve(process.cwd(), 'src', ...parts), 'utf8')
  const moveControlSource = source('features', 'strybldr', 'XrCameraMovePresetControl.tsx')
  const timelineSource = source('features', 'three', 'XrCameraMotionSection.tsx')
  for (const marker of [
    'data-kg-xr-camera-move-controls="floating-camera-only"',
    'data-kg-xr-camera-move-timeline-owner="bottom-panel"',
    'data-kg-xr-camera-move-select="1"',
    'data-kg-xr-camera-move-apply="1"',
  ]) {
    if (!moveControlSource.includes(marker)) throw new Error(`expected the Floating Camera move control to expose ${marker}`)
  }
  if (timelineSource.includes('XrCameraMovePresetControl')) {
    throw new Error('expected BottomPanel Timeline to remain the sole mark editor without duplicating Camera move controls')
  }

  const nativeRuntimeFiles = [
    source('features', 'three', 'xrCameraMoveCatalog.ts'),
    source('features', 'three', 'xrCameraMoveRuntime.ts'),
    source('features', 'three', 'xrMotionReferenceSampling.ts'),
  ]
  if (nativeRuntimeFiles.some(text => text.toLowerCase().includes('blockout'))) {
    throw new Error('expected native Camera move runtime files to contain no copied external implementation identifiers')
  }
  const packageJson = readFileSync(resolve(process.cwd(), '..', 'package.json'), 'utf8').toLowerCase()
  if (packageJson.includes('wassermanproductions') || packageJson.includes('blockout')) {
    throw new Error('expected no external inspiration repository dependency')
  }
}
