import React, { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { ThreeCameraPose, ThreeCameraSnapshotFns } from '@/hooks/store/types'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { selectionPerfEnd, selectionPerfStart } from '@/lib/selectionPerf'
import type { Vec3 } from './layout'
import { applyZoomStep, fitCameraToPositions, type CameraRequestType, getCameraConfig } from './camera'
import { buildAutoFitToScreenSignature, buildAutoZoomSelectionSignature } from '@/lib/zoom/autoModeSignatures'
import type { Canvas3dModeId } from '@/lib/config'
import { isD3Like2dRenderer } from '@/lib/config.render'
import { buildVoxelCameraIntroPoses, readVoxelCameraConfig } from './voxelCamera'

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

const easeOutCubic = (t: number): number => {
  const p = clamp(t, 0, 1)
  const u = 1 - p
  return 1 - u * u * u
}

export function Controls({
  schema,
  positions,
  paused,
  mode = '3d',
  onControlsChange,
}: {
  schema: GraphSchema
  positions: Record<string, Vec3>
  paused?: boolean
  mode?: Canvas3dModeId
  onControlsChange?: () => void
}) {
  const { camera, gl, size } = useThree()
  const perspectiveCamera = camera as PerspectiveCamera
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
  const selectedGroupId = useGraphStore(s => s.selectedGroupId)
  const selectedNodeIds = useGraphStore(s => s.selectedNodeIds)
  const selectedEdgeIds = useGraphStore(s => s.selectedEdgeIds)
  const selectedGroupIds = useGraphStore(s => s.selectedGroupIds)
  const zoomToSelectionMode = useGraphStore(s => s.zoomToSelectionMode)
  const canvas2dRenderer = useGraphStore(s => s.canvas2dRenderer)
  const expansionCfg = schema.behavior?.expansion || {}
  const zoomOnSelectionEnabled = expansionCfg.enabled !== false && expansionCfg.zoomOnSelection !== false
  const cameraPathUserInteractingRef = React.useRef(false)
  const cameraPathInteractionAtRef = React.useRef(0)
  const cameraPathPhaseRef = React.useRef(0)
  const cameraPathDistanceScaleRef = React.useRef(1)
  const cameraPathDesiredRef = React.useRef(new Vector3())
  const lastInteractionAtRef = React.useRef<number>(Date.now())
  const previousModeRef = React.useRef<Canvas3dModeId>(mode)
  const voxelIntroRef = React.useRef<null | {
    startAtMs: number
    delayMs: number
    durationMs: number
    from: { px: number; py: number; pz: number; tx: number; ty: number; tz: number }
    to: { px: number; py: number; pz: number; tx: number; ty: number; tz: number }
  }>(null)
  React.useEffect(() => {
    const handleStart = () => {
      cameraPathUserInteractingRef.current = true
      cameraPathInteractionAtRef.current = Date.now()
      lastInteractionAtRef.current = Date.now()
    }
    const handleEnd = () => {
      cameraPathUserInteractingRef.current = false
      cameraPathInteractionAtRef.current = Date.now()
      lastInteractionAtRef.current = Date.now()
    }
    try {
      controls.addEventListener('start', handleStart)
      controls.addEventListener('end', handleEnd)
    } catch {
      void 0
    }
    return () => {
      try {
        controls.removeEventListener('start', handleStart)
        controls.removeEventListener('end', handleEnd)
      } catch {
        void 0
      }
    }
  }, [controls])
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
  useFrame((_, delta) => {
    if (paused) return
    const voxelIntro = voxelIntroRef.current
    if (voxelIntro) {
      if (cameraPathUserInteractingRef.current) {
        voxelIntroRef.current = null
      } else {
        const now = Date.now()
        const elapsedMs = now - voxelIntro.startAtMs - voxelIntro.delayMs
        const durMs = Math.max(80, voxelIntro.durationMs)
        const t = elapsedMs <= 0 ? 0 : elapsedMs / durMs
        const k = easeOutCubic(t)
        const inv = 1 - k
        const px = voxelIntro.from.px * inv + voxelIntro.to.px * k
        const py = voxelIntro.from.py * inv + voxelIntro.to.py * k
        const pz = voxelIntro.from.pz * inv + voxelIntro.to.pz * k
        const tx = voxelIntro.from.tx * inv + voxelIntro.to.tx * k
        const ty = voxelIntro.from.ty * inv + voxelIntro.to.ty * k
        const tz = voxelIntro.from.tz * inv + voxelIntro.to.tz * k
        camera.position.set(px, py, pz)
        controls.target.set(tx, ty, tz)
        if (t >= 1) voxelIntroRef.current = null
      }
    }
    controls.update()
    if (mode === 'voxel') {
      let corrected = false
      if (controls.target.z < 0) {
        const lift = -controls.target.z
        controls.target.z += lift
        camera.position.z += lift
        corrected = true
      }
      const minCameraZ = controls.target.z + 6
      if (camera.position.z < minCameraZ) {
        camera.position.z = minCameraZ
        corrected = true
      }
      if (corrected) {
        try {
          camera.lookAt(controls.target)
        } catch {
          void 0
        }
        try {
          controls.update()
        } catch {
          void 0
        }
      }
    }
    const threeCfg = schema.three || {}
    const globeEffectsEnabled = threeCfg.globeEffectsEnabled !== false
    const layoutMode = schema.layout?.mode
    const d3Like = isD3Like2dRenderer(canvas2dRenderer)
    const cameraPathEnabled = globeEffectsEnabled && threeCfg.globeCameraEllipseEnabled !== false && layoutMode === 'radial' && d3Like && !viewPinned
    if (cameraPathEnabled) {
      const sphereRadius = clamp(
        typeof threeCfg.sphereRadius === 'number' && Number.isFinite(threeCfg.sphereRadius) ? threeCfg.sphereRadius : 120,
        50,
        560,
      )
      const speed = clamp(
        typeof threeCfg.globeCameraEllipseSpeed === 'number' && Number.isFinite(threeCfg.globeCameraEllipseSpeed) ? threeCfg.globeCameraEllipseSpeed : 0.09,
        0,
        0.4,
      )
      const radiusXFactor = clamp(
        typeof threeCfg.globeCameraEllipseRadiusXFactor === 'number' && Number.isFinite(threeCfg.globeCameraEllipseRadiusXFactor) ? threeCfg.globeCameraEllipseRadiusXFactor : 1.18,
        0.4,
        2.2,
      )
      const radiusZFactor = clamp(
        typeof threeCfg.globeCameraEllipseRadiusZFactor === 'number' && Number.isFinite(threeCfg.globeCameraEllipseRadiusZFactor) ? threeCfg.globeCameraEllipseRadiusZFactor : 0.92,
        0.4,
        2.2,
      )
      const heightFactor = clamp(
        typeof threeCfg.globeCameraEllipseHeightFactor === 'number' && Number.isFinite(threeCfg.globeCameraEllipseHeightFactor) ? threeCfg.globeCameraEllipseHeightFactor : 0.32,
        0,
        1,
      )
      const follow = clamp(
        typeof threeCfg.globeCameraEllipseFollow === 'number' && Number.isFinite(threeCfg.globeCameraEllipseFollow) ? threeCfg.globeCameraEllipseFollow : 0.12,
        0.02,
        1,
      )
      const rx = Math.max(12, sphereRadius * radiusXFactor)
      const rz = Math.max(12, sphereRadius * radiusZFactor)
      const now = Date.now()
      const target = controls.target
      const dx = camera.position.x - target.x
      const dz = camera.position.z - target.z
      const phaseFromCamera = Math.atan2(dz / Math.max(1e-6, rz), dx / Math.max(1e-6, rx))
      const inferredScale = Math.sqrt(
        ((dx / Math.max(1e-6, rx)) * (dx / Math.max(1e-6, rx))) +
        ((dz / Math.max(1e-6, rz)) * (dz / Math.max(1e-6, rz))),
      )
      if (Number.isFinite(inferredScale) && inferredScale > 0) {
        const scale = clamp(inferredScale, 0.35, 4)
        if (cameraPathUserInteractingRef.current || now - cameraPathInteractionAtRef.current < 460) {
          cameraPathDistanceScaleRef.current = scale
        } else if (!(cameraPathDistanceScaleRef.current > 0)) {
          cameraPathDistanceScaleRef.current = scale
        }
      }
      if (cameraPathUserInteractingRef.current || now - cameraPathInteractionAtRef.current < 460) {
        if (Number.isFinite(phaseFromCamera)) cameraPathPhaseRef.current = phaseFromCamera
      } else if (speed > 0) {
        cameraPathPhaseRef.current += delta * speed * Math.PI * 2
        const phase = cameraPathPhaseRef.current
        const scale = clamp(cameraPathDistanceScaleRef.current || 1, 0.35, 4)
        const desiredY = target.y + sphereRadius * heightFactor * scale + Math.sin(phase * 0.6) * (sphereRadius * 0.08) * Math.min(1.6, scale)
        const desired = cameraPathDesiredRef.current.set(
          target.x + Math.cos(phase) * rx * scale,
          desiredY,
          target.z + Math.sin(phase) * rz * scale,
        )
        const alpha = clamp(follow * delta * 60, 0, 1)
        camera.position.lerp(desired, alpha)
        camera.lookAt(target)
      }
    }
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
  const lastFitSigRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (paused || viewPinned) return
    if (!fitToScreenMode) {
      lastFitSigRef.current = null
      return
    }
    const graph = data as GraphData | null
    if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) return
    const sig = buildAutoFitToScreenSignature({
      nodeCount: graph.nodes.length,
      viewportW: size.width,
      viewportH: size.height,
      graphDataRevision: useGraphStore.getState().graphDataRevision || 0,
      schema: schema as GraphSchema,
      mediaPanelDensity: useGraphStore.getState().mediaPanelDensity,
      renderMediaAsNodes: useGraphStore.getState().renderMediaAsNodes === true,
    })
    if (lastFitSigRef.current === sig) return
    lastFitSigRef.current = sig
    try {
      requestThreeCamera('fit')
    } catch {
      void 0
    }
  }, [paused, viewPinned, fitToScreenMode, data, requestThreeCamera, schema, size.height, size.width])
  const lastSelectionKeyRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (paused || viewPinned) return
    if (!zoomToSelectionMode || !zoomOnSelectionEnabled) {
      lastSelectionKeyRef.current = null
      return
    }
    const key = buildAutoZoomSelectionSignature({
      graphDataRevision: useGraphStore.getState().graphDataRevision || 0,
      selectedNodeId,
      selectedEdgeId,
      selectedGroupId,
      selectedNodeIds,
      selectedEdgeIds,
      selectedGroupIds,
    })
    if (!key) return
    if (lastSelectionKeyRef.current === key) return
    lastSelectionKeyRef.current = key
    try {
      requestThreeCamera('selection')
    } catch {
      void 0
    }
  }, [
    paused,
    viewPinned,
    zoomToSelectionMode,
    zoomOnSelectionEnabled,
    selectedEdgeId,
    selectedEdgeIds,
    selectedGroupId,
    selectedGroupIds,
    selectedNodeId,
    selectedNodeIds,
    requestThreeCamera,
  ])
  React.useEffect(() => {
    const cfg = getCameraConfig(schema)
    const globeEffectsEnabled = schema.three?.globeEffectsEnabled !== false
    const globeCameraEllipseEnabled = schema.three?.globeCameraEllipseEnabled !== false
    const d3Like = isD3Like2dRenderer(canvas2dRenderer)
    const layoutMode = schema.layout?.mode
    const pathEnabled = globeEffectsEnabled && globeCameraEllipseEnabled && layoutMode === 'radial' && d3Like
    const voxelMode = mode === 'voxel'
    const topBiasedOrbit = voxelMode || mode === '3d' || mode === 'xr'
    const orbitProfile = voxelMode
      ? {
          rotateFactor: 0.68,
          zoomFactor: 0.52,
          minPolar: 0.12,
          maxPolar: Math.PI * 0.46,
          minDistance: 16,
          maxDistance: 1200,
        }
      : topBiasedOrbit
        ? {
            rotateFactor: 0.74,
            zoomFactor: 0.6,
            minPolar: 0.1,
            maxPolar: Math.PI * 0.44,
            minDistance: 12,
            maxDistance: 1400,
          }
        : {
            rotateFactor: 1,
            zoomFactor: 1,
            minPolar: 0.03,
            maxPolar: Math.PI - 0.03,
            minDistance: 0.05,
            maxDistance: Infinity,
          }
    const globeAutoRotateSpeed =
      typeof schema.three?.globeAutoRotateSpeed === 'number' && Number.isFinite(schema.three.globeAutoRotateSpeed)
        ? Math.max(0, Math.min(0.4, schema.three.globeAutoRotateSpeed))
        : 0.11
    const st = useGraphStore.getState()
    const m = typeof st.canvasInteractionSpeedMultiplier === 'number' && Number.isFinite(st.canvasInteractionSpeedMultiplier) ? st.canvasInteractionSpeedMultiplier : 1
    const safe = Math.max(0.1, Math.min(10, m))
    const voxelIdleDelayMs = typeof schema.three?.voxelIdleAutoRotateDelayMs === 'number' && Number.isFinite(schema.three.voxelIdleAutoRotateDelayMs)
      ? Math.max(0, Math.min(6000, schema.three.voxelIdleAutoRotateDelayMs))
      : 900
    const voxelIdleRotateSpeed = typeof schema.three?.voxelIdleAutoRotateSpeed === 'number' && Number.isFinite(schema.three.voxelIdleAutoRotateSpeed)
      ? Math.max(0, Math.min(1.5, schema.three.voxelIdleAutoRotateSpeed))
      : globeAutoRotateSpeed
    const voxelAnimationEnabled = schema.three?.voxelAnimationEnabled !== false

    try {
      if (mode === 'voxel') {
        camera.up.set(0, 0, 1)
      } else {
        camera.up.set(0, 1, 0)
      }
      controls.enableRotate = true
    } catch {
      void 0
    }
    controls.dampingFactor = cfg.dampingFactor
    controls.rotateSpeed = cfg.rotateSpeed * safe * orbitProfile.rotateFactor
    controls.zoomSpeed = cfg.zoomSpeed * safe * orbitProfile.zoomFactor
    controls.panSpeed = cfg.panSpeed * safe
    controls.screenSpacePanning = !topBiasedOrbit
    controls.minPolarAngle = orbitProfile.minPolar
    controls.maxPolarAngle = orbitProfile.maxPolar
    controls.minDistance = orbitProfile.minDistance
    controls.maxDistance = orbitProfile.maxDistance
    const idleMs = Date.now() - lastInteractionAtRef.current
    const voxelIdleAutoRotate = mode === 'voxel' ? idleMs >= voxelIdleDelayMs : true
    controls.autoRotate = mode === 'voxel'
      ? (voxelAnimationEnabled && !viewPinned && voxelIdleAutoRotate)
      : (!pathEnabled && (cfg.autoRotate || globeEffectsEnabled) && !viewPinned && voxelIdleAutoRotate)
    controls.autoRotateSpeed = mode === 'voxel' ? voxelIdleRotateSpeed : (globeEffectsEnabled ? globeAutoRotateSpeed : cfg.autoRotateSpeed)
    try {
      controls.update()
    } catch {
      void 0
    }
  }, [camera, canvas2dRenderer, controls, mode, schema, viewPinned])
  React.useEffect(() => {
    const wasMode = previousModeRef.current
    previousModeRef.current = mode
    if (paused || mode !== 'voxel') {
      voxelIntroRef.current = null
      return
    }
    const enteredVoxel = wasMode !== 'voxel'
    if (!enteredVoxel) return
    if (viewPinned) return
    const cfg = readVoxelCameraConfig(schema)
    const poses = buildVoxelCameraIntroPoses(positions, cfg)
    if (!poses) return
    const applyPose = (pose: { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } }) => {
      camera.position.set(pose.position.x, pose.position.y, pose.position.z)
      controls.target.set(pose.target.x, pose.target.y, pose.target.z)
      try {
        camera.lookAt(controls.target)
      } catch {
        void 0
      }
      try {
        controls.update()
      } catch {
        void 0
      }
    }
    if (!cfg.introEnabled) {
      voxelIntroRef.current = null
      applyPose(poses.end)
      return
    }
    applyPose(poses.start)
    voxelIntroRef.current = {
      startAtMs: Date.now(),
      delayMs: cfg.introDelayMs,
      durationMs: cfg.introDurationMs,
      from: {
        px: poses.start.position.x,
        py: poses.start.position.y,
        pz: poses.start.position.z,
        tx: poses.start.target.x,
        ty: poses.start.target.y,
        tz: poses.start.target.z,
      },
      to: {
        px: poses.end.position.x,
        py: poses.end.position.y,
        pz: poses.end.position.z,
        tx: poses.end.target.x,
        ty: poses.end.target.y,
        tz: poses.end.target.z,
      },
    }
  }, [camera, controls, mode, paused, positions, schema, viewPinned])
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
      selectedGroupId,
      selectedNodeIds,
      selectedEdgeIds,
      selectedGroupIds,
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
