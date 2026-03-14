import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import type { GraphData, GraphNode, GraphEdge, JSONValue } from '@/lib/graph/types'
import { defaultSchema, type GraphSchema } from '@/lib/graph/schema'
import { usePositions } from './layout'
import { GraphHoverTooltip, type HoverInfo } from '@/components/GraphHoverTooltip'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { Vector3, Quaternion, Matrix4, type Camera, type Scene as ThreeScene, type WebGLRenderer } from 'three'
import { useThemeDetector } from '@/hooks/useThemeDetector'
import type { ThreeCameraPose } from '@/hooks/store/types'
import RichMediaPanel from '@/components/RichMediaPanel'
import { applyMediaPanelCssVars, applyPanelBox, computeMediaPanelCssVars3d, computePanelRect, computePanelSizeFromContent16x9 } from '@/lib/render/mediaPanelLayout'
import { listMediaOverlayNodes } from '@/lib/render/mediaOverlayPool'

const SceneLazy = React.lazy(() =>
  import('./Scene').then(mod => ({
    default: mod.Scene,
  })),
)

const ControlsLazy = React.lazy(() =>
  import('./Controls').then(mod => ({
    default: mod.Controls,
  })),
)

function OverlayFrameSync({ enabled, scheduleRef }: { enabled: boolean; scheduleRef: React.MutableRefObject<(() => void) | null> }) {
  useFrame(() => {
    if (!enabled) return
    try {
      scheduleRef.current?.()
    } catch {
      void 0
    }
  })
  return null
}

export default function ThreeGraph({ active = true }: { active?: boolean }) {
  const {
    schema,
    selectNode,
    selectEdge,
    setSelectionSource,
  } = useGraphStore()
  const {
    renderMediaAsNodes,
    mediaPanelDensity,
    threeIframeOverlayPoolMax,
    threeIframeOverlayMaxVisibleDefault,
    threeIframeOverlayMaxVisibleCompact,
    threeIframeOverlayMaxDistanceDefault,
    threeIframeOverlayMaxDistanceCompact,
    threeIframeOverlayBaseWidthRatioDefault,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMaxPxCompact,
    threeIframeOverlaySizeScaleFactor,
    selectedNodeId,
    selectedNodeIds,
  } = useGraphStore(
    useShallow(s => ({
      renderMediaAsNodes: s.renderMediaAsNodes === true,
      mediaPanelDensity: s.mediaPanelDensity,
      threeIframeOverlayPoolMax: s.threeIframeOverlayPoolMax,
      threeIframeOverlayMaxVisibleDefault: s.threeIframeOverlayMaxVisibleDefault,
      threeIframeOverlayMaxVisibleCompact: s.threeIframeOverlayMaxVisibleCompact,
      threeIframeOverlayMaxDistanceDefault: s.threeIframeOverlayMaxDistanceDefault,
      threeIframeOverlayMaxDistanceCompact: s.threeIframeOverlayMaxDistanceCompact,
      threeIframeOverlayBaseWidthRatioDefault: s.threeIframeOverlayBaseWidthRatioDefault,
      threeIframeOverlayBaseWidthRatioCompact: s.threeIframeOverlayBaseWidthRatioCompact,
      threeIframeOverlayBaseWidthMinPxDefault: s.threeIframeOverlayBaseWidthMinPxDefault,
      threeIframeOverlayBaseWidthMinPxCompact: s.threeIframeOverlayBaseWidthMinPxCompact,
      threeIframeOverlayBaseWidthMaxPxDefault: s.threeIframeOverlayBaseWidthMaxPxDefault,
      threeIframeOverlayBaseWidthMaxPxCompact: s.threeIframeOverlayBaseWidthMaxPxCompact,
      threeIframeOverlaySizeScaleFactor: s.threeIframeOverlaySizeScaleFactor,
      selectedNodeId: s.selectedNodeId,
      selectedNodeIds: s.selectedNodeIds,
    })),
  )
  const registerCanvasSnapshotFns = useGraphStore(s => s.registerCanvasSnapshotFns)
  const registerThreeGlbSnapshotFns = useGraphStore(s => s.registerThreeGlbSnapshotFns)
  const registerThreeLayoutSnapshotFns = useGraphStore(s => s.registerThreeLayoutSnapshotFns)
  const glCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const threeSceneRef = React.useRef<ThreeScene | null>(null)
  const threeCameraRef = React.useRef<Camera | null>(null)
  const threeGlRef = React.useRef<WebGLRenderer | null>(null)
  const iframeOverlayElsRef = React.useRef<Map<string, HTMLDivElement>>(new Map())
  const iframeOverlayVisibleIdsRef = React.useRef<Set<string>>(new Set())
  const iframeOverlayScheduleRef = React.useRef<(() => void) | null>(null)
  const iframeOverlayRefFnByIdRef = React.useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map())
  const iframeOverlayScheduleRafRef = React.useRef<number | null>(null)
  const iframeOverlaySchedulePendingRef = React.useRef<boolean>(false)
  const overlayPointerOverrideActiveRef = React.useRef<boolean>(false)
  const dragOverridesRef = React.useRef<Record<string, [number, number, number]>>({})
  const overlayHeaderDrag3dRef = React.useRef<null | { id: string; pointerId: number; sx: number; sy: number; ndcZ: number; w: number; h: number }>(null)
  const overlayPan3dRef = React.useRef<null | { pointerId: number; pose: ThreeCameraPose }>(null)
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null)
  useEffect(() => {
    if (typeof document === 'undefined') {
      setWebglSupported(false)
      return
    }
    try {
      const canvas = document.createElement('canvas')
      const gl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl' as never)
      setWebglSupported(!!gl)
    } catch {
      setWebglSupported(false)
    }
  }, [])
  const paused = !active
  const graph = useActiveGraphRenderData() as GraphData | null
  const s = schema as GraphSchema | null
  const effectiveSchema = useMemo<GraphSchema>(() => s || defaultSchema, [s])
  const renderGraphRef = useRef<GraphData | null>(null)
  const renderGraph = useMemo(() => {
    if (paused && renderGraphRef.current) return renderGraphRef.current
    renderGraphRef.current = graph
    return graph
  }, [paused, graph])
  const hasGraph = !!(renderGraph && Array.isArray(renderGraph.nodes) && Array.isArray(renderGraph.edges))
  const hoverEnabled = (effectiveSchema as GraphSchema).behavior?.hover?.enabled !== false
  const positions = usePositions(hasGraph ? (renderGraph as GraphData).nodes : [], hasGraph ? (effectiveSchema as GraphSchema) : null)
  const positionsRef = React.useRef<Record<string, [number, number, number]>>({})
  positionsRef.current = positions as unknown as Record<string, [number, number, number]>
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
  const hoverClearTimerRef = useRef<number | null>(null)
  const theme = useThemeDetector()
  useEffect(() => {
    if (!hoverEnabled) {
      setHoverInfo(null)
    }
  }, [hoverEnabled])
  useEffect(() => {
    return () => {
      try {
        registerCanvasSnapshotFns('3d', null)
      } catch {
        void 0
      }
      try {
        registerThreeGlbSnapshotFns(null)
      } catch {
        void 0
      }
      try {
        registerThreeLayoutSnapshotFns(null)
      } catch {
        void 0
      }
    }
  }, [registerCanvasSnapshotFns, registerThreeGlbSnapshotFns, registerThreeLayoutSnapshotFns])

  useEffect(() => {
    registerThreeLayoutSnapshotFns({
      capturePositions: () => {
        try {
          const cur = positionsRef.current
          const out: Record<string, [number, number, number]> = {}
          for (const id in cur) {
            const p = cur[id]
            if (!p) continue
            const x = Number(p[0])
            const y = Number(p[1])
            const z = Number(p[2])
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
            out[id] = [x, y, z]
          }
          return out
        } catch {
          return null
        }
      },
    })
    return () => {
      registerThreeLayoutSnapshotFns(null)
    }
  }, [registerThreeLayoutSnapshotFns])
  const onSelectNode = (id: string) => {
    setSelectionSource('canvas')
    selectNode(id)
  }
  const clearHoverClearTimer = useCallback(() => {
    const t = hoverClearTimerRef.current
    if (t != null) {
      try {
        window.clearTimeout(t)
      } catch {
        void 0
      }
      hoverClearTimerRef.current = null
    }
  }, [])
  useEffect(() => {
    return () => {
      clearHoverClearTimer()
    }
  }, [clearHoverClearTimer])
  const handleHoverNode = useCallback((info: { id: string; clientX: number; clientY: number } | null) => {
    if (!info) {
      clearHoverClearTimer()
      hoverClearTimerRef.current = window.setTimeout(() => {
        setHoverInfo(prev => (prev && prev.kind === 'node' ? null : prev))
        hoverClearTimerRef.current = null
      }, 80)
      return
    }
    clearHoverClearTimer()
    setHoverInfo({ kind: 'node', id: info.id, clientX: info.clientX, clientY: info.clientY })
  }, [clearHoverClearTimer])
  const handleHoverEdge = useCallback((info: { id: string; clientX: number; clientY: number } | null) => {
    if (!info) {
      clearHoverClearTimer()
      hoverClearTimerRef.current = window.setTimeout(() => {
        setHoverInfo(prev => (prev && prev.kind === 'edge' ? null : prev))
        hoverClearTimerRef.current = null
      }, 80)
      return
    }
    clearHoverClearTimer()
    setHoverInfo({ kind: 'edge', id: info.id, clientX: info.clientX, clientY: info.clientY })
  }, [clearHoverClearTimer])

  const mediaNodesPool = useMemo(() => {
    const graph = renderGraph as GraphData | null
    const nodes = graph && Array.isArray(graph.nodes) ? (graph.nodes as GraphNode[]) : []
    const poolMaxRaw = typeof threeIframeOverlayPoolMax === 'number' && Number.isFinite(threeIframeOverlayPoolMax) ? threeIframeOverlayPoolMax : 0
    const poolMax = poolMaxRaw > 0 ? poolMaxRaw : 24
    return listMediaOverlayNodes({ enabled: true, nodes, poolMax })
  }, [renderGraph, renderMediaAsNodes, threeIframeOverlayPoolMax])

  const mediaNodesKey = useMemo(() => mediaNodesPool.map(n => n.id).join('|'), [mediaNodesPool])
  const requestIframeOverlaySchedule = useCallback(() => {
    const schedule = iframeOverlayScheduleRef.current
    if (schedule) {
      schedule()
      return
    }
    iframeOverlaySchedulePendingRef.current = true
    if (iframeOverlayScheduleRafRef.current != null) return
    iframeOverlayScheduleRafRef.current = requestAnimationFrame(() => {
      iframeOverlayScheduleRafRef.current = null
      try {
        iframeOverlayScheduleRef.current?.()
      } catch {
        void 0
      }
    })
  }, [])
  useEffect(() => {
    return () => {
      const raf = iframeOverlayScheduleRafRef.current
      if (raf == null) return
      iframeOverlayScheduleRafRef.current = null
      try {
        cancelAnimationFrame(raf)
      } catch {
        void 0
      }
    }
  }, [])
  useEffect(() => {
    if (!active || !renderMediaAsNodes) return
    const schedule = () => {
      try {
        requestIframeOverlaySchedule()
      } catch {
        void 0
      }
    }
    schedule()
    const canvas = glCanvasRef.current
    const container = containerRef.current
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      try {
        ro = new ResizeObserver(() => schedule())
        if (canvas) ro.observe(canvas)
        if (container) ro.observe(container)
      } catch {
        ro = null
      }
    }
    window.addEventListener('resize', schedule, { passive: true })
    return () => {
      try {
        window.removeEventListener('resize', schedule)
      } catch {
        void 0
      }
      try {
        ro?.disconnect()
      } catch {
        void 0
      }
    }
  }, [active, renderMediaAsNodes, requestIframeOverlaySchedule])
  const getOverlayRefForId = useCallback((id: string) => {
    const key = String(id || '').trim()
    if (!key) return () => void 0
    const cached = iframeOverlayRefFnByIdRef.current.get(key)
    if (cached) return cached
    const fn = (el: HTMLDivElement | null) => {
      if (!el) {
        iframeOverlayElsRef.current.delete(key)
        return
      }
      const prev = iframeOverlayElsRef.current.get(key)
      if (prev === el) return
      iframeOverlayElsRef.current.set(key, el)
      try {
        applyPanelBox(el, { left: -99999, top: -99999, w: 1, h: 1, display: 'block' })
      } catch {
        void 0
      }
      try {
        requestIframeOverlaySchedule()
      } catch {
        void 0
      }
    }
    iframeOverlayRefFnByIdRef.current.set(key, fn)
    return fn
  }, [requestIframeOverlaySchedule])

  useEffect(() => {
    const keep = new Set<string>(mediaNodesPool.map(n => n.id))
    const overlayMap = iframeOverlayElsRef.current
    for (const [id] of overlayMap) {
      if (!keep.has(id)) overlayMap.delete(id)
    }
    const refMap = iframeOverlayRefFnByIdRef.current
    for (const [id] of refMap) {
      if (!keep.has(id)) refMap.delete(id)
    }
  }, [mediaNodesKey, mediaNodesPool])

  useEffect(() => {
    iframeOverlayScheduleRef.current = null
    if (!active) return
    if (mediaNodesPool.length === 0) return
    let raf: number | null = null
    const world = new Vector3()
    const v3 = new Vector3()
    const camSpace = new Vector3()
    const dir = new Vector3()
    const nearPoint = new Vector3()
    const candidates: Array<{ id: string; sx: number; sy: number; dist: number; sizeScale: number }> = []
    const selectedIds = new Set<string>()
    const candidateById = new Map<string, { id: string; sx: number; sy: number; dist: number; sizeScale: number }>()
    const update = () => {
      const camera = threeCameraRef.current
      const gl = threeGlRef.current
      if (!camera || !gl) return
      const w = Math.max(1, gl.domElement.clientWidth || 1)
      const h = Math.max(1, gl.domElement.clientHeight || 1)
      const density = mediaPanelDensity === 'compact' ? 'compact' : 'default'
      const maxCountRaw = density === 'compact' ? threeIframeOverlayMaxVisibleCompact : threeIframeOverlayMaxVisibleDefault
      const maxCount = Number.isFinite(maxCountRaw) ? Math.max(0, Math.floor(maxCountRaw)) : 0
      const maxDistanceRaw = density === 'compact' ? threeIframeOverlayMaxDistanceCompact : threeIframeOverlayMaxDistanceDefault
      const maxDistance = Number.isFinite(maxDistanceRaw) ? Math.max(0, Number(maxDistanceRaw)) : 0
      const prevVisibleIds = iframeOverlayVisibleIdsRef.current
      if (maxCount === 0 || maxDistance <= 0) {
        for (const id of prevVisibleIds) {
          const el = iframeOverlayElsRef.current.get(id)
          if (!el) continue
          applyPanelBox(el, { left: -99999, top: -99999, w: 1, h: 1, display: 'block', zIndex: 1 })
        }
        iframeOverlayVisibleIdsRef.current = new Set<string>()
        return
      }
      const widthRatioRaw = density === 'compact' ? threeIframeOverlayBaseWidthRatioCompact : threeIframeOverlayBaseWidthRatioDefault
      const widthRatio = Number.isFinite(widthRatioRaw) ? Math.max(0.001, Number(widthRatioRaw)) : 0.2
      const widthMinRaw = density === 'compact' ? threeIframeOverlayBaseWidthMinPxCompact : threeIframeOverlayBaseWidthMinPxDefault
      const widthMin = Number.isFinite(widthMinRaw) ? Math.max(1, Math.floor(widthMinRaw)) : 200
      const widthMaxRaw = density === 'compact' ? threeIframeOverlayBaseWidthMaxPxCompact : threeIframeOverlayBaseWidthMaxPxDefault
      const widthMax = Number.isFinite(widthMaxRaw) ? Math.max(1, Math.floor(widthMaxRaw)) : 360
      const baseW = Math.min(widthMax, Math.max(widthMin, w * widthRatio))
      const margin = 12
      selectedIds.clear()
      const selOne = String(selectedNodeId || '').trim()
      if (selOne) selectedIds.add(selOne)
      if (Array.isArray(selectedNodeIds)) {
        for (let i = 0; i < selectedNodeIds.length; i += 1) {
          const id = String(selectedNodeIds[i] || '').trim()
          if (id) selectedIds.add(id)
        }
      }
      candidates.length = 0
      for (let i = 0; i < mediaNodesPool.length; i += 1) {
        const node = mediaNodesPool[i]
        const pos3 = dragOverridesRef.current[node.id] || positions[node.id] || null
        if (!pos3) continue
        world.set(pos3[0], pos3[1], pos3[2])
        const dist = camera.position.distanceTo(world)
        if (!Number.isFinite(dist) || dist > maxDistance) continue
        try {
          camSpace.copy(world).applyMatrix4((camera as unknown as { matrixWorldInverse: unknown }).matrixWorldInverse as never)
        } catch {
          camSpace.set(0, 0, -1)
        }
        if (camSpace.z > 1e-6) continue
        const nearRaw = (camera as unknown as { near?: unknown }).near
        const near = typeof nearRaw === 'number' && Number.isFinite(nearRaw) && nearRaw > 0 ? nearRaw : 0.1
        const tooNear = Math.abs(camSpace.z) < near * 1.1
        const initialPoint = (() => {
          if (!tooNear) return world
          dir.subVectors(world, camera.position)
          const len = dir.length()
          if (len < 1e-6) return world
          dir.multiplyScalar(1 / len)
          nearPoint.copy(camera.position).addScaledVector(dir, near * 1.01)
          return nearPoint
        })()
        v3.copy(initialPoint).project(camera)
        let ndcX = v3.x
        let ndcY = v3.y
        let ndcZ = v3.z
        const unstable =
          !Number.isFinite(ndcX) ||
          !Number.isFinite(ndcY) ||
          !Number.isFinite(ndcZ) ||
          Math.abs(ndcX) > 8 ||
          Math.abs(ndcY) > 8 ||
          Math.abs(ndcZ) > 8
        if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY) || !Number.isFinite(ndcZ)) {
          dir.subVectors(world, camera.position)
          const len = dir.length()
          if (len < 1e-6) {
            ndcX = 0
            ndcY = 0
            ndcZ = 0
          } else {
            dir.multiplyScalar(1 / len)
            nearPoint.copy(camera.position).addScaledVector(dir, near * 1.01)
            v3.copy(nearPoint).project(camera)
            ndcX = v3.x
            ndcY = v3.y
            ndcZ = v3.z
          }
        }
        if (unstable) {
          dir.subVectors(world, camera.position)
          const len = dir.length()
          if (len >= 1e-6) {
            dir.multiplyScalar(1 / len)
            nearPoint.copy(camera.position).addScaledVector(dir, near * 1.01)
            v3.copy(nearPoint).project(camera)
            ndcX = v3.x
            ndcY = v3.y
            ndcZ = v3.z
          }
        }
        if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY) || !Number.isFinite(ndcZ)) continue
        const sx = (ndcX * 0.5 + 0.5) * w
        const sy = (-ndcY * 0.5 + 0.5) * h
        const sizeFactor =
          typeof threeIframeOverlaySizeScaleFactor === 'number' && Number.isFinite(threeIframeOverlaySizeScaleFactor) && threeIframeOverlaySizeScaleFactor > 0
            ? threeIframeOverlaySizeScaleFactor
            : 260
        const sizeScale = Math.max(0.001, Math.min(256, sizeFactor / Math.max(0.001, dist)))
        candidates.push({ id: node.id, sx, sy, dist, sizeScale })
      }
      candidates.sort((a, b) => {
        const d = a.dist - b.dist
        if (d) return d
        if (a.id < b.id) return -1
        if (a.id > b.id) return 1
        return 0
      })
      const nextVisibleIds = new Set<string>()
      candidateById.clear()
      for (let i = 0; i < candidates.length; i += 1) {
        const c = candidates[i]!
        candidateById.set(c.id, c)
      }
      const tryAdd = (id: string) => {
        if (nextVisibleIds.size >= maxCount) return
        if (!iframeOverlayElsRef.current.has(id)) return
        if (!candidateById.has(id)) return
        nextVisibleIds.add(id)
      }
      for (const id of selectedIds) {
        tryAdd(id)
      }
      for (const id of prevVisibleIds) {
        tryAdd(id)
      }
      let shown = 0
      shown = nextVisibleIds.size
      for (let i = 0; i < candidates.length && shown < maxCount; i += 1) {
        const c = candidates[i]!
        if (!iframeOverlayElsRef.current.has(c.id)) continue
        if (nextVisibleIds.has(c.id)) continue
        nextVisibleIds.add(c.id)
        shown += 1
      }
      for (const id of prevVisibleIds) {
        if (nextVisibleIds.has(id)) continue
        const el = iframeOverlayElsRef.current.get(id)
        if (!el) continue
        applyPanelBox(el, { left: -99999, top: -99999, w: 1, h: 1, display: 'block', zIndex: 1 })
      }
      for (let i = 0; i < candidates.length; i += 1) {
        const c = candidates[i]!
        if (!nextVisibleIds.has(c.id)) continue
        const el = iframeOverlayElsRef.current.get(c.id)
        if (!el) continue
        try {
          const applied = (el as unknown as { dataset?: Record<string, string> }).dataset?.kgMediaEagerApplied
          if (!applied) {
            const iframe = el.querySelector('iframe')
            if (iframe) {
              try {
                ;(iframe as unknown as { loading?: string }).loading = 'eager'
              } catch {
                void 0
              }
              try {
                iframe.setAttribute('loading', 'eager')
              } catch {
                void 0
              }
            }
            const img = el.querySelector('img')
            if (img) {
              try {
                ;(img as unknown as { loading?: string }).loading = 'eager'
              } catch {
                void 0
              }
              try {
                img.setAttribute('loading', 'eager')
              } catch {
                void 0
              }
            }
            try {
              ;(el as unknown as { dataset?: Record<string, string> }).dataset!.kgMediaEagerApplied = '1'
            } catch {
              void 0
            }
          }
        } catch {
          void 0
        }
        const MAX_PANEL_PX = 2048
        const STEP_PX = 16
        const maxW = Math.max(2, Math.min(MAX_PANEL_PX, Math.floor(w - margin * 2)))
        const maxH = Math.max(2, Math.min(MAX_PANEL_PX, Math.floor(h - margin * 2)))
        let contentW = Math.max(2, Math.round((baseW * c.sizeScale) / STEP_PX) * STEP_PX)
        contentW = Math.min(contentW, MAX_PANEL_PX)
        let sizeScale = Math.max(0.001, contentW / Math.max(1, baseW))
        let computed = computeMediaPanelCssVars3d({ density, sizeScale })
        let panel = computePanelSizeFromContent16x9({ contentW, metrics: computed.metrics })
        if (panel.panelW > maxW || panel.panelH > maxH) {
          const ratio = Math.min(maxW / panel.panelW, maxH / panel.panelH)
          const nextContentW = Math.max(2, Math.round((contentW * ratio) / STEP_PX) * STEP_PX)
          contentW = Math.min(MAX_PANEL_PX, nextContentW)
          sizeScale = Math.max(0.001, contentW / Math.max(1, baseW))
          computed = computeMediaPanelCssVars3d({ density, sizeScale })
          panel = computePanelSizeFromContent16x9({ contentW, metrics: computed.metrics })
        }
        const rect = computePanelRect({ cx: c.sx, cy: c.sy, w: panel.panelW, h: panel.panelH })
        const { panelW, panelH } = panel
        applyMediaPanelCssVars(el, computed.vars)
        const left = Math.round(rect.left * 10) / 10
        const top = Math.round(rect.top * 10) / 10
        applyPanelBox(el, {
          left,
          top,
          w: panelW,
          h: panelH,
          zIndex: 2000 - Math.max(0, Math.min(1500, Math.floor(c.dist))),
          display: 'block',
        })
      }
      iframeOverlayVisibleIdsRef.current = nextVisibleIds
    }
    const schedule = () => {
      if (raf != null) return
      raf = requestAnimationFrame(() => {
        raf = null
        update()
      })
    }
    iframeOverlayScheduleRef.current = schedule
    if (iframeOverlaySchedulePendingRef.current) {
      iframeOverlaySchedulePendingRef.current = false
      schedule()
    }
    schedule()
    return () => {
      if (raf != null) {
        try {
          cancelAnimationFrame(raf)
        } catch {
          void 0
        }
      }
      raf = null
      if (iframeOverlayScheduleRef.current === schedule) iframeOverlayScheduleRef.current = null
    }
  }, [
    active,
    mediaNodesKey,
    mediaNodesPool,
    mediaPanelDensity,
    positions,
    threeIframeOverlayMaxVisibleCompact,
    threeIframeOverlayMaxVisibleDefault,
    threeIframeOverlayMaxDistanceCompact,
    threeIframeOverlayMaxDistanceDefault,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthRatioDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthMaxPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlaySizeScaleFactor,
    selectedNodeId,
    selectedNodeIds,
  ])

  useEffect(() => {
    const canvas = glCanvasRef.current
    if (!active || !canvas) return
    const setOverlayPointerOverride = (enabled: boolean) => {
      if (overlayPointerOverrideActiveRef.current === enabled) return
      overlayPointerOverrideActiveRef.current = enabled
      for (const [, el] of iframeOverlayElsRef.current) {
        if (!el) continue
        if (enabled) el.style.pointerEvents = 'none'
        else el.style.removeProperty('pointer-events')
      }
    }
    const onDown = () => setOverlayPointerOverride(true)
    const onUp = () => setOverlayPointerOverride(false)
    const onCancel = () => setOverlayPointerOverride(false)
    canvas.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('pointercancel', onCancel, { passive: true })
    window.addEventListener('blur', onUp)
    return () => {
      try {
        canvas.removeEventListener('pointerdown', onDown)
      } catch {
        void 0
      }
      try {
        window.removeEventListener('pointerup', onUp)
      } catch {
        void 0
      }
      try {
        window.removeEventListener('pointercancel', onCancel)
      } catch {
        void 0
      }
      try {
        window.removeEventListener('blur', onUp)
      } catch {
        void 0
      }
      setOverlayPointerOverride(false)
    }
  }, [active])

  const stopEvent = useCallback((event: React.SyntheticEvent) => {
    try {
      event.stopPropagation()
    } catch {
      void 0
    }
  }, [])
  if (!hasGraph || webglSupported === false) {
    return (
      <div
        className="absolute inset-0 w-full h-full z-0"
      />
    )
  }
  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full z-0"
    >
      <Canvas
        frameloop={paused ? 'demand' : 'always'}
        camera={{ position: [0, 0, 220], fov: 50 }}
        shadows
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl, scene, camera }) => {
          gl.setClearColor('#000000', 0)
          try {
            glCanvasRef.current = gl.domElement as HTMLCanvasElement
          } catch {
            glCanvasRef.current = null
          }
          threeGlRef.current = gl
          threeCameraRef.current = camera || null
          threeSceneRef.current = scene || null
          try {
            requestIframeOverlaySchedule()
          } catch {
            void 0
          }
          const capturePng = async (pixelRatio?: number): Promise<Blob | null> => {
            try {
              const canvas = glCanvasRef.current
              if (!canvas) return null
              const ratio = pixelRatio && pixelRatio > 0 ? pixelRatio : 1
              if (ratio === 1 && typeof canvas.toBlob === 'function') {
                const directBlob = await new Promise<Blob | null>(resolve => {
                  canvas.toBlob(b => resolve(b), 'image/png')
                })
                return directBlob || null
              }
              const width = Math.max(1, Math.floor(canvas.width * ratio))
              const height = Math.max(1, Math.floor(canvas.height * ratio))
              const target = document.createElement('canvas')
              target.width = width
              target.height = height
              const ctx = target.getContext('2d')
              if (!ctx) return null
              ctx.clearRect(0, 0, width, height)
              ctx.drawImage(canvas, 0, 0, width, height)
              const blob = await new Promise<Blob | null>(resolve => {
                target.toBlob(b => resolve(b), 'image/png')
              })
              return blob || null
            } catch {
              return null
            }
          }
          registerCanvasSnapshotFns('3d', { capturePng })
          registerThreeGlbSnapshotFns({
            captureGlb: async () => {
              try {
                const scene = threeSceneRef.current
                if (!scene) return null
                const exporter = new GLTFExporter()
                const arrayBuffer = await new Promise<ArrayBuffer | null>(resolve => {
                  exporter.parse(
                    scene,
                    gltf => {
                      if (gltf && gltf instanceof ArrayBuffer) resolve(gltf)
                      else resolve(null)
                    },
                    () => resolve(null),
                    { binary: true },
                  )
                })
                if (!arrayBuffer) return null
                return new Blob([arrayBuffer], { type: 'model/gltf-binary' })
              } catch {
                return null
              }
            },
          })
        }}
        onPointerMissed={(ev) => {
          if (ev && typeof ev.button === 'number' && ev.button !== 0) return
          setSelectionSource('canvas')
          selectNode(null)
          selectEdge(null)
        }}
      >
        <React.Suspense fallback={null}>
          <SceneLazy
            data={renderGraph as GraphData}
            schema={effectiveSchema as GraphSchema}
            positions={positions}
            paused={paused}
            onSelectNode={onSelectNode}
            onHoverNode={hoverEnabled ? handleHoverNode : undefined}
            onHoverEdge={hoverEnabled ? handleHoverEdge : undefined}
            onDragNode={setDraggedNodeId}
            draggedNodeId={draggedNodeId}
            theme={theme}
            dragOverridesRef={dragOverridesRef as unknown as React.MutableRefObject<Record<string, [number, number, number]>>}
          />
          <ControlsLazy
            schema={effectiveSchema as GraphSchema}
            positions={positions}
            paused={paused}
            onControlsChange={() => {
              try {
                iframeOverlayScheduleRef.current?.()
              } catch {
                void 0
              }
            }}
          />
          <OverlayFrameSync enabled={active && renderMediaAsNodes} scheduleRef={iframeOverlayScheduleRef} />
        </React.Suspense>
      </Canvas>
      {active && renderMediaAsNodes && mediaNodesPool.length > 0 ? (
        <section aria-label="3D media overlay" className="absolute inset-0 z-[50] pointer-events-none">
          {mediaNodesPool.map(n => {
            return (
              <RichMediaPanel
                key={n.id}
                ref={getOverlayRefForId(n.id)}
                data-kg-canvas-wheel-ignore="true"
                data-kg-canvas-pointer-ignore="true"
                className="absolute left-0 top-0 pointer-events-auto"
                title={n.title}
                url={n.url}
                kind={n.kind}
                interactive={n.interactive}
                hideUntilReady={true}
                iframeMode="srcdoc-when-needed"
                forwardWheelTo={() => glCanvasRef.current}
                onOverlayPanStart={({ pointerId }) => {
                  const pose = useGraphStore.getState().captureThreeCameraPose()
                  if (!pose) return
                  overlayPan3dRef.current = { pointerId, pose }
                }}
                onOverlayPan={({ pointerId, dx, dy, shiftKey }) => {
                  const st = overlayPan3dRef.current
                  if (!st || st.pointerId !== pointerId) return
                  const pose = st.pose
                  const isPan = shiftKey === true
                  const target = new Vector3(pose.target.x, pose.target.y, pose.target.z)
                  const pos0 = new Vector3(pose.position.x, pose.position.y, pose.position.z)
                  const startQuat = new Quaternion(pose.quaternion.x, pose.quaternion.y, pose.quaternion.z, pose.quaternion.w)
                  const worldUp = new Vector3(0, 1, 0)
                  const offset = pos0.clone().sub(target)
                  if (isPan) {
                    const dist = Math.max(1e-3, offset.length())
                    const scale = dist * 0.0012
                    const right = new Vector3(1, 0, 0).applyQuaternion(startQuat).normalize()
                    const up = new Vector3(0, 1, 0).applyQuaternion(startQuat).normalize()
                    const delta = right.multiplyScalar(-dx * scale).add(up.multiplyScalar(dy * scale))
                    const nextTarget = target.clone().add(delta)
                    const nextPos = pos0.clone().add(delta)
                    const m = new Matrix4().lookAt(nextPos, nextTarget, worldUp)
                    const q = new Quaternion().setFromRotationMatrix(m)
                    useGraphStore.getState().restoreThreeCameraPose({
                      position: { x: nextPos.x, y: nextPos.y, z: nextPos.z },
                      quaternion: { x: q.x, y: q.y, z: q.z, w: q.w },
                      target: { x: nextTarget.x, y: nextTarget.y, z: nextTarget.z },
                    })
                    return
                  }
                  const sensitivity = 0.0025
                  const yaw = -dx * sensitivity
                  const pitch = -dy * sensitivity
                  const right = new Vector3(1, 0, 0).applyQuaternion(startQuat).normalize()
                  const qYaw = new Quaternion().setFromAxisAngle(worldUp, yaw)
                  const qPitch = new Quaternion().setFromAxisAngle(right, pitch)
                  offset.applyQuaternion(qYaw).applyQuaternion(qPitch)
                  const nextPos = target.clone().add(offset)
                  const m = new Matrix4().lookAt(nextPos, target, worldUp)
                  const q = new Quaternion().setFromRotationMatrix(m)
                  useGraphStore.getState().restoreThreeCameraPose({
                    position: { x: nextPos.x, y: nextPos.y, z: nextPos.z },
                    quaternion: { x: q.x, y: q.y, z: q.z, w: q.w },
                    target: { x: target.x, y: target.y, z: target.z },
                  })
                }}
                onOverlayPanEnd={({ pointerId }) => {
                  const st = overlayPan3dRef.current
                  if (!st || st.pointerId !== pointerId) return
                  overlayPan3dRef.current = null
                }}
                onHeaderDragStart={({ clientX, clientY, pointerId }) => {
                  const camera = threeCameraRef.current
                  const gl = threeGlRef.current
                  const p = dragOverridesRef.current[n.id] || positions[n.id]
                  if (!camera || !gl || !p) return
                  const w = gl.domElement.clientWidth || 1
                  const h = gl.domElement.clientHeight || 1
                  const world = new Vector3(p[0], p[1], p[2])
                  const ndc = world.clone().project(camera as unknown as Camera)
                  const sx = (ndc.x * 0.5 + 0.5) * w
                  const sy = (-ndc.y * 0.5 + 0.5) * h
                  overlayHeaderDrag3dRef.current = { id: n.id, pointerId, sx, sy, ndcZ: ndc.z, w, h }
                  setDraggedNodeId(n.id)
                  void clientX
                  void clientY
                }}
                onHeaderDrag={({ dx, dy, pointerId }) => {
                  const st = overlayHeaderDrag3dRef.current
                  if (!st) return
                  if (st.id !== n.id) return
                  if (st.pointerId !== pointerId) return
                  const camera = threeCameraRef.current
                  if (!camera) return
                  const w = st.w || 1
                  const h = st.h || 1
                  const sx = st.sx + dx
                  const sy = st.sy + dy
                  const ndcX = (sx / w) * 2 - 1
                  const ndcY = -((sy / h) * 2 - 1)
                  const ndcZ = st.ndcZ
                  if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY) || !Number.isFinite(ndcZ)) return
                  const nextWorld = new Vector3(ndcX, ndcY, ndcZ).unproject(camera as unknown as Camera)
                  dragOverridesRef.current[n.id] = [nextWorld.x, nextWorld.y, nextWorld.z]
                }}
                onHeaderDragEnd={({ pointerId }) => {
                  const st = overlayHeaderDrag3dRef.current
                  if (st && st.id === n.id && st.pointerId === pointerId) overlayHeaderDrag3dRef.current = null
                  const p = dragOverridesRef.current[n.id]
                  if (p && useGraphStore.getState().workspaceViewMode === 'editor') {
                    const s = useGraphStore.getState()
                    const node0 = s.graphData?.nodes?.find(nn => String(nn.id) === String(n.id)) || null
                    const baseProps = (node0?.properties || {}) as Record<string, JSONValue>
                    const nextProps: Record<string, JSONValue> = { ...baseProps, pos3d: [p[0], p[1], p[2]] as unknown as JSONValue }
                    try {
                      s.updateNode(n.id, { properties: nextProps })
                    } catch {
                      void 0
                    }
                  }
                  delete dragOverridesRef.current[n.id]
                  setDraggedNodeId(null)
                }}
                onWheelCapture={stopEvent}
                onClickCapture={stopEvent}
                onDoubleClickCapture={stopEvent}
                onContextMenuCapture={stopEvent}
              />
            )
          })}
        </section>
      ) : null}
      <GraphHoverTooltip
        hoverInfo={hoverInfo}
        containerRef={containerRef as unknown as React.RefObject<HTMLElement | null>}
        nodes={(renderGraph as GraphData | null)?.nodes as GraphNode[] | undefined}
        edges={(renderGraph as GraphData | null)?.edges as GraphEdge[] | undefined}
        schema={effectiveSchema as GraphSchema | null}
        tooltipInteractive={false}
      />
    </div>
  )
}
