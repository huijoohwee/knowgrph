import React, { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { Vec3 } from './layout'
import { applyZoomStep, fitCameraToPositions, type CameraRequestType, getCameraConfig } from './camera'

type SelectionPerfWindow = Window & { __KG_SELECTION_PERF_ENABLED__?: boolean };

export function Controls({ schema, positions, paused }: { schema: GraphSchema; positions: Record<string, Vec3>; paused?: boolean }) {
  const { camera, gl } = useThree()
  const perspectiveCamera = camera as THREE.PerspectiveCamera
  const controls = useMemo(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.enableDamping = true
    return c
  }, [camera, gl])
  const threeCameraRequest = useGraphStore(s => s.threeCameraRequest)
  const data = useGraphStore(s => s.graphData)
  const fitToScreenMode = useGraphStore(s => s.fitToScreenMode)
  const requestThreeCamera = useGraphStore(s => s.requestThreeCamera)
  const viewPinned = useGraphStore(s => s.viewPinned)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const zoomToSelectionMode = useGraphStore(s => s.zoomToSelectionMode)
  const expansionCfg = schema.behavior?.expansion || {}
  const zoomOnSelectionEnabled = expansionCfg.enabled !== false && expansionCfg.zoomOnSelection !== false
  useFrame(() => {
    if (paused) return
    controls.update()
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
    if (paused) return
    const req = threeCameraRequest
    if (!req) return
    if (viewPinned && req.type !== 'in' && req.type !== 'out') {
      useGraphStore.getState().clearThreeCameraRequest()
      return
    }
    const enabled =
      typeof window !== 'undefined' &&
      (window as SelectionPerfWindow).__KG_SELECTION_PERF_ENABLED__ === true;
    const t0 = enabled ? performance.now() : 0;
    if (req.type === 'in' || req.type === 'out') {
      applyZoomStep(controls, perspectiveCamera, req.type)
      useGraphStore.getState().clearThreeCameraRequest()
      if (enabled) {
        const durationMs = performance.now() - t0;
        try {
          const event = new CustomEvent('kg-selection-perf', {
            detail: { subscriber: 'three' as const, durationMs, ts: performance.now() },
          });
          window.dispatchEvent(event);
        } catch {
          void 0;
        }
      }
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
    if (enabled) {
      const durationMs = performance.now() - t0;
      try {
        const event = new CustomEvent('kg-selection-perf', {
          detail: { subscriber: 'three' as const, durationMs, ts: performance.now() },
        });
        window.dispatchEvent(event);
      } catch {
        void 0;
      }
    }
  }, [paused, viewPinned, threeCameraRequest, data, selectedNodeId, selectedEdgeId, positions, perspectiveCamera, controls, zoomOnSelectionEnabled])
  React.useEffect(() => {
    return () => {
      try { controls.dispose() } catch { void 0 }
    }
  }, [controls])
  return null
}
