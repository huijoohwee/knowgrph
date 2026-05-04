import type { ReactNode } from 'react'
import type { MarkdownGeoCodeBlock } from './markdownGeoCodeBlockContract'

export type MarkdownGeoDatasetRegistrationRequest = {
  sourceDocumentPath: string
  codeBlock: MarkdownGeoCodeBlock
}

export type MarkdownGeoDatasetRegistrationResult = {
  ok: boolean
  error?: string
}

export type MarkdownGeoDatasetIntegration = {
  isGeospatialModeEnabled?: () => boolean
  isGeoJsonCodeBlock?: (req: MarkdownGeoDatasetRegistrationRequest) => boolean
  registerGeoJsonFeatureCollection?: (
    req: MarkdownGeoDatasetRegistrationRequest,
  ) => Promise<MarkdownGeoDatasetRegistrationResult> | MarkdownGeoDatasetRegistrationResult
  loadGeoJsonAsGraphData?: (
    req: MarkdownGeoDatasetRegistrationRequest,
  ) => Promise<MarkdownGeoDatasetRegistrationResult> | MarkdownGeoDatasetRegistrationResult
  renderGeoJsonFeatureCollection?: (req: MarkdownGeoDatasetRegistrationRequest) => ReactNode | null
  requestOpenGeoPanel?: () => void
}
