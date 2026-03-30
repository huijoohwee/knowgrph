import React from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema, ThreeConfig } from '@/lib/graph/schema'
import { resolveCssVar } from '@/lib/ui/theme-tokens'
import { getThreeConfig, getRendererPalette, MVP_COLOR_PALETTE } from '@/lib/graph/schema'
import { computeNeighborIds } from '@/components/GraphCanvas/highlight'
import { getRenderNodeRadius2d, getEdgeStrokeWidth } from '@/components/GraphCanvas/helpers'
import { getEdgeBaseStroke } from '@/lib/graph/visualStyles'
import { Physics3D, type Vec3 } from './layout'
import type { NodeSelectionMode } from './selection'
import { getSelectionVisuals } from './selection'
import { DirectionalParticles, ArrowHead, EdgeMesh, CurvedEdgeMesh, ShaderLineEdges } from './visuals'
import { NodeMesh } from './NodeMesh'
import { Starfield } from './Starfield'
import { GlobeEffects } from './GlobeEffects'
import { getCameraConfig } from './camera'
import { resolveThreeColor } from './resolveColor'
import type { KgTheme } from '@/lib/ui/tokens-ssot'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import { buildDeepestGroupRectByNodeId, buildGroupRectByIdFromSchemaOverrides } from '@/lib/canvas/groupExplicitBounds'
import { clampNodeCenterToRect } from '@/lib/canvas/groupContainment'
import { GroupOverlays3d } from '@/features/three/GroupOverlays'
import { THREE_RENDER_ORDER } from '@/features/three/renderOrder'
import { readThreeRenderOrderOffset } from '@/features/three/zOrder'
import { readEdgePathCurveOptions, readGlobalEdgeType } from '@/lib/graph/edgeTypes'
import type { Canvas3dModeId } from '@/lib/config'
import { resolveVoxelClusterColor, resolveVoxelClusterKey } from './voxelStyle'
import { quantizeVoxelCoordToGridLine, resolveVoxelGridStep } from './threeLayoutConfig'
import { intersectRayWithZPlane } from './raycast'

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
  onDragNode,
  draggedNodeId,
  theme,
  dragOverridesRef,
  hiddenNodeIdSet,
  mode = '3d',
}: {
  data: GraphData;
  schema: GraphSchema;
  positions: Record<string, Vec3>;
  paused?: boolean;
  onSelectNode: (id: string) => void;
  onHoverNode?: (info: { id: string; clientX: number; clientY: number } | null) => void;
  onHoverEdge?: (info: { id: string; clientX: number; clientY: number } | null) => void;
  onDragNode?: (id: string | null) => void;
  draggedNodeId?: string | null;
  theme?: KgTheme;
  dragOverridesRef?: React.MutableRefObject<Record<string, Vec3>>;
  hiddenNodeIdSet?: Set<string>;
  mode?: Canvas3dModeId;
}) {
  const { gl } = useThree()
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const selectedNodeIds = useGraphStore(s => s.selectedNodeIds)
  const selectedEdgeIds = useGraphStore(s => s.selectedEdgeIds)
  const selectEdge = useGraphStore(s => s.selectEdge)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const renderMediaAsNodes = useGraphStore(s => s.renderMediaAsNodes)
  const threeEdgeRenderer = useGraphStore(s => s.threeEdgeRenderer)
  const threeShaderLineWidthPx = useGraphStore(s => s.threeShaderLineWidthPx)
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

  const nodeById = React.useMemo(() => {
    const m = new Map<string, GraphNode>()
    for (let i = 0; i < data.nodes.length; i += 1) {
      const n = data.nodes[i]
      const id = String(n?.id || '').trim()
      if (id && !m.has(id)) m.set(id, n)
    }
    return m
  }, [data.nodes])

  const groups = React.useMemo(() => deriveGraphGroups(data), [data])
  const explicitGroupRectById = React.useMemo(() => {
    if (!groups.length) return new Map<string, { x: number; y: number; width: number; height: number }>()
    return buildGroupRectByIdFromSchemaOverrides({ groups: groups as any, graphNodes: data.nodes as GraphNode[], schema })
  }, [data.nodes, groups, schema])
  const explicitGroupRectByNodeId = React.useMemo(() => {
    if (!groups.length || explicitGroupRectById.size === 0) return new Map<string, { x: number; y: number; width: number; height: number }>()
    return buildDeepestGroupRectByNodeId({ groups: groups as any, groupRectById: explicitGroupRectById as any })
  }, [explicitGroupRectById, groups])
  
  // Memoize resolved colors to depend on theme
  const {
    neutralEdgeColor,
    selectedEdgeColor,
    palette,
    colorByEdge
  } = React.useMemo(() => {
    // We include theme in dependency to force re-evaluation
    void theme

    const palette = getRendererPalette(schema)
    const neutralEdgeColorRaw = palette.edges.neutral || MVP_COLOR_PALETTE.edges.neutral
    const neutralEdgeColor = resolveThreeColor(neutralEdgeColorRaw, MVP_COLOR_PALETTE.edges.neutral)
    const colorByEdge = (e: import('@/lib/graph/types').GraphEdge) => {
      const raw = getEdgeBaseStroke(e, schema)
      return resolveThreeColor(raw, neutralEdgeColor)
    }
    const selectionVisuals = getSelectionVisuals(schema)
    const selectedEdgeColor = resolveThreeColor(selectionVisuals.selectedEdgeColor, neutralEdgeColor)
    return { neutralEdgeColor, selectedEdgeColor, palette, colorByEdge }
  }, [schema, theme])

  const selectionVisuals = React.useMemo(() => getSelectionVisuals(schema), [schema])

  const nodeRadiusMap = React.useMemo(() => {
    const map = new Map<string, number>()
    if (data.nodes) {
      for (const n of data.nodes) {
        const r = getRenderNodeRadius2d(n, schema)
        map.set(n.id, r)
      }
    }
    return map
  }, [data.nodes, schema])

  const threeCfg = getThreeConfig(schema)
  const motionIntensity = typeof threeCfg.nodeMotionIntensity === 'number'
    ? Math.max(0, Math.min(2, threeCfg.nodeMotionIntensity))
    : 1
  const motionIntensityEffective = renderMediaAsNodes ? 0 : motionIntensity

  const cameraConfig = getCameraConfig(schema)
  const hiddenNodeIds = hiddenNodeIdSet || null
  React.useEffect(() => {
    // Force dependency on theme
    void theme
    const threeCfgLocal: ThreeConfig = getThreeConfig(schema)
    const raw = threeCfgLocal.backgroundColor
    let color: string
    if (typeof raw === 'string' && raw.trim() !== '') {
      color = raw
    } else {
      color = resolveCssVar('--kg-canvas-bg', '#ffffff')
    }
    try {
      gl.setClearColor(color)
    } catch {
      void 0
    }
  }, [gl, schema, theme])
  const arrowLenDefault = typeof threeCfg.linkDirectionalArrowLength === 'number' ? Math.max(2, Math.min(24, threeCfg.linkDirectionalArrowLength)) : 8
  const linkOpacityDefault = typeof threeCfg.linkOpacity === 'number' ? Math.max(0, Math.min(1, threeCfg.linkOpacity)) : 0.6
  const linkCurvatureDefault = typeof threeCfg.linkCurvature === 'number' ? Math.max(0, Math.min(1.5, threeCfg.linkCurvature)) : 0
  const globalEdgeType = readGlobalEdgeType(schema)
  const linkCurvatureByEdgeType = (() => {
    if (globalEdgeType === 'straight' || globalEdgeType === 'step') return 0
    if (globalEdgeType === 'smoothstep') return Math.max(linkCurvatureDefault, 0.2)
    return linkCurvatureDefault
  })()
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
  const starfieldColorRaw = React.useMemo(() => {
    void theme
    return typeof threeCfg.starfieldColor === 'string' && threeCfg.starfieldColor.trim() !== ''
      ? threeCfg.starfieldColor
      : (palette.nodes.hypothesis || MVP_COLOR_PALETTE.nodes.hypothesis)
  }, [threeCfg.starfieldColor, palette, theme])
  const localDragOverridesRef = React.useRef<Record<string, Vec3>>({})
  const dragRef = dragOverridesRef || localDragOverridesRef
  const voxelGridStep = resolveVoxelGridStep(schema)
  const snapVoxelDragPoint = React.useCallback((x: number, y: number): Vec3 => {
    const sx = quantizeVoxelCoordToGridLine(x, voxelGridStep)
    const sy = quantizeVoxelCoordToGridLine(y, voxelGridStep)
    return [sx, sy, 0]
  }, [voxelGridStep])
  const handleDragStart = React.useCallback((id: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (mode === 'voxel') {
      const hit = intersectRayWithZPlane(e.ray, 0)
      const p = hit || e.point
      dragRef.current[id] = snapVoxelDragPoint(p.x, p.y)
      return
    }
    const p = e.point.clone()
    const rect = explicitGroupRectByNodeId.get(String(id)) || null
    const n = nodeById.get(String(id)) || null
    if (rect && n) {
      const r = getRenderNodeRadius2d(n, schema)
      const clamped = clampNodeCenterToRect({ cx: p.x, cy: p.y, halfW: r, halfH: r, rect })
      p.x = clamped.cx
      p.y = clamped.cy
    }
    dragRef.current[id] = [p.x, p.y, p.z]
  }, [dragRef, explicitGroupRectByNodeId, mode, nodeById, positions, schema, snapVoxelDragPoint])
  const handleDrag = React.useCallback((id: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (mode === 'voxel') {
      const hit = intersectRayWithZPlane(e.ray, 0)
      const p = hit || e.point
      dragRef.current[id] = snapVoxelDragPoint(p.x, p.y)
      return
    }
    const p = e.point.clone()
    const rect = explicitGroupRectByNodeId.get(String(id)) || null
    const n = nodeById.get(String(id)) || null
    if (rect && n) {
      const r = getRenderNodeRadius2d(n, schema)
      const clamped = clampNodeCenterToRect({ cx: p.x, cy: p.y, halfW: r, halfH: r, rect })
      p.x = clamped.cx
      p.y = clamped.cy
    }
    dragRef.current[id] = [p.x, p.y, p.z]
  }, [dragRef, explicitGroupRectByNodeId, mode, nodeById, positions, schema, snapVoxelDragPoint])
  const handleDragEnd = React.useCallback((id: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (mode === 'voxel') {
      const hit = intersectRayWithZPlane(e.ray, 0)
      const p = hit || e.point
      dragRef.current[id] = snapVoxelDragPoint(p.x, p.y)
      requestAnimationFrame(() => {
        delete dragRef.current[id]
      })
      return
    }
    const p = e.point.clone()
    const rect = explicitGroupRectByNodeId.get(String(id)) || null
    const n = nodeById.get(String(id)) || null
    if (rect && n) {
      const r = getRenderNodeRadius2d(n, schema)
      const clamped = clampNodeCenterToRect({ cx: p.x, cy: p.y, halfW: r, halfH: r, rect })
      p.x = clamped.cx
      p.y = clamped.cy
    }
    dragRef.current[id] = [p.x, p.y, p.z]
    delete dragRef.current[id]
  }, [dragRef, explicitGroupRectByNodeId, mode, nodeById, positions, schema, snapVoxelDragPoint])
  const allowNodeDrag = schema.behavior ? schema.behavior.allowNodeDrag !== false : true
  const voxelClusterLightIntensity = (() => {
    const raw = schema.three?.voxelClusterLightIntensity
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0.7
    return Math.max(0, Math.min(2, raw))
  })()
  const voxelGroupLights = React.useMemo(() => {
    if (mode !== 'voxel') return [] as Array<{ id: string; pos: [number, number, number]; color: string }>
    const byGroupId = new Map<string, { x: number; y: number; z: number; count: number }>()
    for (let i = 0; i < data.nodes.length; i += 1) {
      const n = data.nodes[i]
      const p = positions[n.id]
      if (!p) continue
      const g = resolveVoxelClusterKey(n)
      if (!g) continue
      const prev = byGroupId.get(g)
      if (prev) {
        prev.x += p[0]
        prev.y += p[1]
        prev.z += p[2]
        prev.count += 1
      } else {
        byGroupId.set(g, { x: p[0], y: p[1], z: p[2], count: 1 })
      }
    }
    const out: Array<{ id: string; pos: [number, number, number]; color: string }> = []
    for (const [id, v] of byGroupId.entries()) {
      const inv = v.count > 0 ? 1 / v.count : 1
      const sample = data.nodes.find(n => resolveVoxelClusterKey(n) === id)
      out.push({
        id,
        pos: [v.x * inv, v.y * inv, v.z * inv + 10],
        color: (sample && resolveVoxelClusterColor(sample)) || '#00f5ff',
      })
    }
    return out
  }, [data.nodes, mode, positions])

  const voxelGround = React.useMemo(() => {
    if (mode !== 'voxel') return null
    const gridStep = resolveVoxelGridStep(schema)
    let maxAbs = 0
    for (let i = 0; i < data.nodes.length; i += 1) {
      const id = data.nodes[i].id
      const p = positions[id]
      if (!p) continue
      const ax = Math.abs(p[0])
      const ay = Math.abs(p[1])
      if (ax > maxAbs) maxAbs = ax
      if (ay > maxAbs) maxAbs = ay
    }
    const spanFromPositions = maxAbs > 0
      ? (Math.ceil((maxAbs * 2 + gridStep * 8) / Math.max(1, gridStep)) * gridStep)
      : 0
    const nodeCount = Array.isArray(data.nodes) ? data.nodes.length : 0
    const spanFromCount = Math.max(200, Math.ceil(Math.sqrt(Math.max(1, nodeCount))) * gridStep * 6)
    const targetSpan = Math.max(spanFromCount, spanFromPositions)
    let divisions = Math.max(4, Math.min(220, Math.round(targetSpan / Math.max(1, gridStep))))
    if (divisions % 2 !== 0) divisions += 1
    const span = divisions * gridStep
    return { span, divisions, gridStep }
  }, [data.nodes, mode, positions, schema])

  const motionIntensityForMode = mode === 'voxel' ? 0 : motionIntensityEffective

  const sceneGroupRef = React.useRef<THREE.Group | null>(null)
  useFrame(({ clock }) => {
    if (paused) return
    const g = sceneGroupRef.current
    if (!g) return
    if (mode === 'voxel') {
      g.position.set(0, 0, 0)
      g.rotation.set(0, 0, 0)
      return
    }
    const t = clock.getElapsedTime()
    const i = motionIntensityEffective
    g.position.x = Math.sin(t * 0.12) * (0.08 * i)
    g.position.y = Math.cos(t * 0.15) * (0.08 * i)
    g.rotation.z = Math.sin(t * 0.04) * (0.002 * i)
    g.rotation.x = Math.cos(t * 0.05) * (0.0035 * i)
  })
  return (
    <>
      {cameraConfig.fogColor ? (
        <fog attach="fog" args={[cameraConfig.fogColor, cameraConfig.fogNear, cameraConfig.fogFar]} />
      ) : null}
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#ffffff', '#cbd5e1', 0.6]} />
      <pointLight position={[120, 120, 120]} intensity={0.9} />
      {mode === 'voxel' && voxelGround ? (
        <group>
          <gridHelper args={[voxelGround.span, voxelGround.divisions, '#334155', '#1f2937']} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} />
          <mesh position={[0, 0, -0.5]}>
            <planeGeometry args={[voxelGround.span, voxelGround.span]} />
            <meshStandardMaterial color={'#0b1220'} transparent opacity={0.22} roughness={0.95} metalness={0.05} />
          </mesh>
        </group>
      ) : null}
      {mode === 'voxel'
        ? voxelGroupLights.map(light => (
          <pointLight key={light.id} position={light.pos} color={light.color} intensity={voxelClusterLightIntensity} distance={160} decay={2} />
        ))
        : null}
      {mode !== 'voxel' && starfieldEnabled && starfieldCount > 0 ? (
        <Starfield
          count={starfieldCount}
          radius={starfieldRadius}
          opacity={starfieldOpacity}
          color={starfieldColorRaw}
          paused={paused}
        />
      ) : null}
      <group ref={sceneGroupRef}>
        <Physics3D positions={positions} nodes={data.nodes} edges={data.edges} schema={schema} dragOverrides={dragRef} paused={paused} mode={mode} />
        {mode !== 'voxel' ? (
          <GlobeEffects
            data={data}
            schema={schema}
            positions={positions}
            edgeColor={neutralEdgeColor}
            nodeAccentColor={palette.nodes.hypothesis || MVP_COLOR_PALETTE.nodes.hypothesis}
          />
        ) : null}
        <GroupOverlays3d data={data} schema={schema} positions={positions} dragOverridesRef={dragRef} renderOrder={THREE_RENDER_ORDER.groups} />
        {threeEdgeRenderer === 'shaderLine' ? (
          <ShaderLineEdges
            edges={data.edges}
            positions={positions}
            nodeRadiusById={nodeRadiusMap}
            colorByEdge={colorByEdge}
            neutralEdgeColor={neutralEdgeColor}
            selectedEdgeColor={selectedEdgeColor}
            selectionMode={selectionMode}
            selectedEdgeIdSet={selectionSets.selectedEdgeIdSet}
            selectedNodeIdSet={selectionSets.selectedNodeIdSet}
            dimmedEdgeOpacity={selectionVisuals.dimmedEdgeOpacity}
            selectedEdgeWidth={selectionVisuals.selectedEdgeWidth}
            paused={paused}
            motionIntensity={motionIntensityForMode}
            draggedNodeId={draggedNodeId}
            dragOverridesRef={dragRef}
            lineWidthPx={threeShaderLineWidthPx}
            renderOrder={THREE_RENDER_ORDER.edges}
            onSelectEdge={(id) => {
              setSelectionSource('canvas')
              selectEdge(id)
            }}
            onHoverEdge={onHoverEdge}
          />
        ) : (
          data.edges.map((e) => {
          const a = positions[e.source]
          const b = positions[e.target]
          if (!a || !b) return null
          void hiddenNodeIds
          const props = e.properties || {}
          const parseRgba = (value: string): { color: string; alpha: number } | null => {
            const m = value.match(/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([0-9]*\.?[0-9]+)\s*\)$/i)
            if (!m) return null
            const r = Number(m[1])
            const g = Number(m[2])
            const b = Number(m[3])
            const a = Number(m[4])
            if (![r, g, b, a].every(Number.isFinite)) return null
            const rr = Math.max(0, Math.min(255, Math.floor(r)))
            const gg = Math.max(0, Math.min(255, Math.floor(g)))
            const bb = Math.max(0, Math.min(255, Math.floor(b)))
            const aa = Math.max(0, Math.min(1, a))
            return { color: `rgb(${rr}, ${gg}, ${bb})`, alpha: aa }
          }
          const baseStroke = getEdgeBaseStroke(e, schema)
          const rgba = baseStroke ? parseRgba(String(baseStroke || '').trim()) : null
          const baseColor = rgba?.color || baseStroke || neutralEdgeColor
          const color = baseColor
          const baseWidth = getEdgeStrokeWidth(e, schema)
          let width = clamp(baseWidth, 0.5, 5)
          const curveOptions = readEdgePathCurveOptions(e, schema)
          const bendAbs = curveOptions ? Math.max(0, Math.min(0.8, Math.abs(curveOptions.bend))) : 0
          const linkOpacity = typeof props['opacity'] === 'number'
            ? Math.max(0, Math.min(1, props['opacity'] as number))
            : (rgba ? rgba.alpha : (typeof opacityByLabel[e.label] === 'number' ? Math.max(0, Math.min(1, opacityByLabel[e.label] as number)) : linkOpacityDefault))
          const curvature = (() => {
            if (globalEdgeType === 'straight' || globalEdgeType === 'step') return 0
            if (globalEdgeType === 'smoothstep') {
              const raw = typeof props['curvature'] === 'number' ? Math.max(0, Math.min(1.5, props['curvature'] as number)) : linkCurvatureByEdgeType
              return Math.max(0.2, Math.max(raw, raw * (0.72 + bendAbs)))
            }
            const raw = typeof props['curvature'] === 'number' ? Math.max(0, Math.min(1.5, props['curvature'] as number)) : linkCurvatureByEdgeType
            return Math.max(0, Math.min(1.5, Math.max(raw, raw * (0.68 + bendAbs))))
          })()
          const arrowLen = typeof props['arrowLength'] === 'number' ? Math.max(2, Math.min(24, props['arrowLength'] as number)) : arrowLenDefault
          const arrowColor = typeof props['arrowColor'] === 'string' ? String(props['arrowColor']) : color
          const resolution = typeof props['resolution'] === 'number' ? Math.floor(props['resolution'] as number) : 24
          const arrowRelPos = typeof props['arrowRelPos'] === 'number'
            ? Math.max(0, Math.min(1, props['arrowRelPos'] as number))
            : arrowRelPosDefault
          const curveRotation = (() => {
            const raw = typeof props['curveRotation'] === 'number' ? (props['curveRotation'] as number) : curveRotationDefault
            const bend = curveOptions ? curveOptions.bend : 0
            const sign = bend < 0 ? -1 : bend > 0 ? 1 : curveOptions ? curveOptions.phase : 1
            if (sign < 0) return raw + Math.PI
            return raw
          })()
          const particles = typeof props['linkDirectionalParticles'] === 'number'
            ? Math.max(0, Math.min(64, Math.floor(props['linkDirectionalParticles'] as number)))
            : particlesDefault
          const particleSpeed = typeof props['linkDirectionalParticleSpeed'] === 'number'
            ? Math.max(0.01, Math.min(5, props['linkDirectionalParticleSpeed'] as number))
            : particleSpeedDefault
          const srcId = e.source as string
          const tgtId = e.target as string
          const srcRadius = nodeRadiusMap.get(srcId) || 5
          const tgtRadius = nodeRadiusMap.get(tgtId) || 5
          const isSelectedEdge = selectionSets.selectedEdgeIdSet.has(e.id)
          const isIncidentToSelectedNode = selectionSets.selectedNodeIdSet.size > 0 && (selectionSets.selectedNodeIdSet.has(srcId) || selectionSets.selectedNodeIdSet.has(tgtId))
          let finalColor = arrowColor || color
          let finalOpacity = linkOpacity
          const selectedEdgeWidth = selectionVisuals.selectedEdgeWidth
          const dimmedEdgeOpacity = selectionVisuals.dimmedEdgeOpacity
          if (selectionMode === 'edge') {
            if (isSelectedEdge) {
              finalColor = selectedEdgeColor
              finalOpacity = Math.max(finalOpacity, 0.9)
              width = Math.max(width, selectedEdgeWidth)
            } else {
              finalColor = neutralEdgeColor
              finalOpacity = Math.min(finalOpacity, dimmedEdgeOpacity)
              width = Math.max(1, Math.min(baseWidth, selectedEdgeWidth * 0.5))
            }
          } else if (selectionMode === 'node') {
            if (isIncidentToSelectedNode) {
              finalColor = selectedEdgeColor
              finalOpacity = Math.max(finalOpacity, 0.9)
              width = Math.max(width, selectedEdgeWidth)
            } else {
              finalColor = baseColor
              finalOpacity = Math.min(finalOpacity, dimmedEdgeOpacity)
              width = Math.max(1, Math.min(baseWidth, selectedEdgeWidth * 0.5))
            }
          }
          const resolvedFinalColor = resolveThreeColor(finalColor, neutralEdgeColor)
          return (
            <group
              key={e.id}
              name={`kg_edge:${e.id}`}
              renderOrder={THREE_RENDER_ORDER.edges + readThreeRenderOrderOffset(props as Record<string, unknown>)}
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
              onPointerMove={(evt: ThreeEvent<PointerEvent>) => {
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
                ? <CurvedEdgeMesh a={a} b={b} color={resolvedFinalColor} width={width} opacity={finalOpacity} curvature={curvature} resolution={resolution} rotation={curveRotation} paused={paused} name={`kg_edge:${e.id}`} sourceId={srcId} targetId={tgtId} sourceRadius={srcRadius} targetRadius={tgtRadius} motionIntensity={motionIntensityForMode} draggedNodeId={draggedNodeId} dragOverridesRef={dragRef} />
                : <EdgeMesh a={a} b={b} color={resolvedFinalColor} width={width} opacity={finalOpacity} resolution={resolution} paused={paused} name={`kg_edge:${e.id}`} sourceId={srcId} targetId={tgtId} sourceRadius={srcRadius} targetRadius={tgtRadius} motionIntensity={motionIntensityForMode} draggedNodeId={draggedNodeId} dragOverridesRef={dragRef} />
              }
              <ArrowHead start={a} end={b} color={resolvedFinalColor} height={arrowLen} relPos={arrowRelPos} paused={paused} name={`kg_edge:${e.id}`} sourceId={srcId} targetId={tgtId} sourceRadius={srcRadius} targetRadius={tgtRadius} motionIntensity={motionIntensityForMode} draggedNodeId={draggedNodeId} dragOverridesRef={dragRef} />
              {particles > 0 && particleSpeed > 0 ? (
                <DirectionalParticles start={a} end={b} count={particles} color={resolvedFinalColor} speed={particleSpeed} paused={paused} name={`kg_edge:${e.id}`} sourceId={srcId} targetId={tgtId} sourceRadius={srcRadius} targetRadius={tgtRadius} motionIntensity={motionIntensityForMode} draggedNodeId={draggedNodeId} dragOverridesRef={dragRef} />
              ) : null}
            </group>
          )
        })
        )}
        {data.nodes.map((n) => {
          const p = positions[n.id]
          if (!p) return null
          if (hiddenNodeIds && hiddenNodeIds.has(String(n.id))) return null
          const isSelected = selectionSets.selectedNodeIdSet.has(n.id)
          const isNeighbor = neighborIds.has(n.id)
          const isEdgeEndpoint = selectionSets.selectedEdgeEndpointNodeIdSet.has(n.id)
          const nodeProps = (n.properties || {}) as Record<string, unknown>
          return (
            <NodeMesh
              key={n.id}
              node={n}
              pos={p}
              schema={schema}
              renderOrder={THREE_RENDER_ORDER.nodes + readThreeRenderOrderOffset(nodeProps)}
              onClick={onSelectNode}
              selection={{ mode: selectionMode, isSelected, isNeighbor, isEdgeEndpoint }}
              visuals={selectionVisuals}
              paused={paused}
              onDragStart={allowNodeDrag ? handleDragStart : undefined}
              onDrag={allowNodeDrag ? handleDrag : undefined}
              onDragEnd={allowNodeDrag ? handleDragEnd : undefined}
              onHoverChange={onHoverNode}
              setNodeDragActive={allowNodeDrag ? onDragNode : undefined}
              motionIntensity={motionIntensityForMode}
              draggedNodeId={draggedNodeId}
              dragOverridesRef={dragRef}
              mode={mode}
            />
          )
        })}
      </group>
    </>
  )
}
