import React, { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { ThreeCameraPose, ThreeCameraSnapshotFns } from '@/hooks/store/types'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { selectionPerfEnd, selectionPerfStart } from '@/lib/selectionPerf'
import type { Vec3 } from './layout'
import { applyZoomStep, fitCameraToPositions, type CameraRequestType, getCameraConfig } from './camera'

export function Controls({
  schema,
  positions,
  paused,
  onControlsChange,
}: {
  schema: GraphSchema
  positions: Record<string, Vec3>
  paused?: boolean
  onControlsChange?: () => void
}) {
  const { camera, gl } = useThree()
  const perspectiveCamera = camera as THREE.PerspectiveCamera
  const controls = useMemo(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.enableDamping = true
    c.minDistance = 0.05
    return c
  }, [camera, gl])
  const threeCameraRequest = useGraphStore(s => s.threeCameraRequest)
  const data = useGraphStore(s => s.graphData)
  const fitToScreenMode = useGraphStore(s => s.fitToScreenMode)
  const requestThreeCamera = useGraphStore(s => s.requestThreeCamera)
  const registerThreeCameraSnapshotFns = useGraphStore(s => s.registerThreeCameraSnapshotFns)
  const viewPinned = useGraphStore(s => s.viewPinned)
  const threeCameraAutoClip = useGraphStore(s => s.threeCameraAutoClip)
  const threeCameraAutoClipNearFactor = useGraphStore(s => s.threeCameraAutoClipNearFactor)
  const threeCameraAutoClipFarFactor = useGraphStore(s => s.threeCameraAutoClipFarFactor)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const zoomToSelectionMode = useGraphStore(s => s.zoomToSelectionMode)
  const expansionCfg = schema.behavior?.expansion || {}
  const zoomOnSelectionEnabled = expansionCfg.enabled !== false && expansionCfg.zoomOnSelection !== false
  React.useEffect(() => {
    if (!onControlsChange) return
    const handler = () => {
      try {
        onControlsChange()
      } catch {
        void 0
      }
    }
    try {
      controls.addEventListener('change', handler)
    } catch {
      void 0
    }
    return () => {
      try {
        controls.removeEventListener('change', handler)
      } catch {
        void 0
      }
    }
  }, [controls, onControlsChange])
  useFrame(() => {
    if (paused) return
    controls.update()
    if (!threeCameraAutoClip) return
    const dist = camera.position.distanceTo(controls.target)
    if (!Number.isFinite(dist) || dist <= 0) return
    const nearFactor = typeof threeCameraAutoClipNearFactor === 'number' && Number.isFinite(threeCameraAutoClipNearFactor) && threeCameraAutoClipNearFactor > 0
      ? threeCameraAutoClipNearFactor
      : 0.0001
    const farFactor = typeof threeCameraAutoClipFarFactor === 'number' && Number.isFinite(threeCameraAutoClipFarFactor) && threeCameraAutoClipFarFactor > 1
      ? threeCameraAutoClipFarFactor
      : 200
    const nextNear = Math.max(0.000001, dist * nearFactor)
    const nextFar = Math.max(nextNear + 1, dist * farFactor)
    const pc = perspectiveCamera
    const nearChanged = Math.abs((pc.near || 0) - nextNear) / Math.max(1e-6, pc.near || 1) > 0.15
    const farChanged = Math.abs((pc.far || 0) - nextFar) / Math.max(1e-6, pc.far || 1) > 0.15
    if (!nearChanged && !farChanged) return
    pc.near = nextNear
    pc.far = nextFar
    try {
      pc.updateProjectionMatrix()
    } catch {
      void 0
    }
  })
  const lastFitDepsRef = React.useRef<{ nodesCount: number } | null>(null)
  React.useEffect(() => {
    if (paused || viewPinned) return
    if (!fitToScreenMode) {
      lastFitDepsRef.current = null
      return
    }
    const graph = data as GraphData | null
    if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) return
    const next = { nodesCount: graph.nodes.length }
    const prev = lastFitDepsRef.current
    if (prev && prev.nodesCount === next.nodesCount) {
      return
    }
    lastFitDepsRef.current = next
    try {
      requestThreeCamera('fit')
    } catch {
      void 0
    }
  }, [paused, viewPinned, fitToScreenMode, data, requestThreeCamera])
  const lastSelectionRef = React.useRef<{ nodeId: string | null; edgeId: string | null } | null>(null)
  React.useEffect(() => {
    if (paused || viewPinned) return
    if (!zoomToSelectionMode || !zoomOnSelectionEnabled) {
      lastSelectionRef.current = { nodeId: selectedNodeId, edgeId: selectedEdgeId }
      return
    }
    const prev = lastSelectionRef.current
    if (prev && prev.nodeId === selectedNodeId && prev.edgeId === selectedEdgeId) {
      return
    }
    lastSelectionRef.current = { nodeId: selectedNodeId, edgeId: selectedEdgeId }
    if (!selectedNodeId && !selectedEdgeId) return
    try {
      requestThreeCamera('selection')
    } catch {
      void 0
    }
  }, [paused, viewPinned, zoomToSelectionMode, zoomOnSelectionEnabled, selectedNodeId, selectedEdgeId, requestThreeCamera])
  React.useEffect(() => {
    const cfg = getCameraConfig(schema)
    controls.dampingFactor = cfg.dampingFactor
    controls.rotateSpeed = cfg.rotateSpeed
    controls.zoomSpeed = cfg.zoomSpeed
    controls.panSpeed = cfg.panSpeed
    controls.autoRotate = cfg.autoRotate && !viewPinned
    controls.autoRotateSpeed = cfg.autoRotateSpeed
  }, [controls, schema, viewPinned])
  React.useEffect(() => {
    controls.enabled = !paused
  }, [controls, paused])
  React.useEffect(() => {
    const fns: ThreeCameraSnapshotFns = {
      capturePose: (): ThreeCameraPose | null => {
        try {
          const pos = camera.position
          const quat = camera.quaternion
          const t = controls.target
          const pc = perspectiveCamera
          return {
            position: { x: pos.x, y: pos.y, z: pos.z },
            quaternion: { x: quat.x, y: quat.y, z: quat.z, w: quat.w },
            target: { x: t.x, y: t.y, z: t.z },
            fov: typeof pc?.fov === 'number' && Number.isFinite(pc.fov) ? pc.fov : undefined,
            zoom: typeof pc?.zoom === 'number' && Number.isFinite(pc.zoom) ? pc.zoom : undefined,
          }
        } catch {
          return null
        }
      },
      restorePose: (pose: ThreeCameraPose) => {
        try {
          camera.position.set(pose.position.x, pose.position.y, pose.position.z)
          camera.quaternion.set(pose.quaternion.x, pose.quaternion.y, pose.quaternion.z, pose.quaternion.w)
          controls.target.set(pose.target.x, pose.target.y, pose.target.z)
          if (typeof pose.fov === 'number' && Number.isFinite(pose.fov)) {
            perspectiveCamera.fov = pose.fov
          }
          if (typeof pose.zoom === 'number' && Number.isFinite(pose.zoom)) {
            perspectiveCamera.zoom = pose.zoom
          }
          try {
            perspectiveCamera.updateProjectionMatrix()
          } catch {
            void 0
          }
          controls.update()
        } catch {
          void 0
        }
      },
    }
    registerThreeCameraSnapshotFns(fns)
    return () => {
      registerThreeCameraSnapshotFns(null)
    }
  }, [camera, controls, perspectiveCamera, registerThreeCameraSnapshotFns])
  React.useEffect(() => {
    if (paused) return
    const req = threeCameraRequest
    if (!req) return
    if (viewPinned && req.type !== 'in' && req.type !== 'out') {
      useGraphStore.getState().clearThreeCameraRequest()
      return
    }
    const t0 = selectionPerfStart()
    if (req.type === 'in' || req.type === 'out') {
      applyZoomStep(controls, perspectiveCamera, req.type)
      useGraphStore.getState().clearThreeCameraRequest()
      selectionPerfEnd('three', t0)
      return
    }
    const graph = data as GraphData | null
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      useGraphStore.getState().clearThreeCameraRequest()
      return
    }
    let requestType: CameraRequestType
    if (req.type === 'selection') {
      if (!zoomOnSelectionEnabled) {
        useGraphStore.getState().clearThreeCameraRequest()
        return
      }
      requestType = 'selection'
    } else if (req.type === 'reset') {
      requestType = 'reset'
    } else {
      requestType = 'fit'
    }
    fitCameraToPositions({
      graph,
      positions,
      controls,
      camera: perspectiveCamera,
      requestType,
      selectedNodeId,
      selectedEdgeId,
    })
    useGraphStore.getState().clearThreeCameraRequest()
    selectionPerfEnd('three', t0)
  }, [paused, viewPinned, threeCameraRequest, data, selectedNodeId, selectedEdgeId, positions, perspectiveCamera, controls, zoomOnSelectionEnabled])
  React.useEffect(() => {
    return () => {
      try { controls.dispose() } catch { void 0 }
    }
  }, [controls])
  return null
}
