import * as THREE from 'three'
import {
  IMAGE_TO_GLB_SCHEMA,
  type ImageToGlbProceduralJob,
} from '@/features/image-to-glb/imageToGlbContract'
import type { ImageToGlbReferenceAnalysis } from '@/features/image-to-glb/imageToGlbSceneFactory'
import {
  assertImageToGlbQualityForExport,
  attachImageToGlbQualityReport,
  evaluateImageToGlbQuality,
  type ImageToGlbActionGateEvidence,
  type ImageToGlbReconstructionGateEvidence,
} from '@/features/image-to-glb/imageToGlbQualityGate'

const PROGRAM_SOURCE = `import * as THREE from 'three'
export function buildQualityFixture() {
  const group = new THREE.Group()
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.4), new THREE.MeshStandardMaterial()))
  return group
}`

const MANIFEST = [
  { name: 'Quality part 1', primitive: 'BoxGeometry', role: 'primary volume' },
  { name: 'Quality part 2', primitive: 'BoxGeometry', role: 'secondary volume' },
  { name: 'Quality part 3', primitive: 'BoxGeometry', role: 'identity detail' },
] as const

const JOB: ImageToGlbProceduralJob = {
  schema: IMAGE_TO_GLB_SCHEMA,
  source: { kind: 'raster', url: 'workspace:/media/quality-reference.png' },
  partManifest: MANIFEST,
  program: { entrypoint: 'buildQualityFixture', language: 'typescript', source: PROGRAM_SOURCE },
  programDigest: 'program-quality-fixture',
  referenceDigest: 'reference-quality-fixture',
  visionReviewPasses: [],
}

const ANALYSIS: ImageToGlbReferenceAnalysis = {
  analysisConfidence: 0.9,
  aspectRatio: 3.275,
  backgroundMethod: 'alpha',
  bottomWidthRatio: 0.7,
  foregroundCoverage: 0.8,
  height: 64,
  palette: [{ r: 128, g: 144, b: 176 }],
  profile: 'contour-volume',
  referenceDigest: JOB.referenceDigest,
  spans: [
    { x: -0.366412, width: 0.267176, height: 1 },
    { x: 0.015267, width: 0.236641, height: 0.9 },
    { x: 0.396947, width: 0.206107, height: 0.8 },
  ].map(span => ({
    color: { r: 128, g: 144, b: 176 },
    ...span,
    y: 0,
  })),
  symmetryScore: 0.8,
  topWidthRatio: 0.6,
  width: 64,
}

const ACTION: ImageToGlbActionGateEvidence = {
  clipCount: 1,
  fingerprint: 'action-quality-fixture',
  pivotCount: MANIFEST.length,
  socketCount: MANIFEST.length,
  valid: true,
  violations: [],
}

function createScene(): THREE.Group {
  const scene = new THREE.Group()
  MANIFEST.forEach((part, index) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7 - index * 0.08, 0.8 - index * 0.08, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x8090b0, metalness: 0.1, roughness: 0.55 }),
    )
    mesh.name = part.name
    mesh.position.x = index - 1
    scene.add(mesh)
  })
  return scene
}

const RECONSTRUCTION: ImageToGlbReconstructionGateEvidence = {
  acceptedSpanCount: MANIFEST.length,
  inferredSurfaceConfidence: 0.7,
  rawSpanCount: MANIFEST.length,
  retainedAreaRatio: 0.96,
  withinBudgets: true,
}

function evaluate(scene: THREE.Object3D, action = ACTION, reconstruction = RECONSTRUCTION) {
  return evaluateImageToGlbQuality({
    action,
    analysis: ANALYSIS,
    componentCount: MANIFEST.length,
    job: JOB,
    programSource: PROGRAM_SOURCE,
    reconstruction,
    scene,
  })
}

export function testImageToGlbQualityGateAdmitsBoundedProceduralActionScene() {
  const scene = createScene()
  const report = evaluate(scene)
  if (!report.passed || report.violations.length > 0) {
    throw new Error(`expected bounded procedural scene to pass, got ${JSON.stringify(report.violations)}`)
  }
  if (
    report.metrics.geometry.meshCount !== MANIFEST.length
    || report.metrics.geometry.triangleCount <= 0
    || report.metrics.geometry.depthRatio <= 0
    || report.metrics.compactness.referenceSamples !== MANIFEST.length
    || report.metrics.reference.frontProjectionScore < 0.9
    || report.metrics.material.referenceColorScore < 0.99
    || report.metrics.reference.hiddenSurfaceEvidence !== 'procedurally-inferred'
  ) {
    throw new Error(`expected complete separated quality metrics, got ${JSON.stringify(report.metrics)}`)
  }
  attachImageToGlbQualityReport(scene, report)
  assertImageToGlbQualityForExport(scene, JOB)
}

export function testImageToGlbQualityGateRejectsStaleGeometryEvidence() {
  const scene = createScene()
  attachImageToGlbQualityReport(scene, evaluate(scene))
  const position = (scene.getObjectByName(MANIFEST[0].name) as THREE.Mesh).geometry.getAttribute('position')
  position.setX(0, position.getX(0) + 0.01)
  position.needsUpdate = true
  let message = ''
  try {
    assertImageToGlbQualityForExport(scene, JOB)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (!message.includes('quality-gate evidence')) {
    throw new Error(`expected full geometry-buffer drift to invalidate quality evidence, got ${message || 'no error'}`)
  }

  for (const mutate of [
    (candidate: THREE.Group) => { (candidate.getObjectByName(MANIFEST[0].name) as THREE.Mesh).visible = false },
    (candidate: THREE.Group) => {
      const material = (candidate.getObjectByName(MANIFEST[0].name) as THREE.Mesh).material as THREE.MeshStandardMaterial
      material.emissive.set(0xff0000)
      material.emissiveIntensity = 2
      material.opacity = 0.25
      material.transparent = true
    },
  ]) {
    const candidate = createScene()
    attachImageToGlbQualityReport(candidate, evaluate(candidate))
    mutate(candidate)
    let driftMessage = ''
    try {
      assertImageToGlbQualityForExport(candidate, JOB)
    } catch (error) {
      driftMessage = error instanceof Error ? error.message : String(error)
    }
    if (!driftMessage.includes('quality-gate evidence')) {
      throw new Error(`expected visibility/material export drift to invalidate quality evidence, got ${driftMessage || 'no error'}`)
    }
  }
}

export function testImageToGlbQualityGateRejectsFlatInvalidOrUnactionableScenes() {
  const incompleteAction = evaluate(createScene(), { ...ACTION, socketCount: 1 })
  if (!incompleteAction.violations.some(violation => violation.code === 'animation-readiness')) {
    throw new Error(`expected one socket per mesh, got ${JSON.stringify(incompleteAction.violations)}`)
  }

  const wrongShape = createScene()
  wrongShape.children.forEach((child, index) => {
    child.scale.y = 0.12
    child.position.y = (index - 1) * 0.35
  })
  const wrongShapeReport = evaluate(wrongShape)
  if (!wrongShapeReport.violations.some(violation => violation.code === 'reference-fidelity')) {
    throw new Error(`expected same-bounds wrong geometry to fail front-projection IoU, got ${JSON.stringify(wrongShapeReport.metrics.reference)}`)
  }

  const wrongColor = createScene()
  wrongColor.traverse(object => {
    const mesh = object as THREE.Mesh
    if (mesh.isMesh) (mesh.material as THREE.MeshStandardMaterial).color.set(0xff0000)
  })
  const wrongColorReport = evaluate(wrongColor)
  if (!wrongColorReport.violations.some(violation => violation.code === 'material-reference-mismatch')) {
    throw new Error(`expected incorrect PBR colors to fail reference matching, got ${JSON.stringify(wrongColorReport.metrics.material)}`)
  }

  const scene = createScene()
  const first = scene.getObjectByName(MANIFEST[0].name) as THREE.Mesh
  first.geometry.dispose()
  first.geometry = new THREE.PlaneGeometry(1, 1)
  first.material = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const report = evaluate(
    scene,
    { ...ACTION, clipCount: 0, valid: false, violations: ['missing loop'] },
    { ...RECONSTRUCTION, acceptedSpanCount: 1, retainedAreaRatio: 0.4, withinBudgets: false },
  )
  for (const code of ['animation-readiness', 'invalid-geometry', 'invalid-pbr-material', 'reference-fidelity'] as const) {
    if (!report.violations.some(violation => violation.code === code)) {
      throw new Error(`expected quality gate violation ${code}, got ${JSON.stringify(report.violations)}`)
    }
  }
}
