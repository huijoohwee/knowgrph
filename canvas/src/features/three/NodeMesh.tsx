import React, { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeConfig, getRendererPalette, MVP_COLOR_PALETTE } from '@/lib/graph/schema'
import { getNodeMediaSpec, getLayerOpacity, getNodeBaseFill, getRenderNodeRadius2d, getVisualOpacity } from '@/components/GraphCanvas/helpers'
import { getNodeRectDimensions2d, getNodeRenderShape2d } from '@/components/GraphCanvas/nodeSizing2d'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { NodeSelectionState, SelectionVisuals } from './selection'
import type { Vec3 } from './layout'
import { computeNodeMotion, type NodeMotionState } from './animation'
import { resolveThreeColor } from './resolveColor'
import type { Canvas3dModeId } from '@/lib/config'
import { resolveVoxelClusterColor, resolveVoxelClusterKey } from './voxelStyle'

export function NodeMesh({
  node,
  pos,
  schema,
  renderOrder,
  paused,
  onClick,
  selection,
  visuals,
  onDragStart,
  onDrag,
  onDragEnd,
  onHoverChange,
  setNodeDragActive,
  motionIntensity,
  draggedNodeId,
  dragOverridesRef,
  mode = '3d',
}: {
  node: GraphNode;
  pos: Vec3;
  schema: GraphSchema;
  renderOrder?: number;
  paused?: boolean;
  onClick: (id: string) => void;
  selection: NodeSelectionState;
  visuals: SelectionVisuals;
  onDragStart?: (id: string, e: ThreeEvent<PointerEvent>) => void;
  onDrag?: (id: string, e: ThreeEvent<PointerEvent>) => void;
  onDragEnd?: (id: string, e: ThreeEvent<PointerEvent>) => void;
  onHoverChange?: (info: { id: string; clientX: number; clientY: number } | null) => void;
  setNodeDragActive?: (id: string, active: boolean) => void;
  motionIntensity?: number;
  draggedNodeId?: string | null;
  dragOverridesRef?: React.MutableRefObject<Record<string, Vec3>>;
  mode?: Canvas3dModeId;
}) {
  const [hovered, setHovered] = useState(false)
  const sphereRef = useRef<THREE.Mesh>(null!)
  const ringRef = useRef<THREE.Mesh>(null)
  const diamondRef = useRef<THREE.Mesh>(null)
  const draggingRef = useRef(false)
  const mediaNodeOpacity = useGraphStore(s => s.mediaNodeOpacity)
  const renderMediaAsNodes = useGraphStore(s => s.renderMediaAsNodes)
  const baseColor = getNodeBaseFill(node, schema)
  const props = node.properties || {}
  const baseRadius = getRenderNodeRadius2d(node, schema)
  const baseLayerOpacity = (() => {
    const a = getLayerOpacity(node, schema)
    const b = getVisualOpacity(node)
    const v = a * b
    if (!Number.isFinite(v)) return 1
    if (v < 0) return 0
    if (v > 1) return 1
    return v
  })()
  const deg = typeof props['degree'] === 'number' ? (props['degree'] as number) : undefined
  const scale = deg ? Math.max(0.9, Math.min(1.6, 0.95 + Math.sqrt(Math.max(1, deg)) * 0.15)) : 1
  const radius = baseRadius * scale

  const mediaSpec = getNodeMediaSpec(node)
  const isMediaNode = !!renderMediaAsNodes && !!mediaSpec
  const mediaLayerOpacity = Math.max(0, Math.min(1, mediaNodeOpacity * baseLayerOpacity))

  let displayColor = baseColor
  let displayOpacity = baseLayerOpacity
  const palette = getRendererPalette(schema)
  const dimmedColor = palette.edges.neutral || MVP_COLOR_PALETTE.edges.neutral
  if (selection.mode === 'edge') {
    if (selection.isEdgeEndpoint) {
      displayColor = baseColor
      displayOpacity = isMediaNode ? mediaLayerOpacity : baseLayerOpacity
    } else {
      displayColor = dimmedColor
      displayOpacity = isMediaNode ? mediaLayerOpacity : baseLayerOpacity * visuals.dimmedNodeOpacity
    }
  } else if (selection.mode === 'node') {
    if (selection.isSelected) {
      displayColor = visuals.selectedEdgeColor
      displayOpacity = isMediaNode ? mediaLayerOpacity : baseLayerOpacity
    } else if (selection.isNeighbor) {
      displayColor = baseColor
      displayOpacity = isMediaNode ? mediaLayerOpacity : baseLayerOpacity
    } else {
      displayColor = dimmedColor
      displayOpacity = isMediaNode ? mediaLayerOpacity : baseLayerOpacity * visuals.dimmedNodeOpacity
    }
  }
  if (isMediaNode && selection.mode === 'none' && !selection.isSelected) {
    displayColor = dimmedColor
  }
  const isSelectedNode = selection.isSelected
  const emissiveColor = isSelectedNode ? visuals.selectedEdgeColor : '#000000'
  const emissiveIntensity = isSelectedNode ? visuals.selectedNodeGlowIntensity : 0
  const resolvedEmissive = resolveThreeColor(emissiveColor, '#000000')
  const renderShape = getNodeRenderShape2d(node, schema)
  const rectDims = renderShape === 'circle' ? null : getNodeRectDimensions2d(node, schema)
  const depth = Math.max(2, radius * 0.85)
  const boxW = rectDims ? Math.max(2, rectDims.width) : Math.max(2, radius * 2)
  const boxH = rectDims ? Math.max(2, rectDims.height) : Math.max(2, radius * 2)
  const hexR = Math.max(2, Math.min(boxW, boxH) / 2)
  const isVoxel = mode === 'voxel'
  const normalizedType = String(node.type || '').toLowerCase()
  const isHub = normalizedType.includes('hub')
  const isProblem = normalizedType.includes('problem')
  const isConcept = normalizedType.includes('concept')
  const clusterKey = resolveVoxelClusterKey(node)
  const isGrouped = clusterKey.length > 0
  const voxelTier = isHub ? 'hub' : (isGrouped || isProblem || isConcept ? 'block' : 'brick')
  const voxelScale = voxelTier === 'hub' ? 1.34 : voxelTier === 'block' ? 1.08 : 0.9
  const voxelBaseSize = Math.max(2, boxW, boxH, depth)
  const voxelSize = Math.max(2, voxelBaseSize * voxelScale)
  const voxelW = voxelSize
  const voxelH = voxelSize
  const voxelD = voxelSize
  const capHeight = Math.max(0.8, voxelH * 0.12)
  const threeCfg = getThreeConfig(schema)
  const clusterColor = resolveVoxelClusterColor(node)
  const voxelColor = isVoxel && clusterColor ? clusterColor : displayColor
  const resolvedColor = resolveThreeColor(voxelColor, MVP_COLOR_PALETTE.nodes.execution)
  const ghostOpacity = (() => {
    const raw = typeof threeCfg.voxelGhostOpacity === 'number' ? threeCfg.voxelGhostOpacity : 0.32
    if (!Number.isFinite(raw)) return 0.32
    return Math.max(0.05, Math.min(0.9, raw))
  })()
  const topCapEmissiveIntensity = (() => {
    const raw = typeof threeCfg.voxelTopCapEmissiveIntensity === 'number' ? threeCfg.voxelTopCapEmissiveIntensity : 0.9
    if (!Number.isFinite(raw)) return 0.9
    return Math.max(0.2, Math.min(2.2, raw))
  })()
  const hubPulseStrength = (() => {
    const raw = typeof threeCfg.voxelHubPulseStrength === 'number' ? threeCfg.voxelHubPulseStrength : 0.07
    if (!Number.isFinite(raw)) return 0.07
    return Math.max(0, Math.min(0.5, raw))
  })()
  const voxelEmissiveBase = voxelTier === 'hub' ? 0.55 : voxelTier === 'block' ? 0.32 : 0.2
  const meshRotation: [number, number, number] =
    isVoxel
      ? [0, 0, 0]
      : renderShape === 'hex'
      ? [Math.PI / 2, 0, 0]
      : renderShape === 'diamond'
        ? [0, 0, Math.PI / 4]
        : [0, 0, 0]
  useFrame(({ clock }) => {
    if (paused) return
    if (!sphereRef.current) return
    const t = clock.getElapsedTime()
    const dragging = draggingRef.current
    const ms: NodeMotionState = { intensity: motionIntensity || 0, draggedNodeId }
    if (dragging && !draggedNodeId) {
      ms.draggedNodeId = node.id
    }
    const basePos = dragOverridesRef?.current?.[node.id] || pos
    const p = computeNodeMotion(node.id, basePos, radius, ms, t)
    
    const s = hovered ? 1.06 : 1
    const pulse = isVoxel && isHub ? 1 + Math.sin(t * 2 + node.id.length * 0.6) * hubPulseStrength : 1
    sphereRef.current.scale.set(s * pulse, s * pulse, s * pulse)
    const conceptBob = 0
    const voxelBaseLift = isVoxel ? voxelH * 0.5 : 0
    sphereRef.current.position.set(p[0], p[1], p[2] + voxelBaseLift + conceptBob)
    if (isVoxel) {
      sphereRef.current.rotation.set(0, 0, 0)
    }
    if (ringRef.current && isSelectedNode && isVoxel) {
      ringRef.current.rotation.set(0, 0, 0)
    }
    if (diamondRef.current && isVoxel) {
      diamondRef.current.rotation.set(0, 0, 0)
    }
  })
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    const isModifier = e.metaKey || e.ctrlKey
    if (!isModifier) return
    draggingRef.current = true
    setNodeDragActive?.(node.id, true)
    if (onDragStart) onDragStart(node.id, e)
  }
  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (onHoverChange) {
      onHoverChange({ id: node.id, clientX: e.clientX, clientY: e.clientY })
    }
    if (!draggingRef.current) return
    if (onDrag) onDrag(node.id, e)
  }
  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setNodeDragActive?.(node.id, false)
    if (onDragEnd) onDragEnd(node.id, e)
  }
  const handlePointerOut = () => {
    setHovered(false)
    if (draggingRef.current) {
      draggingRef.current = false
      setNodeDragActive?.(node.id, false)
    }
  }
  return (
    <group name={`kg_node:${node.id}`} renderOrder={renderOrder}>
      <mesh
        ref={sphereRef}
        name={`kg_node:${node.id}`}
        renderOrder={renderOrder}
        rotation={meshRotation}
        onClick={() => onClick(node.id)}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          setHovered(true)
          if (onHoverChange) {
            onHoverChange({ id: node.id, clientX: e.clientX, clientY: e.clientY })
          }
        }}
        onPointerOut={() => {
          handlePointerOut()
          if (onHoverChange) {
            onHoverChange(null)
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {isVoxel ? (
          <boxGeometry args={[voxelW, voxelD, voxelH]} />
        ) : renderShape === 'circle' ? (
          <sphereGeometry args={[radius, 32, 32]} />
        ) : renderShape === 'hex' ? (
          <cylinderGeometry args={[hexR, hexR, depth, 6]} />
        ) : (
          <boxGeometry args={[boxW, boxH, depth]} />
        )}
        <meshStandardMaterial
          color={resolvedColor}
          transparent
          opacity={isMediaNode ? 0 : displayOpacity}
          depthWrite={!isMediaNode}
          emissive={resolvedEmissive}
          emissiveIntensity={isVoxel ? Math.max(emissiveIntensity, voxelEmissiveBase) : emissiveIntensity}
          roughness={isVoxel ? 0.22 : 0.6}
          metalness={isVoxel ? 0.7 : 0.1}
        />
        {isVoxel ? (
          <>
            <mesh position={[0, 0, voxelH * 0.5 + capHeight * 0.5]}>
              <boxGeometry args={[voxelW * 0.98, voxelD * 0.98, capHeight]} />
              <meshStandardMaterial color={resolvedColor} emissive={resolvedColor} emissiveIntensity={topCapEmissiveIntensity} transparent opacity={0.88} roughness={0.08} metalness={0.95} />
            </mesh>
            <mesh ref={diamondRef}>
              <octahedronGeometry args={[Math.max(1.2, Math.min(voxelW, voxelH) * 0.2), 0]} />
              <meshStandardMaterial color={resolvedColor} emissive={resolvedColor} emissiveIntensity={0.6} transparent opacity={0.92} roughness={0.1} metalness={0.95} />
            </mesh>
            {hovered ? (
              <mesh>
                <boxGeometry args={[voxelW * 1.15, voxelD * 1.15, voxelH * 1.15]} />
                <meshStandardMaterial color={resolvedColor} emissive={resolvedColor} emissiveIntensity={0.38} transparent opacity={ghostOpacity} depthWrite={false} roughness={0.3} metalness={0.3} />
              </mesh>
            ) : null}
            {hovered ? (
              <mesh>
                <boxGeometry args={[voxelW * 1.16, voxelD * 1.16, voxelH * 1.16]} />
                <meshBasicMaterial color={resolvedColor} wireframe transparent opacity={Math.min(0.95, ghostOpacity + 0.22)} />
              </mesh>
            ) : null}
            {isSelectedNode ? (
              <mesh ref={ringRef}>
                <boxGeometry args={[voxelW * 1.22, voxelD * 1.22, voxelH * 1.22]} />
                <meshBasicMaterial color={resolvedColor} wireframe transparent opacity={0.75} />
              </mesh>
            ) : null}
          </>
        ) : null}
      </mesh>
    </group>
  )
}
