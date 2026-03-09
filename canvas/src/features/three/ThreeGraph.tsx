import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'
import { defaultSchema, type GraphSchema } from '@/lib/graph/schema'
import { usePositions } from './layout'
import { GraphHoverTooltip, type HoverInfo } from '@/components/GraphHoverTooltip'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { Vector3, type Camera, type Scene as ThreeScene, type WebGLRenderer } from 'three'
import { useThemeDetector } from '@/hooks/useThemeDetector'
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
    })),
  )
  const registerCanvasSnapshotFns = useGraphStore(s => s.registerCanvasSnapshotFns)
  const registerThreeGlbSnapshotFns = useGraphStore(s => s.registerThreeGlbSnapshotFns)
  const glCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const threeSceneRef = React.useRef<ThreeScene | null>(null)
  const threeCameraRef = React.useRef<Camera | null>(null)
  const threeGlRef = React.useRef<WebGLRenderer | null>(null)
  const iframeOverlayElsRef = React.useRef<Map<string, HTMLDivElement>>(new Map())
  const iframeOverlayVisibleIdsRef = React.useRef<Set<string>>(new Set())
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
    }
  }, [registerCanvasSnapshotFns, registerThreeGlbSnapshotFns])
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
    const poolMax = typeof threeIframeOverlayPoolMax === 'number' && Number.isFinite(threeIframeOverlayPoolMax) ? threeIframeOverlayPoolMax : 0
    return listMediaOverlayNodes({ enabled: renderMediaAsNodes === true, nodes, poolMax })
  }, [renderGraph, renderMediaAsNodes, threeIframeOverlayPoolMax])

  const mediaNodesKey = useMemo(() => mediaNodesPool.map(n => n.id).join('|'), [mediaNodesPool])

  useEffect(() => {
    const keep = new Set<string>(mediaNodesPool.map(n => n.id))
    const overlayMap = iframeOverlayElsRef.current
    for (const [id] of overlayMap) {
      if (!keep.has(id)) overlayMap.delete(id)
    }
  }, [mediaNodesKey, mediaNodesPool])

  useEffect(() => {
    if (!active) return
    if (mediaNodesPool.length === 0) return
    let raf: number | null = null
    const world = new Vector3()
    const v3 = new Vector3()
    const candidates: Array<{ id: string; sx: number; sy: number; dist: number; sizeScale: number }> = []
    const tick = () => {
      raf = null
      const camera = threeCameraRef.current
      const gl = threeGlRef.current
      if (!camera || !gl) {
        raf = requestAnimationFrame(tick)
        return
      }
      const w = Math.max(1, gl.domElement.clientWidth || 1)
      const h = Math.max(1, gl.domElement.clientHeight || 1)
      const density = mediaPanelDensity === 'compact' ? 'compact' : 'default'
      const maxCountRaw = density === 'compact' ? threeIframeOverlayMaxVisibleCompact : threeIframeOverlayMaxVisibleDefault
      const maxCount = Number.isFinite(maxCountRaw) ? Math.max(0, Math.floor(maxCountRaw)) : 0
      const maxDistanceRaw = density === 'compact' ? threeIframeOverlayMaxDistanceCompact : threeIframeOverlayMaxDistanceDefault
      const maxDistance = Number.isFinite(maxDistanceRaw) ? Math.max(0, Number(maxDistanceRaw)) : 0
      const widthRatioRaw = density === 'compact' ? threeIframeOverlayBaseWidthRatioCompact : threeIframeOverlayBaseWidthRatioDefault
      const widthRatio = Number.isFinite(widthRatioRaw) ? Math.max(0.001, Number(widthRatioRaw)) : 0.2
      const widthMinRaw = density === 'compact' ? threeIframeOverlayBaseWidthMinPxCompact : threeIframeOverlayBaseWidthMinPxDefault
      const widthMin = Number.isFinite(widthMinRaw) ? Math.max(1, Math.floor(widthMinRaw)) : 200
      const widthMaxRaw = density === 'compact' ? threeIframeOverlayBaseWidthMaxPxCompact : threeIframeOverlayBaseWidthMaxPxDefault
      const widthMax = Number.isFinite(widthMaxRaw) ? Math.max(1, Math.floor(widthMaxRaw)) : 360
      const baseW = Math.min(widthMax, Math.max(widthMin, w * widthRatio))
      const margin = 12
      candidates.length = 0
      for (let i = 0; i < mediaNodesPool.length; i += 1) {
        const node = mediaNodesPool[i]
        const pos = positions[node.id] || null
        if (!pos) continue
        world.set(pos[0], pos[1], pos[2])
        const dist = camera.position.distanceTo(world)
        if (!Number.isFinite(dist) || dist > maxDistance) continue
        v3.copy(world).project(camera)
        const ndcX = v3.x
        const ndcY = v3.y
        const ndcZ = v3.z
        if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY) || !Number.isFinite(ndcZ) || ndcZ < -1 || ndcZ > 1) continue
        const sx = (ndcX * 0.5 + 0.5) * w
        const sy = (-ndcY * 0.5 + 0.5) * h
        const sizeScale = Math.max(0.72, Math.min(1.05, 260 / (dist + 1)))
        candidates.push({ id: node.id, sx, sy, dist, sizeScale })
      }
      candidates.sort((a, b) => a.dist - b.dist)
      const nextVisibleIds = new Set<string>()
      let shown = 0
      for (let i = 0; i < candidates.length && shown < maxCount; i += 1) {
        const c = candidates[i]!
        if (!iframeOverlayElsRef.current.has(c.id)) continue
        nextVisibleIds.add(c.id)
        shown += 1
      }
      const prevVisibleIds = iframeOverlayVisibleIdsRef.current
      for (const id of prevVisibleIds) {
        if (nextVisibleIds.has(id)) continue
        const el = iframeOverlayElsRef.current.get(id)
        if (!el) continue
        applyPanelBox(el, { left: 0, top: 0, w: 1, h: 1, display: 'none' })
      }
      for (let i = 0; i < candidates.length; i += 1) {
        const c = candidates[i]!
        if (!nextVisibleIds.has(c.id)) continue
        const el = iframeOverlayElsRef.current.get(c.id)
        if (!el) continue
        const { metrics, vars } = computeMediaPanelCssVars3d({ density, sizeScale: c.sizeScale })
        const { panelW, panelH } = computePanelSizeFromContent16x9({ contentW: Math.round(baseW * c.sizeScale), metrics })
        const rect = computePanelRect({ cx: c.sx, cy: c.sy, w: panelW, h: panelH, clamp: { viewportW: w, viewportH: h, margin } })
        applyMediaPanelCssVars(el, vars)
        applyPanelBox(el, {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          w: panelW,
          h: panelH,
          zIndex: 2000 - Math.max(0, Math.min(1500, Math.floor(c.dist))),
          display: 'block',
        })
      }
      iframeOverlayVisibleIdsRef.current = nextVisibleIds
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      if (raf != null) {
        try {
          cancelAnimationFrame(raf)
        } catch {
          void 0
        }
      }
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
  ])

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
          />
          <ControlsLazy schema={effectiveSchema as GraphSchema} positions={positions} paused={paused} />
        </React.Suspense>
      </Canvas>
      {active && renderMediaAsNodes && mediaNodesPool.length > 0 ? (
        <section aria-label="3D media overlay" className="absolute inset-0 z-[50] pointer-events-none">
          {mediaNodesPool.map(n => {
            return (
              <RichMediaPanel
                key={n.id}
                ref={(el) => {
                  if (!el) {
                    iframeOverlayElsRef.current.delete(n.id)
                    return
                  }
                  iframeOverlayElsRef.current.set(n.id, el)
                }}
                data-kg-canvas-wheel-ignore="true"
                data-kg-canvas-pointer-ignore="true"
                className="absolute left-0 top-0 pointer-events-auto"
                title={n.title}
                url={n.url}
                kind={n.kind}
                interactive={n.interactive}
                iframeMode="srcdoc-when-needed"
                style={{
                  transform: 'translate(-99999px, -99999px)',
                  width: 1,
                  height: 1,
                }}
                onPointerDownCapture={stopEvent}
                onPointerUpCapture={stopEvent}
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
