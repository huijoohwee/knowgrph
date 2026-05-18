import { GLB_ASSET_DATA_URL_PREFIX, GLB_ASSET_MIME_TYPE, GLTF_ASSET_DATA_URL_PREFIX, GLTF_ASSET_MIME_TYPE } from '@/lib/assets/glbAssetDocument'

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
  validJson?: boolean
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

function hasGlbMagic(buffer: ArrayBuffer): boolean {
  if (!buffer || buffer.byteLength < 4) return false
  const bytes = new Uint8Array(buffer, 0, 4)
  return bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46
}

function hasValidJson(text: string): boolean {
  try {
    JSON.parse(String(text || ''))
    return true
  } catch {
    return false
  }
}

function inferPendingModelAssetFormat(file: File): PendingModelAssetFormat {
  const lower = String(file?.name || '').trim().toLowerCase()
  const type = String(file?.type || '').trim().toLowerCase()
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
    return {
      dataUrl: `${GLTF_ASSET_DATA_URL_PREFIX}${arrayBufferToBase64(buffer)}`,
      mimeType: GLTF_ASSET_MIME_TYPE,
      byteLength: buffer.byteLength,
      validJson: hasValidJson(text),
      format: 'gltf',
    }
  }
  const buffer = await pending.file.arrayBuffer()
  return {
    dataUrl: `${GLB_ASSET_DATA_URL_PREFIX}${arrayBufferToBase64(buffer)}`,
    mimeType: GLB_ASSET_MIME_TYPE,
    byteLength: buffer.byteLength,
    validMagic: hasGlbMagic(buffer),
    format: 'glb',
  }
}
