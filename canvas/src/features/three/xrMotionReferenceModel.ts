import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'
import { resolveCameraFramingPose, type CameraFramingPose } from '@/lib/camera/cameraFramingPose'
import {
  readStrybldrCameraSettings,
  serializeStrybldrCameraSettings,
  type StrybldrCameraSettings,
} from '@/features/strybldr/strybldrCamera'

export const XR_MOTION_REFERENCE_GRAPH_METADATA_KEY = 'kgXrMotionReference'
export const XR_MOTION_REFERENCE_SCHEMA = 'knowgrph-xr-motion-reference/v1'
export const XR_MOTION_REFERENCE_PACKAGE_SCHEMA = 'knowgrph-xr-motion-reference-package/v1'

export type XrMotionReferenceStageId = 'neutral-volume' | 'street-grid' | 'loading-bay'
export type XrMotionReferenceTransition = 'linear' | 'hold'
export type XrMotionReferenceVector = readonly [number, number, number]

export type XrGreyBoxStructure = Readonly<{
  id: string
  position: XrMotionReferenceVector
  size: XrMotionReferenceVector
  tone: 'light' | 'mid' | 'dark' | 'accent'
}>

export type XrMotionReferenceStagePreset = Readonly<{
  id: XrMotionReferenceStageId
  label: string
  description: string
  sizeMeters: readonly [number, number]
  structures: readonly XrGreyBoxStructure[]
}>

export type XrMotionReferenceMark = Readonly<{
  id: string
  timeSeconds: number
  position: XrMotionReferenceVector
  transition: XrMotionReferenceTransition
}>

export type XrMotionReferenceCastTrack = Readonly<{
  actorId: string
  label: string
  color: string
  marks: readonly XrMotionReferenceMark[]
}>

export type XrMotionReferenceCameraMark = Readonly<{
  id: string
  timeSeconds: number
  anchorId: string
  settings: Readonly<StrybldrCameraSettings>
  pose: CameraFramingPose
}>

export type XrMotionReferencePlan = Readonly<{
  schema: typeof XR_MOTION_REFERENCE_SCHEMA
  stageId: XrMotionReferenceStageId
  durationSeconds: number
  fps: number
  cast: readonly XrMotionReferenceCastTrack[]
  camera: readonly XrMotionReferenceCameraMark[]
}>

export type XrMotionReferencePackageFile = Readonly<{
  path: string
  mimeType: string
  text: string
}>

export type XrMotionReferencePackage = Readonly<{
  schema: typeof XR_MOTION_REFERENCE_PACKAGE_SCHEMA
  packageId: string
  title: string
  referenceBoundary: Readonly<{
    implementation: 'native-knowgrph'
    inspirationCitation: 'documentation-only'
    copyPolicy: 'no-external-code-assets-or-schemas'
    dependencyPolicy: 'no-external-runtime'
    runtimeDependency: false
  }>
  source: Readonly<{
    documentName: string
    graphFingerprint: string
    motionFingerprint: string
    graphType: string
    nodeCount: number
    edgeCount: number
  }>
  stage: Readonly<{
    id: XrMotionReferenceStageId
    label: string
    sizeMeters: readonly [number, number]
  }>
  timeline: Readonly<{
    durationSeconds: number
    fps: number
    frameCount: number
  }>
  files: readonly XrMotionReferencePackageFile[]
}>

const MAX_CAST_TRACKS = 12
export const XR_MOTION_REFERENCE_MAX_CAST_MARKS = 32
export const XR_MOTION_REFERENCE_MAX_CAMERA_MARKS = 32
const MIN_DURATION_SECONDS = 1
const MAX_DURATION_SECONDS = 30
const MIN_FPS = 6
const MAX_FPS = 30
const MAX_COORDINATE_METERS = 50
export const XR_MOTION_REFERENCE_CAMERA_BASELINE_METERS = 8

const CAST_COLORS = [
  '#38bdf8', '#f97316', '#a78bfa', '#22c55e', '#f43f5e', '#eab308',
  '#14b8a6', '#ec4899', '#60a5fa', '#84cc16', '#fb7185', '#c084fc',
] as const

export const XR_MOTION_REFERENCE_STAGE_PRESETS: readonly XrMotionReferenceStagePreset[] = [
  {
    id: 'neutral-volume',
    label: 'Neutral Volume',
    description: 'Open rehearsal floor with framing flats and a raised focus deck.',
    sizeMeters: [16, 12],
    structures: [
      { id: 'back-flat', position: [0, 2.4, -5.7], size: [16, 4.8, 0.3], tone: 'mid' },
      { id: 'left-flat', position: [-7.7, 1.8, 0], size: [0.3, 3.6, 12], tone: 'dark' },
      { id: 'right-flat', position: [7.7, 1.8, 0], size: [0.3, 3.6, 12], tone: 'dark' },
      { id: 'focus-deck', position: [0, 0.2, 2.7], size: [5.2, 0.4, 2.4], tone: 'light' },
    ],
  },
  {
    id: 'street-grid',
    label: 'Street Grid',
    description: 'Road channel, walkable edges, and neutral building masses for exterior blocking.',
    sizeMeters: [20, 14],
    structures: [
      { id: 'west-block', position: [-7.6, 2.8, 0], size: [4.2, 5.6, 13], tone: 'mid' },
      { id: 'east-block', position: [7.6, 3.4, 0], size: [4.2, 6.8, 13], tone: 'dark' },
      { id: 'west-walk', position: [-4.8, 0.15, 0], size: [1.4, 0.3, 13], tone: 'light' },
      { id: 'east-walk', position: [4.8, 0.15, 0], size: [1.4, 0.3, 13], tone: 'light' },
      { id: 'crossing', position: [0, 0.04, 1.8], size: [8.2, 0.08, 1.4], tone: 'accent' },
    ],
  },
  {
    id: 'loading-bay',
    label: 'Loading Bay',
    description: 'Deep industrial floor with columns, dock, and movable grey-box obstacles.',
    sizeMeters: [18, 14],
    structures: [
      { id: 'rear-wall', position: [0, 3, -6.7], size: [18, 6, 0.3], tone: 'dark' },
      { id: 'dock', position: [0, 0.65, -4.8], size: [8, 1.3, 3], tone: 'mid' },
      { id: 'column-a', position: [-5.4, 2.2, 0], size: [0.6, 4.4, 0.6], tone: 'light' },
      { id: 'column-b', position: [5.4, 2.2, 0], size: [0.6, 4.4, 0.6], tone: 'light' },
      { id: 'crate-a', position: [-2.8, 0.75, 2.4], size: [1.5, 1.5, 1.5], tone: 'accent' },
      { id: 'crate-b', position: [3.1, 1.1, 1.4], size: [2.2, 2.2, 2.2], tone: 'mid' },
    ],
  },
]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function round(value: number, places = 4): number {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

function normalizeDuration(value: unknown): number {
  return round(clamp(finiteNumber(value, 6), MIN_DURATION_SECONDS, MAX_DURATION_SECONDS), 2)
}

function normalizeFps(value: unknown): number {
  return Math.round(clamp(finiteNumber(value, 12), MIN_FPS, MAX_FPS))
}

function normalizeTime(value: unknown, durationSeconds: number): number {
  return round(clamp(finiteNumber(value, 0), 0, durationSeconds), 3)
}

function normalizeVector(value: unknown, fallback: XrMotionReferenceVector = [0, 0, 0]): XrMotionReferenceVector {
  if (!Array.isArray(value) || value.length < 3) return Object.freeze([...fallback]) as unknown as XrMotionReferenceVector
  return Object.freeze([
    round(clamp(finiteNumber(value[0], fallback[0]), -MAX_COORDINATE_METERS, MAX_COORDINATE_METERS)),
    round(clamp(finiteNumber(value[1], fallback[1]), 0, MAX_COORDINATE_METERS)),
    round(clamp(finiteNumber(value[2], fallback[2]), -MAX_COORDINATE_METERS, MAX_COORDINATE_METERS)),
  ]) as unknown as XrMotionReferenceVector
}

function normalizeStageId(value: unknown): XrMotionReferenceStageId {
  const id = String(value || '').trim()
  return XR_MOTION_REFERENCE_STAGE_PRESETS.some(preset => preset.id === id)
    ? id as XrMotionReferenceStageId
    : 'neutral-volume'
}

function normalizeTransition(value: unknown): XrMotionReferenceTransition {
  return value === 'hold' ? 'hold' : 'linear'
}

function defaultActorPosition(index: number): XrMotionReferenceVector {
  const column = index % 4
  const row = Math.floor(index / 4)
  return [round((column - 1.5) * 2.4), 0, round((row - 0.5) * 2.8)]
}

function stableMarkId(prefix: string, timeSeconds: number): string {
  return `${prefix}:${Math.round(timeSeconds * 1000)}`
}

function boundedSourceWithLatest(value: unknown, max: number): unknown[] {
  const source = Array.isArray(value) ? value : []
  return source.length > max ? [...source.slice(0, max), source[source.length - 1]] : source
}

function normalizeMarks(value: unknown, actorId: string, durationSeconds: number, fallbackPosition: XrMotionReferenceVector): readonly XrMotionReferenceMark[] {
  const source = boundedSourceWithLatest(value, XR_MOTION_REFERENCE_MAX_CAST_MARKS)
  const marks = source.map((item, index) => {
    const record = asRecord(item)
    const timeSeconds = normalizeTime(record.timeSeconds, durationSeconds)
    return Object.freeze({
      id: stableMarkId(`cast:${actorId}`, timeSeconds),
      timeSeconds,
      position: normalizeVector(record.position, fallbackPosition),
      transition: normalizeTransition(record.transition),
      index,
    })
  })
  if (marks.length === 0) {
    marks.push(Object.freeze({
      id: stableMarkId(`cast:${actorId}`, 0),
      timeSeconds: 0,
      position: fallbackPosition,
      transition: 'linear' as const,
      index: 0,
    }))
  }
  const byTime = new Map<number, (typeof marks)[number]>()
  marks.forEach(mark => byTime.set(mark.timeSeconds, mark))
  return Object.freeze([...byTime.values()]
    .sort((left, right) => left.timeSeconds - right.timeSeconds || left.index - right.index)
    .slice(0, XR_MOTION_REFERENCE_MAX_CAST_MARKS)
    .map(({ index: _index, ...mark }) => Object.freeze(mark)))
}

function normalizeCameraMarks(
  value: unknown,
  durationSeconds: number,
  cast: readonly XrMotionReferenceCastTrack[],
): readonly XrMotionReferenceCameraMark[] {
  const source = boundedSourceWithLatest(value, XR_MOTION_REFERENCE_MAX_CAMERA_MARKS)
  const marks = source.map((item, index) => {
    const record = asRecord(item)
    const timeSeconds = normalizeTime(record.timeSeconds, durationSeconds)
    const anchorId = String(record.anchorId || '').trim()
    const anchorTrack = cast.find(track => track.actorId === anchorId)
    const target = anchorTrack
      ? sampleXrMotionReferenceMarks(anchorTrack.marks, timeSeconds)
      : [0, 0, 0] as const
    const settings = Object.freeze(readStrybldrCameraSettings(record.settings))
    return {
      id: stableMarkId('camera', timeSeconds),
      timeSeconds,
      anchorId,
      settings,
      pose: resolveCameraFramingPose({ settings, target, baseDistance: XR_MOTION_REFERENCE_CAMERA_BASELINE_METERS }),
      index,
    }
  })
  const byTime = new Map<number, (typeof marks)[number]>()
  marks.forEach(mark => byTime.set(mark.timeSeconds, mark))
  return Object.freeze([...byTime.values()]
    .sort((left, right) => left.timeSeconds - right.timeSeconds || left.index - right.index)
    .slice(0, XR_MOTION_REFERENCE_MAX_CAMERA_MARKS)
    .map(({ index: _index, ...mark }) => Object.freeze(mark)))
}

function resolveCast(nodes: readonly GraphNode[], value: unknown, durationSeconds: number): readonly XrMotionReferenceCastTrack[] {
  const savedById = new Map(
    (Array.isArray(value) ? value : [])
      .map(item => asRecord(item))
      .map(item => [String(item.actorId || '').trim(), item] as const)
      .filter(([actorId]) => actorId),
  )
  return Object.freeze(nodes.slice(0, MAX_CAST_TRACKS).map((node, index) => {
    const actorId = String(node.id || '').trim() || `actor-${index + 1}`
    const saved = savedById.get(actorId) || {}
    const fallbackPosition = defaultActorPosition(index)
    return Object.freeze({
      actorId,
      label: String(node.label || saved.label || actorId).trim().slice(0, 80) || actorId,
      color: CAST_COLORS[index % CAST_COLORS.length],
      marks: normalizeMarks(saved.marks, actorId, durationSeconds, fallbackPosition),
    })
  }))
}

export function readXrMotionReferencePlan(value: unknown, nodes: readonly GraphNode[] = []): XrMotionReferencePlan {
  const record = asRecord(value)
  const durationSeconds = normalizeDuration(record.durationSeconds)
  const cast = resolveCast(nodes, record.cast, durationSeconds)
  return Object.freeze({
    schema: XR_MOTION_REFERENCE_SCHEMA,
    stageId: normalizeStageId(record.stageId),
    durationSeconds,
    fps: normalizeFps(record.fps),
    cast,
    camera: normalizeCameraMarks(record.camera, durationSeconds, cast),
  })
}

export function xrMotionReferenceSceneKey(documentName: string, graphData: GraphData | null): string {
  return `${String(documentName || 'Untitled')}|${graphData?.type || 'Graph'}`
}

export function serializeXrMotionReferencePlan(plan: XrMotionReferencePlan): JSONValue {
  return {
    schema: XR_MOTION_REFERENCE_SCHEMA,
    stageId: plan.stageId,
    durationSeconds: plan.durationSeconds,
    fps: plan.fps,
    cast: plan.cast.map(track => ({
      actorId: track.actorId,
      label: track.label,
      marks: track.marks.map(mark => ({
        timeSeconds: mark.timeSeconds,
        position: [...mark.position],
        transition: mark.transition,
      })),
    })),
    camera: plan.camera.map(mark => ({
      timeSeconds: mark.timeSeconds,
      anchorId: mark.anchorId,
      settings: serializeStrybldrCameraSettings(mark.settings),
    })),
  } as JSONValue
}

export function resolveXrMotionReferenceStage(stageId: XrMotionReferenceStageId): XrMotionReferenceStagePreset {
  return XR_MOTION_REFERENCE_STAGE_PRESETS.find(preset => preset.id === stageId) || XR_MOTION_REFERENCE_STAGE_PRESETS[0]!
}

function interpolateVector(left: XrMotionReferenceVector, right: XrMotionReferenceVector, progress: number): XrMotionReferenceVector {
  return [
    round(left[0] + (right[0] - left[0]) * progress),
    round(left[1] + (right[1] - left[1]) * progress),
    round(left[2] + (right[2] - left[2]) * progress),
  ]
}

function normalizeDirection(vector: XrMotionReferenceVector): XrMotionReferenceVector {
  const length = Math.hypot(vector[0], vector[1], vector[2])
  if (!(length > 0.000001)) return [0, 1, 0]
  return [round(vector[0] / length), round(vector[1] / length), round(vector[2] / length)]
}

export function sampleXrMotionReferenceMarks(marks: readonly XrMotionReferenceMark[], timeSeconds: number): XrMotionReferenceVector {
  if (marks.length === 0) return [0, 0, 0]
  if (timeSeconds <= marks[0]!.timeSeconds) return marks[0]!.position
  const last = marks[marks.length - 1]!
  if (timeSeconds >= last.timeSeconds) return last.position
  for (let index = 1; index < marks.length; index += 1) {
    const right = marks[index]!
    if (timeSeconds > right.timeSeconds) continue
    const left = marks[index - 1]!
    if (Math.abs(timeSeconds - right.timeSeconds) < 0.000001) return right.position
    if (left.transition === 'hold') return left.position
    const span = Math.max(0.001, right.timeSeconds - left.timeSeconds)
    return interpolateVector(left.position, right.position, clamp((timeSeconds - left.timeSeconds) / span, 0, 1))
  }
  return last.position
}

function sampleCameraPose(marks: readonly XrMotionReferenceCameraMark[], timeSeconds: number): CameraFramingPose | null {
  if (marks.length === 0) return null
  if (timeSeconds <= marks[0]!.timeSeconds) return marks[0]!.pose
  const last = marks[marks.length - 1]!
  if (timeSeconds >= last.timeSeconds) return last.pose
  for (let index = 1; index < marks.length; index += 1) {
    const right = marks[index]!
    if (timeSeconds > right.timeSeconds) continue
    const left = marks[index - 1]!
    const span = Math.max(0.001, right.timeSeconds - left.timeSeconds)
    const progress = clamp((timeSeconds - left.timeSeconds) / span, 0, 1)
    return Object.freeze({
      position: interpolateVector(left.pose.position, right.pose.position, progress),
      target: interpolateVector(left.pose.target, right.pose.target, progress),
      up: normalizeDirection(interpolateVector(left.pose.up, right.pose.up, progress)),
    })
  }
  return last.pose
}

function hashText(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function graphFingerprint(graphData: GraphData): string {
  const nodes = graphData.nodes.map(node => [node.id, node.label, node.type]).sort((a, b) => a[0].localeCompare(b[0]))
  const edges = graphData.edges.map(edge => [edge.id, edge.source, edge.target, edge.type || '']).sort((a, b) => a[0].localeCompare(b[0]))
  return hashText(JSON.stringify({ type: graphData.type, nodes, edges }))
}

function safeFilenameStem(value: string): string {
  const stem = value.trim().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return stem.slice(0, 56) || 'scene'
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, token => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[token] || token)
}

function buildTopDownSvg(plan: XrMotionReferencePlan): string {
  const stage = resolveXrMotionReferenceStage(plan.stageId)
  const width = 1000
  const height = 700
  const scaleX = width / stage.sizeMeters[0]
  const scaleZ = height / stage.sizeMeters[1]
  const point = (position: XrMotionReferenceVector) => ({
    x: round(width / 2 + position[0] * scaleX, 2),
    y: round(height / 2 + position[2] * scaleZ, 2),
  })
  const structureRows = stage.structures.map(structure => {
    const p = point(structure.position)
    const boxWidth = round(structure.size[0] * scaleX, 2)
    const boxHeight = round(structure.size[2] * scaleZ, 2)
    return `<rect x="${round(p.x - boxWidth / 2, 2)}" y="${round(p.y - boxHeight / 2, 2)}" width="${boxWidth}" height="${boxHeight}" class="${structure.tone}"/>`
  })
  const castRows = plan.cast.flatMap(track => {
    const points = track.marks.map(mark => point(mark.position))
    const path = points.map(item => `${item.x},${item.y}`).join(' ')
    return [
      `<polyline points="${path}" fill="none" stroke="${track.color}" stroke-width="4"/>`,
      ...points.map((item, index) => `<g><circle cx="${item.x}" cy="${item.y}" r="10" fill="${track.color}"/><text x="${item.x + 14}" y="${item.y - 12}">${escapeXml(track.label)} ${index + 1}</text></g>`),
    ]
  })
  const cameraRows = plan.camera.map((mark, index) => {
    const p = point(mark.pose.position)
    const target = point(mark.pose.target)
    const angle = round(Math.atan2(target.y - p.y, target.x - p.x) * 180 / Math.PI, 2)
    return `<g transform="translate(${p.x} ${p.y}) rotate(${angle})"><path d="M 14 0 L -10 10 L -10 -10 Z" class="camera"/></g><text x="${p.x + 14}" y="${p.y}">C${index + 1} ${mark.timeSeconds}s</text>`
  })
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700" viewBox="0 0 1000 700">',
    '<style>text{font:16px system-ui;fill:#e2e8f0}.light{fill:#64748b}.mid{fill:#475569}.dark{fill:#1e293b}.accent{fill:#0f766e}.camera{fill:#f8fafc}</style>',
    '<rect width="1000" height="700" fill="#0f172a"/>',
    ...structureRows,
    ...castRows,
    ...cameraRows,
    '</svg>',
    '',
  ].join('\n')
}

function buildGeneratorBrief(plan: XrMotionReferencePlan): string {
  const stage = resolveXrMotionReferenceStage(plan.stageId)
  const castLines = plan.cast.map(track => {
    const marks = track.marks.map(mark => `${mark.timeSeconds}s (${mark.position.join(', ')}) [${mark.transition}]`).join(' → ')
    return `- ${track.label}: ${marks}`
  })
  const cameraLines = plan.camera.map(mark => (
    `- ${mark.timeSeconds}s: ${mark.settings.shot}, ${mark.settings.angle}, ${mark.settings.level}; position (${mark.pose.position.join(', ')})`
  ))
  return [
    'Use the attached Knowgrph XR data as the motion and spatial reference for one continuous shot.',
    `Stage: ${stage.label}. ${stage.description}`,
    `Duration: ${plan.durationSeconds}s at ${plan.fps} fps.`,
    'Preserve subject identities, mark order, timing, screen direction, and camera path. Treat grey boxes as spatial constraints rather than final art direction.',
    '',
    'Cast blocking:',
    ...(castLines.length ? castLines : ['- No cast tracks.']),
    '',
    'Camera choreography:',
    ...(cameraLines.length ? cameraLines : ['- No camera marks; use a locked neutral camera.']),
    '',
  ].join('\n')
}

function buildMotionSamples(plan: XrMotionReferencePlan): unknown[] {
  const frameCount = Math.floor(plan.durationSeconds * plan.fps) + 1
  return Array.from({ length: frameCount }, (_item, frame) => {
    const timeSeconds = round(Math.min(plan.durationSeconds, frame / plan.fps), 4)
    return {
      frame,
      timeSeconds,
      camera: sampleCameraPose(plan.camera, timeSeconds),
      cast: plan.cast.map(track => ({
        actorId: track.actorId,
        position: sampleXrMotionReferenceMarks(track.marks, timeSeconds),
      })),
    }
  })
}

function jsonFile(path: string, value: unknown): XrMotionReferencePackageFile {
  return Object.freeze({ path, mimeType: 'application/json', text: `${JSON.stringify(value, null, 2)}\n` })
}

export function buildXrMotionReferencePackage(args: {
  plan: XrMotionReferencePlan
  graphData: GraphData
  documentName: string
}): XrMotionReferencePackage {
  const plan = readXrMotionReferencePlan(serializeXrMotionReferencePlan(args.plan), args.graphData.nodes)
  const stage = resolveXrMotionReferenceStage(plan.stageId)
  const fingerprint = graphFingerprint(args.graphData)
  const motionFingerprint = hashText(JSON.stringify({
    graphFingerprint: fingerprint,
    plan: serializeXrMotionReferencePlan(plan),
  }))
  const title = safeFilenameStem(args.documentName)
  const timeline = Object.freeze({
    durationSeconds: plan.durationSeconds,
    fps: plan.fps,
    frameCount: Math.floor(plan.durationSeconds * plan.fps) + 1,
  })
  const manifest = {
    schema: XR_MOTION_REFERENCE_SCHEMA,
    stage: { id: stage.id, label: stage.label, sizeMeters: stage.sizeMeters },
    timeline,
    castTracks: plan.cast.length,
    cameraMarks: plan.camera.length,
    coordinateSystem: 'right-handed-y-up-meters',
    interpolation: 'bounded-linear-with-holds',
    graphFingerprint: fingerprint,
    motionFingerprint,
    cameraSemanticMapping: {
      baselineMeters: XR_MOTION_REFERENCE_CAMERA_BASELINE_METERS,
      anchorFallback: 'stage-origin',
    },
    referenceBoundary: {
      implementation: 'native-knowgrph',
      inspirationCitation: 'documentation-only',
      copyPolicy: 'no-external-code-assets-or-schemas',
      dependencyPolicy: 'no-external-runtime',
      runtimeDependency: false,
    },
  }
  const files = Object.freeze([
    jsonFile('reference/manifest.json', manifest),
    jsonFile('reference/cast-tracks.json', plan.cast),
    jsonFile('reference/camera-track.json', plan.camera),
    jsonFile('reference/frame-samples.json', buildMotionSamples(plan)),
    Object.freeze({ path: 'reference/stage-map.svg', mimeType: 'image/svg+xml', text: buildTopDownSvg(plan) }),
    Object.freeze({ path: 'handoff/video-generator-brief.txt', mimeType: 'text/plain', text: buildGeneratorBrief(plan) }),
    Object.freeze({
      path: 'README.txt',
      mimeType: 'text/plain',
      text: 'Knowgrph XR motion-reference package\n\nAttach the generator brief and stage map to a video-generation workflow. The frame samples are deterministic, meter-based motion data; grey-box structures define spatial constraints, not final visual styling.\n',
    }),
  ])
  return Object.freeze({
    schema: XR_MOTION_REFERENCE_PACKAGE_SCHEMA,
    packageId: `kg-xr-${motionFingerprint}`,
    title,
    referenceBoundary: Object.freeze({
      implementation: 'native-knowgrph',
      inspirationCitation: 'documentation-only',
      copyPolicy: 'no-external-code-assets-or-schemas',
      dependencyPolicy: 'no-external-runtime',
      runtimeDependency: false,
    }),
    source: Object.freeze({
      documentName: String(args.documentName || 'Untitled'),
      graphFingerprint: fingerprint,
      motionFingerprint,
      graphType: String(args.graphData.type || 'Graph'),
      nodeCount: args.graphData.nodes.length,
      edgeCount: args.graphData.edges.length,
    }),
    stage: Object.freeze({ id: stage.id, label: stage.label, sizeMeters: stage.sizeMeters }),
    timeline,
    files,
  })
}

export function xrMotionReferencePackageFilename(bundle: XrMotionReferencePackage): string {
  return `${bundle.title}.xr-motion-reference.${bundle.source.motionFingerprint}.json`
}

export function xrMotionReferencePackageBlob(bundle: XrMotionReferencePackage): Blob {
  return new Blob([`${JSON.stringify(bundle, null, 2)}\n`], { type: 'application/json;charset=utf-8' })
}
