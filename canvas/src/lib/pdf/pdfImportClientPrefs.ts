import { useGraphStore } from '@/hooks/useGraphStore'

export function buildPdfConvertQueryParamsFromStore(): URLSearchParams {
  const s = useGraphStore.getState()
  const qs = new URLSearchParams()

  qs.set('includeImages', s.pdfImportIncludeImages ? '1' : '0')
  qs.set('embedImages', s.pdfImportEmbedImages ? '1' : '0')

  const maxPages = Number.isFinite(s.pdfImportMaxPages) ? Math.max(0, Math.min(10_000, Math.floor(s.pdfImportMaxPages))) : 0
  if (maxPages > 0) qs.set('maxPages', String(maxPages))

  const maxPdfBytes = Number.isFinite(s.pdfImportMaxPdfBytes) ? Math.max(1_000_000, Math.min(2_000_000_000, Math.floor(s.pdfImportMaxPdfBytes))) : 0
  if (maxPdfBytes > 0) qs.set('maxPdfBytes', String(maxPdfBytes))
  const fetchTimeoutMs = Number.isFinite(s.pdfImportFetchTimeoutMs) ? Math.max(1_000, Math.min(10 * 60_000, Math.floor(s.pdfImportFetchTimeoutMs))) : 0
  if (fetchTimeoutMs > 0) qs.set('fetchTimeoutMs', String(fetchTimeoutMs))
  const uploadTimeoutMs = Number.isFinite(s.pdfImportUploadTimeoutMs) ? Math.max(1_000, Math.min(10 * 60_000, Math.floor(s.pdfImportUploadTimeoutMs))) : 0
  if (uploadTimeoutMs > 0) qs.set('uploadTimeoutMs', String(uploadTimeoutMs))
  const convertTimeoutMs = Number.isFinite(s.pdfImportConvertTimeoutMs) ? Math.max(1_000, Math.min(30 * 60_000, Math.floor(s.pdfImportConvertTimeoutMs))) : 0
  if (convertTimeoutMs > 0) qs.set('convertTimeoutMs', String(convertTimeoutMs))

  const streamDecodeCacheMaxBytes = Number.isFinite(s.pdfImportStreamDecodeCacheMaxBytes)
    ? Math.max(1_000_000, Math.min(2_000_000_000, Math.floor(s.pdfImportStreamDecodeCacheMaxBytes)))
    : 0
  if (streamDecodeCacheMaxBytes > 0) qs.set('streamDecodeCacheMaxBytes', String(streamDecodeCacheMaxBytes))
  const contentStreamMaxDecodeBytes = Number.isFinite(s.pdfImportContentStreamMaxDecodeBytes)
    ? Math.max(64 * 1024, Math.min(256 * 1024 * 1024, Math.floor(s.pdfImportContentStreamMaxDecodeBytes)))
    : 0
  if (contentStreamMaxDecodeBytes > 0) qs.set('contentStreamMaxDecodeBytes', String(contentStreamMaxDecodeBytes))
  const pageContentMaxBytes = Number.isFinite(s.pdfImportPageContentMaxBytes)
    ? Math.max(64 * 1024, Math.min(256 * 1024 * 1024, Math.floor(s.pdfImportPageContentMaxBytes)))
    : 0
  if (pageContentMaxBytes > 0) qs.set('pageContentMaxBytes', String(pageContentMaxBytes))

  const cmapMaxBytes = Number.isFinite(s.pdfImportCmapMaxBytes) ? Math.max(8 * 1024, Math.min(32 * 1024 * 1024, Math.floor(s.pdfImportCmapMaxBytes))) : 0
  if (cmapMaxBytes > 0) qs.set('cmapMaxBytes', String(cmapMaxBytes))
  const maxToUnicodeStreamBytes = Number.isFinite(s.pdfImportMaxToUnicodeStreamBytes)
    ? Math.max(8 * 1024, Math.min(256 * 1024 * 1024, Math.floor(s.pdfImportMaxToUnicodeStreamBytes)))
    : 0
  if (maxToUnicodeStreamBytes > 0) qs.set('maxToUnicodeStreamBytes', String(maxToUnicodeStreamBytes))
  const toUnicodeMaxDecodeBytes = Number.isFinite(s.pdfImportToUnicodeMaxDecodeBytes)
    ? Math.max(8 * 1024, Math.min(256 * 1024 * 1024, Math.floor(s.pdfImportToUnicodeMaxDecodeBytes)))
    : 0
  if (toUnicodeMaxDecodeBytes > 0) qs.set('toUnicodeMaxDecodeBytes', String(toUnicodeMaxDecodeBytes))
  const imageStreamMaxDecodeBytes = Number.isFinite(s.pdfImportImageStreamMaxDecodeBytes)
    ? Math.max(64 * 1024, Math.min(2_000_000_000, Math.floor(s.pdfImportImageStreamMaxDecodeBytes)))
    : 0
  if (imageStreamMaxDecodeBytes > 0) qs.set('imageStreamMaxDecodeBytes', String(imageStreamMaxDecodeBytes))
  const maxTextContentBytesPerPage = Number.isFinite(s.pdfImportMaxTextContentBytesPerPage)
    ? Math.max(8 * 1024, Math.min(256 * 1024 * 1024, Math.floor(s.pdfImportMaxTextContentBytesPerPage)))
    : 0
  if (maxTextContentBytesPerPage > 0) qs.set('maxTextContentBytesPerPage', String(maxTextContentBytesPerPage))
  const maxTextStreamBytes = Number.isFinite(s.pdfImportMaxTextStreamBytes) ? Math.max(8 * 1024, Math.min(256 * 1024 * 1024, Math.floor(s.pdfImportMaxTextStreamBytes))) : 0
  if (maxTextStreamBytes > 0) qs.set('maxTextStreamBytes', String(maxTextStreamBytes))
  const maxFormXObjectBytes = Number.isFinite(s.pdfImportMaxFormXObjectBytes) ? Math.max(8 * 1024, Math.min(256 * 1024 * 1024, Math.floor(s.pdfImportMaxFormXObjectBytes))) : 0
  if (maxFormXObjectBytes > 0) qs.set('maxFormXObjectBytes', String(maxFormXObjectBytes))
  const maxFormXObjectStreamBytes = Number.isFinite(s.pdfImportMaxFormXObjectStreamBytes)
    ? Math.max(8 * 1024, Math.min(256 * 1024 * 1024, Math.floor(s.pdfImportMaxFormXObjectStreamBytes)))
    : 0
  if (maxFormXObjectStreamBytes > 0) qs.set('maxFormXObjectStreamBytes', String(maxFormXObjectStreamBytes))
  const maxFormXObjectCount = Number.isFinite(s.pdfImportMaxFormXObjectCount) ? Math.max(0, Math.min(10_000, Math.floor(s.pdfImportMaxFormXObjectCount))) : 0
  qs.set('maxFormXObjectCount', String(maxFormXObjectCount))

  const maxExtracted = Number.isFinite(s.pdfImportMaxExtractedImagesPerPage) ? Math.max(0, Math.min(50, Math.floor(s.pdfImportMaxExtractedImagesPerPage))) : 12
  const maxEmbedded = Number.isFinite(s.pdfImportMaxEmbeddedImagesPerPage) ? Math.max(0, Math.min(50, Math.floor(s.pdfImportMaxEmbeddedImagesPerPage))) : 6
  const maxTotalBytes = Number.isFinite(s.pdfImportMaxEmbeddedTotalBytes) ? Math.max(0, Math.min(50 * 1024 * 1024, Math.floor(s.pdfImportMaxEmbeddedTotalBytes))) : 4 * 1024 * 1024
  const maxAssetBytes = Number.isFinite(s.pdfImportMaxEmbeddedAssetBytes) ? Math.max(0, Math.min(20 * 1024 * 1024, Math.floor(s.pdfImportMaxEmbeddedAssetBytes))) : 2 * 1024 * 1024

  qs.set('maxExtractedImagesPerPage', String(maxExtracted))
  qs.set('maxEmbeddedImagesPerPage', String(maxEmbedded))
  qs.set('maxEmbeddedTotalBytes', String(maxTotalBytes))
  qs.set('maxEmbeddedAssetBytes', String(maxAssetBytes))

  qs.set('reconstructTables', s.pdfImportReconstructTables ? '1' : '0')
  const tableMinColumns = Number.isFinite(s.pdfImportTableMinColumns) ? Math.max(2, Math.min(12, Math.floor(s.pdfImportTableMinColumns))) : 2
  const tableMinRows = Number.isFinite(s.pdfImportTableMinRows) ? Math.max(2, Math.min(20, Math.floor(s.pdfImportTableMinRows))) : 3
  const tableMaxRows = Number.isFinite(s.pdfImportTableMaxRows) ? Math.max(5, Math.min(200, Math.floor(s.pdfImportTableMaxRows))) : 60
  qs.set('tableMinColumns', String(tableMinColumns))
  qs.set('tableMinRows', String(tableMinRows))
  qs.set('tableMaxRows', String(tableMaxRows))

  qs.set('provider', s.pdfImportProvider === 'docling-remote' ? 'docling-remote' : 'native')
  const doclingEndpoint = String(s.pdfImportDoclingEndpoint || '').trim()
  if (doclingEndpoint) qs.set('doclingEndpoint', doclingEndpoint)
  qs.set('providerFallbackToNative', s.pdfImportProviderFallbackToNative ? '1' : '0')

  qs.set('ocr', s.pdfImportOcrEnabled ? '1' : '0')
  qs.set('ocrMode', s.pdfImportOcrMode === 'always' ? 'always' : 'fallback')

  return qs
}
