import type { Object3D } from 'three'
import type { GLTFExporterOptions } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { inspectGlbBytes, inspectGltfJson, type GlbContainerInspection, type GltfJsonInspection } from '@/lib/assets/gltfFormat'
import {
  validateImageToGlbProceduralJob,
  type ImageToGlbProceduralJob,
} from './imageToGlbContract'
import { inspectImageToGlbScene } from './imageToGlbSceneEvidence'

export type ImageToGlbExternalBufferArtifact = {
  fileName: string
  mimeType: 'application/octet-stream'
  blob: Blob
  bytes: ArrayBuffer
}

export type ImageToGlbGlbArtifact = {
  fileName: string
  mimeType: 'model/gltf-binary'
  blob: Blob
  bytes: ArrayBuffer
  inspection: GlbContainerInspection
}

export type ImageToGlbEditableGltfArtifact = {
  fileName: string
  mimeType: 'model/gltf+json'
  blob: Blob
  text: string
  inspection: GltfJsonInspection
  externalBuffers: readonly ImageToGlbExternalBufferArtifact[]
}

export type ImageToGlbRuntimeArtifacts = {
  job: ImageToGlbProceduralJob
  glb: ImageToGlbGlbArtifact
  gltf: ImageToGlbEditableGltfArtifact
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function normalizeArtifactStem(value: unknown): string {
  const raw = String(value || '').trim().replace(/\.(?:glb|gltf)$/i, '')
  const cleaned = raw.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned || 'image-to-glb-procedural'
}

function requireBrowserExporterRuntime(): void {
  if (typeof Blob !== 'function' || typeof FileReader !== 'function') {
    throw new Error('Image to GLB export requires the browser Blob and FileReader runtime used by Three.js GLTFExporter.')
  }
}

export function buildImageToGlbExporterOptions(scene: Object3D, binary: boolean): GLTFExporterOptions {
  return {
    animations: Array.isArray(scene.animations) ? scene.animations : [],
    binary,
    includeCustomExtensions: false,
    maxTextureSize: Infinity,
    onlyVisible: true,
    trs: false,
  }
}

async function exportWithGltfExporter(scene: Object3D, binary: boolean): Promise<ArrayBuffer | Record<string, unknown>> {
  requireBrowserExporterRuntime()
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
  const exporter = new GLTFExporter()
  const output = await exporter.parseAsync(scene, buildImageToGlbExporterOptions(scene, binary))
  if (output instanceof ArrayBuffer) return output
  if (asRecord(output)) return output
  throw new Error('Three.js GLTFExporter returned an unsupported artifact.')
}

function bytesFromDataUri(uri: unknown): ArrayBuffer {
  const value = String(uri || '').trim()
  const match = /^data:[^,]*;base64,([\s\S]+)$/i.exec(value)
  if (!match || typeof atob !== 'function') {
    throw new Error('Three.js GLTFExporter did not return an externalizable binary buffer data URI.')
  }
  const binary = atob(match[1])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

function externalizeGltfBuffers(args: {
  exporterResult: Record<string, unknown>
  artifactStem: string
}): { text: string; externalBuffers: ImageToGlbExternalBufferArtifact[] } {
  const document = JSON.parse(JSON.stringify(args.exporterResult)) as Record<string, unknown>
  const buffers = Array.isArray(document.buffers) ? document.buffers : []
  if (buffers.length === 0) throw new Error('Image to GLB requires procedural geometry with an exportable binary buffer.')
  const externalBuffers = buffers.map((value, index) => {
    const buffer = asRecord(value)
    if (!buffer) throw new Error('Three.js GLTFExporter returned an invalid glTF buffer entry.')
    const bytes = bytesFromDataUri(buffer.uri)
    const fileName = `${args.artifactStem}${index === 0 ? '' : `-${index + 1}`}.bin`
    buffer.uri = fileName
    buffer.byteLength = bytes.byteLength
    return {
      fileName,
      mimeType: 'application/octet-stream' as const,
      blob: new Blob([bytes], { type: 'application/octet-stream' }),
      bytes,
    }
  })
  const text = `${JSON.stringify(document, null, 2)}\n`
  const inspection = inspectGltfJson(text)
  if (!inspection.validJson || !inspection.validGltfAsset || inspection.embeddedResourceDataUriCount !== 0) {
    throw new Error('Editable glTF must be valid JSON with external .bin buffers and no embedded data URIs.')
  }
  return { text, externalBuffers }
}

function assertExportableJob(job: ImageToGlbProceduralJob): void {
  const validation = validateImageToGlbProceduralJob(job)
  if (!validation.valid) {
    throw new Error(`Image to GLB procedural contract failed: ${validation.violations.map(item => item.code).join(', ')}`)
  }
}

function assertSceneMatchesReviewedJob(scene: Object3D, job: ImageToGlbProceduralJob): void {
  let provenance: Record<string, unknown> | null = null
  scene.traverse(object => {
    if (provenance) return
    provenance = asRecord(asRecord(object.userData)?.imageToGlb)
  })
  if (
    !provenance
    || provenance.programDigest !== job.programDigest
    || provenance.referenceDigest !== job.referenceDigest
    || JSON.stringify(provenance.partManifest) !== JSON.stringify(job.partManifest)
  ) {
    throw new Error('Image to GLB refused to export a scene that does not match the reviewed program, reference, and named-part manifest.')
  }
  const sceneEvidence = inspectImageToGlbScene(scene)
  const reviewedProjectionDigest = job.visionReviewPasses[job.visionReviewPasses.length - 1]?.evidence.projectionDigest
  const manifestByName = new Map(job.partManifest.map(part => [part.name, part]))
  const scenePartsMatchManifest = sceneEvidence.parts.every(part => manifestByName.get(part.name)?.primitive === part.primitive)
    && sceneEvidence.parts.length === job.partManifest.length
  if (sceneEvidence.projectionDigest !== reviewedProjectionDigest || !scenePartsMatchManifest) {
    throw new Error('Image to GLB refused to export native geometry that drifted from the reviewed projection and part graph.')
  }
}

/**
 * Exports a trusted native Three.js scene. The reviewable program is validated
 * as provenance and is intentionally never evaluated here.
 */
export async function exportImageToGlbRuntimeArtifacts(args: {
  job: ImageToGlbProceduralJob
  scene: Object3D
  artifactStem?: string
}): Promise<ImageToGlbRuntimeArtifacts> {
  assertExportableJob(args.job)
  assertSceneMatchesReviewedJob(args.scene, args.job)
  const artifactStem = normalizeArtifactStem(args.artifactStem)
  const glbResult = await exportWithGltfExporter(args.scene, true)
  if (!(glbResult instanceof ArrayBuffer)) throw new Error('Three.js GLTFExporter did not produce a GLB ArrayBuffer.')
  const glbInspection = inspectGlbBytes(glbResult)
  if (!glbInspection.validContainer || !glbInspection.validGltfAsset || !glbInspection.validBinReference) {
    throw new Error('Three.js GLTFExporter produced an invalid GLB container.')
  }

  const gltfResult = await exportWithGltfExporter(args.scene, false)
  if (gltfResult instanceof ArrayBuffer) throw new Error('Three.js GLTFExporter did not produce editable glTF JSON.')
  const gltf = externalizeGltfBuffers({ exporterResult: gltfResult, artifactStem })
  const gltfInspection = inspectGltfJson(gltf.text)

  return {
    job: args.job,
    glb: {
      fileName: `${artifactStem}.glb`,
      mimeType: 'model/gltf-binary',
      blob: new Blob([glbResult], { type: 'model/gltf-binary' }),
      bytes: glbResult,
      inspection: glbInspection,
    },
    gltf: {
      fileName: `${artifactStem}.gltf`,
      mimeType: 'model/gltf+json',
      blob: new Blob([gltf.text], { type: 'model/gltf+json' }),
      text: gltf.text,
      inspection: gltfInspection,
      externalBuffers: gltf.externalBuffers,
    },
  }
}
