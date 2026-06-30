import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'
import { defaultSchema, type GraphSchema } from '@/lib/graph/schema'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import { usePositions } from '@/features/three/layout'
import { GraphHoverTooltip, type HoverInfo } from '@/components/GraphHoverTooltip'
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace, type Camera, type Scene as ThreeScene, type WebGLRenderer } from 'three'
import { useThemeDetector } from '@/hooks/useThemeDetector'
import type { Canvas3dModeId } from '@/lib/config'
import { emitPropsPanelOpen } from '@/features/canvas/utils'
import { parseGlbAssetDocument } from '@/lib/assets/glbAssetDocument'
import { GlbAssetModel, buildGlbAssetRenderKey, type GlbFit } from '@/lib/three/GlbAssetModel'
import { CanvasXrEntryPanel, OverlayFrameSync } from '@/lib/three/ThreeGraphXr'
import { registerThreeGraphSnapshotFns } from '@/lib/three/ThreeGraphSnapshots'
import { useThreeRichMediaOverlayController } from '@/lib/three/useThreeRichMediaOverlayController'
import { useCanvasAppliedMarkdownDocument } from '@/features/canvas/useCanvasAppliedMarkdownDocument'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { shouldRenderCanvasAppliedModelAsset } from '@/lib/three/modelAssetActivePathGuard'

const SceneLazy = React.lazy(() =>
  import('@/features/three/Scene').then(mod => ({
    default: mod.Scene,
  })),
)

const ControlsLazy = React.lazy(() =>
  import('@/features/three/Controls').then(mod => ({
    default: mod.Controls,
  })),
)

export default function ThreeGraph({ active = true, mode = '3d' }: { active?: boolean; mode?: Canvas3dModeId }) {
  const {
    schema,
    selectNode,
    selectEdge,
    setSelectionSource,
  } = useGraphStore()
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName)
  const markdownDocumentSourceUrl = useGraphStore(s => s.markdownDocumentSourceUrl)
  const markdownDocumentText = useGraphStore(s => s.markdownDocumentText)
  const markdownDocumentApplyViewPreset = useGraphStore(s => s.markdownDocumentApplyViewPreset)
  const explorerActivePath = useMarkdownExplorerStore(s => s.activePath)
  const registerCanvasSnapshotFns = useGraphStore(s => s.registerCanvasSnapshotFns)
  const registerThreeGlbSnapshotFns = useGraphStore(s => s.registerThreeGlbSnapshotFns)
  const registerThreeLayoutSnapshotFns = useGraphStore(s => s.registerThreeLayoutSnapshotFns)
  const glCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const threeSceneRef = React.useRef<ThreeScene | null>(null)
  const threeCameraRef = React.useRef<Camera | null>(null)
  const threeGlRef = React.useRef<WebGLRenderer | null>(null)
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
  const canvasMarkdownDocument = useCanvasAppliedMarkdownDocument({
    name: markdownDocumentName,
    sourceUrl: markdownDocumentSourceUrl,
    text: markdownDocumentText,
    applyViewPreset: markdownDocumentApplyViewPreset !== false,
  })
  const glbAsset = useMemo(() => parseGlbAssetDocument(canvasMarkdownDocument.text), [canvasMarkdownDocument.text])
  const shouldRenderGlbAsset = useMemo(
    () => shouldRenderCanvasAppliedModelAsset({
      explorerActivePath,
      canvasDocumentName: canvasMarkdownDocument.name,
      hasModelAsset: !!glbAsset,
    }),
    [canvasMarkdownDocument.name, explorerActivePath, glbAsset],
  )
  const glbAssetRenderKey = useMemo(
    () => (glbAsset && shouldRenderGlbAsset ? buildGlbAssetRenderKey(glbAsset, canvasMarkdownDocument.semanticKey) : ''),
    [canvasMarkdownDocument.semanticKey, glbAsset, shouldRenderGlbAsset],
  )
  const [glbAssetFit, setGlbAssetFit] = useState<GlbFit | null>(null)
  useEffect(() => {
    setGlbAssetFit(null)
  }, [glbAssetRenderKey])
  const handleGlbAssetFitChange = useCallback((fit: GlbFit | null) => {
    setGlbAssetFit(fit)
  }, [])
  const sceneGraph = useMemo(() => {
    if (glbAsset) return null
    const g = renderGraph as GraphData | null
    if (!g) return null
    return deriveSceneDisplayGraph({ graphData: g })?.displayGraphData || g
  }, [glbAsset, renderGraph])
  const sceneGraphForRender = useMemo<GraphData | null>(() => {
    if (!sceneGraph || !Array.isArray(sceneGraph.nodes)) return null
    return Array.isArray(sceneGraph.edges)
      ? sceneGraph
      : { ...sceneGraph, edges: [] }
  }, [sceneGraph])
  const hasGraph = !!sceneGraphForRender
  const hasGlbAsset = !!glbAsset && shouldRenderGlbAsset
  const hasRenderableScene = hasGraph || hasGlbAsset
  const hoverEnabled = (effectiveSchema as GraphSchema).behavior?.hover?.enabled !== false
  const positions = usePositions(
    hasGraph ? sceneGraphForRender!.nodes : [],
    hasGraph ? (effectiveSchema as GraphSchema) : null,
    hasGraph ? sceneGraphForRender : null,
    mode,
  )
  const positionsRef = React.useRef<Record<string, [number, number, number]>>({})
  const positions3d = positions as unknown as Record<string, [number, number, number]>
  positionsRef.current = positions3d
  const containerRef = React.useRef<HTMLElement | null>(null)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
  const draggedNodeIdRef = React.useRef<string | null>(null)
  const hoverClearTimerRef = useRef<number | null>(null)
  const theme = useThemeDetector()
  useEffect(() => {
    draggedNodeIdRef.current = draggedNodeId
  }, [draggedNodeId])
  useEffect(() => {
    if (!hoverEnabled) {
      setHoverInfo(null)
      setHoveredEdgeId(null)
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
    const renderer = threeGlRef.current
    if (!renderer) return
    renderer.xr.enabled = mode === 'xr'
    return () => {
      if (renderer === threeGlRef.current) renderer.xr.enabled = false
    }
  }, [mode])

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
    if (mode === 'voxel') {
      emitPropsPanelOpen()
    }
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

  const handleHoverEdgeIdChange = useCallback((id: string | null) => {
    setHoveredEdgeId(id)
  }, [])

  const { dragOverridesRef, overlayHiddenNodeIdSet, overlayLayer, requestSchedule, scheduleRef } = useThreeRichMediaOverlayController({
    active,
    sceneGraph: sceneGraphForRender,
    effectiveSchema,
    positions: positions3d,
    glCanvasRef,
    containerRef,
    threeCameraRef,
    threeGlRef,
    draggedNodeIdRef,
    setDraggedNodeId,
  })
  if (!hasRenderableScene || webglSupported === false) {
    return (
      <section
        className="absolute inset-0 w-full h-full z-0"
      />
    )
  }
  return (
    <section
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
            gl.toneMapping = ACESFilmicToneMapping
            gl.toneMappingExposure = 1
            gl.shadowMap.enabled = true
            gl.shadowMap.type = PCFSoftShadowMap
            gl.outputColorSpace = SRGBColorSpace
          } catch {
            void 0
          }
          try {
            glCanvasRef.current = gl.domElement as HTMLCanvasElement
          } catch {
            glCanvasRef.current = null
          }
          threeGlRef.current = gl
          threeCameraRef.current = camera || null
          threeSceneRef.current = scene || null
          try {
            requestSchedule()
          } catch {
            void 0
          }
          registerThreeGraphSnapshotFns({
            glCanvasRef,
            threeSceneRef,
            registerCanvasSnapshotFns,
            registerThreeGlbSnapshotFns,
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
          {hasGraph ? (
            <SceneLazy
              data={sceneGraphForRender as GraphData}
              schema={effectiveSchema as GraphSchema}
              positions={positions}
              paused={paused}
              onSelectNode={onSelectNode}
              onHoverNode={hoverEnabled ? handleHoverNode : undefined}
              onHoverEdge={hoverEnabled ? handleHoverEdge : undefined}
              onHoverEdgeIdChange={hoverEnabled ? handleHoverEdgeIdChange : undefined}
              hoveredEdgeId={hoveredEdgeId}
              onDragNode={setDraggedNodeId}
              draggedNodeId={draggedNodeId}
              theme={theme}
              dragOverridesRef={dragOverridesRef as unknown as React.MutableRefObject<Record<string, [number, number, number]>>}
              hiddenNodeIdSet={overlayHiddenNodeIdSet}
              mode={mode}
            />
          ) : null}
          {glbAsset && shouldRenderGlbAsset ? (
            <GlbAssetModel
              key={glbAssetRenderKey}
              asset={glbAsset}
              mode={mode}
              paused={paused}
              standalone={!hasGraph}
              onFitChange={handleGlbAssetFitChange}
            />
          ) : null}
          <ControlsLazy
            schema={effectiveSchema as GraphSchema}
            positions={positions}
            paused={paused}
            mode={mode}
            modelAssetRenderKey={glbAssetRenderKey}
            modelAssetFit={glbAssetFit}
            onControlsChange={() => {
              try {
                scheduleRef.current?.()
              } catch {
                void 0
              }
            }}
          />
          <OverlayFrameSync enabled={active} scheduleRef={scheduleRef} />
        </React.Suspense>
      </Canvas>
      <CanvasXrEntryPanel active={active && mode === 'xr'} rendererRef={threeGlRef} />
      {overlayLayer}
      <GraphHoverTooltip
        hoverInfo={hoverInfo}
        containerRef={containerRef as unknown as React.RefObject<HTMLElement | null>}
        nodes={sceneGraphForRender?.nodes as GraphNode[] | undefined}
        edges={sceneGraphForRender?.edges as GraphEdge[] | undefined}
        schema={effectiveSchema as GraphSchema | null}
        tooltipInteractive
      />
    </section>
  )
}
