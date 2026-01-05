import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema, ThreeConfig } from '@/lib/graph/schema'
import { getNodeRadiusFromSchema, getThreeConfig, getRendererPalette, getAgenticRagTagColor } from '@/lib/graph/schema'
import type { Vec3 } from './layout'
import type { NodeSelectionState, SelectionVisuals } from './selection'

function normalizePriorityLabel(value: unknown): 'P1' | 'P2' | 'P3' | 'Backlog' | null {
  const raw = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''
  const v = raw.trim().toUpperCase()
  if (v === 'P1' || v === 'P2' || v === 'P3') return v
  if (v === 'BACKLOG') return 'Backlog'
  return null
}

function getPriorityColor(priority: 'P1' | 'P2' | 'P3' | 'Backlog', schema: GraphSchema): string {
  const palette = getRendererPalette(schema)
  if (priority === 'P1') return palette.nodes.alert
  if (priority === 'P2') return palette.nodes.pivot
  if (priority === 'P3') return palette.nodes.hypothesis
  return '#6b7280'
}

function getNodeBaseColor(node: GraphNode, schema: GraphSchema): string {
  const props = node.properties || {}
  if (node.type === 'CustomerFeedback' || node.type === 'Priority') {
    const prio = normalizePriorityLabel(props['priority'])
    if (prio) return getPriorityColor(prio, schema)
  }
  const tagColor = getAgenticRagTagColor(node, schema)
  if (tagColor) return tagColor
  const byType = schema.nodeStyles[node.type]?.color
  if (typeof byType === 'string' && byType.trim()) return byType
  const palette = getRendererPalette(schema)
  return palette.nodes.execution
}

export function NodeMesh({
  node,
  pos,
  schema,
  onClick,
  selection,
  visuals,
  onDragStart,
  onDrag,
  onDragEnd,
  onHoverChange,
}: {
  node: GraphNode;
  pos: Vec3;
  schema: GraphSchema;
  onClick: (id: string) => void;
  selection: NodeSelectionState;
  visuals: SelectionVisuals;
  onDragStart?: (id: string, e: ThreeEvent<PointerEvent>) => void;
  onDrag?: (id: string, e: ThreeEvent<PointerEvent>) => void;
  onDragEnd?: (id: string, e: ThreeEvent<PointerEvent>) => void;
  onHoverChange?: (info: { id: string; clientX: number; clientY: number } | null) => void;
}) {
  const hoveredRef = useRef(false)
  const sphereRef = useRef<THREE.Mesh>(null!)
  const draggingRef = useRef(false)
  const baseColor = getNodeBaseColor(node, schema)
  const props = node.properties || {}
  const baseRadius = getNodeRadiusFromSchema(node, schema)
  const layerRaw = props['visual:layer']
  let baseLayerOpacity = 1
  let numericLayer: number | null = null
  if (typeof layerRaw === 'number') {
    numericLayer = layerRaw
  } else if (typeof layerRaw === 'string') {
    const n = Number(layerRaw)
    if (Number.isFinite(n)) numericLayer = n
  }
  const layerKey = numericLayer != null ? String(numericLayer) : null
  const layerOpacityByLayer = getThreeConfig(schema).layerOpacityByLayer || {}
  if (layerKey && Object.prototype.hasOwnProperty.call(layerOpacityByLayer, layerKey)) {
    const v = layerOpacityByLayer[layerKey]
    if (typeof v === 'number' && Number.isFinite(v)) {
      baseLayerOpacity = v
    }
  } else if (numericLayer != null) {
    if (numericLayer === 1) baseLayerOpacity = 1
    else if (numericLayer === 2) baseLayerOpacity = 0.9
    else if (numericLayer === 3) baseLayerOpacity = 0.8
  }
  const deg = typeof props['degree'] === 'number' ? (props['degree'] as number) : undefined
  const scale = deg ? Math.max(0.9, Math.min(1.6, 0.95 + Math.sqrt(Math.max(1, deg)) * 0.15)) : 1
  const radius = baseRadius * scale
  let displayColor = baseColor
  let displayOpacity = baseLayerOpacity
  if (selection.mode === 'edge') {
    if (selection.isEdgeEndpoint) {
      displayColor = baseColor
      displayOpacity = baseLayerOpacity
    } else {
      displayColor = '#9CA3AF'
      displayOpacity = baseLayerOpacity * visuals.dimmedNodeOpacity
    }
  } else if (selection.mode === 'node') {
    if (selection.isSelected) {
      displayColor = visuals.selectedEdgeColor
      displayOpacity = baseLayerOpacity
    } else if (selection.isNeighbor) {
      displayColor = baseColor
      displayOpacity = baseLayerOpacity
    } else {
      displayColor = '#9CA3AF'
      displayOpacity = baseLayerOpacity * visuals.dimmedNodeOpacity
    }
  }
  const isSelectedNode = selection.isSelected
  const emissiveColor = isSelectedNode ? visuals.selectedEdgeColor : '#000000'
  const emissiveIntensity = isSelectedNode ? visuals.selectedNodeGlowIntensity : 0
  useFrame(() => {
    if (!sphereRef.current) return
    const threeCfg: ThreeConfig = getThreeConfig(schema)
    const motionRaw = threeCfg.nodeMotionIntensity
    const motion = typeof motionRaw === 'number'
      ? Math.max(0, Math.min(2, motionRaw))
      : 1
    const amp = 0.2 * motion
    const t = Date.now() * 0.001
    const s = hoveredRef.current ? 1.06 : 1
    sphereRef.current.scale.set(s, s, s)
    sphereRef.current.position.x = pos[0] + Math.sin(t * 0.2 + node.id.length) * amp
    sphereRef.current.position.y = pos[1] + Math.cos(t * 0.25 + node.id.length) * amp
    sphereRef.current.position.z = pos[2]
  })
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    const isModifier = e.metaKey || e.ctrlKey
    if (!isModifier) return
    draggingRef.current = true
    if (onDragStart) onDragStart(node.id, e)
  }
  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return
    if (onDrag) onDrag(node.id, e)
  }
  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (onDragEnd) onDragEnd(node.id, e)
  }
  const handlePointerOut = () => {
    hoveredRef.current = false
    draggingRef.current = false
  }
  return (
    <mesh
      ref={sphereRef}
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
      <sphereGeometry args={[radius, 32, 32]} />
      <meshLambertMaterial
        color={displayColor}
        transparent
        opacity={displayOpacity}
        emissive={emissiveColor}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  )
}
