import { resolve } from 'node:path'
import {
  RICH_MEDIA_CATALOG_PREVIEW_TIMING_ARTIFACT_PATH,
  validateRichMediaCatalogPreviewTimingArtifact,
} from './lib/rich-media-catalog-preview-timing-schema.mjs'

const artifactPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : RICH_MEDIA_CATALOG_PREVIEW_TIMING_ARTIFACT_PATH

try {
  const result = await validateRichMediaCatalogPreviewTimingArtifact(artifactPath)
  console.log(`OK ${result.schemaVersion} ${result.artifactPath}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
