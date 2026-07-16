import React from 'react'
import * as THREE from 'three'
import { getVoxelLabelTexture } from '@/features/three/voxelLabelTexture'
import { resolveXrSceneLibraryAsset } from '@/features/three/xrSceneLibrary'
import type { XrMotionReferenceSubject } from '@/features/three/xrMotionReferenceModel'

function Material({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.9} metalness={0.02} />
}

function Humanoid({ color, size }: { color: string; size: readonly [number, number, number] }) {
  const [width, height, depth] = size
  return (
    <group>
      <mesh position={[0, 0, height * 0.55]}><boxGeometry args={[width * 0.72, depth, height * 0.54]} /><Material color={color} /></mesh>
      <mesh position={[0, 0, height * 0.9]}><sphereGeometry args={[width * 0.3, 16, 12]} /><Material color={color} /></mesh>
      <mesh position={[-width * 0.2, 0, height * 0.2]}><boxGeometry args={[width * 0.2, depth * 0.62, height * 0.4]} /><Material color={color} /></mesh>
      <mesh position={[width * 0.2, 0, height * 0.2]}><boxGeometry args={[width * 0.2, depth * 0.62, height * 0.4]} /><Material color={color} /></mesh>
    </group>
  )
}

function Quadruped({ color, size }: { color: string; size: readonly [number, number, number] }) {
  const [width, height, depth] = size
  return (
    <group>
      <mesh position={[0, 0, height * 0.58]}><boxGeometry args={[width, depth * 0.7, height * 0.42]} /><Material color={color} /></mesh>
      <mesh position={[0, -depth * 0.42, height * 0.72]}><sphereGeometry args={[width * 0.34, 14, 10]} /><Material color={color} /></mesh>
      {[-1, 1].flatMap(x => [-1, 1].map(y => (
        <mesh key={`${x}:${y}`} position={[x * width * 0.3, y * depth * 0.24, height * 0.22]}>
          <boxGeometry args={[width * 0.16, depth * 0.16, height * 0.44]} /><Material color={color} />
        </mesh>
      )))}
    </group>
  )
}

function Car({ color, size }: { color: string; size: readonly [number, number, number] }) {
  const [width, height, depth] = size
  return (
    <group>
      <mesh position={[0, 0, height * 0.34]}><boxGeometry args={[width, depth, height * 0.48]} /><Material color={color} /></mesh>
      <mesh position={[0, depth * 0.05, height * 0.72]}><boxGeometry args={[width * 0.76, depth * 0.5, height * 0.38]} /><Material color={color} /></mesh>
      {[-1, 1].flatMap(x => [-1, 1].map(y => (
        <mesh key={`${x}:${y}`} position={[x * width * 0.46, y * depth * 0.32, height * 0.2]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[height * 0.2, height * 0.2, width * 0.08, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={1} />
        </mesh>
      )))}
    </group>
  )
}

function Bicycle({ color, size }: { color: string; size: readonly [number, number, number] }) {
  const [width, height, depth] = size
  const radius = Math.min(height, depth * 0.32) * 0.42
  return (
    <group>
      {[-1, 1].map(y => (
        <mesh key={y} position={[0, y * depth * 0.35, radius]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[radius, Math.max(0.025, width * 0.05), 8, 22]} />
          <meshStandardMaterial color="#0f172a" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 0, radius * 1.2]} rotation={[Math.PI / 4, 0, 0]}><boxGeometry args={[width * 0.12, depth * 0.7, width * 0.12]} /><Material color={color} /></mesh>
      <mesh position={[0, -depth * 0.08, height * 0.78]}><boxGeometry args={[width * 0.7, width * 0.1, width * 0.1]} /><Material color={color} /></mesh>
    </group>
  )
}

function Chair({ color, size }: { color: string; size: readonly [number, number, number] }) {
  const [width, height, depth] = size
  return (
    <group>
      <mesh position={[0, 0, height * 0.48]}><boxGeometry args={[width, depth, height * 0.08]} /><Material color={color} /></mesh>
      <mesh position={[0, depth * 0.43, height * 0.72]}><boxGeometry args={[width, depth * 0.12, height * 0.5]} /><Material color={color} /></mesh>
      {[-1, 1].flatMap(x => [-1, 1].map(y => (
        <mesh key={`${x}:${y}`} position={[x * width * 0.4, y * depth * 0.38, height * 0.23]}><boxGeometry args={[width * 0.1, depth * 0.1, height * 0.46]} /><Material color={color} /></mesh>
      )))}
    </group>
  )
}

function Table({ color, size }: { color: string; size: readonly [number, number, number] }) {
  const [width, height, depth] = size
  return (
    <group>
      <mesh position={[0, 0, height * 0.9]}><boxGeometry args={[width, depth, height * 0.14]} /><Material color={color} /></mesh>
      {[-1, 1].flatMap(x => [-1, 1].map(y => (
        <mesh key={`${x}:${y}`} position={[x * width * 0.42, y * depth * 0.36, height * 0.43]}><boxGeometry args={[width * 0.08, depth * 0.08, height * 0.86]} /><Material color={color} /></mesh>
      )))}
    </group>
  )
}

function Sofa({ color, size }: { color: string; size: readonly [number, number, number] }) {
  const [width, height, depth] = size
  return (
    <group>
      <mesh position={[0, 0, height * 0.28]}><boxGeometry args={[width, depth, height * 0.5]} /><Material color={color} /></mesh>
      <mesh position={[0, depth * 0.38, height * 0.66]}><boxGeometry args={[width, depth * 0.22, height * 0.68]} /><Material color={color} /></mesh>
      {[-1, 1].map(x => <mesh key={x} position={[x * width * 0.46, 0, height * 0.52]}><boxGeometry args={[width * 0.08, depth, height * 0.42]} /><Material color={color} /></mesh>)}
    </group>
  )
}

function Cart({ color, size }: { color: string; size: readonly [number, number, number] }) {
  const [width, height, depth] = size
  return (
    <group>
      <mesh position={[0, 0, height * 0.58]}><boxGeometry args={[width, depth, height * 0.48]} /><meshStandardMaterial color={color} wireframe roughness={1} /></mesh>
      <mesh position={[0, depth * 0.46, height * 0.86]}><boxGeometry args={[width * 0.92, depth * 0.08, height * 0.08]} /><Material color={color} /></mesh>
      {[-1, 1].flatMap(x => [-1, 1].map(y => <mesh key={`${x}:${y}`} position={[x * width * 0.36, y * depth * 0.32, height * 0.12]} rotation={[0, Math.PI / 2, 0]}><cylinderGeometry args={[height * 0.11, height * 0.11, width * 0.08, 12]} /><meshStandardMaterial color="#0f172a" /></mesh>))}
    </group>
  )
}

function Tree({ color, size }: { color: string; size: readonly [number, number, number] }) {
  const [width, height, depth] = size
  return (
    <group>
      <mesh position={[0, 0, height * 0.34]}><cylinderGeometry args={[width * 0.11, width * 0.16, height * 0.68, 10]} /><meshStandardMaterial color="#854d0e" roughness={1} /></mesh>
      <mesh position={[0, 0, height * 0.76]}><sphereGeometry args={[Math.min(width, depth) * 0.5, 16, 12]} /><Material color={color} /></mesh>
    </group>
  )
}

function Lamp({ color, size }: { color: string; size: readonly [number, number, number] }) {
  const [width, height] = size
  return (
    <group>
      <mesh position={[0, 0, height * 0.48]}><cylinderGeometry args={[width * 0.08, width * 0.12, height * 0.96, 10]} /><meshStandardMaterial color="#475569" roughness={0.8} /></mesh>
      <mesh position={[0, 0, height]}><sphereGeometry args={[width * 0.3, 12, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} /></mesh>
    </group>
  )
}

function Umbrella({ color, size }: { color: string; size: readonly [number, number, number] }) {
  const [width, height] = size
  return (
    <group>
      <mesh position={[0, 0, height * 0.48]}><cylinderGeometry args={[width * 0.025, width * 0.035, height * 0.96, 10]} /><meshStandardMaterial color="#475569" /></mesh>
      <mesh position={[0, 0, height * 0.94]}><coneGeometry args={[width * 0.5, height * 0.25, 18, 1, true]} /><meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} /></mesh>
    </group>
  )
}

export function XrSceneLibraryAssetGeometry({
  assetId,
  color,
}: {
  assetId: string
  color?: string
}) {
  const asset = resolveXrSceneLibraryAsset(assetId)
  const size = asset.dimensionsMeters
  const effectiveColor = color || asset.defaultColor
  if (asset.shape === 'humanoid') return <Humanoid color={effectiveColor} size={size} />
  if (asset.shape === 'quadruped') return <Quadruped color={effectiveColor} size={size} />
  if (asset.shape === 'car') return <Car color={effectiveColor} size={size} />
  if (asset.shape === 'bicycle') return <Bicycle color={effectiveColor} size={size} />
  if (asset.shape === 'chair') return <Chair color={effectiveColor} size={size} />
  if (asset.shape === 'table') return <Table color={effectiveColor} size={size} />
  if (asset.shape === 'sofa') return <Sofa color={effectiveColor} size={size} />
  if (asset.shape === 'cart') return <Cart color={effectiveColor} size={size} />
  if (asset.shape === 'tree') return <Tree color={effectiveColor} size={size} />
  if (asset.shape === 'lamp') return <Lamp color={effectiveColor} size={size} />
  if (asset.shape === 'umbrella') return <Umbrella color={effectiveColor} size={size} />
  return <mesh position={[0, 0, size[1] * 0.5]}><boxGeometry args={[size[0], size[2], size[1]]} /><Material color={effectiveColor} /></mesh>
}

function SubjectLabel({ label, heightMeters }: { label: string; heightMeters: number }) {
  const labelTexture = React.useMemo(() => getVoxelLabelTexture({ text: label, fontSizePx: 18, textColor: '#f8fafc', bgColor: '#0f172a', bgOpacity: 0.88 }), [label])
  const aspect = labelTexture.widthPx / Math.max(1, labelTexture.heightPx)
  return (
    <sprite position={[0, 0, heightMeters + 0.45]} scale={[Math.min(3.2, Math.max(1.2, aspect * 0.5)), 0.5, 1]}>
      <spriteMaterial map={labelTexture.texture} transparent depthWrite={false} sizeAttenuation />
    </sprite>
  )
}

export function XrSceneLibrarySubject({
  subject,
  position,
  stageScale,
}: {
  subject: XrMotionReferenceSubject
  position: readonly [number, number, number]
  stageScale: number
}) {
  const asset = resolveXrSceneLibraryAsset(subject.assetId)
  return (
    <group
      name={`kg_xr_scene_subject_${subject.id}`}
      position={position}
      rotation={[0, THREE.MathUtils.degToRad(subject.rotationYDegrees), 0]}
      scale={stageScale * subject.scale}
      userData={{ subjectId: subject.id, assetId: subject.assetId, category: subject.category, label: subject.label }}
    >
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <XrSceneLibraryAssetGeometry assetId={subject.assetId} color={subject.color} />
        <SubjectLabel label={subject.label} heightMeters={asset.dimensionsMeters[1]} />
      </group>
    </group>
  )
}
