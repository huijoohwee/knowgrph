import React from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { StandaloneSpatialCaptureManifest } from '@/features/markdown-workspace/workspaceImport/spatialCaptureFileset'
import {
  readSpatialCaptureAxis,
  readSpatialCaptureCenterAction,
  readSpatialCaptureTool,
  subscribeSpatialCaptureAxis,
  subscribeSpatialCaptureCenterAction,
  subscribeSpatialCaptureTool,
} from '@/features/three/xrSpatialCaptureTools'
import type { SpatialCaptureAxisId, SpatialCaptureCenterActionId, SpatialCaptureToolId } from '@/features/three/xrSpatialCaptureTools'
import { loadSpatialCapturePointCloud, type SpatialCapturePointCloudLoad } from '@/lib/assets/spatialCaptureAssetRuntime'
import type { GlbFit } from '@/lib/three/GlbAssetModel'
import { readModelAssetCameraPose } from './modelAssetCameraPose'
import { buildGaussianSplatMaterial } from './spatialCaptureGaussianMaterial'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; load: SpatialCapturePointCloudLoad }
  | { status: 'empty' }
  | { status: 'error'; message: string }

const STAGE_TARGET_EXTENT = 156
const SPATIAL_CAPTURE_BACKGROUND = '#081827'
const SPATIAL_CAPTURE_FOG = '#0d2236'
const SPATIAL_CAPTURE_GRID_MAJOR = '#b9c8d8'
const SPATIAL_CAPTURE_GRID_MINOR = '#31506b'
const SPATIAL_CAPTURE_SORT_BUCKETS = 32768
const SPATIAL_CAPTURE_SORT_DIRECTION_DOT_MIN = 0.9965
const SPATIAL_CAPTURE_SORT_INTERVAL_MS = 180
const SPATIAL_CAPTURE_INITIAL_VIEW_DIRECTION = [-0.95, -0.28, -0.12] as const
const SPATIAL_CAPTURE_SELECTION_COLORS: Record<SpatialCaptureCenterActionId, string> = {
  set: '#e2e8f0',
  add: '#38bdf8',
  remove: '#fb7185',
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function buildSpatialCaptureFit(load: SpatialCapturePointCloudLoad): GlbFit {
  const bounds = load.pointCloud.bounds
  const sourceAnchored = load.pointCloud.kind === 'gaussian-splat'
  const size: [number, number, number] = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ]
  const scale = STAGE_TARGET_EXTENT / Math.max(1, bounds.maxExtent)
  const scaledSize: [number, number, number] = [
    size[0] * scale,
    size[1] * scale,
    size[2] * scale,
  ]
  const stageSpan = clamp(Math.max(scaledSize[0], scaledSize[2], STAGE_TARGET_EXTENT) * 1.6, 180, 520)
  return {
    cameraProfile: 'spatial-capture',
    cameraTarget: [0, 0, 0],
    position: sourceAnchored
      ? [0, 0, 0]
      : [
        -bounds.center[0] * scale,
        -bounds.center[1] * scale,
        -bounds.center[2] * scale,
    ],
    scale,
    floorY: sourceAnchored ? bounds.min[1] * scale : (bounds.min[1] - bounds.center[1]) * scale,
    stageSpan,
    preserveFlatFacing: false,
    flatAxis: null,
    size,
    scaledSize,
  }
}

function buildDepthSortedIndex(positions: Float32Array, direction: readonly [number, number, number]): Uint16Array | Uint32Array | null {
  const count = Math.floor(positions.length / 3)
  if (count <= 1) return null
  const [dx, dy, dz] = direction
  let minDepth = Number.POSITIVE_INFINITY
  let maxDepth = Number.NEGATIVE_INFINITY
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3
    const depth = positions[offset] * dx + positions[offset + 1] * dy + positions[offset + 2] * dz
    if (depth < minDepth) minDepth = depth
    if (depth > maxDepth) maxDepth = depth
  }
  if (!Number.isFinite(minDepth) || !Number.isFinite(maxDepth) || maxDepth <= minDepth) return null
  const bucketCount = Math.min(SPATIAL_CAPTURE_SORT_BUCKETS, Math.max(64, count))
  const histogram = new Uint32Array(bucketCount)
  const scale = (bucketCount - 1) / Math.max(1e-6, maxDepth - minDepth)
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3
    const bucket = clamp(Math.floor((positions[offset] * dx + positions[offset + 1] * dy + positions[offset + 2] * dz - minDepth) * scale), 0, bucketCount - 1)
    histogram[bucket] += 1
  }
  const offsets = new Uint32Array(bucketCount)
  let cursor = 0
  for (let bucket = bucketCount - 1; bucket >= 0; bucket -= 1) {
    offsets[bucket] = cursor
    cursor += histogram[bucket]
  }
  const writes = offsets.slice()
  const out = count > 65535 ? new Uint32Array(count) : new Uint16Array(count)
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3
    const bucket = clamp(Math.floor((positions[offset] * dx + positions[offset + 1] * dy + positions[offset + 2] * dz - minDepth) * scale), 0, bucketCount - 1)
    out[writes[bucket]] = index
    writes[bucket] += 1
  }
  return out
}

function dotSortDirection(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function normalizeSortDirection(x: number, y: number, z: number): readonly [number, number, number] {
  const length = Math.hypot(x, y, z)
  if (!(length > 1e-6)) return SPATIAL_CAPTURE_INITIAL_VIEW_DIRECTION
  return [x / length, y / length, z / length]
}

function resolveSpatialCaptureInitialSortDirection(fit: GlbFit): readonly [number, number, number] {
  const pose = readModelAssetCameraPose(fit)
  return normalizeSortDirection(
    pose.target[0] - pose.position[0],
    pose.target[1] - pose.position[1],
    pose.target[2] - pose.position[2],
  )
}

function buildInitialDepthSortedIndex(positions: Float32Array, fit: GlbFit): Uint16Array | Uint32Array | null {
  return buildDepthSortedIndex(positions, resolveSpatialCaptureInitialSortDirection(fit))
}

function resolveCameraSortDirection(camera: THREE.Camera): readonly [number, number, number] {
  const elements = camera.matrixWorld.elements
  return normalizeSortDirection(-elements[8], -elements[9], -elements[10])
}

function buildPointCloudGeometry(load: SpatialCapturePointCloudLoad): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(load.pointCloud.positions, 3))
  if (load.pointCloud.colors) geometry.setAttribute('pointColor', new THREE.BufferAttribute(load.pointCloud.colors, 3))
  geometry.computeBoundingSphere()
  return geometry
}

function reorderFloatAttribute(values: Float32Array, itemSize: number, order: Uint16Array | Uint32Array | null): Float32Array {
  if (!order) return values
  const out = new Float32Array(values.length)
  for (let nextIndex = 0; nextIndex < order.length; nextIndex += 1) {
    const sourceIndex = order[nextIndex]
    const sourceOffset = sourceIndex * itemSize
    const targetOffset = nextIndex * itemSize
    for (let component = 0; component < itemSize; component += 1) {
      out[targetOffset + component] = values[sourceOffset + component]
    }
  }
  return out
}

function writeReorderedFloatAttribute(
  target: Float32Array,
  values: Float32Array,
  itemSize: number,
  order: Uint16Array | Uint32Array | null,
): void {
  if (!order) {
    target.set(values)
    return
  }
  for (let nextIndex = 0; nextIndex < order.length; nextIndex += 1) {
    const sourceIndex = order[nextIndex]
    const sourceOffset = sourceIndex * itemSize
    const targetOffset = nextIndex * itemSize
    for (let component = 0; component < itemSize; component += 1) {
      target[targetOffset + component] = values[sourceOffset + component]
    }
  }
}

function updateReorderedFloatAttribute(
  geometry: THREE.InstancedBufferGeometry,
  name: string,
  values: Float32Array | null,
  itemSize: number,
  order: Uint16Array | Uint32Array | null,
): void {
  if (!values) return
  const attribute = geometry.getAttribute(name)
  if (!(attribute instanceof THREE.InstancedBufferAttribute) || !(attribute.array instanceof Float32Array)) return
  writeReorderedFloatAttribute(attribute.array, values, itemSize, order)
  attribute.needsUpdate = true
}

function updateGaussianSplatGeometrySort(
  geometry: THREE.InstancedBufferGeometry,
  load: SpatialCapturePointCloudLoad,
  direction: readonly [number, number, number],
): void {
  const order = buildDepthSortedIndex(load.pointCloud.positions, direction)
  updateReorderedFloatAttribute(geometry, 'splatCenter', load.pointCloud.positions, 3, order)
  updateReorderedFloatAttribute(geometry, 'splatColor', load.pointCloud.colors, 3, order)
  updateReorderedFloatAttribute(geometry, 'splatOpacity', load.pointCloud.opacities, 1, order)
  updateReorderedFloatAttribute(geometry, 'splatScale', load.pointCloud.splatScales, 3, order)
  updateReorderedFloatAttribute(geometry, 'splatRotation', load.pointCloud.splatRotations, 4, order)
}

function buildGaussianSplatGeometry(load: SpatialCapturePointCloudLoad, fit: GlbFit): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry()
  const initialOrder = buildInitialDepthSortedIndex(load.pointCloud.positions, fit)
  const centers = reorderFloatAttribute(load.pointCloud.positions, 3, initialOrder)
  const colors = load.pointCloud.colors ? reorderFloatAttribute(load.pointCloud.colors, 3, initialOrder) : null
  const opacities = load.pointCloud.opacities ? reorderFloatAttribute(load.pointCloud.opacities, 1, initialOrder) : null
  const scales = load.pointCloud.splatScales ? reorderFloatAttribute(load.pointCloud.splatScales, 3, initialOrder) : null
  const rotations = load.pointCloud.splatRotations ? reorderFloatAttribute(load.pointCloud.splatRotations, 4, initialOrder) : null
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1))
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0,
  ]), 3))
  geometry.setAttribute('splatCenter', new THREE.InstancedBufferAttribute(centers, 3))
  if (colors) geometry.setAttribute('splatColor', new THREE.InstancedBufferAttribute(colors, 3))
  if (opacities) geometry.setAttribute('splatOpacity', new THREE.InstancedBufferAttribute(opacities, 1))
  if (scales) geometry.setAttribute('splatScale', new THREE.InstancedBufferAttribute(scales, 3))
  if (rotations) geometry.setAttribute('splatRotation', new THREE.InstancedBufferAttribute(rotations, 4))
  geometry.instanceCount = load.pointCloud.pointCount
  const bounds = load.pointCloud.bounds
  const center = new THREE.Vector3(bounds.center[0], bounds.center[1], bounds.center[2])
  const radius = Math.max(
    center.distanceTo(new THREE.Vector3(bounds.min[0], bounds.min[1], bounds.min[2])),
    center.distanceTo(new THREE.Vector3(bounds.min[0], bounds.min[1], bounds.max[2])),
    center.distanceTo(new THREE.Vector3(bounds.min[0], bounds.max[1], bounds.min[2])),
    center.distanceTo(new THREE.Vector3(bounds.min[0], bounds.max[1], bounds.max[2])),
    center.distanceTo(new THREE.Vector3(bounds.max[0], bounds.min[1], bounds.min[2])),
    center.distanceTo(new THREE.Vector3(bounds.max[0], bounds.min[1], bounds.max[2])),
    center.distanceTo(new THREE.Vector3(bounds.max[0], bounds.max[1], bounds.min[2])),
    center.distanceTo(new THREE.Vector3(bounds.max[0], bounds.max[1], bounds.max[2])),
  )
  geometry.boundingSphere = new THREE.Sphere(center, Math.max(1, radius))
  return geometry
}

function resolvePointCloudMaterialScale(pointCount: number): number {
  const millions = Math.max(0.25, pointCount / 1_000_000)
  return Math.max(2.4, Math.min(6.2, 7.6 / Math.sqrt(millions)))
}

function buildPointCloudMaterial(args: {
  hasColor: boolean
  paused: boolean
  pointCount: number
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    defines: args.hasColor ? { KG_HAS_POINT_COLOR: '1' } : undefined,
    uniforms: {
      baseColor: { value: new THREE.Color('#dbeafe') },
      opacityScale: { value: args.paused ? 0.66 : 0.96 },
      pointScale: { value: resolvePointCloudMaterialScale(args.pointCount) },
    },
    vertexShader: `
      precision highp float;
      uniform float pointScale;
      #ifdef KG_HAS_POINT_COLOR
      attribute vec3 pointColor;
      varying vec3 vPointColor;
      #endif
      void main() {
        #ifdef KG_HAS_POINT_COLOR
        vPointColor = pointColor;
        #endif
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float attenuation = 160.0 / max(1.0, -mvPosition.z);
        gl_PointSize = clamp(pointScale * attenuation, 1.35, 9.5);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 baseColor;
      uniform float opacityScale;
      #ifdef KG_HAS_POINT_COLOR
      varying vec3 vPointColor;
      #endif
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float radius = dot(uv, uv);
        if (radius > 0.25) discard;
        float core = exp(-radius * 7.0);
        float alpha = smoothstep(0.0, 0.92, core) * opacityScale;
        #ifdef KG_HAS_POINT_COLOR
        vec3 color = vPointColor;
        #else
        vec3 color = baseColor;
        #endif
        gl_FragColor = vec4(color, alpha);
      }
    `,
  })
}

function SpatialCaptureStatusMarker({ color }: { color: string }) {
  return (
    <group name="kg_spatial_capture_status_marker">
      <gridHelper args={[96, 12, '#475569', '#1f2937']} position={[0, -18, 0]} />
      <mesh position={[0, -18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[23, 24, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.48} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

function resolveSelectionRadius(load: SpatialCapturePointCloudLoad): number {
  return Math.max(12, Math.min(180, load.pointCloud.bounds.maxExtent * 0.42))
}

function resolveSelectionScale(load: SpatialCapturePointCloudLoad): [number, number, number] {
  const bounds = load.pointCloud.bounds
  const radius = resolveSelectionRadius(load)
  const sizeX = Math.max(1, bounds.max[0] - bounds.min[0])
  const sizeY = Math.max(1, bounds.max[1] - bounds.min[1])
  const sizeZ = Math.max(1, bounds.max[2] - bounds.min[2])
  return [
    Math.max(radius * 0.45, sizeX * 0.36),
    Math.max(radius * 0.45, sizeY * 0.5),
    Math.max(radius * 0.45, sizeZ * 0.36),
  ]
}

function resolveAxisCameraPosition(axis: SpatialCaptureAxisId, fit: GlbFit): [number, number, number] {
  const distance = Math.max(220, fit.stageSpan * 1.15)
  if (axis === 'x') return [distance, Math.max(42, distance * 0.22), 0]
  if (axis === 'y') return [0, distance, Math.max(42, distance * 0.12)]
  return [0, Math.max(42, distance * 0.22), distance]
}

function SpatialCaptureSelectionOverlay({
  action,
  load,
  tool,
}: {
  action: SpatialCaptureCenterActionId
  load: SpatialCapturePointCloudLoad
  tool: SpatialCaptureToolId
}) {
  const color = SPATIAL_CAPTURE_SELECTION_COLORS[action]
  const radius = resolveSelectionRadius(load)
  const boxScale = resolveSelectionScale(load)
  if (tool === 'sphere') {
    return (
      <group name="kg_spatial_capture_sphere_select_volume">
        <mesh renderOrder={8}>
          <sphereGeometry args={[radius, 48, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.08} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        {[
          [0, 0, 0],
          [Math.PI / 2, 0, 0],
          [0, Math.PI / 2, 0],
        ].map((rotation, index) => (
          <mesh key={index} rotation={rotation as [number, number, number]} renderOrder={9}>
            <ringGeometry args={[radius * 0.994, radius, 144]} />
            <meshBasicMaterial color={color} transparent opacity={0.82} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <axesHelper args={[Math.max(18, radius * 0.22)]} />
      </group>
    )
  }
  if (tool === 'box') {
    return (
      <group name="kg_spatial_capture_box_select_volume">
        <mesh scale={boxScale} renderOrder={8}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={color} transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh scale={boxScale} renderOrder={9}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.82} depthWrite={false} />
        </mesh>
      </group>
    )
  }
  if (tool === 'center') {
    return (
      <group name="kg_spatial_capture_center_select_crosshair">
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={9}>
          <ringGeometry args={[radius * 0.12, radius * 0.135, 96]} />
          <meshBasicMaterial color={color} transparent opacity={0.72} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <axesHelper args={[Math.max(18, radius * 0.28)]} />
      </group>
    )
  }
  return null
}

export function SpatialCaptureManifestStage({
  manifest,
  paused,
  onLoadStateChange,
  onFitChange,
}: {
  manifest: StandaloneSpatialCaptureManifest
  paused: boolean
  onLoadStateChange?: (state: LoadState) => void
  onFitChange?: (fit: GlbFit | null) => void
}) {
  const { camera, size } = useThree()
  const [state, setState] = React.useState<LoadState>({ status: 'loading' })
  const [spatialTool, setSpatialTool] = React.useState<SpatialCaptureToolId>(readSpatialCaptureTool())
  const [spatialAxis, setSpatialAxis] = React.useState<SpatialCaptureAxisId>(readSpatialCaptureAxis())
  const [spatialCenterAction, setSpatialCenterAction] = React.useState<SpatialCaptureCenterActionId>(readSpatialCaptureCenterAction())
  const sortStateRef = React.useRef<{
    direction: readonly [number, number, number]
    lastSortMs: number
  }>({
    direction: SPATIAL_CAPTURE_INITIAL_VIEW_DIRECTION,
    lastSortMs: 0,
  })
	  const loadKey = [
    manifest.format,
    manifest.renderCacheKey,
    manifest.pendingLocalPath,
    manifest.sourceKind,
    manifest.sourceIdentity,
	  ].join('|')

  React.useEffect(() => subscribeSpatialCaptureTool(setSpatialTool), [])
  React.useEffect(() => subscribeSpatialCaptureAxis(setSpatialAxis), [])
  React.useEffect(() => subscribeSpatialCaptureCenterAction(setSpatialCenterAction), [])

  React.useEffect(() => {
    let cancelled = false
    const loadingState: LoadState = { status: 'loading' }
    setState(loadingState)
    onLoadStateChange?.(loadingState)
    loadSpatialCapturePointCloud(manifest)
      .then(load => {
        if (cancelled) return
        const nextState: LoadState = load ? { status: 'ready', load } : { status: 'empty' }
        setState(nextState)
        onLoadStateChange?.(nextState)
      })
      .catch(error => {
        if (cancelled) return
        const nextState: LoadState = { status: 'error', message: error instanceof Error ? error.message : String(error) }
        setState(nextState)
        onLoadStateChange?.(nextState)
      })
    return () => {
      cancelled = true
    }
  }, [loadKey, manifest, onLoadStateChange])

  const fit = React.useMemo(() => (state.status === 'ready' ? buildSpatialCaptureFit(state.load) : null), [state])
  const geometry = React.useMemo(() => {
    if (state.status !== 'ready' || !fit) return null
    return state.load.pointCloud.kind === 'gaussian-splat'
      ? buildGaussianSplatGeometry(state.load, fit)
      : buildPointCloudGeometry(state.load)
  }, [fit, state])
  React.useEffect(() => () => geometry?.dispose(), [geometry])
  const gaussianSplatMaterial = React.useMemo(() => {
    if (
      state.status !== 'ready'
      || state.load.pointCloud.kind !== 'gaussian-splat'
      || !state.load.pointCloud.colors
      || !state.load.pointCloud.opacities
      || !state.load.pointCloud.splatScales
      || !state.load.pointCloud.splatRotations
    ) return null
    return buildGaussianSplatMaterial({
      paused,
      viewportHeight: size.height,
      viewportWidth: size.width,
    })
  }, [paused, size.height, size.width, state])
  React.useEffect(() => () => gaussianSplatMaterial?.dispose(), [gaussianSplatMaterial])
  useFrame(({ clock }) => {
    if (
      state.status !== 'ready'
      || state.load.pointCloud.kind !== 'gaussian-splat'
      || !(geometry instanceof THREE.InstancedBufferGeometry)
    ) return
    const nextDirection = resolveCameraSortDirection(camera)
    const sortState = sortStateRef.current
    const elapsedMs = clock.elapsedTime * 1000
    if (
      dotSortDirection(sortState.direction, nextDirection) >= SPATIAL_CAPTURE_SORT_DIRECTION_DOT_MIN
      || elapsedMs - sortState.lastSortMs < SPATIAL_CAPTURE_SORT_INTERVAL_MS
    ) return
    updateGaussianSplatGeometrySort(geometry, state.load, nextDirection)
    sortStateRef.current = {
      direction: nextDirection,
      lastSortMs: elapsedMs,
    }
  })
  const pointCloudMaterial = React.useMemo(() => {
    if (state.status !== 'ready' || state.load.pointCloud.kind === 'gaussian-splat') return null
    return buildPointCloudMaterial({
      hasColor: !!state.load.pointCloud.colors,
      paused,
      pointCount: state.load.pointCloud.pointCount,
    })
  }, [paused, state])
  React.useEffect(() => () => pointCloudMaterial?.dispose(), [pointCloudMaterial])
  React.useEffect(() => {
    onFitChange?.(fit)
    return () => {
      onFitChange?.(null)
    }
  }, [fit, onFitChange])

  React.useEffect(() => {
    if (!fit || state.status !== 'ready') return
    const nextPosition = resolveAxisCameraPosition(spatialAxis, fit)
    camera.position.set(nextPosition[0], nextPosition[1], nextPosition[2])
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, fit, spatialAxis, state.status])

  if (state.status !== 'ready' || !geometry || !fit) {
    return <SpatialCaptureStatusMarker color={state.status === 'error' ? '#f97316' : '#38bdf8'} />
  }

  const bounds = state.load.pointCloud.bounds
  const gridPosition: [number, number, number] = state.load.pointCloud.kind === 'gaussian-splat'
    ? [0, 0, 0]
    : [bounds.center[0], bounds.min[1], bounds.center[2]]

  return (
    <>
      <color attach="background" args={[SPATIAL_CAPTURE_BACKGROUND]} />
      <fog attach="fog" args={[SPATIAL_CAPTURE_FOG, 260, 680]} />
      <group name={`kg_spatial_capture_manifest_${manifest.format}`} scale={[fit.scale, fit.scale, fit.scale]} position={fit.position}>
        {gaussianSplatMaterial && geometry instanceof THREE.InstancedBufferGeometry
          ? (
            <mesh name="kg_spatial_capture_gaussian_splats" geometry={geometry} frustumCulled={false} renderOrder={2}>
              <primitive object={gaussianSplatMaterial} attach="material" />
            </mesh>
          )
          : (
            <points name="kg_spatial_capture_point_cloud" geometry={geometry} frustumCulled={false} renderOrder={2}>
              {pointCloudMaterial ? <primitive object={pointCloudMaterial} attach="material" /> : null}
            </points>
          )}
	        <gridHelper args={[fit.stageSpan / fit.scale, 24, SPATIAL_CAPTURE_GRID_MAJOR, SPATIAL_CAPTURE_GRID_MINOR]} position={gridPosition} />
        <SpatialCaptureSelectionOverlay action={spatialCenterAction} load={state.load} tool={spatialTool} />
	      </group>
    </>
  )
}
