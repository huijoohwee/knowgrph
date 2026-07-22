import * as THREE from 'three'
import {
  createImageToGlbActionReadiness,
  IMAGE_TO_GLB_INSPECTION_CLIP_NAME,
  IMAGE_TO_GLB_MODEL_ROOT_NAME,
  type ImageToGlbActionReadinessManifest,
  validateImageToGlbActionReadiness,
} from '@/features/image-to-glb/imageToGlbActionReadiness'
import { inspectImageToGlbScene } from '@/features/image-to-glb/imageToGlbSceneEvidence'

function createTrustedScene(): THREE.Group {
  const scene = new THREE.Group()
  scene.name = 'Trusted image model'
  scene.position.set(2.5, -1.25, 4)
  scene.rotation.set(0.08, -0.15, 0.04)

  const bodyParent = new THREE.Group()
  bodyParent.position.set(-0.4, 0.8, 0.2)
  bodyParent.rotation.z = 0.12
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 3.2, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x4d78aa }),
  )
  body.name = 'Reference body'
  body.position.set(0.2, 0.4, -0.3)
  bodyParent.add(body)

  const accent = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xe2a04a }),
  )
  accent.name = 'Front accent'
  accent.position.set(0.45, 1.1, 0.75)
  scene.add(bodyParent, accent)
  scene.updateMatrixWorld(true)
  return scene
}

function requireValid(scene: THREE.Object3D, manifest?: ImageToGlbActionReadinessManifest): void {
  const validation = validateImageToGlbActionReadiness(scene, manifest)
  if (!validation.valid) throw new Error(`expected valid action readiness: ${JSON.stringify(validation.violations)}`)
}

function requireViolation(scene: THREE.Object3D, code: string, manifest?: ImageToGlbActionReadinessManifest): void {
  const validation = validateImageToGlbActionReadiness(scene, manifest)
  if (validation.valid || !validation.violations.some(violation => violation.code === code)) {
    throw new Error(`expected ${code} violation, got ${JSON.stringify(validation.violations)}`)
  }
}

function clonedManifest(manifest: ImageToGlbActionReadinessManifest): ImageToGlbActionReadinessManifest {
  return JSON.parse(JSON.stringify(manifest)) as ImageToGlbActionReadinessManifest
}

export function testImageToGlbActionReadinessPreservesEvidenceAndBuildsExportHierarchy() {
  const scene = createTrustedScene()
  const before = inspectImageToGlbScene(scene)
  const worldMatrices = new Map<string, number[]>()
  scene.traverse(object => {
    const mesh = object as THREE.Mesh
    if (mesh.isMesh) worldMatrices.set(mesh.name, [...mesh.matrixWorld.elements])
  })

  const result = createImageToGlbActionReadiness(scene)
  const after = inspectImageToGlbScene(scene)
  const spatialEvidence = (evidence: typeof before) => evidence.parts.map(part => ({
    bounds: part.bounds,
    matrix: part.matrix,
    name: part.name,
  }))
  if (
    JSON.stringify(spatialEvidence(after)) !== JSON.stringify(spatialEvidence(before))
    || Math.abs(after.aspectRatio - before.aspectRatio) > 1e-12
  ) {
    throw new Error('expected action hierarchy to preserve mesh bounds and world matrices')
  }
  if (result.modelRoot.name !== IMAGE_TO_GLB_MODEL_ROOT_NAME || result.modelRoot.parent !== scene) {
    throw new Error('expected one stable model root beneath the export scene')
  }
  if (scene.getObjectsByProperty('name', IMAGE_TO_GLB_MODEL_ROOT_NAME).length !== 1) {
    throw new Error('expected the stable model root name to resolve exactly once')
  }
  for (const part of result.manifest.parts) {
    const mesh = scene.getObjectByName(part.meshName) as THREE.Mesh | undefined
    const pivot = scene.getObjectByName(part.pivotName)
    const socket = scene.getObjectByName(part.socketName)
    if (!mesh?.isMesh || !pivot || !socket || pivot.parent !== result.modelRoot || mesh.parent !== pivot || socket.parent !== pivot) {
      throw new Error(`expected exportable pivot and attachment socket hierarchy for ${part.partId}`)
    }
    if (part.classification !== 'rigid' || part.surfaceProvenance.front !== 'observed' || part.surfaceProvenance.hidden !== 'inferred') {
      throw new Error(`expected explicit rigid classification and surface provenance for ${part.partId}`)
    }
    const beforeMatrix = worldMatrices.get(part.meshName) || []
    if (mesh.matrixWorld.elements.some((value, index) => Math.abs(value - beforeMatrix[index]) > 1e-6)) {
      throw new Error(`expected unchanged world matrix for ${part.meshName}`)
    }
  }
  requireValid(scene, result.manifest)
}

export function testImageToGlbActionReadinessNamesAndInspectionLoopAreStableAndBounded() {
  const first = createImageToGlbActionReadiness(createTrustedScene())
  const second = createImageToGlbActionReadiness(createTrustedScene())
  if (JSON.stringify(first.manifest) !== JSON.stringify(second.manifest)) {
    throw new Error('expected equivalent trusted scenes to produce stable action identities')
  }
  const clip = first.clip
  const track = clip.tracks[0]
  if (
    clip.name !== IMAGE_TO_GLB_INSPECTION_CLIP_NAME
    || first.scene.animations[0] !== clip
    || track.name !== `${IMAGE_TO_GLB_MODEL_ROOT_NAME}.quaternion`
    || track.times[0] !== 0
    || track.times[track.times.length - 1] !== clip.duration
  ) throw new Error('expected the inspection loop to bind the stable model root over its full duration')
  const start = Array.from(track.values.slice(0, 4))
  const end = Array.from(track.values.slice(-4))
  if (start.some((value, index) => Math.abs(value - end[index]) > 1e-6)) {
    throw new Error('expected the inspection clip to be exactly loop-continuous')
  }

  const root = first.modelRoot
  const mixer = new THREE.AnimationMixer(first.scene)
  const action = mixer.clipAction(clip)
  action.setLoop(THREE.LoopRepeat, Infinity).play()
  mixer.setTime(1)
  if (root.quaternion.angleTo(new THREE.Quaternion()) <= 0.05 || root.quaternion.angleTo(new THREE.Quaternion()) > THREE.MathUtils.degToRad(12.01)) {
    throw new Error('expected the inspection binding to animate only within its bounded yaw')
  }
  mixer.setTime(clip.duration)
  if (root.quaternion.angleTo(new THREE.Quaternion()) > 1e-6) {
    throw new Error('expected the repeating inspection action to return to its loop origin')
  }
  mixer.uncacheRoot(first.scene)
  requireValid(first.scene, first.manifest)
}

export function testImageToGlbActionReadinessRejectsHierarchyAndMotionTampering() {
  {
    const result = createImageToGlbActionReadiness(createTrustedScene())
    const duplicate = new THREE.Group()
    duplicate.name = result.manifest.parts[0].pivotName
    result.modelRoot.add(duplicate)
    requireViolation(result.scene, 'duplicate-name', result.manifest)
  }
  {
    const result = createImageToGlbActionReadiness(createTrustedScene())
    result.scene.getObjectByName(result.manifest.parts[0].socketName)?.removeFromParent()
    requireViolation(result.scene, 'missing-socket', result.manifest)
  }
  {
    const result = createImageToGlbActionReadiness(createTrustedScene())
    const socket = result.scene.getObjectByName(result.manifest.parts[0].socketName) as THREE.Object3D
    socket.position.set(99, 99, 99)
    requireViolation(result.scene, 'attachment-transform-mismatch', result.manifest)
  }
  {
    const result = createImageToGlbActionReadiness(createTrustedScene())
    const pivot = result.scene.getObjectByName(result.manifest.parts[0].pivotName) as THREE.Object3D
    pivot.position.x = Number.NaN
    requireViolation(result.scene, 'non-finite-transform', result.manifest)
  }
  {
    const result = createImageToGlbActionReadiness(createTrustedScene())
    const manifest = clonedManifest(result.manifest)
    manifest.parts[0].classification = 'deformable'
    requireViolation(result.scene, 'unsupported-deformable', manifest)
  }
  {
    const result = createImageToGlbActionReadiness(createTrustedScene())
    result.clip.tracks[0].name = 'MissingModelRoot.quaternion'
    requireViolation(result.scene, 'invalid-animation-binding', result.manifest)
  }
  {
    const result = createImageToGlbActionReadiness(createTrustedScene())
    const values = result.clip.tracks[0].values
    values[values.length - 2] = 0.2
    requireViolation(result.scene, 'non-loop-continuous-animation', result.manifest)
  }
  {
    const result = createImageToGlbActionReadiness(createTrustedScene())
    const values = result.clip.tracks[0].values
    for (let index = 0; index < values.length; index += 4) values.set([0, 0, 0, 1], index)
    requireViolation(result.scene, 'invalid-animation', result.manifest)
  }
  {
    const result = createImageToGlbActionReadiness(createTrustedScene())
    const track = result.clip.tracks[0]
    const positivePitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(12))
    const negativePitch = positivePitch.clone().invert()
    track.values.set(positivePitch.toArray(), 4)
    track.values.set(negativePitch.toArray(), 12)
    requireViolation(result.scene, 'invalid-animation', result.manifest)
  }
  {
    const result = createImageToGlbActionReadiness(createTrustedScene())
    result.clip.tracks[0].setInterpolation(THREE.InterpolateDiscrete)
    requireViolation(result.scene, 'invalid-animation', result.manifest)
  }
}

export function testImageToGlbActionReadinessRejectsDeformableMeshesAndExistingAnimations() {
  const deformable = new THREE.Group()
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial(),
  )
  mesh.name = 'Unsupported soft body'
  mesh.geometry.morphAttributes.position = [mesh.geometry.attributes.position.clone()]
  deformable.add(mesh)
  let deformableRejected = false
  try {
    createImageToGlbActionReadiness(deformable)
  } catch (error) {
    deformableRejected = String(error).includes('deformable')
  }
  if (!deformableRejected) throw new Error('expected unsupported deformable geometry to fail closed')

  const animated = createTrustedScene()
  animated.animations = [new THREE.AnimationClip('unreviewed', 1, [])]
  let animationRejected = false
  try {
    createImageToGlbActionReadiness(animated)
  } catch (error) {
    animationRejected = String(error).includes('unreviewed')
  }
  if (!animationRejected) throw new Error('expected unreviewed existing animations to fail closed')
}
