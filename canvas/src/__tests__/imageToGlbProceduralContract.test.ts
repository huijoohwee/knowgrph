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
    observations: ['The first silhouette lacked a distinct upper profile.'],
    evidence: REVIEW_EVIDENCE,
  },
  {
    iteration: 2,
    stage: 'procedural-geometry',
    verdict: 'approved',
    observations: ['The procedural volume and contour now express the reviewed reference silhouette.'],
    evidence: REVIEW_EVIDENCE,
  },
  {
    iteration: 3,
    stage: 'artifact-review',
    verdict: 'approved',
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

function buildRingFrameReference(): ImageReferencePixels {
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
}

export function testImageToGlbReferenceBuildsReviewedNamedPartGraph() {
  const result = createReviewedImageToGlbScene({
    pixels: buildRingFrameReference(),
    sourceUrl: 'workspace:/media/reference-object.png',
  })
  if (result.analysis.profile !== 'ring-frame') throw new Error(`expected measured ring-frame profile, got ${result.analysis.profile}`)
  const names = new Set(result.scene.children.map(child => child.name))
  for (const name of ['Upper annular shell', 'Central recessed rim', 'Curved support 1', 'Curved support 4', 'Lower tray', 'Lower tray rim']) {
    if (!names.has(name)) throw new Error(`expected reference-derived named part ${name}, got ${JSON.stringify([...names])}`)
  }
  if (!result.job.program.source.includes('new THREE.TorusGeometry') || !result.job.program.source.includes('new THREE.TubeGeometry')) {
    throw new Error('expected the reviewable program to reproduce the ring, supports, and lower tray with procedural constructors')
  }
  if (result.job.programDigest !== result.scene.userData.imageToGlb?.programDigest) {
    throw new Error('expected reviewable program and exported runtime scene to share one digest owner')
  }
  const validation = validateImageToGlbProceduralJob(result.job)
  if (!validation.valid) throw new Error(`expected measured procedural job to validate, got ${JSON.stringify(validation.violations)}`)
}

export function testImageToGlbRingFramePreservesMeasuredConstructionFidelity() {
  const result = createReviewedImageToGlbScene({
    pixels: buildRingFrameReference(),
    sourceUrl: 'workspace:/media/reference-object.png',
  })
  const sceneBox = new THREE.Box3().setFromObject(result.scene)
  const sceneSize = sceneBox.getSize(new THREE.Vector3())
  const widthHeightRatio = sceneSize.x / sceneSize.y
  if (widthHeightRatio < 1.35 || widthHeightRatio > 1.75) {
    throw new Error(`expected a wide, low ring-frame silhouette, got width/height ${widthHeightRatio.toFixed(3)}`)
  }
  const meshes = result.scene.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh)
  const meshNames = meshes.map(mesh => mesh.name).sort()
  const manifestNames = result.job.partManifest.map(part => part.name).sort()
  if (JSON.stringify(meshNames) !== JSON.stringify(manifestNames)) {
    throw new Error('expected the reviewed manifest to map one-to-one to actual native meshes')
  }
  const shell = result.scene.getObjectByName('Upper annular shell') as THREE.Mesh | null
  const tray = result.scene.getObjectByName('Lower tray') as THREE.Mesh | null
  const lowerRim = result.scene.getObjectByName('Lower tray rim') as THREE.Mesh | null
  if (shell?.geometry.type !== 'LatheGeometry' || tray?.geometry.type !== 'LatheGeometry') {
    throw new Error('expected flattened shell and rounded tray profiles instead of generic torus/cylinder volumes')
  }
  const ribs = meshes.filter(mesh => mesh.name.startsWith('Radial upper rib '))
  const supports = meshes.filter(mesh => mesh.name.startsWith('Curved support '))
  if (ribs.length !== 8 || supports.length !== 4 || ribs.some(mesh => mesh.geometry.type !== 'TubeGeometry')) {
    throw new Error(`expected eight rounded ribs and four curved supports, got ${ribs.length}/${supports.length}`)
  }
  const plan = result.scene.userData.ringFrameConstructionPlan as {
    apertureRadius: number
    outerDiameter: number
  } | undefined
  if (!plan) throw new Error('expected the scene to retain its measured scalar construction plan')
  const minimumRibRadius = Math.min(...ribs.flatMap(rib => {
    const positions = rib.geometry.getAttribute('position')
    const radii: number[] = []
    for (let index = 0; index < positions.count; index += 1) {
      radii.push(Math.hypot(positions.getX(index), positions.getZ(index)))
    }
    return radii
  }))
  if (minimumRibRadius < plan.apertureRadius + plan.outerDiameter * 0.007) {
    throw new Error(`expected ribs to preserve the central aperture, got minimum radius ${minimumRibRadius.toFixed(3)}`)
  }
  if (!tray || !lowerRim) throw new Error('expected lower tray and rim')
  const traySize = new THREE.Box3().setFromObject(tray).getSize(new THREE.Vector3())
  const rimSize = new THREE.Box3().setFromObject(lowerRim).getSize(new THREE.Vector3())
  if (Math.abs(traySize.x - rimSize.x) / traySize.x > 0.05 || Math.abs(traySize.z - rimSize.z) / traySize.z > 0.05) {
    throw new Error(`expected tray/rim footprints to agree within 5%, got ${JSON.stringify({ tray: traySize.toArray(), rim: rimSize.toArray() })}`)
  }
  const primaryMaterial = shell.material as THREE.MeshPhysicalMaterial
  const expectedReferenceColor = new THREE.Color(0xc6a67c)
  const maximumColorChannelDifference = Math.max(
    Math.abs(primaryMaterial.color.r - expectedReferenceColor.r),
    Math.abs(primaryMaterial.color.g - expectedReferenceColor.g),
    Math.abs(primaryMaterial.color.b - expectedReferenceColor.b),
  )
  if (maximumColorChannelDifference > 0.00001) {
    throw new Error('expected sampled sRGB reference color to be converted by the installed Three.js color policy')
  }
}

export function testImageToGlbReviewedSceneIsFilenameInvariant() {
  const pixels = buildRingFrameReference()
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
  const ring = createReviewedImageToGlbScene({ pixels: buildRingFrameReference(), sourceUrl })
  const asymmetric = createReviewedImageToGlbScene({ pixels: buildAsymmetricReference(), sourceUrl })
  if (ring.job.referenceDigest === asymmetric.job.referenceDigest || ring.job.programDigest === asymmetric.job.programDigest) {
    throw new Error('expected the reconstruction to change with reference pixels even when the source URL is identical')
  }
  if (ring.analysis.profile === asymmetric.analysis.profile) {
    throw new Error(`expected distinct measured part plans, got ${ring.analysis.profile}`)
  }
}

export async function testImageToGlbRuntimeExportProducesGlbAndExternalBufferGltf() {
  await withGlbExporterFileReader(async () => {
    const reconstruction = createReviewedImageToGlbScene({
      pixels: buildRingFrameReference(),
      sourceUrl: 'workspace:/media/reference-object.png',
    })
    const artifacts = await exportImageToGlbRuntimeArtifacts({
      job: reconstruction.job,
      scene: reconstruction.scene,
      artifactStem: 'reference-object',
    })
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
    const gltfDocument = JSON.parse(artifacts.gltf.text) as { materials?: unknown[]; meshes?: unknown[]; nodes?: unknown[] }
    if ((gltfDocument.meshes?.length || 0) < 8 || (gltfDocument.materials?.length || 0) < 2 || (gltfDocument.nodes?.length || 0) < 8) {
      throw new Error(`expected the exported glTF to preserve the reviewed named-part graph, got ${JSON.stringify({ meshes: gltfDocument.meshes?.length, materials: gltfDocument.materials?.length, nodes: gltfDocument.nodes?.length })}`)
    }
    for (const part of reconstruction.job.partManifest) {
      if (!artifacts.gltf.text.includes(JSON.stringify(part.name))) throw new Error(`expected editable glTF to preserve named part ${part.name}`)
    }
  })
}

export async function testImageToGlbRuntimeExportRejectsSceneProgramDrift() {
  await withGlbExporterFileReader(async () => {
    const reconstruction = createReviewedImageToGlbScene({
      pixels: buildRingFrameReference(),
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
      pixels: buildRingFrameReference(),
      sourceUrl: 'workspace:/media/reference-object.png',
    })
    const support = reconstruction.scene.getObjectByName('Curved support 1')
    if (!support) throw new Error('expected reviewed support geometry')
    support.position.x += 0.2
    let message = ''
    try {
      await exportImageToGlbRuntimeArtifacts({ job: reconstruction.job, scene: reconstruction.scene })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    if (!message.includes('drifted from the reviewed projection')) {
      throw new Error(`expected geometry tampering to block GLB/glTF export, got ${message || 'no error'}`)
    }
  })
}
