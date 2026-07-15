import * as THREE from 'three'
import { hashStringToHex } from '@/lib/hash/stringHash'

type ScenePartEvidence = {
  bounds: readonly number[]
  material: readonly Record<string, unknown>[]
  matrix: readonly number[]
  name: string
  primitive: string
}

export type ImageToGlbSceneEvidence = {
  aspectRatio: number
  foundParts: readonly string[]
  parts: readonly ScenePartEvidence[]
  projectionDigest: string
}

const rounded = (value: number) => Number(value.toFixed(5))

function readMaterialEvidence(material: THREE.Material): Record<string, unknown> {
  const candidate = material as THREE.MeshStandardMaterial
  return {
    color: candidate.color?.getHexString?.() || '',
    metalness: Number.isFinite(candidate.metalness) ? rounded(candidate.metalness) : null,
    name: material.name,
    roughness: Number.isFinite(candidate.roughness) ? rounded(candidate.roughness) : null,
    type: material.type,
  }
}

export function inspectImageToGlbScene(scene: THREE.Object3D): ImageToGlbSceneEvidence {
  scene.updateMatrixWorld(true)
  const parts: ScenePartEvidence[] = []
  scene.traverse(object => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    const box = new THREE.Box3().setFromObject(mesh)
    const material = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    parts.push({
      bounds: [...box.min.toArray(), ...box.max.toArray()].map(rounded),
      material: material.filter(Boolean).map(readMaterialEvidence),
      matrix: mesh.matrixWorld.elements.map(rounded),
      name: mesh.name,
      primitive: mesh.geometry.type,
    })
  })
  parts.sort((first, second) => first.name.localeCompare(second.name))
  const sceneBox = new THREE.Box3().setFromObject(scene)
  const size = sceneBox.getSize(new THREE.Vector3())
  const aspectRatio = size.y > 0 ? size.x / size.y : 0
  return {
    aspectRatio,
    foundParts: parts.map(part => part.name),
    parts,
    projectionDigest: hashStringToHex(JSON.stringify(parts)),
  }
}
