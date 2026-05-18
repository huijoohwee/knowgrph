import { GLB_ASSET_DATA_URL_PREFIX, GLB_ASSET_MIME_TYPE, GLTF_ASSET_DATA_URL_PREFIX, GLTF_ASSET_MIME_TYPE } from '@/lib/assets/glbAssetDocument'
import { inspectGlbBytes, inspectGltfJson } from '@/lib/assets/gltfFormat'

type PendingModelAssetFormat = 'glb' | 'gltf'

type PendingGlbAsset = {
  file: File
  originalName?: string
  format: PendingModelAssetFormat
}

type PendingGlbAssetPayload = {
  dataUrl: string
  mimeType: string
  byteLength: number
  validMagic?: boolean
  validContainer?: boolean
  validJson?: boolean
  validGltfAsset?: boolean
  format: PendingModelAssetFormat
}

const pendingGlbAssetsByPath = new Map<string, PendingGlbAsset>()

function normalizePendingPath(path: unknown): string {
  const raw = String(path || '').trim().replace(/\\/g, '/')
  if (!raw) return ''
  return raw.startsWith('/') ? raw : `/${raw}`
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize)
    binary += String.fromCharCode(...Array.from(chunk))
  }
  return btoa(binary)
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(out).set(bytes)
  return out
}

function inferPendingModelAssetFormat(file: File): PendingModelAssetFormat {
  const lower = String(file?.name || '').trim().toLowerCase()
  const type = String(file?.type || '').trim().toLowerCase().split(';')[0]
  if (lower.endsWith('.gltf') || type === GLTF_ASSET_MIME_TYPE || type === 'application/json') return 'gltf'
  return 'glb'
}

export function setPendingGlbAsset(path: unknown, file: File, originalName?: string, format?: PendingModelAssetFormat): void {
  const key = normalizePendingPath(path)
  if (!key) return
  pendingGlbAssetsByPath.set(key, { file, originalName, format: format || inferPendingModelAssetFormat(file) })
}

export function clearPendingGlbAsset(path: unknown): void {
  const key = normalizePendingPath(path)
  if (!key) return
  pendingGlbAssetsByPath.delete(key)
}

export function hasPendingGlbAsset(path: unknown): boolean {
  const key = normalizePendingPath(path)
  return !!key && pendingGlbAssetsByPath.has(key)
}

export async function readPendingGlbAssetPayload(path: unknown): Promise<PendingGlbAssetPayload | null> {
  const key = normalizePendingPath(path)
  if (!key) return null
  const pending = pendingGlbAssetsByPath.get(key)
  if (!pending) return null
  if (pending.format === 'gltf') {
    const text = await pending.file.text()
    const bytes = new TextEncoder().encode(text)
    const buffer = bytesToArrayBuffer(bytes)
    const inspection = inspectGltfJson(text)
    return {
      dataUrl: `${GLTF_ASSET_DATA_URL_PREFIX}${arrayBufferToBase64(buffer)}`,
      mimeType: GLTF_ASSET_MIME_TYPE,
      byteLength: buffer.byteLength,
      validJson: inspection.validJson,
      validGltfAsset: inspection.validGltfAsset,
      format: 'gltf',
    }
  }
  const buffer = await pending.file.arrayBuffer()
  const inspection = inspectGlbBytes(buffer)
  return {
    dataUrl: `${GLB_ASSET_DATA_URL_PREFIX}${arrayBufferToBase64(buffer)}`,
    mimeType: GLB_ASSET_MIME_TYPE,
    byteLength: buffer.byteLength,
    validMagic: inspection.validMagic,
    validContainer: inspection.validContainer,
    validJson: inspection.validJson,
    validGltfAsset: inspection.validGltfAsset,
    format: 'glb',
  }
}
