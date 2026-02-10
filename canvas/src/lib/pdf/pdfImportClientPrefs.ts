import { useGraphStore } from '@/hooks/useGraphStore'

export function buildPdfConvertQueryParamsFromStore(): URLSearchParams {
  const s = useGraphStore.getState()
  const qs = new URLSearchParams()

  qs.set('conversionMode', s.pdfImportConversionMode === 'image-heavy' ? 'image-heavy' : s.pdfImportConversionMode === 'scan-ocr' ? 'scan-ocr' : 'text-only')
  qs.set('includeImages', s.pdfImportIncludeImages ? '1' : '0')
  qs.set('embedImages', s.pdfImportEmbedImages ? '1' : '0')

  const maxExtracted = Number.isFinite(s.pdfImportMaxExtractedImagesPerPage) ? Math.max(0, Math.min(50, Math.floor(s.pdfImportMaxExtractedImagesPerPage))) : 12
  const maxEmbedded = Number.isFinite(s.pdfImportMaxEmbeddedImagesPerPage) ? Math.max(0, Math.min(50, Math.floor(s.pdfImportMaxEmbeddedImagesPerPage))) : 6
  const maxTotalBytes = Number.isFinite(s.pdfImportMaxEmbeddedTotalBytes) ? Math.max(0, Math.min(50 * 1024 * 1024, Math.floor(s.pdfImportMaxEmbeddedTotalBytes))) : 4 * 1024 * 1024
  const maxAssetBytes = Number.isFinite(s.pdfImportMaxEmbeddedAssetBytes) ? Math.max(0, Math.min(20 * 1024 * 1024, Math.floor(s.pdfImportMaxEmbeddedAssetBytes))) : 2 * 1024 * 1024

  qs.set('maxExtractedImagesPerPage', String(maxExtracted))
  qs.set('maxEmbeddedImagesPerPage', String(maxEmbedded))
  qs.set('maxEmbeddedTotalBytes', String(maxTotalBytes))
  qs.set('maxEmbeddedAssetBytes', String(maxAssetBytes))

  qs.set('provider', s.pdfImportProvider === 'docling-remote' ? 'docling-remote' : 'native')
  const doclingEndpoint = String(s.pdfImportDoclingEndpoint || '').trim()
  if (doclingEndpoint) qs.set('doclingEndpoint', doclingEndpoint)
  qs.set('providerFallbackToNative', s.pdfImportProviderFallbackToNative ? '1' : '0')

  qs.set('deepseekOcr2', s.pdfImportDeepseekOcr2Enabled ? '1' : '0')
  qs.set('deepseekOcr2Mode', s.pdfImportDeepseekOcr2Mode === 'always' ? 'always' : 'fallback')

  return qs
}
