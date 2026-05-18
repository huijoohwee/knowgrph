import { deriveFilenameFromUrl } from '@/lib/url'
import {
  GLB_ASSET_BASE64_FENCE,
  GLB_ASSET_DATA_URL_PREFIX,
  GLB_ASSET_MIME_TYPE,
  GLTF_ASSET_BASE64_FENCE,
  GLTF_ASSET_MIME_TYPE,
} from '@/lib/assets/glbAssetDocument'
import { inspectGlbBytes, inspectGltfJson } from '@/lib/assets/gltfFormat'

export { GLB_ASSET_DATA_URL_PREFIX, GLB_ASSET_MIME_TYPE, GLTF_ASSET_MIME_TYPE }

export type WorkspaceModelAssetFormat = 'glb' | 'gltf'

function yamlQuote(value: string): string {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function isGlbAssetName(value: unknown): boolean {
  const raw = String(value || '').trim().toLowerCase()
  return /\.glb(?:$|[?#])/.test(raw)
}

export function isGltfAssetName(value: unknown): boolean {
  const raw = String(value || '').trim().toLowerCase()
  return /\.gltf(?:$|[?#])/.test(raw)
}

export function isModelAssetName(value: unknown): boolean {
  return isGlbAssetName(value) || isGltfAssetName(value)
}

export function inferModelAssetFormatFromName(value: unknown): WorkspaceModelAssetFormat {
  return isGltfAssetName(value) ? 'gltf' : 'glb'
}

export function deriveModelWorkspaceDocumentName(value: unknown, format?: WorkspaceModelAssetFormat): string {
  const assetFormat = format || inferModelAssetFormatFromName(value)
  const fallback = assetFormat === 'gltf' ? 'model.gltf' : 'model.glb'
  const raw = String(value || '').trim() || fallback
  const fileName = raw.split(/[\\/]/).filter(Boolean).pop() || raw
  const noQuery = fileName.split(/[?#]/)[0] || fileName
  const ext = assetFormat === 'gltf' ? '.gltf' : '.glb'
  const base = isModelAssetName(noQuery) ? noQuery : `${noQuery.replace(/\.[a-z0-9]+$/i, '') || 'model'}${ext}`
  return base
}

export function deriveGlbWorkspaceDocumentName(value: unknown): string {
  return deriveModelWorkspaceDocumentName(value, 'glb')
}

export function deriveGlbWorkspaceDocumentNameFromUrl(url: string): string {
  return deriveModelWorkspaceDocumentName(deriveFilenameFromUrl(url, 'model.glb'), 'glb')
}

export function deriveModelWorkspaceDocumentNameFromUrl(url: string): string {
  const format = inferModelAssetFormatFromName(url)
  return deriveModelWorkspaceDocumentName(deriveFilenameFromUrl(url, format === 'gltf' ? 'model.gltf' : 'model.glb'), format)
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

function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(String(text || ''))
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return arrayBufferToBase64(buffer)
}

function chunkBase64(value: string): string[] {
  const raw = String(value || '').replace(/\s+/g, '')
  const chunkSize = 76
  const out: string[] = []
  for (let offset = 0; offset < raw.length; offset += chunkSize) {
    out.push(raw.slice(offset, offset + chunkSize))
  }
  return out
}

export function buildGlbAssetMarkdown(args: {
  name: string
  sourceKind: 'local' | 'url'
  sourceUrl?: string | null
  buffer: ArrayBuffer
}): string {
  const name = String(args.name || '').trim() || 'model.glb'
  const bytes = Math.max(0, Number(args.buffer?.byteLength || 0))
  const base64 = arrayBufferToBase64(args.buffer)
  const sourceUrl = String(args.sourceUrl || '').trim()
  const inspection = inspectGlbBytes(args.buffer)
  return [
    '---',
    'kgAssetType: "model"',
    'kgAssetFormat: "glb"',
    'kgAssetEncoding: "base64-body"',
    `kgAssetName: ${yamlQuote(name)}`,
    `kgAssetSource: ${yamlQuote(args.sourceKind)}`,
    `kgAssetMimeType: ${yamlQuote(GLB_ASSET_MIME_TYPE)}`,
    `kgAssetBytes: ${bytes}`,
    `kgAssetValidGlbMagic: ${inspection.validMagic ? 'true' : 'false'}`,
    `kgAssetValidGlbContainer: ${inspection.validContainer ? 'true' : 'false'}`,
    `kgAssetValidGlbChunkOrder: ${inspection.validChunkOrder ? 'true' : 'false'}`,
    `kgAssetValidGlbChunkAlignment: ${inspection.validChunkAlignment ? 'true' : 'false'}`,
    `kgAssetValidGlbJsonPadding: ${inspection.validJsonPadding ? 'true' : 'false'}`,
    `kgAssetValidGlbBinPadding: ${inspection.validBinPadding ? 'true' : 'false'}`,
    `kgAssetValidGlbBinReference: ${inspection.validBinReference ? 'true' : 'false'}`,
    `kgAssetValidGltfJson: ${inspection.validJson ? 'true' : 'false'}`,
    `kgAssetValidGltfAsset: ${inspection.validGltfAsset ? 'true' : 'false'}`,
    inspection.assetVersion ? `kgAssetGltfVersion: ${yamlQuote(inspection.assetVersion)}` : '',
    `kgAssetExternalResourceCount: ${inspection.externalResourceUris.length}`,
    `kgAssetEmbeddedResourceCount: ${inspection.embeddedResourceDataUriCount}`,
    inspection.jsonChunkLength ? `kgAssetGlbJsonChunkBytes: ${inspection.jsonChunkLength}` : '',
    inspection.binChunkLength ? `kgAssetGlbBinChunkBytes: ${inspection.binChunkLength}` : '',
    inspection.unknownChunkCount ? `kgAssetGlbUnknownChunkCount: ${inspection.unknownChunkCount}` : '',
    sourceUrl ? `kgAssetUrl: ${yamlQuote(sourceUrl)}` : '',
    'kgCanvasSurfaceMode: "3d"',
    'kgCanvasRenderMode: "3d"',
    'kgCanvas3dMode: "xr"',
    '---',
    '',
    `# ${name}`,
    '',
    'Imported GLB model asset.',
    '',
    '- Format: GLB',
    `- Source: ${args.sourceKind}`,
    `- Bytes: ${bytes}`,
    '',
    `\`\`\`${GLB_ASSET_BASE64_FENCE}`,
    ...chunkBase64(base64),
    '```',
    '',
  ].filter(line => line !== '').join('\n')
}

export function buildGltfAssetMarkdown(args: {
  name: string
  sourceKind: 'local' | 'url'
  sourceUrl?: string | null
  text: string
}): string {
  const name = String(args.name || '').trim() || 'model.gltf'
  const text = String(args.text || '')
  const bytes = new TextEncoder().encode(text).byteLength
  const base64 = textToBase64(text)
  const sourceUrl = String(args.sourceUrl || '').trim()
  const inspection = inspectGltfJson(text)
  return [
    '---',
    'kgAssetType: "model"',
    'kgAssetFormat: "gltf"',
    'kgAssetEncoding: "json-body"',
    `kgAssetName: ${yamlQuote(name)}`,
    `kgAssetSource: ${yamlQuote(args.sourceKind)}`,
    `kgAssetMimeType: ${yamlQuote(GLTF_ASSET_MIME_TYPE)}`,
    `kgAssetBytes: ${bytes}`,
    `kgAssetValidGltfJson: ${inspection.validJson ? 'true' : 'false'}`,
    `kgAssetValidGltfAsset: ${inspection.validGltfAsset ? 'true' : 'false'}`,
    inspection.assetVersion ? `kgAssetGltfVersion: ${yamlQuote(inspection.assetVersion)}` : '',
    `kgAssetExternalResourceCount: ${inspection.externalResourceUris.length}`,
    `kgAssetEmbeddedResourceCount: ${inspection.embeddedResourceDataUriCount}`,
    sourceUrl ? `kgAssetUrl: ${yamlQuote(sourceUrl)}` : '',
    'kgCanvasSurfaceMode: "3d"',
    'kgCanvasRenderMode: "3d"',
    'kgCanvas3dMode: "xr"',
    '---',
    '',
    `# ${name}`,
    '',
    'Imported GLTF model asset.',
    '',
    '- Format: GLTF',
    `- Source: ${args.sourceKind}`,
    `- Bytes: ${bytes}`,
    '',
    `\`\`\`${GLTF_ASSET_BASE64_FENCE}`,
    ...chunkBase64(base64),
    '```',
    '',
  ].filter(line => line !== '').join('\n')
}

export async function buildGlbAssetMarkdownFromFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  return buildGlbAssetMarkdown({
    name: String(file.name || '').trim() || 'model.glb',
    sourceKind: 'local',
    buffer,
  })
}

export async function buildModelAssetMarkdownFromFile(file: File, format?: WorkspaceModelAssetFormat): Promise<string> {
  const assetFormat = format || inferModelAssetFormatFromName(file.name)
  if (assetFormat === 'gltf') {
    return buildGltfAssetMarkdown({
      name: String(file.name || '').trim() || 'model.gltf',
      sourceKind: 'local',
      text: await file.text(),
    })
  }
  return buildGlbAssetMarkdownFromFile(file)
}
