import * as THREE from 'three'
import { inspectGlbBytes, inspectGltfJson } from '@/lib/assets/gltfFormat'
import { hashStringToHex } from '@/lib/hash/stringHash'
import {
  IMAGE_TO_GLB_BINDING_TOKEN,
  IMAGE_TO_GLB_COMMAND_TOKEN,
  IMAGE_TO_GLB_SEMANTIC_TOKEN,
  createImageToGlbProceduralJob,
  validateImageToGlbProceduralJob,
  validateImageToGlbProceduralProgram,
  type ImageToGlbProceduralProgram,
  type ImageToGlbVisionReviewPass,
} from '@/features/image-to-glb/imageToGlbContract'
import {
  createReviewedImageToGlbScene,
  type ReviewedImageToGlbScene,
} from '@/features/image-to-glb/imageToGlbSceneFactory'
import type { ImageReferencePixels } from '@/features/image-to-threejs/imageReferencePixels'
import { exportImageToGlbRuntimeArtifacts } from '@/features/image-to-glb/imageToGlbRuntimeExport'
import { withGlbExporterFileReader } from '@/tests/lib/glbExporterFileReaderHarness'

const PROCEDURAL_SOURCE = `
import * as THREE from 'three'

export function buildReferenceObject() {
  const group = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1, 0.45),
    new THREE.MeshStandardMaterial({ color: '#4b8bbe' }),
  )
  const contour = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.8, -0.5, 0.3),
    new THREE.Vector3(0, 0.7, 0.3),
    new THREE.Vector3(0.8, -0.5, 0.3),
  ])
  group.add(body, new THREE.Line(contour, new THREE.LineBasicMaterial()))
  return group
}
`

const PROCEDURAL_PROGRAM: ImageToGlbProceduralProgram = {
  language: 'typescript',
  entrypoint: 'buildReferenceObject',
  source: PROCEDURAL_SOURCE,
}

const PROGRAM_DIGEST = hashStringToHex(PROCEDURAL_PROGRAM.source)
const REFERENCE_DIGEST = 'reference-evidence-digest'
const PART_MANIFEST = [
  { name: 'Body', primitive: 'BoxGeometry', role: 'primary volume' },
  { name: 'Upper contour', primitive: 'BufferGeometry', role: 'upper silhouette' },
  { name: 'Lower contour', primitive: 'BufferGeometry', role: 'lower silhouette' },
] as const

const REVIEW_EVIDENCE = {
  expectedParts: PART_MANIFEST.map(part => part.name),
  foundParts: PART_MANIFEST.map(part => part.name),
  programDigest: PROGRAM_DIGEST,
  projectionDigest: 'projection-evidence-digest',
  referenceDigest: REFERENCE_DIGEST,
  reviewedViews: ['reference-front', 'procedural-front-projection'],
  silhouetteScore: 0.82,
  unresolvedIssues: [] as string[],
}

const VISION_REVIEW_PASSES: readonly ImageToGlbVisionReviewPass[] = [
  {
    iteration: 1,
    stage: 'reference-analysis',
    verdict: 'revise',
    reviewer: { evidenceDigest: REVIEW_EVIDENCE.projectionDigest, kind: 'native-deterministic' },
    observations: ['The first silhouette lacked a distinct upper profile.'],
    evidence: REVIEW_EVIDENCE,
  },
  {
    iteration: 2,
    stage: 'procedural-geometry',
    verdict: 'approved',
    reviewer: { evidenceDigest: 'independent-provider-review-2', kind: 'independent-provider' },
    observations: ['The procedural volume and contour now express the reviewed reference silhouette.'],
    evidence: REVIEW_EVIDENCE,
  },
  {
    iteration: 3,
    stage: 'artifact-review',
    verdict: 'approved',
    reviewer: { evidenceDigest: 'independent-provider-review-3', kind: 'independent-provider' },
    observations: ['The scene remains editable as native Three.js meshes and lines.'],
    evidence: REVIEW_EVIDENCE,
  },
]

function buildValidJob() {
  return createImageToGlbProceduralJob({
    sourceUrl: 'workspace:/media/reference-object.jpg',
    partManifest: PART_MANIFEST,
    program: PROCEDURAL_PROGRAM,
    programDigest: PROGRAM_DIGEST,
    referenceDigest: REFERENCE_DIGEST,
    visionReviewPasses: VISION_REVIEW_PASSES,
  })
}

function createTransparentPixels(width = 72, height = 72): ImageReferencePixels {
  return { data: new Uint8ClampedArray(width * height * 4), height, sourceHeight: height, sourceWidth: width, width }
}

function paintRect(pixels: ImageReferencePixels, left: number, top: number, right: number, bottom: number, color = { r: 198, g: 166, b: 124 }) {
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const index = (y * pixels.width + x) * 4
      pixels.data[index] = color.r
      pixels.data[index + 1] = color.g
      pixels.data[index + 2] = color.b
      pixels.data[index + 3] = 255
    }
  }
}

function buildStructuredReference(): ImageReferencePixels {
  const pixels = createTransparentPixels()
  paintRect(pixels, 7, 8, 64, 17)
  paintRect(pixels, 9, 18, 22, 22)
  paintRect(pixels, 49, 18, 62, 22)
  paintRect(pixels, 15, 20, 23, 52)
  paintRect(pixels, 48, 20, 56, 52)
  paintRect(pixels, 21, 47, 50, 59, { r: 180, g: 146, b: 106 })
  return pixels
}

function buildAsymmetricReference(): ImageReferencePixels {
  const pixels = createTransparentPixels()
  paintRect(pixels, 8, 10, 28, 60, { r: 72, g: 132, b: 184 })
  paintRect(pixels, 29, 42, 62, 60, { r: 44, g: 92, b: 142 })
  return pixels
}

function buildSingleVolumeReference(): ImageReferencePixels {
  const pixels = createTransparentPixels()
  paintRect(pixels, 12, 9, 59, 62, { r: 96, g: 148, b: 208 })
  return pixels
}

export function testImageToGlbProceduralContractSharesInvocationTokensAndImageInputResolver() {
  if (
    IMAGE_TO_GLB_COMMAND_TOKEN !== '/image.to-glb'
    || IMAGE_TO_GLB_BINDING_TOKEN !== '@image-to-glb'
    || IMAGE_TO_GLB_SEMANTIC_TOKEN !== '#image-to-glb'
  ) {
    throw new Error('expected canonical /, @, and # image-to-glb invocation tokens')
  }
  const job = buildValidJob()
  if (job.source.kind !== 'raster') throw new Error(`expected shared image-to-threejs source detection, got ${job.source.kind}`)
  const validation = validateImageToGlbProceduralJob(job)
  if (!validation.valid) throw new Error(`expected valid reviewed procedural job, got ${JSON.stringify(validation.violations)}`)
}

export function testImageToGlbProceduralContractRejectsSerializedAndBakedGeometry() {
  const serialized = validateImageToGlbProceduralProgram({
    language: 'javascript',
    entrypoint: 'buildObject',
    source: 'const geometry = JSON.parse(serialized); return new THREE.Mesh(geometry, material)',
  })
  if (serialized.valid || !serialized.violations.some(item => item.code === 'serialized-or-baked-geometry')) {
    throw new Error(`expected serialized geometry to be rejected, got ${JSON.stringify(serialized)}`)
  }

  const baked = validateImageToGlbProceduralProgram({
    language: 'javascript',
    entrypoint: 'buildObject',
    source: 'const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3)); return new THREE.Mesh(geometry, material)',
  })
  if (baked.valid || !baked.violations.some(item => item.code === 'serialized-or-baked-geometry')) {
    throw new Error(`expected baked typed-array geometry to be rejected, got ${JSON.stringify(baked)}`)
  }

  const remote = validateImageToGlbProceduralProgram({
    language: 'typescript',
    entrypoint: 'buildObject',
    source: 'import CSG from "arbitrary-csg"; const geometry = new THREE.BoxGeometry(1, 1, 1); return new THREE.Mesh(geometry, material)',
  })
  if (remote.valid || !remote.violations.some(item => item.code === 'external-runtime-dependency')) {
    throw new Error(`expected extra procedural runtime dependency to be rejected, got ${JSON.stringify(remote)}`)
  }

  const invalidLanguage = validateImageToGlbProceduralProgram({
    ...PROCEDURAL_PROGRAM,
    language: 'python' as never,
  })
  if (invalidLanguage.valid || !invalidLanguage.violations.some(item => item.code === 'invalid-program-language')) {
    throw new Error(`expected non-JS/TS program language to be rejected, got ${JSON.stringify(invalidLanguage)}`)
  }
}

export function testImageToGlbReviewRejectsMissingReferenceProjectionEvidence() {
  const job = buildValidJob()
  const unapproved = validateImageToGlbProceduralJob({
    ...job,
    visionReviewPasses: [{
      iteration: 1,
      stage: 'reference-analysis',
      verdict: 'revise',
      reviewer: { evidenceDigest: REVIEW_EVIDENCE.projectionDigest, kind: 'native-deterministic' },
      observations: ['A final approval is still required.'],
      evidence: REVIEW_EVIDENCE,
    }],
  })
  if (unapproved.valid || !unapproved.violations.some(item => item.code === 'unapproved-vision-review')) {
    throw new Error(`expected an incomplete review ledger to block export, got ${JSON.stringify(unapproved)}`)
  }
  const missingEvidence = validateImageToGlbProceduralJob({
    ...job,
    visionReviewPasses: job.visionReviewPasses.map((pass, index) => index === job.visionReviewPasses.length - 1
      ? { ...pass, evidence: { ...pass.evidence, projectionDigest: '', reviewedViews: [] } }
      : pass),
  })
  if (missingEvidence.valid || !missingEvidence.violations.some(item => item.code === 'invalid-vision-review-evidence')) {
    throw new Error(`expected unevidenced approval to be rejected, got ${JSON.stringify(missingEvidence)}`)
  }
  const dishonestApproval = validateImageToGlbProceduralJob({
    ...job,
    visionReviewPasses: job.visionReviewPasses.map((pass, index) => index === job.visionReviewPasses.length - 1
      ? { ...pass, reviewer: { evidenceDigest: pass.evidence.projectionDigest, kind: 'native-deterministic' as const } }
      : pass),
  })
  if (dishonestApproval.valid || !dishonestApproval.violations.some(item => item.code === 'invalid-vision-review-evidence')) {
    throw new Error(`expected native evidence to be unable to self-approve, got ${JSON.stringify(dishonestApproval)}`)
  }
}

export function testImageToGlbReferenceBuildsReviewedNamedPartGraph() {
  const result = createReviewedImageToGlbScene({
    pixels: buildStructuredReference(),
    sourceUrl: 'workspace:/media/reference-object.png',
  })
  if (result.analysis.profile !== 'contour-volume') throw new Error(`expected general contour-volume profile, got ${result.analysis.profile}`)
  const meshes: THREE.Mesh[] = []
  result.scene.traverse(object => {
    const mesh = object as THREE.Mesh
    if (mesh.isMesh) meshes.push(mesh)
  })
  const names = meshes.map(mesh => mesh.name).sort()
  const manifestNames = result.job.partManifest.map(part => part.name).sort()
  if (JSON.stringify(names) !== JSON.stringify(manifestNames) || meshes.some(mesh => mesh.geometry.type !== 'ExtrudeGeometry')) {
    throw new Error(`expected the measured manifest to map one-to-one to native contour volumes, got ${JSON.stringify(names)}`)
  }
  if (
    !result.job.program.source.includes('new THREE.ExtrudeGeometry')
    || !result.job.program.source.includes('new THREE.QuaternionKeyframeTrack')
    || result.job.program.source.includes('new THREE.BoxGeometry')
  ) {
    throw new Error('expected reviewable source to reproduce connected contours and its action clip without stale box-band templates')
  }
  if (result.job.programDigest !== result.scene.userData.imageToGlb?.programDigest) {
    throw new Error('expected reviewable program and exported runtime scene to share one digest owner')
  }
  const validation = validateImageToGlbProceduralJob(result.job)
  if (!validation.valid) throw new Error(`expected measured procedural job to validate, got ${JSON.stringify(validation.violations)}`)

  const singleVolume = createReviewedImageToGlbScene({
    pixels: buildSingleVolumeReference(),
    sourceUrl: 'workspace:/media/single-volume.png',
  })
  const singleValidation = validateImageToGlbProceduralJob(singleVolume.job)
  if (singleVolume.job.partManifest.length !== 1 || !singleValidation.valid) {
    throw new Error(`expected a common one-piece silhouette to remain exportable, got ${JSON.stringify({ parts: singleVolume.job.partManifest.length, violations: singleValidation.violations })}`)
  }
}

export function testImageToGlbContourVolumePreservesMeasuredConstructionFidelity() {
  const result = createReviewedImageToGlbScene({
    pixels: buildStructuredReference(),
    sourceUrl: 'workspace:/media/reference-object.png',
  })
  const sceneBox = new THREE.Box3().setFromObject(result.scene)
  const sceneSize = sceneBox.getSize(new THREE.Vector3())
  const widthHeightRatio = sceneSize.x / sceneSize.y
  if (Math.abs(widthHeightRatio - result.analysis.aspectRatio) > 0.08 || sceneSize.z <= 0.1) {
    throw new Error(`expected front aspect and non-flat inferred depth, got ${JSON.stringify(sceneSize.toArray())}`)
  }
  const meshes: THREE.Mesh[] = []
  result.scene.traverse(object => {
    const mesh = object as THREE.Mesh
    if (mesh.isMesh) meshes.push(mesh)
  })
  const meshNames = meshes.map(mesh => mesh.name).sort()
  const manifestNames = result.job.partManifest.map(part => part.name).sort()
  if (JSON.stringify(meshNames) !== JSON.stringify(manifestNames)) {
    throw new Error('expected the reviewed manifest to map one-to-one to actual native meshes')
  }
  const plan = result.scene.userData.contourRebuildPlan as {
    components: readonly { depth: number; inferredSurfaceConfidence: number; outline: readonly [number, number][] }[]
    quality: { acceptedSpanCount: number; componentCount: number; rawSpanCount: number; withinBudgets: boolean }
  } | undefined
  if (!plan?.quality.withinBudgets || plan.quality.componentCount !== meshes.length || plan.quality.acceptedSpanCount > plan.quality.rawSpanCount) {
    throw new Error(`expected compact bounded contour evidence, got ${JSON.stringify(plan?.quality)}`)
  }
  if (plan.components.some(component => component.depth <= 0 || component.inferredSurfaceConfidence <= 0 || component.inferredSurfaceConfidence >= 1)) {
    throw new Error('expected every hidden surface to have bounded inferred depth and confidence')
  }
  const actionManifest = result.scene.userData.imageToGlbActionReadiness as { parts?: unknown[] } | undefined
  if (actionManifest?.parts?.length !== meshes.length || result.scene.animations.length !== 1) {
    throw new Error('expected one stable rigid pivot/socket identity per mesh and one reviewed inspection loop')
  }
  const quality = result.scene.userData.imageToGlb?.qualityReport as { passed?: boolean; metrics?: { geometry?: { triangleCount?: number } } } | undefined
  if (!quality?.passed || !quality.metrics?.geometry?.triangleCount) {
    throw new Error(`expected attached passing geometry/material/action quality evidence, got ${JSON.stringify(quality)}`)
  }
}

export function testImageToGlbReviewedSceneIsFilenameInvariant() {
  const pixels = buildStructuredReference()
  const first = createReviewedImageToGlbScene({ pixels, sourceUrl: 'workspace:/media/first-name.png' })
  const second = createReviewedImageToGlbScene({ pixels, sourceUrl: 'workspace:/media/unrelated-name.jpg' })
  if (
    first.job.referenceDigest !== second.job.referenceDigest
    || first.job.programDigest !== second.job.programDigest
    || first.job.program.source !== second.job.program.source
    || first.scene.userData.imageToGlb?.projectionDigest !== second.scene.userData.imageToGlb?.projectionDigest
  ) {
    throw new Error('expected identical pixels to produce identical procedural structure regardless of filename')
  }
}

export function testImageToGlbSceneDependsOnReferencePixelsNotSourceUrlHash() {
  const sourceUrl = 'workspace:/media/same-reference-url.png'
  const structured = createReviewedImageToGlbScene({ pixels: buildStructuredReference(), sourceUrl })
  const asymmetric = createReviewedImageToGlbScene({ pixels: buildAsymmetricReference(), sourceUrl })
  if (structured.job.referenceDigest === asymmetric.job.referenceDigest || structured.job.programDigest === asymmetric.job.programDigest) {
    throw new Error('expected the reconstruction to change with reference pixels even when the source URL is identical')
  }
  const firstPlan = structured.scene.userData.contourRebuildPlan
  const secondPlan = asymmetric.scene.userData.contourRebuildPlan
  if (JSON.stringify(firstPlan) === JSON.stringify(secondPlan) || structured.scene.userData.imageToGlb?.projectionDigest === asymmetric.scene.userData.imageToGlb?.projectionDigest) {
    throw new Error('expected distinct pixel evidence to produce distinct compact plans and native geometry')
  }
}

export async function testImageToGlbRuntimeExportProducesGlbAndExternalBufferGltf() {
  await withGlbExporterFileReader(async () => {
    const reconstruction = createReviewedImageToGlbScene({
      pixels: buildStructuredReference(),
      sourceUrl: 'workspace:/media/reference-object.png',
    })
    const exportPromise = exportImageToGlbRuntimeArtifacts({
      job: reconstruction.job,
      scene: reconstruction.scene,
      artifactStem: 'reference-object',
    })
    const racingMesh = reconstruction.scene.getObjectByName(reconstruction.job.partManifest[0]?.name || '') as THREE.Mesh
    racingMesh.visible = false
    const artifacts = await exportPromise
    const glbInspection = inspectGlbBytes(artifacts.glb.bytes)
    if (!glbInspection.validContainer || !glbInspection.validGltfAsset) {
      throw new Error(`expected native GLTFExporter GLB, got ${JSON.stringify(glbInspection)}`)
    }
    if (artifacts.gltf.externalBuffers.length !== 1 || artifacts.gltf.externalBuffers[0]?.fileName !== 'reference-object.bin') {
      throw new Error(`expected one editable external .bin buffer, got ${JSON.stringify(artifacts.gltf.externalBuffers.map(item => item.fileName))}`)
    }
    const gltfInspection = inspectGltfJson(artifacts.gltf.text)
    if (!gltfInspection.validGltfAsset || gltfInspection.embeddedResourceDataUriCount !== 0) {
      throw new Error(`expected editable glTF without embedded data URIs, got ${JSON.stringify(gltfInspection)}`)
    }
    if (!artifacts.gltf.text.includes('"reference-object.bin"')) {
      throw new Error('expected editable glTF to reference its external binary buffer')
    }
    if (gltfInspection.firstBufferByteLength !== artifacts.gltf.externalBuffers[0]?.bytes.byteLength) {
      throw new Error('expected editable glTF buffer metadata to match the emitted external .bin bytes')
    }
    const gltfDocument = JSON.parse(artifacts.gltf.text) as { animations?: Array<{ channels?: unknown[] }>; materials?: unknown[]; meshes?: unknown[]; nodes?: unknown[] }
    if (
      gltfDocument.meshes?.length !== reconstruction.job.partManifest.length
      || (gltfDocument.materials?.length || 0) < 1
      || (gltfDocument.nodes?.length || 0) < reconstruction.job.partManifest.length * 3
      || gltfDocument.animations?.length !== 1
      || gltfDocument.animations[0]?.channels?.length !== 1
    ) {
      throw new Error(`expected glTF to preserve exact meshes, pivot/socket nodes, PBR materials, and the inspection clip, got ${JSON.stringify({ animations: gltfDocument.animations?.length, meshes: gltfDocument.meshes?.length, materials: gltfDocument.materials?.length, nodes: gltfDocument.nodes?.length })}`)
    }
    for (const part of reconstruction.job.partManifest) {
      if (!artifacts.gltf.text.includes(JSON.stringify(part.name))) throw new Error(`expected editable glTF to preserve named part ${part.name}`)
    }

    const dataSource = `data:image/png;base64,${'A'.repeat(100_000)}`
    const dataReconstruction = createReviewedImageToGlbScene({ pixels: buildStructuredReference(), sourceUrl: dataSource })
    const dataArtifacts = await exportImageToGlbRuntimeArtifacts({ job: dataReconstruction.job, scene: dataReconstruction.scene })
    if (dataArtifacts.gltf.text.includes('data:image') || dataArtifacts.gltf.text.length > 80_000) {
      throw new Error(`expected bounded digest-only source provenance in model extras, got ${dataArtifacts.gltf.text.length} characters`)
    }
  })
}

export async function testImageToGlbRuntimeExportRejectsSceneProgramDrift() {
  await withGlbExporterFileReader(async () => {
    const reconstruction = createReviewedImageToGlbScene({
      pixels: buildStructuredReference(),
      sourceUrl: 'workspace:/media/reference-object.png',
    })
    reconstruction.scene.userData.imageToGlb.programDigest = 'stale-program-digest'
    let message = ''
    try {
      await exportImageToGlbRuntimeArtifacts({ job: reconstruction.job, scene: reconstruction.scene })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    if (!message.includes('does not match the reviewed program')) {
      throw new Error(`expected scene/program drift to block export, got ${message || 'no error'}`)
    }
  })
}

export async function testImageToGlbRuntimeExportRejectsReviewedGeometryTampering() {
  await withGlbExporterFileReader(async () => {
    const reconstruction = createReviewedImageToGlbScene({
      pixels: buildStructuredReference(),
      sourceUrl: 'workspace:/media/reference-object.png',
    })
    const part = reconstruction.scene.getObjectByName(reconstruction.job.partManifest[0]?.name || '')
    if (!part) throw new Error('expected reviewed contour geometry')
    part.position.x += 0.2
    let message = ''
    try {
      await exportImageToGlbRuntimeArtifacts({ job: reconstruction.job, scene: reconstruction.scene })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    if (!message.includes('drifted from the reviewed projection') && !message.includes('invalid action hierarchy')) {
      throw new Error(`expected geometry tampering to block GLB/glTF export, got ${message || 'no error'}`)
    }

    for (const mutate of [
      (candidate: ReviewedImageToGlbScene) => {
        const mesh = candidate.scene.getObjectByName(candidate.job.partManifest[0]?.name || '') as THREE.Mesh
        mesh.visible = false
      },
      (candidate: ReviewedImageToGlbScene) => {
        const mesh = candidate.scene.getObjectByName(candidate.job.partManifest[0]?.name || '') as THREE.Mesh
        const material = mesh.material as THREE.MeshStandardMaterial
        material.emissive.set(0xff0000)
        material.opacity = 0.2
        material.transparent = true
      },
      (candidate: ReviewedImageToGlbScene) => {
        const action = candidate.scene.userData.imageToGlbActionReadiness as { parts: Array<{ socketName: string }> }
        candidate.scene.getObjectByName(action.parts[0]?.socketName || '')?.position.set(99, 99, 99)
      },
    ]) {
      const candidate = createReviewedImageToGlbScene({
        pixels: buildStructuredReference(),
        sourceUrl: 'workspace:/media/reference-object.png',
      })
      mutate(candidate)
      let tamperMessage = ''
      try {
        await exportImageToGlbRuntimeArtifacts({ job: candidate.job, scene: candidate.scene })
      } catch (error) {
        tamperMessage = error instanceof Error ? error.message : String(error)
      }
      if (!tamperMessage) throw new Error('expected visibility, material, and attachment-node tampering to fail export')
    }
  })
}
