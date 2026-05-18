import type { GlbAssetDocument } from '@/lib/assets/glbAssetDocument'
import { readPendingGlbAssetPayload } from '@/lib/assets/glbAssetRuntime'

export type ModelAssetRenderPayload = {
  format: GlbAssetDocument['format']
  loaderInput: string | ArrayBuffer
  basePath: string
  byteLength: number
}

function decodeBase64DataUrl(dataUrl: string): Uint8Array | null {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return null
  const encoded = dataUrl.slice(comma + 1)
  if (!encoded) return null
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(out).set(bytes)
  return out
}

export function deriveModelAssetResourceBasePath(sourceUrl: string | undefined): string {
  const raw = String(sourceUrl || '').trim()
  if (!raw) return ''
  try {
    const baseHref =
      typeof window !== 'undefined' && typeof window.location?.href === 'string'
        ? window.location.href
        : 'http://localhost/'
    const u = new URL(raw, baseHref)
    u.hash = ''
    u.search = ''
    const pathname = String(u.pathname || '')
    u.pathname = pathname.includes('/') ? pathname.slice(0, pathname.lastIndexOf('/') + 1) : '/'
    return u.toString()
  } catch {
    const normalized = raw.replace(/\\/g, '/')
    const slash = normalized.lastIndexOf('/')
    return slash >= 0 ? normalized.slice(0, slash + 1) : ''
  }
}

export async function loadModelAssetRenderPayload(asset: GlbAssetDocument): Promise<ModelAssetRenderPayload> {
  if (asset.format === 'glb' && asset.validMagic === false) throw new Error('Invalid GLB magic')
  if (asset.format === 'glb' && asset.validContainer === false) throw new Error('Invalid GLB container')
  if (asset.format === 'gltf' && asset.validJson === false) throw new Error('Invalid GLTF JSON')
  if (asset.validGltfAsset === false) throw new Error('Invalid glTF asset version')

  const resolved = asset.dataUrl
    ? {
        dataUrl: asset.dataUrl,
        validMagic: asset.validMagic,
        validContainer: asset.validContainer,
        validJson: asset.validJson,
        validGltfAsset: asset.validGltfAsset,
        byteLength: asset.byteLength,
      }
    : asset.pendingLocalImportPath
      ? await readPendingGlbAssetPayload(asset.pendingLocalImportPath)
      : null
  if (!resolved) throw new Error('Missing model asset data')
  if (asset.format === 'glb' && resolved.validMagic === false) throw new Error('Invalid GLB magic')
  if (asset.format === 'glb' && resolved.validContainer === false) throw new Error('Invalid GLB container')
  if (asset.format === 'gltf' && resolved.validJson === false) throw new Error('Invalid GLTF JSON')
  if (resolved.validGltfAsset === false) throw new Error('Invalid glTF asset version')

  const bytes = decodeBase64DataUrl(resolved.dataUrl)
  if (!bytes) throw new Error('Invalid model data URL')

  return {
    format: asset.format,
    loaderInput: asset.format === 'gltf'
      ? new TextDecoder().decode(bytes)
      : bytesToArrayBuffer(bytes),
    basePath: asset.format === 'gltf' ? deriveModelAssetResourceBasePath(asset.sourceUrl) : '',
    byteLength: Math.max(0, Number(resolved.byteLength || bytes.byteLength || 0)),
  }
}
