import React from 'react'
import { useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema, ThreeConfig } from '@/lib/graph/schema'
import { UI_THEME_COLORS } from '@/lib/ui/theme-tokens'
import { getThreeConfig, getRendererPalette, MVP_COLOR_PALETTE } from '@/lib/graph/schema'
import { computeNeighborIds } from '@/components/GraphCanvas/highlight'
import { getEdgeStrokeWidth } from '@/components/GraphCanvas/helpers'
import { Physics3D, type Vec3 } from './layout'
import type { NodeSelectionMode } from './selection'
import { getSelectionVisuals } from './selection'
import { DirectionalParticles, ArrowHead, EdgeMesh, CurvedEdgeMesh } from './visuals'
import { NodeMesh } from './NodeMesh'
import { Starfield } from './Starfield'
import { getCameraConfig } from './camera'

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

export function Scene({
  data,
  schema,
  positions,
  paused,
  onSelectNode,
  onHoverNode,
  onHoverEdge,
}: {
  data: GraphData;
  schema: GraphSchema;
  positions: Record<string, Vec3>;
  paused?: boolean;
  onSelectNode: (id: string) => void;
  onHoverNode?: (info: { id: string; clientX: number; clientY: number } | null) => void;
  onHoverEdge?: (info: { id: string; clientX: number; clientY: number } | null) => void;
}) {
  const { gl } = useThree()
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const selectedNodeIds = useGraphStore(s => s.selectedNodeIds)
  const selectedEdgeIds = useGraphStore(s => s.selectedEdgeIds)
  const selectEdge = useGraphStore(s => s.selectEdge)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const renderMediaAsNodes = useGraphStore(s => s.renderMediaAsNodes)
  const selectionSets = React.useMemo(() => {
    const nodeIds =
      Array.isArray(selectedNodeIds) && selectedNodeIds.length > 0
        ? selectedNodeIds
        : selectedNodeId
          ? [selectedNodeId]
          : []
    const edgeIds =
      Array.isArray(selectedEdgeIds) && selectedEdgeIds.length > 0
        ? selectedEdgeIds
        : selectedEdgeId
          ? [selectedEdgeId]
          : []
    const selectedNodeIdSet = new Set<string>(nodeIds.map(String))
    const selectedEdgeIdSet = new Set<string>(edgeIds.map(String))
    const selectedEdgeEndpointNodeIdSet = new Set<string>()
    if (selectedEdgeIdSet.size > 0) {
      for (let i = 0; i < data.edges.length; i += 1) {
        const e = data.edges[i]
        if (!selectedEdgeIdSet.has(String(e.id))) continue
        const src = String(e.source)
        const tgt = String(e.target)
        if (src) selectedEdgeEndpointNodeIdSet.add(src)
        if (tgt) selectedEdgeEndpointNodeIdSet.add(tgt)
      }
    }
    return { selectedNodeIdSet, selectedEdgeIdSet, selectedEdgeEndpointNodeIdSet }
  }, [data.edges, selectedEdgeId, selectedEdgeIds, selectedNodeId, selectedNodeIds])
  const neighborIds = React.useMemo(
    () =>
      computeNeighborIds({
        data,
        schema,
        selectedNodeId,
        selectedEdgeId,
        selectedNodeIds,
        selectedEdgeIds,
        renderMediaAsNodes,
      }),
    [data, schema, selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds, renderMediaAsNodes],
  )
  const selectionMode: NodeSelectionMode =
    selectionSets.selectedEdgeIdSet.size > 0 ? 'edge' : selectionSets.selectedNodeIdSet.size > 0 ? 'node' : 'none'
  const palette = getRendererPalette(schema)
  const neutralEdgeColor = palette.edges.neutral || MVP_COLOR_PALETTE.edges.neutral
  const colorByLabel = (l: string) => schema.edgeStyles[l]?.color || neutralEdgeColor
  const selectionVisuals = getSelectionVisuals(schema)
  const cameraConfig = getCameraConfig(schema)
  const threeCfg: ThreeConfig = getThreeConfig(schema)
  const hiddenNodeIds = React.useMemo(() => new Set<string>(), [])
  React.useEffect(() => {
    const threeCfgLocal: ThreeConfig = getThreeConfig(schema)
    const raw = threeCfgLocal.backgroundColor
    let color: string
    if (typeof raw === 'string' && raw.trim() !== '') {
      color = raw
    } else {
      let theme: string | null = null
      try {
        if (typeof document !== 'undefined') {
          theme = document.documentElement.getAttribute('data-theme')
        }
      } catch {
        theme = null
      }
      if (theme === 'dark') {
        color = UI_THEME_COLORS.dark.bg
      } else {
        color = UI_THEME_COLORS.light.bg
      }
    }
    try {
      gl.setClearColor(color)
    } catch {
      void 0
    }
  }, [gl, schema])
  const arrowLenDefault = typeof threeCfg.linkDirectionalArrowLength === 'number' ? Math.max(2, Math.min(24, threeCfg.linkDirectionalArrowLength)) : 8
  const linkOpacityDefault = typeof threeCfg.linkOpacity === 'number' ? Math.max(0, Math.min(1, threeCfg.linkOpacity)) : 0.6
  const linkCurvatureDefault = typeof threeCfg.linkCurvature === 'number' ? Math.max(0, Math.min(1.5, threeCfg.linkCurvature)) : 0
  const curveRotationDefault = typeof threeCfg.linkCurveRotation === 'number' ? threeCfg.linkCurveRotation : 0
  const arrowRelPosDefault = typeof threeCfg.linkDirectionalArrowRelPos === 'number'
    ? Math.max(0, Math.min(1, threeCfg.linkDirectionalArrowRelPos))
    : 0.85
  const particlesDefault = typeof threeCfg.linkDirectionalParticles === 'number'
    ? Math.max(0, Math.min(64, Math.floor(threeCfg.linkDirectionalParticles)))
    : 0
  const particleSpeedDefault = typeof threeCfg.linkDirectionalParticleSpeed === 'number'
    ? Math.max(0.01, Math.min(5, threeCfg.linkDirectionalParticleSpeed))
    : 0.6
  const opacityByLabel: Record<string, number> = threeCfg.edgeOpacityByLabel || {}
  const starfieldEnabled = !!threeCfg.starfieldEnabled
  const starfieldCountRaw = typeof threeCfg.starfieldCount === 'number' ? threeCfg.starfieldCount : 0
  const starfieldCount = Math.max(0, Math.min(10000, Math.floor(starfieldCountRaw)))
  const starfieldRadiusRaw = typeof threeCfg.starfieldRadius === 'number' ? threeCfg.starfieldRadius : (typeof schema.three?.sphereRadius === 'number' ? schema.three.sphereRadius : 260)
  const starfieldRadius = Math.max(40, Math.min(1200, starfieldRadiusRaw))
  const starfieldOpacityRaw = typeof threeCfg.starfieldOpacity === 'number' ? threeCfg.starfieldOpacity : 0.9
  const starfieldOpacity = Math.max(0, Math.min(1, starfieldOpacityRaw))
  const starfieldColorRaw =
    typeof threeCfg.starfieldColor === 'string' && threeCfg.starfieldColor.trim() !== ''
      ? threeCfg.starfieldColor
      : (palette.nodes.hypothesis || MVP_COLOR_PALETTE.nodes.hypothesis)
  const dragOverridesRef = React.useRef<Record<string, Vec3>>({})
  const handleDragStart = React.useCallback((id: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const p = e.point
    dragOverridesRef.current[id] = [p.x, p.y, p.z]
  }, [])
  const handleDrag = React.useCallback((id: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const p = e.point
    dragOverridesRef.current[id] = [p.x, p.y, p.z]
  }, [])
  const handleDragEnd = React.useCallback((id: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const p = e.point
    dragOverridesRef.current[id] = [p.x, p.y, p.z]
    delete dragOverridesRef.current[id]
  }, [])
  const allowNodeDrag = schema.behavior ? schema.behavior.allowNodeDrag !== false : true
  return (
    <>
      {cameraConfig.fogColor ? (
        <fog attach="fog" args={[cameraConfig.fogColor, cameraConfig.fogNear, cameraConfig.fogFar]} />
      ) : null}
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#ffffff', '#cbd5e1', 0.6]} />
      <pointLight position={[120, 120, 120]} intensity={0.9} />
      {starfieldEnabled && starfieldCount > 0 ? (
        <Starfield
          count={starfieldCount}
          radius={starfieldRadius}
          opacity={starfieldOpacity}
          color={starfieldColorRaw}
          paused={paused}
        />
      ) : null}
      <group>
        <Physics3D positions={positions} nodes={data.nodes} edges={data.edges} schema={schema} dragOverrides={dragOverridesRef} paused={paused} />
        {data.edges.map((e) => {
          const a = positions[e.source]
          const b = positions[e.target]
          if (!a || !b) return null
          if (hiddenNodeIds.size > 0) {
            const srcId = String(e.source)
            const tgtId = String(e.target)
            if (hiddenNodeIds.has(srcId) || hiddenNodeIds.has(tgtId)) return null
          }
          const props = e.properties || {}
          const color = typeof props['color'] === 'string' ? String(props['color']) : colorByLabel(e.label)
          const baseWidth = getEdgeStrokeWidth(e, schema)
          let width = clamp(baseWidth, 0.5, 5)
          const linkOpacity = typeof props['opacity'] === 'number'
            ? Math.max(0, Math.min(1, props['opacity'] as number))
            : (typeof opacityByLabel[e.label] === 'number' ? Math.max(0, Math.min(1, opacityByLabel[e.label] as number)) : linkOpacityDefault)
          const curvature = typeof props['curvature'] === 'number' ? Math.max(0, Math.min(1.5, props['curvature'] as number)) : linkCurvatureDefault
          const arrowLen = typeof props['arrowLength'] === 'number' ? Math.max(2, Math.min(24, props['arrowLength'] as number)) : arrowLenDefault
          const arrowColor = typeof props['arrowColor'] === 'string' ? String(props['arrowColor']) : color
          const resolution = typeof props['resolution'] === 'number' ? Math.floor(props['resolution'] as number) : 24
          const arrowRelPos = typeof props['arrowRelPos'] === 'number'
            ? Math.max(0, Math.min(1, props['arrowRelPos'] as number))
            : arrowRelPosDefault
          const curveRotation = typeof props['curveRotation'] === 'number' ? props['curveRotation'] as number : curveRotationDefault
          const particles = typeof props['linkDirectionalParticles'] === 'number'
            ? Math.max(0, Math.min(64, Math.floor(props['linkDirectionalParticles'] as number)))
            : particlesDefault
          const particleSpeed = typeof props['linkDirectionalParticleSpeed'] === 'number'
            ? Math.max(0.01, Math.min(5, props['linkDirectionalParticleSpeed'] as number))
            : particleSpeedDefault
          const srcId = e.source as string
          const tgtId = e.target as string
          const isSelectedEdge = selectionSets.selectedEdgeIdSet.has(e.id)
          const isIncidentToSelectedNode = selectionSets.selectedNodeIdSet.size > 0 && (selectionSets.selectedNodeIdSet.has(srcId) || selectionSets.selectedNodeIdSet.has(tgtId))
          let finalColor = arrowColor || color
          let finalOpacity = linkOpacity
          const selectedEdgeWidth = selectionVisuals.selectedEdgeWidth
          const dimmedEdgeOpacity = selectionVisuals.dimmedEdgeOpacity
          if (selectionMode === 'edge') {
            if (isSelectedEdge) {
              finalColor = selectionVisuals.selectedEdgeColor
              finalOpacity = Math.max(finalOpacity, 0.9)
              width = Math.max(width, selectedEdgeWidth)
            } else {
              finalColor = neutralEdgeColor
              finalOpacity = Math.min(finalOpacity, dimmedEdgeOpacity)
              width = Math.max(1, Math.min(baseWidth, selectedEdgeWidth * 0.5))
            }
          } else if (selectionMode === 'node') {
            if (isIncidentToSelectedNode) {
              finalColor = selectionVisuals.selectedEdgeColor
              finalOpacity = Math.max(finalOpacity, 0.9)
              width = Math.max(width, selectedEdgeWidth)
            } else {
              finalColor = schema.edgeStyles[e.label]?.color || neutralEdgeColor
              finalOpacity = Math.min(finalOpacity, dimmedEdgeOpacity)
              width = Math.max(1, Math.min(baseWidth, selectedEdgeWidth * 0.5))
            }
          }
          return (
            <group
              key={e.id}
              onClick={(evt) => {
                evt.stopPropagation()
                setSelectionSource('canvas')
                selectEdge(e.id)
              }}
              onPointerOver={(evt: ThreeEvent<PointerEvent>) => {
                if (onHoverEdge) {
                  onHoverEdge({ id: e.id, clientX: evt.clientX, clientY: evt.clientY })
                }
              }}
              onPointerOut={() => {
                if (onHoverEdge) {
                  onHoverEdge(null)
                }
              }}
            >
              {curvature > 0.001
                ? <CurvedEdgeMesh a={a} b={b} color={finalColor} width={width} opacity={finalOpacity} curvature={curvature} resolution={resolution} rotation={curveRotation} paused={paused} />
                : <EdgeMesh a={a} b={b} color={finalColor} width={width} opacity={finalOpacity} resolution={resolution} paused={paused} />
              }
              <ArrowHead start={a} end={b} color={finalColor} height={arrowLen} relPos={arrowRelPos} paused={paused} />
              {particles > 0 && particleSpeed > 0 ? (
                <DirectionalParticles start={a} end={b} count={particles} color={finalColor} speed={particleSpeed} paused={paused} />
              ) : null}
            </group>
          )
        })}
        {data.nodes.map((n) => {
          const p = positions[n.id]
          if (!p) return null
          if (hiddenNodeIds.size > 0 && hiddenNodeIds.has(String(n.id))) return null
          const isSelected = selectionSets.selectedNodeIdSet.has(n.id)
          const isNeighbor = neighborIds.has(n.id)
          const isEdgeEndpoint = selectionSets.selectedEdgeEndpointNodeIdSet.has(n.id)
          return (
            <NodeMesh
              key={n.id}
              node={n}
              pos={p}
              schema={schema}
              onClick={onSelectNode}
              selection={{ mode: selectionMode, isSelected, isNeighbor, isEdgeEndpoint }}
              visuals={selectionVisuals}
              paused={paused}
              onDragStart={allowNodeDrag ? handleDragStart : undefined}
              onDrag={allowNodeDrag ? handleDrag : undefined}
              onDragEnd={allowNodeDrag ? handleDragEnd : undefined}
              onHoverChange={onHoverNode}
            />
          )
        })}
      </group>
    </>
  )
}
