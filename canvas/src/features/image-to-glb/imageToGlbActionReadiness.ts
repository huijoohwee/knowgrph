import * as THREE from 'three'

export const IMAGE_TO_GLB_MODEL_ROOT_NAME = 'ImageToGlbModelRoot'
export const IMAGE_TO_GLB_INSPECTION_CLIP_NAME = 'ImageToGlbInspectionLoop'
export const IMAGE_TO_GLB_INSPECTION_DURATION_SECONDS = 4
export const IMAGE_TO_GLB_INSPECTION_MAXIMUM_YAW_RADIANS = THREE.MathUtils.degToRad(12)

const ACTION_MANIFEST_KEY = 'imageToGlbActionReadiness'
const ACTION_NODE_KEY = 'imageToGlbActionNode'
const PART_READINESS_KEY = 'imageToGlbPartReadiness'
const MATRIX_TOLERANCE = 1e-6
const VALUE_TOLERANCE = 1e-5

export type ImageToGlbMotionClassification = 'rigid' | 'deformable'

export type ImageToGlbActionPart = {
  classification: ImageToGlbMotionClassification
  meshName: string
  partId: string
  pivotName: string
  socketName: string
  surfaceProvenance: {
    front: 'observed'
    hidden: 'inferred'
  }
}

export type ImageToGlbActionReadinessManifest = {
  animation: {
    clipName: string
    durationSeconds: number
    loop: 'repeat-continuous'
    maximumYawRadians: number
    trackName: string
  }
  modelRootName: string
  parts: readonly ImageToGlbActionPart[]
  schemaVersion: 'image-to-glb-action-readiness/v1'
}

export type ImageToGlbActionReadinessViolation = {
  code:
    | 'attachment-transform-mismatch'
    | 'duplicate-name'
    | 'hierarchy-mismatch'
    | 'invalid-animation'
    | 'invalid-animation-binding'
    | 'invalid-manifest'
    | 'invalid-provenance'
    | 'missing-animation'
    | 'missing-mesh'
    | 'missing-model-root'
    | 'missing-pivot'
    | 'missing-socket'
    | 'non-finite-transform'
    | 'non-loop-continuous-animation'
    | 'unstable-name'
    | 'unsupported-deformable'
  message: string
}

export type ImageToGlbActionReadinessValidation = {
  valid: boolean
  violations: readonly ImageToGlbActionReadinessViolation[]
}

export type ImageToGlbActionReadinessResult = {
  clip: THREE.AnimationClip
  manifest: ImageToGlbActionReadinessManifest
  modelRoot: THREE.Group
  scene: THREE.Object3D
}

type PartNodes = {
  mesh: THREE.Mesh
  part: ImageToGlbActionPart
  pivot: THREE.Group
  socket: THREE.Object3D
}

function stableToken(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function expectedPart(meshName: string): ImageToGlbActionPart | null {
  const token = stableToken(meshName)
  if (!token) return null
  return {
    classification: 'rigid',
    meshName,
    partId: `part-${token}`,
    pivotName: `ImageToGlbPivot-${token}`,
    socketName: `ImageToGlbSocket-${token}`,
    surfaceProvenance: { front: 'observed', hidden: 'inferred' },
  }
}

function isStableSourceName(name: string): boolean {
  return name.length > 0
    && name.length <= 96
    && name === name.trim()
    && ![...name].some(character => {
      const codePoint = character.codePointAt(0) || 0
      return codePoint <= 31 || codePoint === 127
    })
    && Boolean(stableToken(name))
}

function isDeformableMesh(mesh: THREE.Mesh): boolean {
  const candidate = mesh as THREE.SkinnedMesh
  return Boolean(
    candidate.isSkinnedMesh
    || (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0)
    || Object.values(mesh.geometry.morphAttributes).some(attributes => attributes.length > 0),
  )
}

function isFiniteObjectTransform(object: THREE.Object3D): boolean {
  const values = [
    ...object.position.toArray(),
    ...object.quaternion.toArray(),
    ...object.scale.toArray(),
    ...object.matrix.elements,
    ...object.matrixWorld.elements,
  ]
  return values.every(Number.isFinite)
}

function matricesMatch(first: THREE.Matrix4, second: THREE.Matrix4): boolean {
  return first.elements.every((value, index) => Math.abs(value - second.elements[index]) <= MATRIX_TOLERANCE)
}

function namedObjects(scene: THREE.Object3D): Map<string, THREE.Object3D[]> {
  const result = new Map<string, THREE.Object3D[]>()
  scene.traverse(object => {
    if (!object.name) return
    const matches = result.get(object.name) || []
    matches.push(object)
    result.set(object.name, matches)
  })
  return result
}

function findSingleNamedObject(
  names: Map<string, THREE.Object3D[]>,
  name: string,
): THREE.Object3D | null {
  const matches = names.get(name) || []
  return matches.length === 1 ? matches[0] : null
}

function pushDuplicateNameViolations(
  names: Map<string, THREE.Object3D[]>,
  requiredNames: readonly string[],
  violations: ImageToGlbActionReadinessViolation[],
): void {
  for (const name of new Set(requiredNames)) {
    if ((names.get(name) || []).length <= 1) continue
    violations.push({ code: 'duplicate-name', message: `Action node name must resolve exactly once: ${name}` })
  }
}

function readManifest(scene: THREE.Object3D): ImageToGlbActionReadinessManifest | null {
  const value = scene.userData[ACTION_MANIFEST_KEY] as Partial<ImageToGlbActionReadinessManifest> | undefined
  if (
    !value
    || value.schemaVersion !== 'image-to-glb-action-readiness/v1'
    || value.modelRootName !== IMAGE_TO_GLB_MODEL_ROOT_NAME
    || !Array.isArray(value.parts)
    || !value.animation
  ) return null
  return value as ImageToGlbActionReadinessManifest
}

function createInspectionClip(): THREE.AnimationClip {
  const times = [0, 1, 2, 3, IMAGE_TO_GLB_INSPECTION_DURATION_SECONDS]
  const quaternions = [
    new THREE.Quaternion(),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), IMAGE_TO_GLB_INSPECTION_MAXIMUM_YAW_RADIANS),
    new THREE.Quaternion(),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -IMAGE_TO_GLB_INSPECTION_MAXIMUM_YAW_RADIANS),
    new THREE.Quaternion(),
  ]
  const values = quaternions.flatMap(quaternion => quaternion.toArray())
  const track = new THREE.QuaternionKeyframeTrack(`${IMAGE_TO_GLB_MODEL_ROOT_NAME}.quaternion`, times, values)
  return new THREE.AnimationClip(IMAGE_TO_GLB_INSPECTION_CLIP_NAME, IMAGE_TO_GLB_INSPECTION_DURATION_SECONDS, [track])
}

function requireTrustedMeshes(scene: THREE.Object3D): THREE.Mesh[] {
  scene.updateMatrixWorld(true)
  const meshes: THREE.Mesh[] = []
  scene.traverse(object => {
    const mesh = object as THREE.Mesh
    if (mesh.isMesh) meshes.push(mesh)
  })
  if (meshes.length === 0) throw new Error('Action readiness requires at least one trusted mesh.')
  const identities = new Set<string>()
  for (const mesh of meshes) {
    if (!isStableSourceName(mesh.name)) throw new Error(`Action readiness requires a stable mesh name: ${mesh.name || '(empty)'}`)
    const part = expectedPart(mesh.name)
    if (!part || identities.has(part.partId)) throw new Error(`Action readiness found a duplicate stable mesh identity: ${mesh.name}`)
    if (!isFiniteObjectTransform(mesh)) throw new Error(`Action readiness rejected a non-finite mesh transform: ${mesh.name}`)
    if (isDeformableMesh(mesh)) throw new Error(`Action readiness does not claim deformable support: ${mesh.name}`)
    identities.add(part.partId)
  }
  return meshes.sort((first, second) => stableToken(first.name).localeCompare(stableToken(second.name)))
}

export function createImageToGlbActionReadiness(scene: THREE.Object3D): ImageToGlbActionReadinessResult {
  if (readManifest(scene)) throw new Error('Action readiness is already attached to this scene.')
  if (scene.animations.length > 0) throw new Error('Action readiness cannot replace unreviewed scene animations.')
  const meshes = requireTrustedMeshes(scene)
  const existingNames = namedObjects(scene)
  const reservedNames = [IMAGE_TO_GLB_MODEL_ROOT_NAME]
  for (const mesh of meshes) {
    const part = expectedPart(mesh.name) as ImageToGlbActionPart
    reservedNames.push(part.pivotName, part.socketName)
  }
  const collision = reservedNames.find(name => existingNames.has(name))
  if (collision) throw new Error(`Action readiness reserved name is already in use: ${collision}`)

  const originalWorldMatrices = new Map(meshes.map(mesh => [mesh, mesh.matrixWorld.clone()]))
  const originalBounds = new Map(meshes.map(mesh => [mesh, new THREE.Box3().setFromObject(mesh)]))
  const modelRoot = new THREE.Group()
  modelRoot.name = IMAGE_TO_GLB_MODEL_ROOT_NAME
  modelRoot.userData[ACTION_NODE_KEY] = { kind: 'model-root' }
  scene.add(modelRoot)
  scene.updateMatrixWorld(true)

  const parts: ImageToGlbActionPart[] = []
  for (const mesh of meshes) {
    const part = expectedPart(mesh.name) as ImageToGlbActionPart
    const bounds = originalBounds.get(mesh) as THREE.Box3
    if (bounds.isEmpty()) throw new Error(`Action readiness rejected empty mesh bounds: ${mesh.name}`)
    const centerWorld = bounds.getCenter(new THREE.Vector3())
    const pivot = new THREE.Group()
    pivot.name = part.pivotName
    pivot.position.copy(modelRoot.worldToLocal(centerWorld.clone()))
    pivot.userData[ACTION_NODE_KEY] = { kind: 'rigid-pivot', partId: part.partId }
    modelRoot.add(pivot)
    scene.updateMatrixWorld(true)

    const originalWorld = originalWorldMatrices.get(mesh) as THREE.Matrix4
    pivot.add(mesh)
    const localMatrix = new THREE.Matrix4().copy(pivot.matrixWorld).invert().multiply(originalWorld)
    localMatrix.decompose(mesh.position, mesh.quaternion, mesh.scale)
    mesh.matrix.copy(localMatrix)
    if (mesh.matrixAutoUpdate) mesh.updateMatrix()
    mesh.userData[PART_READINESS_KEY] = {
      classification: part.classification,
      partId: part.partId,
      surfaceProvenance: part.surfaceProvenance,
    }

    const socket = new THREE.Object3D()
    socket.name = part.socketName
    const socketWorld = new THREE.Vector3(centerWorld.x, bounds.max.y, centerWorld.z)
    socket.position.copy(pivot.worldToLocal(socketWorld))
    socket.userData[ACTION_NODE_KEY] = { kind: 'attachment-socket', partId: part.partId }
    pivot.add(socket)
    parts.push(part)
  }

  const clip = createInspectionClip()
  scene.animations = [clip]
  const manifest: ImageToGlbActionReadinessManifest = {
    animation: {
      clipName: clip.name,
      durationSeconds: clip.duration,
      loop: 'repeat-continuous',
      maximumYawRadians: IMAGE_TO_GLB_INSPECTION_MAXIMUM_YAW_RADIANS,
      trackName: clip.tracks[0].name,
    },
    modelRootName: modelRoot.name,
    parts,
    schemaVersion: 'image-to-glb-action-readiness/v1',
  }
  scene.userData[ACTION_MANIFEST_KEY] = manifest
  scene.updateMatrixWorld(true)

  for (const mesh of meshes) {
    if (!matricesMatch(mesh.matrixWorld, originalWorldMatrices.get(mesh) as THREE.Matrix4)) {
      throw new Error(`Action readiness could not preserve the world transform for ${mesh.name}.`)
    }
  }
  const validation = validateImageToGlbActionReadiness(scene, manifest)
  if (!validation.valid) throw new Error(validation.violations.map(item => item.message).join(' '))
  return { clip, manifest, modelRoot, scene }
}

function validatePartNodes(
  modelRoot: THREE.Object3D,
  part: ImageToGlbActionPart,
  names: Map<string, THREE.Object3D[]>,
  violations: ImageToGlbActionReadinessViolation[],
): PartNodes | null {
  const expected = expectedPart(part.meshName)
  if (!expected || JSON.stringify(expected) !== JSON.stringify(part)) {
    const code = part.classification === 'deformable' ? 'unsupported-deformable' : 'unstable-name'
    violations.push({ code, message: `Part manifest does not match its stable rigid identity: ${part.meshName}` })
  }
  if (part.classification !== 'rigid') {
    violations.push({ code: 'unsupported-deformable', message: `Deformable readiness is unsupported: ${part.meshName}` })
  }
  if (part.surfaceProvenance.front !== 'observed' || part.surfaceProvenance.hidden !== 'inferred') {
    violations.push({ code: 'invalid-provenance', message: `Part must distinguish observed front and inferred hidden surfaces: ${part.meshName}` })
  }
  const meshObject = findSingleNamedObject(names, part.meshName)
  const pivotObject = findSingleNamedObject(names, part.pivotName)
  const socketObject = findSingleNamedObject(names, part.socketName)
  const mesh = meshObject as THREE.Mesh | null
  const pivot = pivotObject as THREE.Group | null
  const socket = socketObject
  if (!mesh?.isMesh) violations.push({ code: 'missing-mesh', message: `Missing action mesh: ${part.meshName}` })
  if (!pivot) violations.push({ code: 'missing-pivot', message: `Missing action pivot: ${part.pivotName}` })
  if (!socket) violations.push({ code: 'missing-socket', message: `Missing attachment socket: ${part.socketName}` })
  if (!mesh || !pivot || !socket) return null
  if (pivot.parent !== modelRoot || mesh.parent !== pivot || socket.parent !== pivot) {
    violations.push({ code: 'hierarchy-mismatch', message: `Part hierarchy must be model root -> pivot -> mesh/socket: ${part.meshName}` })
  }
  const meshBounds = new THREE.Box3().setFromObject(mesh)
  const expectedPivotWorld = meshBounds.getCenter(new THREE.Vector3())
  const expectedSocketWorld = new THREE.Vector3(expectedPivotWorld.x, meshBounds.max.y, expectedPivotWorld.z)
  const pivotWorld = pivot.getWorldPosition(new THREE.Vector3())
  const socketWorld = socket.getWorldPosition(new THREE.Vector3())
  if (
    pivotWorld.distanceTo(expectedPivotWorld) > VALUE_TOLERANCE
    || socketWorld.distanceTo(expectedSocketWorld) > VALUE_TOLERANCE
  ) {
    violations.push({ code: 'attachment-transform-mismatch', message: `Pivot and socket must remain at the reviewed mesh center and upper attachment point: ${part.meshName}` })
  }
  const pivotMetadata = pivot.userData[ACTION_NODE_KEY] as { kind?: unknown; partId?: unknown } | undefined
  const socketMetadata = socket.userData[ACTION_NODE_KEY] as { kind?: unknown; partId?: unknown } | undefined
  if (pivotMetadata?.kind !== 'rigid-pivot' || pivotMetadata.partId !== part.partId) {
    violations.push({ code: 'invalid-manifest', message: `Pivot export metadata does not match the manifest: ${part.pivotName}` })
  }
  if (socketMetadata?.kind !== 'attachment-socket' || socketMetadata.partId !== part.partId) {
    violations.push({ code: 'invalid-manifest', message: `Socket export metadata does not match the manifest: ${part.socketName}` })
  }
  if (isDeformableMesh(mesh)) {
    violations.push({ code: 'unsupported-deformable', message: `Mesh contains unsupported deformable state: ${part.meshName}` })
  }
  const metadata = mesh.userData[PART_READINESS_KEY] as Partial<ImageToGlbActionPart> | undefined
  if (
    metadata?.classification !== 'rigid'
    || metadata.partId !== part.partId
    || JSON.stringify(metadata.surfaceProvenance) !== JSON.stringify(part.surfaceProvenance)
  ) violations.push({ code: 'invalid-manifest', message: `Mesh readiness metadata does not match the manifest: ${part.meshName}` })
  for (const object of [mesh, pivot, socket]) {
    if (!isFiniteObjectTransform(object)) {
      violations.push({ code: 'non-finite-transform', message: `Action node has a non-finite transform: ${object.name}` })
    }
  }
  return { mesh, part, pivot, socket }
}

function validateInspectionClip(
  scene: THREE.Object3D,
  manifest: ImageToGlbActionReadinessManifest,
  violations: ImageToGlbActionReadinessViolation[],
): void {
  if (scene.animations.length !== 1) {
    violations.push({ code: 'missing-animation', message: 'Scene must export exactly one reviewed inspection clip.' })
    return
  }
  const clip = scene.animations[0]
  const track = clip.tracks[0]
  if (
    clip.name !== IMAGE_TO_GLB_INSPECTION_CLIP_NAME
    || clip.name !== manifest.animation.clipName
    || !Number.isFinite(clip.duration)
    || clip.duration !== IMAGE_TO_GLB_INSPECTION_DURATION_SECONDS
    || clip.duration !== manifest.animation.durationSeconds
    || clip.tracks.length !== 1
    || !(track instanceof THREE.QuaternionKeyframeTrack)
  ) {
    violations.push({ code: 'invalid-animation', message: 'Inspection clip must be the bounded reviewed quaternion clip.' })
    return
  }
  const expectedTrackName = `${IMAGE_TO_GLB_MODEL_ROOT_NAME}.quaternion`
  if (track.name !== expectedTrackName || track.name !== manifest.animation.trackName) {
    violations.push({ code: 'invalid-animation-binding', message: 'Inspection track must bind the stable model root quaternion.' })
  }
  const times = Array.from(track.times)
  const values = Array.from(track.values)
  const expectedTimes = [0, 1, 2, 3, IMAGE_TO_GLB_INSPECTION_DURATION_SECONDS]
  if (
    times.length !== expectedTimes.length
    || values.length !== times.length * 4
    || !times.every(Number.isFinite)
    || !values.every(Number.isFinite)
    || times.some((time, index) => Math.abs(time - expectedTimes[index]) > VALUE_TOLERANCE)
    || track.getInterpolation() !== THREE.InterpolateLinear
  ) {
    violations.push({ code: 'invalid-animation', message: 'Inspection track must use the exact finite, linear, four-second sample schedule.' })
    return
  }
  const start = values.slice(0, 4)
  const end = values.slice(-4)
  if (start.some((value, index) => Math.abs(value - end[index]) > VALUE_TOLERANCE)) {
    violations.push({ code: 'non-loop-continuous-animation', message: 'Inspection animation must end at its exact starting quaternion.' })
  }
  const expectedQuaternions = [
    new THREE.Quaternion(),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), IMAGE_TO_GLB_INSPECTION_MAXIMUM_YAW_RADIANS),
    new THREE.Quaternion(),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -IMAGE_TO_GLB_INSPECTION_MAXIMUM_YAW_RADIANS),
    new THREE.Quaternion(),
  ]
  for (let index = 0; index < values.length; index += 4) {
    const quaternion = new THREE.Quaternion().fromArray(values, index)
    const magnitude = Math.sqrt(quaternion.x ** 2 + quaternion.y ** 2 + quaternion.z ** 2 + quaternion.w ** 2)
    const expected = expectedQuaternions[index / 4]
    const alignment = expected ? Math.abs(quaternion.clone().normalize().dot(expected)) : 0
    if (Math.abs(magnitude - 1) > VALUE_TOLERANCE || 1 - alignment > VALUE_TOLERANCE) {
      violations.push({ code: 'invalid-animation', message: 'Inspection animation must use the reviewed normalized +/-12-degree Y-axis yaw samples.' })
      break
    }
  }
}

export function validateImageToGlbActionReadiness(
  scene: THREE.Object3D,
  suppliedManifest?: ImageToGlbActionReadinessManifest,
): ImageToGlbActionReadinessValidation {
  scene.updateMatrixWorld(true)
  const violations: ImageToGlbActionReadinessViolation[] = []
  const manifest = suppliedManifest || readManifest(scene)
  if (!manifest) return { valid: false, violations: [{ code: 'invalid-manifest', message: 'Missing action-readiness manifest.' }] }
  if (
    manifest.parts.length === 0
    || manifest.animation.loop !== 'repeat-continuous'
    || manifest.animation.maximumYawRadians !== IMAGE_TO_GLB_INSPECTION_MAXIMUM_YAW_RADIANS
  ) violations.push({ code: 'invalid-manifest', message: 'Action manifest must declare parts and the bounded continuous loop policy.' })
  const names = namedObjects(scene)
  const requiredNames = [manifest.modelRootName, ...manifest.parts.flatMap(part => [part.meshName, part.pivotName, part.socketName])]
  pushDuplicateNameViolations(names, requiredNames, violations)
  if (new Set(manifest.parts.map(part => part.partId)).size !== manifest.parts.length) {
    violations.push({ code: 'duplicate-name', message: 'Action manifest part identities must be unique.' })
  }
  const modelRoot = findSingleNamedObject(names, IMAGE_TO_GLB_MODEL_ROOT_NAME)
  if (!modelRoot || manifest.modelRootName !== IMAGE_TO_GLB_MODEL_ROOT_NAME) {
    violations.push({ code: 'missing-model-root', message: 'Scene must contain one stable action model root.' })
  } else {
    if (modelRoot.parent !== scene) violations.push({ code: 'hierarchy-mismatch', message: 'Action model root must be a direct scene child.' })
    const rootMetadata = modelRoot.userData[ACTION_NODE_KEY] as { kind?: unknown } | undefined
    if (rootMetadata?.kind !== 'model-root') violations.push({ code: 'invalid-manifest', message: 'Action model root is missing its export metadata.' })
    if (!isFiniteObjectTransform(modelRoot)) violations.push({ code: 'non-finite-transform', message: 'Action model root has a non-finite transform.' })
    for (const part of manifest.parts) validatePartNodes(modelRoot, part, names, violations)
  }
  validateInspectionClip(scene, manifest, violations)
  return { valid: violations.length === 0, violations }
}
