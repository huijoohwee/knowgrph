import { LS_KEYS } from '@/lib/config.ls.keys'
import type { UiStorageReaders } from './uiSliceStorage'

export const createPdfImportInitialState = (readers: UiStorageReaders) => {
  const { lsBool, lsInt, lsJson } = readers
  return {
    pdfImportIncludeImages: lsBool(LS_KEYS.pdfImportIncludeImages, true),
    pdfImportMaxPages: lsInt(LS_KEYS.pdfImportMaxPages, 0),
    pdfImportMaxPdfBytes: lsInt(LS_KEYS.pdfImportMaxPdfBytes, 100 * 1024 * 1024),
    pdfImportFetchTimeoutMs: lsInt(LS_KEYS.pdfImportFetchTimeoutMs, 60_000),
    pdfImportUploadTimeoutMs: lsInt(LS_KEYS.pdfImportUploadTimeoutMs, 30_000),
    pdfImportConvertTimeoutMs: lsInt(LS_KEYS.pdfImportConvertTimeoutMs, 180_000),
    pdfImportStreamDecodeCacheMaxBytes: lsInt(LS_KEYS.pdfImportStreamDecodeCacheMaxBytes, 64 * 1024 * 1024),
    pdfImportContentStreamMaxDecodeBytes: lsInt(LS_KEYS.pdfImportContentStreamMaxDecodeBytes, 8 * 1024 * 1024),
    pdfImportPageContentMaxBytes: lsInt(LS_KEYS.pdfImportPageContentMaxBytes, 8 * 1024 * 1024),
    pdfImportCmapMaxBytes: lsInt(LS_KEYS.pdfImportCmapMaxBytes, 256 * 1024),
    pdfImportMaxToUnicodeStreamBytes: lsInt(LS_KEYS.pdfImportMaxToUnicodeStreamBytes, 256 * 1024),
    pdfImportToUnicodeMaxDecodeBytes: lsInt(LS_KEYS.pdfImportToUnicodeMaxDecodeBytes, 512 * 1024),
    pdfImportImageStreamMaxDecodeBytes: lsInt(LS_KEYS.pdfImportImageStreamMaxDecodeBytes, 32 * 1024 * 1024),
    pdfImportMaxTextContentBytesPerPage: lsInt(LS_KEYS.pdfImportMaxTextContentBytesPerPage, 512 * 1024),
    pdfImportMaxTextStreamBytes: lsInt(LS_KEYS.pdfImportMaxTextStreamBytes, 256 * 1024),
    pdfImportMaxFormXObjectBytes: lsInt(LS_KEYS.pdfImportMaxFormXObjectBytes, 512 * 1024),
    pdfImportMaxFormXObjectStreamBytes: lsInt(LS_KEYS.pdfImportMaxFormXObjectStreamBytes, 256 * 1024),
    pdfImportMaxFormXObjectCount: lsInt(LS_KEYS.pdfImportMaxFormXObjectCount, 64),
    pdfImportEmbedImages: lsBool(LS_KEYS.pdfImportEmbedImages, false),
    pdfImportMaxExtractedImagesPerPage: lsInt(LS_KEYS.pdfImportMaxExtractedImagesPerPage, 6),
    pdfImportMaxEmbeddedImagesPerPage: lsInt(LS_KEYS.pdfImportMaxEmbeddedImagesPerPage, 6),
    pdfImportMaxEmbeddedTotalBytes: lsInt(LS_KEYS.pdfImportMaxEmbeddedTotalBytes, 4 * 1024 * 1024),
    pdfImportMaxEmbeddedAssetBytes: lsInt(LS_KEYS.pdfImportMaxEmbeddedAssetBytes, 2 * 1024 * 1024),
    pdfImportReconstructTables: lsBool(LS_KEYS.pdfImportReconstructTables, true),
    pdfImportTableMinColumns: lsInt(LS_KEYS.pdfImportTableMinColumns, 2),
    pdfImportTableMinRows: lsInt(LS_KEYS.pdfImportTableMinRows, 3),
    pdfImportTableMaxRows: lsInt(LS_KEYS.pdfImportTableMaxRows, 60),
    pdfImportProvider: lsJson<'native' | 'docling-remote'>(
      LS_KEYS.pdfImportProvider,
      'native',
      v => (v === 'native' || v === 'docling-remote' ? v : 'native'),
    ),
    pdfImportDoclingEndpoint: lsJson<string | null>(
      LS_KEYS.pdfImportDoclingEndpoint,
      null,
      v => (typeof v === 'string' ? v : null),
    ),
    pdfImportProviderFallbackToNative: lsBool(LS_KEYS.pdfImportProviderFallbackToNative, true),
    pdfImportOcrEnabled: lsBool(LS_KEYS.pdfImportOcrEnabled, false),
    pdfImportOcrMode: lsJson<'fallback' | 'always'>(
      LS_KEYS.pdfImportOcrMode,
      'fallback',
      v => (v === 'always' || v === 'fallback' ? v : 'fallback'),
    ),
  }
}
