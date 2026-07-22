import { createContext, Script } from 'node:vm'
import * as THREE from 'three'
import * as ts from 'typescript'
import {
  buildContourRebuildScene,
  createContourRebuildProgram,
  deriveContourRebuildPlan,
} from '@/features/image-to-glb/imageToGlbContourRebuild'
import { validateImageToGlbProceduralProgram } from '@/features/image-to-glb/imageToGlbContract'
import {
  createImageToGlbActionReadiness,
  validateImageToGlbActionReadiness,
} from '@/features/image-to-glb/imageToGlbActionReadiness'
import { inspectImageToGlbScene } from '@/features/image-to-glb/imageToGlbSceneEvidence'
import type {
  ImageToGlbReferenceAnalysis,
  ImageToGlbSilhouetteSpan,
} from '@/features/image-to-glb/imageToGlbSceneFactory'

const LEFT_COLOR = { b: 176, g: 120, r: 64 }
const RIGHT_COLOR = { b: 72, g: 152, r: 208 }

function createSeparatedSilhouette(): ImageToGlbReferenceAnalysis {
  const spans: ImageToGlbSilhouetteSpan[] = []
  for (let row = 0; row < 7; row += 1) {
    const y = -0.42 + row * 0.14
    const width = 0.18 + row * 0.006
    spans.push({ color: LEFT_COLOR, height: 0.12, width, x: -0.27 + row * 0.003, y })
    spans.push({ color: RIGHT_COLOR, height: 0.12, width, x: 0.27 - row * 0.003, y })
  }
  return {
    analysisConfidence: 0.87,
    aspectRatio: 1.2,
    backgroundMethod: 'alpha',
    bottomWidthRatio: 0.38,
    foregroundCoverage: 0.46,
    height: 96,
    palette: [LEFT_COLOR, RIGHT_COLOR],
    profile: 'contour-volume',
    referenceDigest: 'separated-silhouette-reference',
    spans,
    symmetryScore: 0.91,
    topWidthRatio: 0.4,
    width: 112,
  }
}

function meshTriangles(mesh: THREE.Mesh): number {
  const geometry = mesh.geometry
  return (geometry.getIndex()?.count || geometry.getAttribute('position').count) / 3
}

function executeTrustedGeneratedProgram(source: string): THREE.Group {
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  })
  const errors = (transpiled.diagnostics || []).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)
  if (errors.length > 0) throw new Error(`generated TypeScript did not transpile: ${errors.map(error => error.messageText).join('; ')}`)
  const module = { exports: {} as Record<string, unknown> }
  const context = createContext({
    exports: module.exports,
    module,
    require: (specifier: string) => {
      if (specifier !== 'three') throw new Error(`unexpected generated-program import: ${specifier}`)
      return THREE
    },
  })
  new Script(transpiled.outputText, { filename: 'image-to-glb.generated.cjs' }).runInContext(context, { timeout: 2_000 })
  const build = module.exports.buildImageToGlbReviewedScene
  if (typeof build !== 'function') throw new Error('generated TypeScript did not export its declared scene builder')
  const scene = build() as unknown
  if (!(scene instanceof THREE.Group)) throw new Error('generated TypeScript did not return a native Three.js group')
  return scene
}

export function testImageToGlbContourRebuildPreservesSeparatedRunsAsVolumes() {
  const analysis = createSeparatedSilhouette()
  const plan = deriveContourRebuildPlan(analysis)
  if (plan.components.length !== 2) {
    throw new Error(`expected two disconnected run tracks, got ${plan.components.length}`)
  }
  if (plan.quality.preservedRunTrackCount !== 2 || plan.quality.componentCount > analysis.spans.length) {
    throw new Error(`expected semantic components to compact raw spans, got ${JSON.stringify(plan.quality)}`)
  }
  const horizontalRanges = plan.components.map(component => ({
    maximum: Math.max(...component.outline.map(point => point[0])),
    minimum: Math.min(...component.outline.map(point => point[0])),
  }))
  if (!horizontalRanges.some(range => range.maximum < 0) || !horizontalRanges.some(range => range.minimum > 0)) {
    throw new Error(`expected the central negative space to remain open, got ${JSON.stringify(horizontalRanges)}`)
  }
  if (
    plan.depthEvidence.method !== 'front-silhouette-symmetry-inference'
    || plan.depthEvidence.inferredSurfaceConfidence >= 1
    || plan.depthEvidence.inferredSurfaceConfidence <= 0
  ) {
    throw new Error(`expected explicit bounded inferred-surface confidence, got ${JSON.stringify(plan.depthEvidence)}`)
  }

  const partManifest: Array<{ name: string; primitive: string; role: string }> = []
  const scene = buildContourRebuildScene({ partManifest, plan })
  const meshes = scene.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh)
  if (meshes.length !== plan.components.length || partManifest.length !== meshes.length) {
    throw new Error('expected one manifest entry and one native mesh for each semantic contour component')
  }
  const manifestNames = partManifest.map(part => part.name)
  const meshNames = meshes.map(mesh => mesh.name)
  if (JSON.stringify(manifestNames) !== JSON.stringify(meshNames)) {
    throw new Error(`expected manifest names to match the built scene, got ${JSON.stringify({ manifestNames, meshNames })}`)
  }
  for (const mesh of meshes) {
    if (mesh.geometry.type !== 'ExtrudeGeometry') throw new Error(`expected beveled native extrusion, got ${mesh.geometry.type}`)
    const position = mesh.geometry.getAttribute('position')
    const normal = mesh.geometry.getAttribute('normal')
    if (!position || !normal || position.count !== normal.count) throw new Error(`expected complete position/normal attributes for ${mesh.name}`)
    for (let index = 0; index < position.count; index += 1) {
      for (const value of [position.getX(index), position.getY(index), position.getZ(index), normal.getX(index), normal.getY(index), normal.getZ(index)]) {
        if (!Number.isFinite(value)) throw new Error(`expected finite geometry for ${mesh.name}`)
      }
    }
    const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3())
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) throw new Error(`expected nondegenerate volume for ${mesh.name}: ${size.toArray()}`)
  }
  const triangleCount = meshes.reduce((sum, mesh) => sum + meshTriangles(mesh), 0)
  if (triangleCount > plan.budgets.maxTriangles || triangleCount !== plan.quality.estimatedTriangleCount) {
    throw new Error(`expected exact bounded triangle evidence, got ${triangleCount}/${plan.quality.estimatedTriangleCount}`)
  }
}

export function testImageToGlbContourRebuildPlanAndSourceAreDeterministicAndCompact() {
  const analysis = createSeparatedSilhouette()
  const first = deriveContourRebuildPlan(analysis)
  const second = deriveContourRebuildPlan({ ...analysis, spans: [...analysis.spans] })
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('expected a deterministic quantized contour plan')
  const firstSource = createContourRebuildProgram(first)
  const secondSource = createContourRebuildProgram(second)
  if (firstSource !== secondSource) throw new Error('expected a deterministic procedural source program')
  const sourceBytes = new TextEncoder().encode(firstSource).byteLength
  if (sourceBytes !== first.quality.proceduralSourceBytes || sourceBytes > first.budgets.maxSourceBytes || sourceBytes > 8_000) {
    throw new Error(`expected compact procedural source, got ${sourceBytes} bytes`)
  }
  const imports = [...firstSource.matchAll(/import\s+[^'\"]+['\"]([^'\"]+)['\"]/g)].map(match => match[1])
  if (JSON.stringify(imports) !== JSON.stringify(['three'])) {
    throw new Error(`expected Three.js as the only source import, got ${JSON.stringify(imports)}`)
  }
  if (/Float(?:32|64)Array|Uint(?:8|16|32)Array|fetch\s*\(|XMLHttpRequest|TextureLoader|GLTFLoader|https?:|data:/.test(firstSource)) {
    throw new Error('expected code-only procedural source without baked buffers, loaders, network, or embedded assets')
  }
  if (!firstSource.includes('new THREE.ExtrudeGeometry') || !firstSource.includes('bevelEnabled: true')) {
    throw new Error('expected the reviewable source to reproduce its beveled contour volumes')
  }
  const admission = validateImageToGlbProceduralProgram({
    entrypoint: 'buildImageToGlbReviewedScene',
    language: 'typescript',
    source: firstSource,
  })
  if (!admission.valid) throw new Error(`expected generated source to pass procedural admission, got ${JSON.stringify(admission.violations)}`)
  if (!first.quality.withinBudgets || first.quality.acceptedSpanCount !== analysis.spans.length) {
    throw new Error(`expected all spans to fit deterministic geometry/material budgets, got ${JSON.stringify(first.quality)}`)
  }
  if (first.materials.length > first.budgets.maxMaterials || first.components.some(component => component.outline.length > first.budgets.maxOutlinePointsPerComponent)) {
    throw new Error('expected bounded material and outline plans')
  }
  for (const component of first.components) {
    if (!firstSource.includes(JSON.stringify(component.name))) throw new Error(`expected source/manifest identity for ${component.name}`)
  }

  const generatedScene = executeTrustedGeneratedProgram(firstSource)
  const generatedAction = validateImageToGlbActionReadiness(generatedScene)
  if (!generatedAction.valid) {
    throw new Error(`expected generated code to build its complete action-ready hierarchy, got ${JSON.stringify(generatedAction.violations)}`)
  }
  const trustedManifest: Array<{ name: string; primitive: string; role: string }> = []
  const trustedScene = buildContourRebuildScene({ partManifest: trustedManifest, plan: first })
  trustedScene.name = 'Image to GLB reviewed procedural scene'
  createImageToGlbActionReadiness(trustedScene)
  const generatedEvidence = inspectImageToGlbScene(generatedScene)
  const trustedEvidence = inspectImageToGlbScene(trustedScene)
  if (generatedEvidence.projectionDigest !== trustedEvidence.projectionDigest) {
    throw new Error(`generated code drifted from the trusted scene builder: ${JSON.stringify({ generated: generatedEvidence, trusted: trustedEvidence })}`)
  }
}
