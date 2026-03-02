import type { IncomingMessage } from 'node:http'

export type PdfConvertOverrides = {
  includeImages?: boolean
  embedImages?: boolean
  maxPages?: number
  maxExtractedImagesPerPage?: number
  maxEmbeddedImagesPerPage?: number
  maxEmbeddedTotalBytes?: number
  maxEmbeddedAssetBytes?: number
  reconstructTables?: boolean
  tableMinColumns?: number
  tableMinRows?: number
  tableMaxRows?: number
  ocrEnabled?: boolean
  ocrMode?: 'fallback' | 'always'
  provider?: string
  doclingEndpoint?: string
  providerFallbackToNative?: boolean

  maxPdfBytes?: number
  fetchTimeoutMs?: number
  uploadTimeoutMs?: number
  convertTimeoutMs?: number

  streamDecodeCacheMaxBytes?: number
  contentStreamMaxDecodeBytes?: number
  pageContentMaxBytes?: number

  cmapMaxBytes?: number
  maxToUnicodeStreamBytes?: number
  toUnicodeMaxDecodeBytes?: number
  imageStreamMaxDecodeBytes?: number
  maxTextContentBytesPerPage?: number
  maxTextStreamBytes?: number
  maxFormXObjectBytes?: number
  maxFormXObjectStreamBytes?: number
  maxFormXObjectCount?: number
}

export type PdfConvertRequest = {
  url: string | undefined
  body: Buffer | null
  nameHint: string | undefined
  overrides: PdfConvertOverrides
  rawContentType: string
}

function readBool01(sp: URLSearchParams, key: string): boolean | undefined {
  const raw = sp.get(key)
  if (raw == null) return undefined
  return raw.trim() === '1'
}

function readString(sp: URLSearchParams, key: string): string | undefined {
  const raw = String(sp.get(key) || '').trim()
  return raw ? raw : undefined
}

function readInt(sp: URLSearchParams, key: string): number | undefined {
  const raw = sp.get(key)
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) ? Math.floor(n) : undefined
}

function readPositiveInt(sp: URLSearchParams, key: string): number | undefined {
  const n = readInt(sp, key)
  return typeof n === 'number' && n > 0 ? n : undefined
}

function readNonNegativeInt(sp: URLSearchParams, key: string): number | undefined {
  const n = readInt(sp, key)
  return typeof n === 'number' && n >= 0 ? n : undefined
}

export function parsePdfConvertRequest(args: {
  req: IncomingMessage
}): PdfConvertRequest {
  const parsed = new URL(args.req.url || '', `http://${args.req.headers.host}`)
  const sp = parsed.searchParams

  const urlParam = readString(sp, 'url')
  const includeImagesOverride = readBool01(sp, 'includeImages')
  const embedImagesOverride = readBool01(sp, 'embedImages')
  const providerFallbackToNative = readBool01(sp, 'providerFallbackToNative')

  const maxExtractedImagesPerPage = readPositiveInt(sp, 'maxExtractedImagesPerPage')
  const maxPages = readPositiveInt(sp, 'maxPages')
  const maxEmbeddedImagesPerPage = readNonNegativeInt(sp, 'maxEmbeddedImagesPerPage')
  const maxEmbeddedTotalBytes = readPositiveInt(sp, 'maxEmbeddedTotalBytes')
  const maxEmbeddedAssetBytes = readPositiveInt(sp, 'maxEmbeddedAssetBytes')

  const reconstructTables = readBool01(sp, 'reconstructTables')
  const tableMinColumns = readPositiveInt(sp, 'tableMinColumns')
  const tableMinRows = readPositiveInt(sp, 'tableMinRows')
  const tableMaxRows = readPositiveInt(sp, 'tableMaxRows')

  const maxPdfBytes = readPositiveInt(sp, 'maxPdfBytes')
  const fetchTimeoutMs = readPositiveInt(sp, 'fetchTimeoutMs')
  const uploadTimeoutMs = readPositiveInt(sp, 'uploadTimeoutMs')
  const convertTimeoutMs = readPositiveInt(sp, 'convertTimeoutMs')

  const streamDecodeCacheMaxBytes = readPositiveInt(sp, 'streamDecodeCacheMaxBytes')
  const contentStreamMaxDecodeBytes = readPositiveInt(sp, 'contentStreamMaxDecodeBytes')
  const pageContentMaxBytes = readPositiveInt(sp, 'pageContentMaxBytes')

  const cmapMaxBytes = readPositiveInt(sp, 'cmapMaxBytes')
  const maxToUnicodeStreamBytes = readPositiveInt(sp, 'maxToUnicodeStreamBytes')
  const toUnicodeMaxDecodeBytes = readPositiveInt(sp, 'toUnicodeMaxDecodeBytes')
  const imageStreamMaxDecodeBytes = readPositiveInt(sp, 'imageStreamMaxDecodeBytes')
  const maxTextContentBytesPerPage = readPositiveInt(sp, 'maxTextContentBytesPerPage')
  const maxTextStreamBytes = readPositiveInt(sp, 'maxTextStreamBytes')
  const maxFormXObjectBytes = readPositiveInt(sp, 'maxFormXObjectBytes')
  const maxFormXObjectStreamBytes = readPositiveInt(sp, 'maxFormXObjectStreamBytes')
  const maxFormXObjectCount = readNonNegativeInt(sp, 'maxFormXObjectCount')

  const ocrEnabled = (() => {
    const direct = sp.get('ocr')
    if (direct != null) return direct.trim() === '1'
    return undefined
  })()
  const ocrMode = (() => {
    const raw = String(sp.get('ocrMode') || '').trim().toLowerCase()
    if (raw) return raw === 'always' ? 'always' : raw === 'fallback' ? 'fallback' : undefined
    return undefined
  })()

  const provider = readString(sp, 'provider')
  const doclingEndpoint = readString(sp, 'doclingEndpoint')

  const nameHintHeader = typeof args.req.headers['x-import-filename'] === 'string' ? args.req.headers['x-import-filename'] : undefined
  const contentType = typeof args.req.headers['content-type'] === 'string' ? args.req.headers['content-type'] : ''

  return {
    url: urlParam,
    body: null,
    nameHint: nameHintHeader,
    rawContentType: contentType,
    overrides: {
      includeImages: includeImagesOverride,
      embedImages: embedImagesOverride,
      maxPages,
      maxExtractedImagesPerPage,
      maxEmbeddedImagesPerPage,
      maxEmbeddedTotalBytes,
      maxEmbeddedAssetBytes,
      reconstructTables,
      tableMinColumns,
      tableMinRows,
      tableMaxRows,
      ocrEnabled,
      ocrMode,
      provider,
      doclingEndpoint,
      providerFallbackToNative,
      maxPdfBytes,
      fetchTimeoutMs,
      uploadTimeoutMs,
      convertTimeoutMs,

      streamDecodeCacheMaxBytes,
      contentStreamMaxDecodeBytes,
      pageContentMaxBytes,

      cmapMaxBytes,
      maxToUnicodeStreamBytes,
      toUnicodeMaxDecodeBytes,
      imageStreamMaxDecodeBytes,
      maxTextContentBytesPerPage,
      maxTextStreamBytes,
      maxFormXObjectBytes,
      maxFormXObjectStreamBytes,
      maxFormXObjectCount,
    },
  }
}
