import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'
import { defaultSchema, type GraphSchema } from '@/lib/graph/schema'
import { usePositions } from './layout'
import { GraphHoverTooltip, type HoverInfo } from '@/components/GraphHoverTooltip'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import type { Scene as ThreeScene } from 'three'
import { useThemeDetector } from '@/hooks/useThemeDetector'

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
  const registerCanvasSnapshotFns = useGraphStore(s => s.registerCanvasSnapshotFns)
  const registerThreeGlbSnapshotFns = useGraphStore(s => s.registerThreeGlbSnapshotFns)
  const glCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const threeSceneRef = React.useRef<ThreeScene | null>(null)
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
        onCreated={({ gl, scene }) => {
          gl.setClearColor('#000000', 0)
          try {
            glCanvasRef.current = gl.domElement as HTMLCanvasElement
          } catch {
            glCanvasRef.current = null
          }
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
