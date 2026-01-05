import React, { useState, useCallback, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { deriveGraphDataForLayers } from '@/lib/graph/layerDerivation'
import { usePositions } from './layout'
import { GraphHoverTooltip, type HoverInfo } from '@/components/GraphHoverTooltip'

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

export default function ThreeGraph() {
  const { graphData: data, schema, selectNode, selectEdge, setSelectionSource } = useGraphStore()
  const registerCanvasSnapshotFns = useGraphStore(s => s.registerCanvasSnapshotFns)
  const glCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const graph = data as GraphData | null
  const s = schema as GraphSchema | null
  const effectiveSchema = s || { nodeStyles: {}, edgeStyles: {}, rules: [] }
  const renderGraph = deriveGraphDataForLayers(graph, effectiveSchema as GraphSchema)
  const hasGraph = !!(renderGraph && Array.isArray(renderGraph.nodes) && Array.isArray(renderGraph.edges))
  const hoverEnabled = (effectiveSchema as GraphSchema).behavior?.hover?.enabled !== false
  const positions = usePositions(hasGraph ? renderGraph!.nodes : [], hasGraph ? (effectiveSchema as GraphSchema) : null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)
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
    }
  }, [registerCanvasSnapshotFns])
  const onSelectNode = (id: string) => {
    setSelectionSource('canvas')
    selectNode(id)
  }
  const handleHoverNode = useCallback((info: { id: string; clientX: number; clientY: number } | null) => {
    if (!info) {
      setHoverInfo(prev => (prev && prev.kind === 'node' ? null : prev))
      return
    }
    setHoverInfo({ kind: 'node', id: info.id, clientX: info.clientX, clientY: info.clientY })
  }, [])
  const handleHoverEdge = useCallback((info: { id: string; clientX: number; clientY: number } | null) => {
    if (!info) {
      setHoverInfo(prev => (prev && prev.kind === 'edge' ? null : prev))
      return
    }
    setHoverInfo({ kind: 'edge', id: info.id, clientX: info.clientX, clientY: info.clientY })
  }, [])
  if (!hasGraph) {
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
        camera={{ position: [0, 0, 220], fov: 50 }}
        shadows
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.setClearColor('#000000', 0)
          try {
            glCanvasRef.current = gl.domElement as HTMLCanvasElement
          } catch {
            glCanvasRef.current = null
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
            onSelectNode={onSelectNode}
            onHoverNode={hoverEnabled ? handleHoverNode : undefined}
            onHoverEdge={hoverEnabled ? handleHoverEdge : undefined}
          />
          <ControlsLazy schema={effectiveSchema as GraphSchema} positions={positions} />
        </React.Suspense>
      </Canvas>
      <GraphHoverTooltip
        hoverInfo={hoverInfo}
        containerRef={containerRef as unknown as React.RefObject<HTMLElement | null>}
        nodes={(renderGraph as GraphData | null)?.nodes as GraphNode[] | undefined}
        edges={(renderGraph as GraphData | null)?.edges as GraphEdge[] | undefined}
        schema={effectiveSchema as GraphSchema | null}
      />
    </div>
  )
}
