import { GLB_ASSET_MIME_TYPE, GLTF_ASSET_MIME_TYPE, parseGlbAssetDocument } from '@/lib/assets/glbAssetDocument'
import type { GlbAssetDocument } from '@/lib/assets/glbAssetDocument'
import { inspectGlbBytes, inspectGltfJson } from '@/lib/assets/gltfFormat'
import { loadModelAssetRenderPayload } from '@/lib/assets/modelAssetPayload'

export type ModelAssetExportFormat = GlbAssetDocument['format']

export type ModelAssetExportBlob = {
  blob: Blob
  extension: ModelAssetExportFormat
  name: string
}

function basenameWithoutModelExt(value: unknown, fallback: string): string {
  const raw = String(value || '').trim() || fallback
  const leaf = raw.split(/[\\/]/).filter(Boolean).pop() || raw
  return leaf.replace(/\.(gltf|glb)$/i, '').replace(/\.[a-z0-9]+$/i, '') || fallback
}

export async function resolveModelAssetExportBlob(args: {
  text: unknown
  requestedFormat: ModelAssetExportFormat
  fallbackBaseName: string
}): Promise<ModelAssetExportBlob | null> {
  const asset = parseGlbAssetDocument(args.text)
  if (!asset || asset.format !== args.requestedFormat) return null
  const payload = await loadModelAssetRenderPayload(asset)
  const baseName = basenameWithoutModelExt(asset.name, basenameWithoutModelExt(args.fallbackBaseName, 'model'))
  if (args.requestedFormat === 'gltf') {
    if (typeof payload.loaderInput !== 'string') return null
    const inspection = inspectGltfJson(payload.loaderInput)
    if (!inspection.validJson || !inspection.validGltfAsset) return null
    return {
      extension: 'gltf',
      name: `${baseName}.gltf`,
      blob: new Blob([payload.loaderInput], { type: GLTF_ASSET_MIME_TYPE }),
    }
  }
  if (typeof payload.loaderInput === 'string') return null
  const inspection = inspectGlbBytes(payload.loaderInput)
  if (!inspection.validMagic || !inspection.validContainer) return null
  return {
    extension: 'glb',
    name: `${baseName}.glb`,
    blob: new Blob([payload.loaderInput], { type: GLB_ASSET_MIME_TYPE }),
  }
}

export async function normalizeCapturedModelAssetBlob(args: {
  blob: Blob
  format: ModelAssetExportFormat
}): Promise<Blob | null> {
  if (args.format === 'gltf') {
    const text = await args.blob.text()
    const inspection = inspectGltfJson(text)
    if (!inspection.validJson || !inspection.validGltfAsset) return null
    return String(args.blob.type || '').trim() === GLTF_ASSET_MIME_TYPE
      ? args.blob
      : new Blob([text], { type: GLTF_ASSET_MIME_TYPE })
  }
  const buffer = await args.blob.arrayBuffer()
  const inspection = inspectGlbBytes(buffer)
  if (!inspection.validMagic || !inspection.validContainer) return null
  return String(args.blob.type || '').trim() === GLB_ASSET_MIME_TYPE
    ? args.blob
    : new Blob([buffer], { type: GLB_ASSET_MIME_TYPE })
}
