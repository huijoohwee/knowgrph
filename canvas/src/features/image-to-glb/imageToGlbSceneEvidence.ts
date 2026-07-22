import * as THREE from 'three'
import { hashStringToHex } from '@/lib/hash/stringHash'

type ScenePartEvidence = {
  bounds: readonly number[]
  effectiveVisible: boolean
  geometry: Record<string, unknown>
  localMatrix: readonly number[]
  material: readonly Record<string, unknown>[]
  matrix: readonly number[]
  name: string
  parentPath: readonly string[]
  primitive: string
  visible: boolean
}

type SceneNodeEvidence = {
  localMatrix: readonly number[]
  matrix: readonly number[]
  name: string
  parentPath: readonly string[]
  type: string
  visible: boolean
}

export type ImageToGlbSceneEvidence = {
  animations: readonly Record<string, unknown>[]
  aspectRatio: number
  foundParts: readonly string[]
  nodes: readonly SceneNodeEvidence[]
  parts: readonly ScenePartEvidence[]
  projectionDigest: string
}

export const IMAGE_TO_GLB_MATERIAL_TEXTURE_SLOTS = Object.freeze([
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'lightMap',
  'map',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
])

const rounded = (value: number) => Number(value.toFixed(5))

function readMaterialEvidence(material: THREE.Material): Record<string, unknown> {
  const candidate = material as THREE.MeshStandardMaterial
  const record = candidate as unknown as Record<string, unknown>
  return {
    alphaHash: material.alphaHash,
    alphaTest: rounded(material.alphaTest),
    blending: material.blending,
    color: candidate.color?.getHexString?.() || '',
    depthTest: material.depthTest,
    depthWrite: material.depthWrite,
    emissive: candidate.emissive?.getHexString?.() || '',
    emissiveIntensity: Number.isFinite(candidate.emissiveIntensity) ? rounded(candidate.emissiveIntensity) : null,
    flatShading: candidate.flatShading,
    maps: IMAGE_TO_GLB_MATERIAL_TEXTURE_SLOTS.filter(slot => Boolean(record[slot])),
    metalness: Number.isFinite(candidate.metalness) ? rounded(candidate.metalness) : null,
    name: material.name,
    opacity: Number.isFinite(material.opacity) ? rounded(material.opacity) : null,
    side: material.side,
    toneMapped: material.toneMapped,
    transparent: material.transparent,
    roughness: Number.isFinite(candidate.roughness) ? rounded(candidate.roughness) : null,
    type: material.type,
    vertexColors: candidate.vertexColors,
    visible: material.visible,
    wireframe: candidate.wireframe,
  }
}

function numericArrayFingerprint(value: ArrayLike<number>): string {
  const values = new Array<string>(value.length)
  for (let index = 0; index < value.length; index += 1) {
    const item = Number(value[index])
    values[index] = Number.isFinite(item) ? String(rounded(item)) : String(item)
  }
  return hashStringToHex(values.join(','))
}

function readGeometryEvidence(geometry: THREE.BufferGeometry): Record<string, unknown> {
  const attributes = Object.entries(geometry.attributes)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([name, attribute]) => {
      return {
        count: attribute.count,
        fingerprint: numericArrayFingerprint(attribute.array),
        itemSize: attribute.itemSize,
        name,
        normalized: attribute.normalized,
      }
    })
  const index = geometry.getIndex()
  return {
    attributes,
    groups: geometry.groups.map(group => ({ count: group.count, materialIndex: group.materialIndex, start: group.start })),
    index: index ? {
      count: index.count,
      fingerprint: numericArrayFingerprint(index.array),
    } : null,
  }
}

function readParentPath(object: THREE.Object3D, root: THREE.Object3D): string[] {
  const path: string[] = []
  let parent = object.parent
  while (parent && parent !== root) {
    path.unshift(parent.name)
    parent = parent.parent
  }
  return path
}

function readAnimationEvidence(clips: readonly THREE.AnimationClip[]): Record<string, unknown>[] {
  return clips.map(clip => ({
    duration: rounded(clip.duration),
    name: clip.name,
    tracks: clip.tracks.map(track => ({
      interpolation: track.getInterpolation(),
      name: track.name,
      times: numericArrayFingerprint(track.times),
      values: numericArrayFingerprint(track.values),
    })),
  })).sort((first, second) => String(first.name).localeCompare(String(second.name)))
}

function isEffectivelyVisible(object: THREE.Object3D, root: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object
  while (current) {
    if (!current.visible) return false
    if (current === root) return true
    current = current.parent
  }
  return false
}

export function inspectImageToGlbScene(scene: THREE.Object3D): ImageToGlbSceneEvidence {
  scene.updateMatrixWorld(true)
  const nodes: SceneNodeEvidence[] = []
  const parts: ScenePartEvidence[] = []
  scene.traverse(object => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) {
      if (object.name) {
        nodes.push({
          localMatrix: object.matrix.elements.map(rounded),
          matrix: object.matrixWorld.elements.map(rounded),
          name: object.name,
          parentPath: readParentPath(object, scene),
          type: object.type,
          visible: object.visible,
        })
      }
      return
    }
    const box = new THREE.Box3().setFromObject(mesh)
    const material = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    parts.push({
      bounds: [...box.min.toArray(), ...box.max.toArray()].map(rounded),
      effectiveVisible: isEffectivelyVisible(mesh, scene),
      geometry: readGeometryEvidence(mesh.geometry),
      localMatrix: mesh.matrix.elements.map(rounded),
      material: material.filter(Boolean).map(readMaterialEvidence),
      matrix: mesh.matrixWorld.elements.map(rounded),
      name: mesh.name,
      parentPath: readParentPath(mesh, scene),
      primitive: mesh.geometry.type,
      visible: mesh.visible,
    })
  })
  nodes.sort((first, second) => first.name.localeCompare(second.name)
    || first.parentPath.join('/').localeCompare(second.parentPath.join('/')))
  parts.sort((first, second) => first.name.localeCompare(second.name))
  const sceneBox = new THREE.Box3().setFromObject(scene)
  const size = sceneBox.getSize(new THREE.Vector3())
  const aspectRatio = size.y > 0 ? size.x / size.y : 0
  const animations = readAnimationEvidence(Array.isArray(scene.animations) ? scene.animations : [])
  return {
    animations,
    aspectRatio,
    foundParts: parts.map(part => part.name),
    nodes,
    parts,
    projectionDigest: hashStringToHex(JSON.stringify({ animations, nodes, parts })),
  }
}
