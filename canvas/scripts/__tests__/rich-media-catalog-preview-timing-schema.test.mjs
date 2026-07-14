import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  RICH_MEDIA_CATALOG_PREVIEW_TIMING_SCHEMA,
  validateRichMediaCatalogPreviewTiming,
} from '../lib/rich-media-catalog-preview-timing-schema.mjs'

function validTimingEvidence() {
  return {
    schema: RICH_MEDIA_CATALOG_PREVIEW_TIMING_SCHEMA,
    status: 'passed',
    budgetMs: 500,
    fixture: {
      path: '/demo/media-preview-metadata-ready.mp4',
      sha256: 'd165317102285ee0ebf46dca943b4b70b510fe1442dc84c523f30cb73ec5a2a2',
      sizeBytes: 1092,
    },
    image: {
      criterion: 'complete && naturalWidth > 0',
      coldOpenReadyMs: 39.4,
      preloadedTransitionReadyMs: 49.5,
    },
    video: {
      criterion: 'readyState >= HAVE_METADATA',
      metadata: {
        expected: {
          durationSeconds: 0.4,
          durationToleranceSeconds: 0.02,
          height: 90,
          width: 160,
        },
        preloaded: { durationSeconds: 0.4, height: 90, width: 160 },
        visible: { durationSeconds: 0.4, height: 90, width: 160 },
      },
      preloadedTransitionReadyMs: 48.6,
    },
  }
}

test('accepts complete v1 timing evidence', async () => {
  const result = await validateRichMediaCatalogPreviewTiming(validTimingEvidence())
  assert.equal(result.schemaVersion, RICH_MEDIA_CATALOG_PREVIEW_TIMING_SCHEMA)
})

test('rejects evidence with an unknown field', async () => {
  const evidence = { ...validTimingEvidence(), legacyTargetKind: 'video' }
  await assert.rejects(
    validateRichMediaCatalogPreviewTiming(evidence),
    /must NOT have additional properties/,
  )
})

test('rejects evidence without visible video metadata', async () => {
  const evidence = validTimingEvidence()
  delete evidence.video.metadata.visible
  await assert.rejects(validateRichMediaCatalogPreviewTiming(evidence), /must have required property 'visible'/)
})
