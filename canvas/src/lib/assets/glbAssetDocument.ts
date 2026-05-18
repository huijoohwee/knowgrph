import { extractYamlFrontmatterBlock, readYamlFrontmatterValue } from '@/lib/markdown/frontmatter'

export const GLB_ASSET_MIME_TYPE = 'model/gltf-binary'
export const GLTF_ASSET_MIME_TYPE = 'model/gltf+json'
export const GLB_ASSET_DATA_URL_PREFIX = `data:${GLB_ASSET_MIME_TYPE};base64,`
export const GLTF_ASSET_DATA_URL_PREFIX = `data:${GLTF_ASSET_MIME_TYPE};base64,`
export const GLB_ASSET_BASE64_FENCE = 'kg-glb-base64'
export const GLTF_ASSET_BASE64_FENCE = 'kg-gltf-base64'
export const GLTF_ASSET_JSON_FENCE = 'kg-gltf-json'

export type GlbAssetDocument = {
  name: string
  format: 'glb' | 'gltf'
  dataUrl?: string
  mimeType: string
  byteLength?: number
  validMagic?: boolean
  validContainer?: boolean
  validChunkOrder?: boolean
  validChunkAlignment?: boolean
  validGlbJsonPadding?: boolean
  validGlbBinPadding?: boolean
  validGlbBinReference?: boolean
  validJson?: boolean
  validGltfAsset?: boolean
  gltfVersion?: string
  externalResourceCount?: number
  embeddedResourceCount?: number
  glbJsonChunkLength?: number
  glbBinChunkLength?: number
  glbUnknownChunkCount?: number
  pendingLocalImport?: boolean
  pendingLocalImportPath?: string
  sourceUrl?: string
}

function normalizeToken(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function readBooleanValue(value: unknown): boolean | undefined {
  const raw = normalizeToken(value)
  if (!raw) return undefined
  if (raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on') return true
  if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') return false
  return undefined
}

function readNumberValue(value: unknown): number | undefined {
  const n = Number(value)
  if (!Number.isFinite(n)) return undefined
  return Math.max(0, Math.floor(n))
}

function encodeUtf8Base64(value: string): string {
  const bytes = new TextEncoder().encode(String(value || ''))
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize)
    binary += String.fromCharCode(...Array.from(chunk))
  }
  return btoa(binary)
}

function inferMimeTypeFromDataUrl(dataUrl: string): string {
  const match = /^data:([^;,]+);base64,/i.exec(dataUrl)
  return match?.[1]?.trim() || GLB_ASSET_MIME_TYPE
}

function isModelDataUrl(dataUrl: string): boolean {
  return /^data:(model\/gltf-binary|model\/gltf\+json|application\/json|application\/octet-stream)?;base64,/i.test(dataUrl)
}

function readFencedPayload(bodyText: string, fenceName: string): string {
  const body = String(bodyText || '')
  const fence = new RegExp(`(^|\\n)\`\`\`${fenceName}\\s*\\n([\\s\\S]*?)\\n\`\`\``, 'i')
  const match = fence.exec(body)
  return match ? String(match[2] || '') : ''
}

function readGlbBase64Fence(bodyText: string): string {
  return readFencedPayload(bodyText, GLB_ASSET_BASE64_FENCE).replace(/\s+/g, '')
}

function readGltfJsonFence(bodyText: string): string {
  return readFencedPayload(bodyText, GLTF_ASSET_JSON_FENCE).trim()
}

function readGltfBase64Fence(bodyText: string): string {
  return readFencedPayload(bodyText, GLTF_ASSET_BASE64_FENCE).replace(/\s+/g, '')
}

export function parseGlbAssetDocument(rawText: unknown): GlbAssetDocument | null {
  const block = extractYamlFrontmatterBlock(String(rawText || ''))
  if (!block) return null

  const rawFormat = normalizeToken(readYamlFrontmatterValue(block.rawBlock, 'kgAssetFormat'))
  const type = normalizeToken(readYamlFrontmatterValue(block.rawBlock, 'kgAssetType'))
  const format = rawFormat === 'glb' || rawFormat === 'gltfbinary'
    ? 'glb'
    : rawFormat === 'gltf' || rawFormat === 'gltfjson'
      ? 'gltf'
      : ''
  if (type !== 'model' || !format) return null

  const name = readYamlFrontmatterValue(block.rawBlock, 'kgAssetName').trim() || (format === 'gltf' ? 'model.gltf' : 'model.glb')
  const pendingLocalImport = readBooleanValue(readYamlFrontmatterValue(block.rawBlock, 'kgAssetPendingLocalImport')) === true
  const pendingLocalImportPath = readYamlFrontmatterValue(block.rawBlock, 'kgAssetPendingLocalPath').trim()
  const sourceUrl = readYamlFrontmatterValue(block.rawBlock, 'kgAssetUrl').trim()
  const frontmatterDataUrl = readYamlFrontmatterValue(block.rawBlock, 'kgAssetDataUrl').trim()
  const fencedBase64 = frontmatterDataUrl || format !== 'glb' ? '' : readGlbBase64Fence(block.bodyText)
  const fencedGltfBase64 = frontmatterDataUrl || format !== 'gltf' ? '' : readGltfBase64Fence(block.bodyText)
  const fencedGltfJson = frontmatterDataUrl || format !== 'gltf' ? '' : readGltfJsonFence(block.bodyText)
  const dataUrl = frontmatterDataUrl
    || (fencedBase64 ? `${GLB_ASSET_DATA_URL_PREFIX}${fencedBase64}` : '')
    || (fencedGltfBase64 ? `${GLTF_ASSET_DATA_URL_PREFIX}${fencedGltfBase64}` : '')
    || (fencedGltfJson ? `${GLTF_ASSET_DATA_URL_PREFIX}${encodeUtf8Base64(fencedGltfJson)}` : '')
  if (!dataUrl && !pendingLocalImport) return null
  if (dataUrl && !isModelDataUrl(dataUrl)) return null

  const defaultMime = format === 'gltf' ? GLTF_ASSET_MIME_TYPE : GLB_ASSET_MIME_TYPE
  const mimeType = readYamlFrontmatterValue(block.rawBlock, 'kgAssetMimeType').trim() || (dataUrl ? inferMimeTypeFromDataUrl(dataUrl) : defaultMime)
  const byteLength = readNumberValue(readYamlFrontmatterValue(block.rawBlock, 'kgAssetBytes'))
  const validMagic = readBooleanValue(readYamlFrontmatterValue(block.rawBlock, 'kgAssetValidGlbMagic'))
  const validContainer = readBooleanValue(readYamlFrontmatterValue(block.rawBlock, 'kgAssetValidGlbContainer'))
  const validChunkOrder = readBooleanValue(readYamlFrontmatterValue(block.rawBlock, 'kgAssetValidGlbChunkOrder'))
  const validChunkAlignment = readBooleanValue(readYamlFrontmatterValue(block.rawBlock, 'kgAssetValidGlbChunkAlignment'))
  const validGlbJsonPadding = readBooleanValue(readYamlFrontmatterValue(block.rawBlock, 'kgAssetValidGlbJsonPadding'))
  const validGlbBinPadding = readBooleanValue(readYamlFrontmatterValue(block.rawBlock, 'kgAssetValidGlbBinPadding'))
  const validGlbBinReference = readBooleanValue(readYamlFrontmatterValue(block.rawBlock, 'kgAssetValidGlbBinReference'))
  const validJson = readBooleanValue(readYamlFrontmatterValue(block.rawBlock, 'kgAssetValidGltfJson'))
  const validGltfAsset = readBooleanValue(readYamlFrontmatterValue(block.rawBlock, 'kgAssetValidGltfAsset'))
  const gltfVersion = readYamlFrontmatterValue(block.rawBlock, 'kgAssetGltfVersion').trim()
  const externalResourceCount = readNumberValue(readYamlFrontmatterValue(block.rawBlock, 'kgAssetExternalResourceCount'))
  const embeddedResourceCount = readNumberValue(readYamlFrontmatterValue(block.rawBlock, 'kgAssetEmbeddedResourceCount'))
  const glbJsonChunkLength = readNumberValue(readYamlFrontmatterValue(block.rawBlock, 'kgAssetGlbJsonChunkBytes'))
  const glbBinChunkLength = readNumberValue(readYamlFrontmatterValue(block.rawBlock, 'kgAssetGlbBinChunkBytes'))
  const glbUnknownChunkCount = readNumberValue(readYamlFrontmatterValue(block.rawBlock, 'kgAssetGlbUnknownChunkCount'))

  return {
    name,
    format,
    ...(dataUrl ? { dataUrl } : {}),
    mimeType,
    byteLength,
    validMagic,
    validContainer,
    validChunkOrder,
    validChunkAlignment,
    validGlbJsonPadding,
    validGlbBinPadding,
    validGlbBinReference,
    validJson,
    validGltfAsset,
    ...(gltfVersion ? { gltfVersion } : {}),
    externalResourceCount,
    embeddedResourceCount,
    glbJsonChunkLength,
    glbBinChunkLength,
    glbUnknownChunkCount,
    ...(pendingLocalImport ? { pendingLocalImport: true } : {}),
    ...(pendingLocalImportPath ? { pendingLocalImportPath } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
  }
}
