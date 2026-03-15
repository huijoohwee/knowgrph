import React, { useRef } from 'react'
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
}) {
  const hoveredRef = useRef(false)
  const sphereRef = useRef<THREE.Mesh>(null!)
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
  const resolvedColor = resolveThreeColor(displayColor, MVP_COLOR_PALETTE.nodes.execution)
  const resolvedEmissive = resolveThreeColor(emissiveColor, '#000000')
  const renderShape = getNodeRenderShape2d(node, schema)
  const rectDims = renderShape === 'circle' ? null : getNodeRectDimensions2d(node, schema)
  const depth = Math.max(2, radius * 0.85)
  const boxW = rectDims ? Math.max(2, rectDims.width) : Math.max(2, radius * 2)
  const boxH = rectDims ? Math.max(2, rectDims.height) : Math.max(2, radius * 2)
  const hexR = Math.max(2, Math.min(boxW, boxH) / 2)
  const meshRotation: [number, number, number] =
    renderShape === 'hex'
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
    // If we are dragging locally, we override the motion state for this node to be dragging
    if (dragging && !draggedNodeId) {
      ms.draggedNodeId = node.id
    }
    const basePos = dragOverridesRef?.current?.[node.id] || pos
    const p = computeNodeMotion(node.id, basePos, radius, ms, t)
    
    const s = hoveredRef.current ? 1.06 : 1
    sphereRef.current.scale.set(s, s, s)
    sphereRef.current.position.set(p[0], p[1], p[2])
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
    hoveredRef.current = false
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
          hoveredRef.current = true
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
        {renderShape === 'circle' ? (
          <sphereGeometry args={[radius, 32, 32]} />
        ) : renderShape === 'hex' ? (
          <cylinderGeometry args={[hexR, hexR, depth, 6]} />
        ) : (
          <boxGeometry args={[boxW, boxH, depth]} />
        )}
        <meshLambertMaterial
          color={resolvedColor}
          transparent
          opacity={isMediaNode ? 0 : displayOpacity}
          depthWrite={!isMediaNode}
          emissive={resolvedEmissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
    </group>
  )
}
