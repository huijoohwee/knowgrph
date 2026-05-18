export type GltfJsonInspection = {
  validJson: boolean
  validGltfAsset: boolean
  assetVersion?: string
  firstBufferByteLength?: number
  firstBufferUriDefined?: boolean
  externalResourceUris: string[]
  embeddedResourceDataUriCount: number
}

export type GlbContainerInspection = GltfJsonInspection & {
  byteLength: number
  declaredLength?: number
  version?: number
  validMagic: boolean
  validVersion: boolean
  validLength: boolean
  validChunkOrder: boolean
  validChunkAlignment: boolean
  validJsonPadding: boolean
  validBinPadding: boolean
  validBinReference: boolean
  consumedByteLength: number
  validContainer: boolean
  jsonChunkLength?: number
  binChunkLength?: number
  unknownChunkCount: number
}

const GLB_MAGIC = 0x46546c67
const GLB_VERSION = 2
const GLB_JSON_CHUNK_TYPE = 0x4e4f534a
const GLB_BIN_CHUNK_TYPE = 0x004e4942

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isDataUri(uri: string): boolean {
  return /^data:/i.test(String(uri || '').trim())
}

function normalizeAssetVersion(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isGltf2Version(value: unknown): boolean {
  const version = normalizeAssetVersion(value)
  return /^2(?:\.|$)/.test(version)
}

function collectResourceUris(parsed: unknown): { external: string[]; embeddedCount: number } {
  if (!isRecord(parsed)) return { external: [], embeddedCount: 0 }
  const out: string[] = []
  let embeddedCount = 0
  const collect = (items: unknown) => {
    if (!Array.isArray(items)) return
    for (const item of items) {
      if (!isRecord(item)) continue
      const uri = typeof item.uri === 'string' ? item.uri.trim() : ''
      if (!uri) continue
      if (isDataUri(uri)) embeddedCount += 1
      else out.push(uri)
    }
  }
  collect(parsed.buffers)
  collect(parsed.images)
  return { external: out, embeddedCount }
}

function readFirstBufferInfo(parsed: unknown): { byteLength?: number; uriDefined?: boolean } {
  if (!isRecord(parsed) || !Array.isArray(parsed.buffers) || parsed.buffers.length === 0) return {}
  const first = parsed.buffers[0]
  if (!isRecord(first)) return {}
  const byteLength = Number(first.byteLength)
  return {
    ...(Number.isFinite(byteLength) && byteLength >= 0 ? { byteLength: Math.floor(byteLength) } : {}),
    uriDefined: typeof first.uri === 'string' && first.uri.trim() !== '',
  }
}

export function inspectGltfJson(text: unknown): GltfJsonInspection {
  const raw = String(text || '').trim()
  try {
    const parsed = JSON.parse(raw) as unknown
    const asset = isRecord(parsed) && isRecord(parsed.asset) ? parsed.asset : null
    const assetVersion = normalizeAssetVersion(asset?.version)
    const resources = collectResourceUris(parsed)
    const firstBuffer = readFirstBufferInfo(parsed)
    return {
      validJson: true,
      validGltfAsset: !!asset && isGltf2Version(asset.version),
      ...(assetVersion ? { assetVersion } : {}),
      ...(typeof firstBuffer.byteLength === 'number' ? { firstBufferByteLength: firstBuffer.byteLength } : {}),
      ...(typeof firstBuffer.uriDefined === 'boolean' ? { firstBufferUriDefined: firstBuffer.uriDefined } : {}),
      externalResourceUris: resources.external,
      embeddedResourceDataUriCount: resources.embeddedCount,
    }
  } catch {
    return {
      validJson: false,
      validGltfAsset: false,
      externalResourceUris: [],
      embeddedResourceDataUriCount: 0,
    }
  }
}

function toUint8Array(buffer: ArrayBuffer | Uint8Array): Uint8Array {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes).replace(/[\u0020]+$/g, '')
}

function isJsonChunkPaddingValid(bytes: Uint8Array): boolean {
  let index = bytes.byteLength - 1
  while (index >= 0 && bytes[index] === 0x20) index -= 1
  return index >= 0
}

function isBinChunkPaddingValid(bytes: Uint8Array, declaredLength?: number): boolean {
  if (typeof declaredLength !== 'number') return false
  if (declaredLength < 0 || declaredLength > bytes.byteLength) return false
  if (bytes.byteLength - declaredLength > 3) return false
  for (let index = declaredLength; index < bytes.byteLength; index += 1) {
    if (bytes[index] !== 0x00) return false
  }
  return true
}

export function inspectGlbBytes(buffer: ArrayBuffer | Uint8Array): GlbContainerInspection {
  const bytes = toUint8Array(buffer)
  const byteLength = bytes.byteLength
  const emptyJsonInspection: GltfJsonInspection = {
    validJson: false,
    validGltfAsset: false,
    externalResourceUris: [],
    embeddedResourceDataUriCount: 0,
  }
  if (byteLength < 12) {
    return {
      ...emptyJsonInspection,
      byteLength,
      validMagic: false,
      validVersion: false,
      validLength: false,
      validChunkOrder: false,
      validChunkAlignment: false,
      validJsonPadding: false,
      validBinPadding: true,
      validBinReference: true,
      consumedByteLength: 0,
      validContainer: false,
      unknownChunkCount: 0,
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const magic = view.getUint32(0, true)
  const version = view.getUint32(4, true)
  const declaredLength = view.getUint32(8, true)
  const validMagic = magic === GLB_MAGIC
  const validVersion = version === GLB_VERSION
  const validLength = declaredLength === byteLength

  let offset = 12
  let jsonChunkLength = 0
  let binChunkLength = 0
  let jsonInspection = emptyJsonInspection
  let sawJsonChunk = false
  let sawBinChunk = false
  let validChunkOrder = true
  let validChunkAlignment = byteLength % 4 === 0
  let validJsonPadding = false
  let binChunkBytes: Uint8Array | null = null
  let unknownChunkCount = 0
  let sawUnknownAfterJsonBeforeBin = false

  while (offset + 8 <= byteLength) {
    const chunkLength = view.getUint32(offset, true)
    const chunkType = view.getUint32(offset + 4, true)
    const chunkStart = offset + 8
    const chunkEnd = chunkStart + chunkLength
    if (offset % 4 !== 0 || chunkStart % 4 !== 0 || chunkEnd % 4 !== 0) validChunkAlignment = false
    if (chunkEnd > byteLength) {
      validChunkAlignment = false
      break
    }
    const chunkBytes = bytes.subarray(chunkStart, chunkEnd)
    if (chunkType === GLB_JSON_CHUNK_TYPE) {
      if (sawJsonChunk || sawBinChunk || offset !== 12) validChunkOrder = false
      if (!sawJsonChunk) {
        sawJsonChunk = true
        jsonChunkLength = chunkLength
        validJsonPadding = isJsonChunkPaddingValid(chunkBytes)
        jsonInspection = inspectGltfJson(decodeUtf8(chunkBytes))
      }
    } else if (chunkType === GLB_BIN_CHUNK_TYPE) {
      if (!sawJsonChunk || sawBinChunk || sawUnknownAfterJsonBeforeBin) validChunkOrder = false
      if (!sawBinChunk) {
        sawBinChunk = true
        binChunkLength = chunkLength
        binChunkBytes = chunkBytes
      }
    } else {
      unknownChunkCount += 1
      if (!sawJsonChunk) validChunkOrder = false
      else if (!sawBinChunk) sawUnknownAfterJsonBeforeBin = true
    }
    offset = chunkEnd
  }
  const consumedByteLength = offset
  const validChunkCompleteness = consumedByteLength === byteLength
  const validBinReference = !sawBinChunk
    || (
      typeof jsonInspection.firstBufferByteLength === 'number'
      && jsonInspection.firstBufferUriDefined === false
    )
  const validBinPadding = !sawBinChunk
    || (binChunkBytes ? isBinChunkPaddingValid(binChunkBytes, jsonInspection.firstBufferByteLength) : false)

  return {
    ...jsonInspection,
    byteLength,
    declaredLength,
    version,
    validMagic,
    validVersion,
    validLength,
    validChunkOrder,
    validChunkAlignment: validChunkAlignment && validChunkCompleteness,
    validJsonPadding,
    validBinPadding,
    validBinReference,
    consumedByteLength,
    validContainer:
      validMagic
      && validVersion
      && validLength
      && validChunkOrder
      && validChunkAlignment
      && validChunkCompleteness
      && validJsonPadding
      && validBinPadding
      && validBinReference
      && sawJsonChunk
      && jsonInspection.validGltfAsset,
    ...(jsonChunkLength > 0 ? { jsonChunkLength } : {}),
    ...(binChunkLength > 0 ? { binChunkLength } : {}),
    unknownChunkCount,
  }
}
