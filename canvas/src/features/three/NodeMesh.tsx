import React, { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema, ThreeConfig } from '@/lib/graph/schema'
import { getThreeConfig, getRendererPalette, MVP_COLOR_PALETTE } from '@/lib/graph/schema'
import { getNodeMediaSpec, getLayerOpacity, getNodeBaseFill, getRenderNodeRadius2d } from '@/components/GraphCanvas/helpers'
import { applyMediaProxySrc } from '@/lib/url'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { NodeSelectionState, SelectionVisuals } from './selection'
import type { Vec3 } from './layout'

function MediaBillboard({ url, size, opacity, offsetZ }: { url: string; size: number; opacity: number; offsetZ: number }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const textureRef = useRef<THREE.Texture | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [, bump] = useState(0)

  useEffect(() => {
    const prev = textureRef.current
    if (prev) {
      prev.dispose()
      textureRef.current = null
    }

    let cancelled = false
    setLoadError(false)
    const loader = new THREE.TextureLoader()
    try {
      loader.setCrossOrigin('anonymous')
    } catch {
      void 0
    }

    const src = applyMediaProxySrc(url)
    loader.load(
      src,
      tex => {
        if (cancelled) {
          try {
            tex.dispose()
          } catch {
            void 0
          }
          return
        }
        try {
          tex.colorSpace = THREE.SRGBColorSpace
        } catch {
          void 0
        }
        textureRef.current = tex
        bump(x => x + 1)
      },
      undefined,
      () => {
        if (cancelled) return
        textureRef.current = null
        setLoadError(true)
        bump(x => x + 1)
      },
    )

    return () => {
      cancelled = true
      const t = textureRef.current
      if (t) {
        try {
          t.dispose()
        } catch {
          void 0
        }
        textureRef.current = null
      }
    }
  }, [url])

  useFrame(state => {
    if (!meshRef.current) return
    meshRef.current.lookAt(state.camera.position)
  })

  const texture = textureRef.current
  if (!texture) {
    if (!loadError) return null
    const o = Math.max(0, Math.min(1, opacity))
    const s = Math.max(1, size)
    return (
      <mesh ref={meshRef} position={[0, 0, offsetZ]}>
        <planeGeometry args={[s, s]} />
        <meshBasicMaterial
          color={MVP_COLOR_PALETTE.nodes.alert}
          transparent
          opacity={Math.max(0.25, Math.min(0.9, o))}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    )
  }

  const o = Math.max(0, Math.min(1, opacity))
  const s = Math.max(1, size)
  return (
    <mesh ref={meshRef} position={[0, 0, offsetZ]}>
      <planeGeometry args={[s, s]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={o}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

export function NodeMesh({
  node,
  pos,
  schema,
  paused,
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
  paused?: boolean;
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
  const mediaNodeOpacity = useGraphStore(s => s.mediaNodeOpacity)
  const renderMediaAsNodes = useGraphStore(s => s.renderMediaAsNodes)
  const baseColor = getNodeBaseFill(node, schema)
  const props = node.properties || {}
  const baseRadius = getRenderNodeRadius2d(node, schema)
  const baseLayerOpacity = getLayerOpacity(node, schema)
  const deg = typeof props['degree'] === 'number' ? (props['degree'] as number) : undefined
  const scale = deg ? Math.max(0.9, Math.min(1.6, 0.95 + Math.sqrt(Math.max(1, deg)) * 0.15)) : 1
  const radius = baseRadius * scale

  const mediaSpec = getNodeMediaSpec(node)
  const hasImage = !!renderMediaAsNodes && !!mediaSpec && (mediaSpec.kind === 'image' || mediaSpec.kind === 'svg')
  const imageUrl = hasImage ? mediaSpec.url : null

  let displayColor = baseColor
  let displayOpacity = baseLayerOpacity
  const mediaOpacity = mediaNodeOpacity
  const palette = getRendererPalette(schema)
  const dimmedColor = palette.edges.neutral || MVP_COLOR_PALETTE.edges.neutral
  if (selection.mode === 'edge') {
    if (selection.isEdgeEndpoint) {
      displayColor = baseColor
      displayOpacity = mediaOpacity
    } else {
      displayColor = dimmedColor
      displayOpacity = mediaOpacity * visuals.dimmedNodeOpacity
    }
  } else if (selection.mode === 'node') {
    if (selection.isSelected) {
      displayColor = visuals.selectedEdgeColor
      displayOpacity = mediaOpacity
    } else if (selection.isNeighbor) {
      displayColor = baseColor
      displayOpacity = mediaOpacity
    } else {
      displayColor = dimmedColor
      displayOpacity = mediaOpacity * visuals.dimmedNodeOpacity
    }
  }
  const isSelectedNode = selection.isSelected
  const emissiveColor = isSelectedNode ? visuals.selectedEdgeColor : '#000000'
  const emissiveIntensity = isSelectedNode ? visuals.selectedNodeGlowIntensity : 0
  useFrame(() => {
    if (paused) return
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
    <group>
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
          opacity={hasImage ? Math.max(0.1, displayOpacity * 0.3) : displayOpacity}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
        />
        {hasImage && imageUrl && (
          <MediaBillboard
            url={imageUrl}
            size={radius * 1.5}
            opacity={displayOpacity}
            offsetZ={radius + 0.1}
          />
        )}
      </mesh>
    </group>
  )
}
