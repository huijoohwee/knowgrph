import { MathUtils, Vector3, type PerspectiveCamera } from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { GraphData, GraphNode } from '../../lib/graph/types'
import type { GraphSchema, ThreeConfig } from '@/lib/graph/schema'
import { getThreeConfig } from '@/lib/graph/schema'
import type { Vec3 } from './layout'
import { computeZoomTargetNodeIds } from '@/lib/zoom/selectionTargets'
import { DEFAULT_FIT_TO_SCREEN_FILL_RATIO } from 'grph-shared/zoom/presets'
import { DEFAULT_TOOLBAR_ZOOM_CONFIG } from '@/lib/zoom/toolbarZoom'

export type CameraZoomType = 'in' | 'out'

export type CameraRequestType = 'fit' | 'reset' | 'selection'

export type CameraConfig = {
  fogColor: string | null;
  fogNear: number;
  fogFar: number;
  dampingFactor: number;
  rotateSpeed: number;
  zoomSpeed: number;
  panSpeed: number;
  autoRotate: boolean;
  autoRotateSpeed: number;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

export function getCameraConfig(schema: GraphSchema): CameraConfig {
  const threeCfg: ThreeConfig = getThreeConfig(schema)
  const fogColorRaw = typeof threeCfg.fogColor === 'string' && threeCfg.fogColor.trim() !== '' ? threeCfg.fogColor : null
  const fogNearRaw = typeof threeCfg.fogNear === 'number' ? threeCfg.fogNear : 180
  const fogFarRaw = typeof threeCfg.fogFar === 'number' ? threeCfg.fogFar : 360
  const fogNear = Math.max(1, Math.min(fogNearRaw, fogFarRaw - 1))
  const fogFar = Math.max(fogNear + 1, fogFarRaw)
  const dampingRaw = typeof threeCfg.cameraDampingFactor === 'number' ? threeCfg.cameraDampingFactor : 0.06
  const dampingFactor = clamp(dampingRaw, 0, 1)
  const rotateSpeed = typeof threeCfg.cameraRotateSpeed === 'number' ? threeCfg.cameraRotateSpeed : 0.6
  const zoomSpeed = typeof threeCfg.cameraZoomSpeed === 'number' ? threeCfg.cameraZoomSpeed : 0.8
  const panSpeed = typeof threeCfg.cameraPanSpeed === 'number' ? threeCfg.cameraPanSpeed : 0.5
  const autoRotate = !!threeCfg.cameraAutoRotate
  const autoRotateSpeed = typeof threeCfg.cameraAutoRotateSpeed === 'number' ? threeCfg.cameraAutoRotateSpeed : 0.4
  return {
    fogColor: fogColorRaw,
    fogNear,
    fogFar,
    dampingFactor,
    rotateSpeed,
    zoomSpeed,
    panSpeed,
    autoRotate,
    autoRotateSpeed,
  }
}

export function applyZoomStep(controls: OrbitControls, camera: PerspectiveCamera, type: CameraZoomType) {
  const scaleFactor = DEFAULT_TOOLBAR_ZOOM_CONFIG.scaleFactor
  const safe = typeof scaleFactor === 'number' && Number.isFinite(scaleFactor) && scaleFactor > 1 ? scaleFactor : 1.25
  const factor = type === 'in' ? 1 / safe : safe
  const offset = new Vector3()
  offset.subVectors(camera.position, controls.target)
  offset.multiplyScalar(factor)
  camera.position.copy(controls.target.clone().add(offset))
  camera.updateProjectionMatrix()
}

function collectFitIds(args: {
  graph: GraphData
  requestType: CameraRequestType
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedGroupId?: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
  selectedGroupIds?: string[]
}) {
  const graph = args.graph
  if (args.requestType === 'selection') {
    const selectionIds = computeZoomTargetNodeIds({
      graphData: graph,
      selectedNodeId: args.selectedNodeId,
      selectedEdgeId: args.selectedEdgeId,
      selectedGroupId: args.selectedGroupId,
      selectedNodeIds: args.selectedNodeIds,
      selectedEdgeIds: args.selectedEdgeIds,
      selectedGroupIds: args.selectedGroupIds,
    })
    if (selectionIds.size > 0) {
      return selectionIds
    }
  }
  const ids = new Set<string>()
  if (ids.size === 0) {
    graph.nodes.forEach(n => ids.add(String(n.id)))
  }
  return ids
}

function toPointsFromGraph(nodes: GraphNode[], ids: Set<string>) {
  const points: Vector3[] = []
  ids.forEach(id => {
    const node = nodes.find(x => String(x.id) === id)
    if (!node) return
    const px = typeof node.x === 'number' ? node.x : 0
    const py = typeof node.y === 'number' ? node.y : 0
    points.push(new Vector3(px, py, 0))
  })
  return points
}

function toPointsFromPositions(positions: Record<string, Vec3>, ids: Set<string>) {
  const points: Vector3[] = []
  ids.forEach(id => {
    const p = positions[id]
    if (!p) return
    points.push(new Vector3(p[0], p[1], p[2]))
  })
  return points
}

export function fitCameraToGraph(options: {
  graph: GraphData
  controls: OrbitControls
  camera: PerspectiveCamera
  requestType: CameraRequestType
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedGroupId?: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
  selectedGroupIds?: string[]
}) {
  const { graph, controls, camera, requestType, selectedNodeId, selectedEdgeId, selectedGroupId, selectedNodeIds, selectedEdgeIds, selectedGroupIds } = options
  const ids = collectFitIds({ graph, requestType, selectedNodeId, selectedEdgeId, selectedGroupId, selectedNodeIds, selectedEdgeIds, selectedGroupIds })
  return fitCameraToPoints({ controls, camera, requestType, points: toPointsFromGraph(graph.nodes, ids) })
}

export function fitCameraToPositions(options: {
  graph: GraphData
  positions: Record<string, Vec3>
  controls: OrbitControls
  camera: PerspectiveCamera
  requestType: CameraRequestType
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedGroupId?: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
  selectedGroupIds?: string[]
}) {
  const { graph, positions, controls, camera, requestType, selectedNodeId, selectedEdgeId, selectedGroupId, selectedNodeIds, selectedEdgeIds, selectedGroupIds } = options
  const ids = collectFitIds({ graph, requestType, selectedNodeId, selectedEdgeId, selectedGroupId, selectedNodeIds, selectedEdgeIds, selectedGroupIds })
  return fitCameraToPoints({ controls, camera, requestType, points: toPointsFromPositions(positions, ids) })
}

export function fitCameraToPoints(options: {
  controls: OrbitControls
  camera: PerspectiveCamera
  requestType: CameraRequestType
  points: Vector3[]
}) {
  const { controls, camera, requestType, points } = options
  if (requestType === 'reset') {
    const center = new Vector3(0, 0, 0)
    controls.target.copy(center)
    const up = camera.up
    const zUp = Math.abs(up.z) >= Math.abs(up.y) && Math.abs(up.z) >= Math.abs(up.x)
    if (zUp) {
      camera.position.set(0, 0, 220)
    } else {
      camera.position.set(0, 220, 120)
    }
    camera.updateProjectionMatrix()
    return
  }
  if (!points.length) {
    return
  }
  const center = new Vector3()
  points.forEach(p => center.add(p))
  center.multiplyScalar(1 / points.length)
  let maxR = 0
  points.forEach(p => {
    const d = p.distanceTo(center)
    if (d > maxR) maxR = d
  })
  const fov = MathUtils.degToRad(camera.fov)
  const fillRatio = DEFAULT_FIT_TO_SCREEN_FILL_RATIO
  const dist = (maxR / (Math.tan(fov / 2) * Math.max(0.2, Math.min(0.95, fillRatio)))) + 40
  const offset = new Vector3()
  offset.subVectors(camera.position, controls.target)
  if (offset.lengthSq() < 1e-6) {
    offset.set(0, 0, dist)
  } else {
    offset.normalize().multiplyScalar(dist)
  }
  controls.target.copy(center)
  camera.position.copy(center.clone().add(offset))
  camera.updateProjectionMatrix()
}
