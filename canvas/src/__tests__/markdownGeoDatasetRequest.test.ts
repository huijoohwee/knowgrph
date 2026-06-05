import {
  buildMarkdownGeoCodeBlockContentHash,
  buildMarkdownGeoFeatureCollectionGraphSourceHash,
  normalizeMarkdownGeoCodeBlockText,
} from '@/features/geospatial/markdownGeoContentSignature'
import {
  buildMarkdownGeoDatasetGraphSourcePath,
  buildMarkdownGeoDatasetId,
  buildMarkdownGeoDatasetRequestFingerprint,
  buildMarkdownGeoDatasetRegistrationRequest,
  buildMarkdownGeoDatasetSourceLineRangePath,
  buildMarkdownGeoDatasetUploadName,
  buildMarkdownGeoDatasetUploadStem,
} from '@/features/geospatial/markdownGeoDatasetRequest'
import {
  normalizeMarkdownGeoSourceDocumentPath,
  readMarkdownGeoSourceDocumentBasename,
} from '@/features/geospatial/markdownGeoDocumentPath'
import {
  buildMarkdownGeoDocumentLineRangePath,
  normalizeMarkdownGeoLineRange,
} from '@/features/geospatial/markdownGeoLineRange'
import {
  buildMarkdownGeoCodeBlockGraphSourceDescriptor,
  buildMarkdownGeoCodeBlockGraphSourcePath,
  buildMarkdownGeoTableGraphSourceDescriptor,
  buildMarkdownGeoTableGraphSourcePath,
} from '@/features/geospatial/markdownGeoSourcePath'
import type { MarkdownGeoCodeBlock, MarkdownGeoCodeBlockLanguage } from '@/features/geospatial/markdownGeoCodeBlockContract'
import type { MarkdownGeoDatasetRegistrationRequest } from '@/features/geospatial/markdownGeoDatasetContract'
import type { MarkdownGeoGraphSourceDescriptor, MarkdownGeoGraphSourceKind } from '@/features/geospatial/markdownGeoSourceContract'
import { resolveMarkdownGeoDatasetParseResult } from '@/features/geospatial/markdownGeoParse'

export function testMarkdownGeoDatasetRequestHelperCentralizesGeoCodeBlockRequestShape() {
  const req = buildMarkdownGeoDatasetRegistrationRequest({
    activeDocumentPath: ' workspace:/fixtures/trip-demo.mmd#geo ',
    lang: 'geojson',
    text: ' {"type":"FeatureCollection","features":[]} ',
    startLine: 7,
    endLine: 11,
  })
  const reqContract: MarkdownGeoDatasetRegistrationRequest = req
  const codeBlockContract: MarkdownGeoCodeBlock = req.codeBlock
  const codeBlockLanguage: MarkdownGeoCodeBlockLanguage = req.codeBlock.lang

  if (req.sourceDocumentPath !== '/fixtures/trip-demo.mmd') {
    throw new Error('expected markdown geo dataset request helper to normalize workspace-style document paths into a canonical upstream identity')
  }
  if (codeBlockContract.startLine !== 7 || codeBlockContract.endLine !== 11 || codeBlockLanguage !== 'geojson') {
    throw new Error('expected markdown geo dataset request helper to stay assignable to the shared markdown geo code-block contract')
  }
  if (reqContract.codeBlock.lang !== 'geojson' || reqContract.codeBlock.startLine !== 7 || reqContract.codeBlock.endLine !== 11) {
    throw new Error('expected markdown geo dataset request helper to stay assignable to the shared geospatial dataset request contract')
  }
  if (req.codeBlock.lang !== 'geojson' || req.codeBlock.startLine !== 7 || req.codeBlock.endLine !== 11) {
    throw new Error('expected markdown geo dataset request helper to preserve code block language and line range')
  }
  if (req.codeBlock.text !== ' {"type":"FeatureCollection","features":[]} ') {
    throw new Error('expected markdown geo dataset request helper to preserve raw code block text for downstream hashing and parsing')
  }

  const datasetIdA = buildMarkdownGeoDatasetId(req)
  const requestFingerprintA = buildMarkdownGeoDatasetRequestFingerprint(req)
  const datasetIdB = buildMarkdownGeoDatasetId({
    ...req,
    codeBlock: { ...req.codeBlock, text: ' {"type":"FeatureCollection","features":[{"type":"Feature"}]} ' },
  })
  if (datasetIdA === datasetIdB) {
    throw new Error('expected markdown geo dataset id helper to change when the GeoJSON code block content changes')
  }
  if (datasetIdA !== requestFingerprintA.replace('kg:md:geo:req:', 'kg:md:geo:')) {
    throw new Error('expected markdown geo dataset id helper to derive from the shared markdown geo request fingerprint')
  }

  const uploadName = buildMarkdownGeoDatasetUploadName(req)
  if (uploadName !== 'trip-demo-L7-L11.geojson') {
    throw new Error(`expected markdown geo dataset upload helper to derive a stable basename and canonical line-range label, got ${uploadName}`)
  }

  const graphSourcePath = buildMarkdownGeoDatasetGraphSourcePath(req)
  if (graphSourcePath !== '/fixtures/trip-demo.mmd#L7-L11') {
    throw new Error(`expected markdown geo dataset graph-source helper to derive a stable document line range path, got ${graphSourcePath}`)
  }
  const sourceLineRangePath = buildMarkdownGeoDatasetSourceLineRangePath(req)
  if (sourceLineRangePath !== graphSourcePath) {
    throw new Error('expected markdown geo dataset helpers to reuse one canonical document#line-range identity across upload and graph-source derivation')
  }
  const uploadStem = buildMarkdownGeoDatasetUploadStem(req)
  if (uploadStem !== 'trip-demo-L7-L11') {
    throw new Error(`expected markdown geo dataset upload stem helper to reuse canonical line-range identity, got ${uploadStem}`)
  }

  const fallbackGraphSourcePath = buildMarkdownGeoDatasetGraphSourcePath(buildMarkdownGeoDatasetRegistrationRequest({
    activeDocumentPath: ' ',
    lang: 'json',
    text: '{}',
    startLine: Number.NaN,
    endLine: Number.NaN,
  }))
  if (fallbackGraphSourcePath !== 'document#L1-L1') {
    throw new Error(`expected markdown geo dataset graph-source helper to fall back to a bounded document path when no active document path exists, got ${fallbackGraphSourcePath}`)
  }

  if (normalizeMarkdownGeoSourceDocumentPath('sandbox/notes/demo.md#focus') !== '/sandbox/notes/demo.md') {
    throw new Error('expected markdown geo document path helper to normalize relative workspace-like paths and strip fragments')
  }
  if (normalizeMarkdownGeoSourceDocumentPath('https://example.com/geo/demo.md#focus') !== 'https://example.com/geo/demo.md') {
    throw new Error('expected markdown geo document path helper to preserve URI-based document identities while stripping fragments')
  }
  if (readMarkdownGeoSourceDocumentBasename('https://example.com/geo/demo.md#focus') !== 'demo.md') {
    throw new Error('expected markdown geo document basename helper to read URI path basenames without duplicating URL parsing downstream')
  }

  const normalizedRange = normalizeMarkdownGeoLineRange({ startLine: 7.8, endLine: 3.2 })
  if (normalizedRange.startLine !== 7 || normalizedRange.endLine !== 7) {
    throw new Error(`expected markdown geo line-range helper to clamp and bound line ranges, got ${JSON.stringify(normalizedRange)}`)
  }
  if (buildMarkdownGeoDocumentLineRangePath({
    sourceDocumentPath: 'workspace:/fixtures/trip-demo.mmd#focus',
    startLine: 7.8,
    endLine: 3.2,
  }) !== '/fixtures/trip-demo.mmd#L7-L7') {
    throw new Error('expected markdown geo line-range helper to derive one canonical document#line-range identity from workspace-style input')
  }

  const datasetIdRangeVariant = buildMarkdownGeoDatasetId({
    ...req,
    codeBlock: { ...req.codeBlock, endLine: 12 },
  })
  if (datasetIdRangeVariant === datasetIdA) {
    throw new Error('expected markdown geo dataset id helper to change when the canonical code-block line range changes')
  }
  const requestFingerprintRangeVariant = buildMarkdownGeoDatasetRequestFingerprint({
    ...req,
    codeBlock: { ...req.codeBlock, endLine: 12 },
  })
  if (requestFingerprintRangeVariant === requestFingerprintA) {
    throw new Error('expected markdown geo request fingerprint helper to change when the canonical code-block line range changes')
  }

  const whitespaceVariantFingerprint = buildMarkdownGeoDatasetRequestFingerprint({
    ...req,
    codeBlock: { ...req.codeBlock, text: `\n${req.codeBlock.text}\n` },
  })
  if (whitespaceVariantFingerprint !== requestFingerprintA) {
    throw new Error('expected markdown geo request fingerprint helper to reuse the shared normalized code-block content hash for whitespace-only variants')
  }
  if (normalizeMarkdownGeoCodeBlockText(`\n${req.codeBlock.text}\n`) !== req.codeBlock.text.trim()) {
    throw new Error('expected markdown geo content-signature helper to normalize code-block text exactly once upstream')
  }
  if (buildMarkdownGeoCodeBlockContentHash(`\n${req.codeBlock.text}\n`) !== buildMarkdownGeoCodeBlockContentHash(req.codeBlock.text)) {
    throw new Error('expected markdown geo content-signature helper to reuse one stable content hash for whitespace-only variants')
  }

  const featureCollectionHashA = buildMarkdownGeoFeatureCollectionGraphSourceHash({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'A' },
        geometry: { type: 'Point', coordinates: [103.85, 1.29] },
      },
    ],
  })
  const featureCollectionHashB = buildMarkdownGeoFeatureCollectionGraphSourceHash({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'A' },
        geometry: { type: 'Point', coordinates: [103.85, 1.29] },
      },
    ],
  })
  if (featureCollectionHashA !== featureCollectionHashB) {
    throw new Error('expected markdown geo feature-collection graph hash helper to reuse one stable graph source hash for equivalent feature collections')
  }

  if (buildMarkdownGeoCodeBlockGraphSourcePath(req) !== graphSourcePath) {
    throw new Error('expected markdown geo dataset graph-source helper to reuse the shared markdown geo code-block source-path contract')
  }
  const codeBlockSourceDescriptor = buildMarkdownGeoCodeBlockGraphSourceDescriptor(req)
  const codeBlockSourceKind: MarkdownGeoGraphSourceKind = codeBlockSourceDescriptor.kind
  const codeBlockSourceContract: MarkdownGeoGraphSourceDescriptor = codeBlockSourceDescriptor
  if (codeBlockSourceDescriptor.kind !== 'code-block' || codeBlockSourceDescriptor.sourcePath !== graphSourcePath) {
    throw new Error('expected markdown geo code-block source descriptor helper to centralize explicit kind metadata alongside the canonical source path')
  }
  if (codeBlockSourceKind !== 'code-block' || codeBlockSourceContract.sourcePath !== graphSourcePath) {
    throw new Error('expected markdown geo source descriptor contract to stay assignable from shared code-block source helpers')
  }

  const tableGraphSourcePath = buildMarkdownGeoTableGraphSourcePath({
    sourceDocumentPath: 'workspace:/fixtures/trip-demo.mmd#focus',
    featureCollection: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { kgSourceTableStartLine: 18 },
          geometry: { type: 'Point', coordinates: [103.85, 1.29] },
        },
      ],
    },
    tableIndex: 2,
  })
  if (tableGraphSourcePath !== '/fixtures/trip-demo.mmd#markdown-geo-table-L18') {
    throw new Error(`expected markdown geo table source-path helper to derive a stable source path from table line metadata, got ${tableGraphSourcePath}`)
  }
  const tableSourceDescriptor = buildMarkdownGeoTableGraphSourceDescriptor({
    sourceDocumentPath: 'workspace:/fixtures/trip-demo.mmd#focus',
    featureCollection: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { kgSourceTableStartLine: 18 },
          geometry: { type: 'Point', coordinates: [103.85, 1.29] },
        },
      ],
    },
    tableIndex: 2,
  })
  if (tableSourceDescriptor.kind !== 'table' || tableSourceDescriptor.sourcePath !== tableGraphSourcePath) {
    throw new Error('expected markdown geo table source descriptor helper to centralize explicit kind metadata alongside the canonical source path')
  }

  const fallbackTableGraphSourcePath = buildMarkdownGeoTableGraphSourcePath({
    sourceDocumentPath: 'workspace:/fixtures/trip-demo.mmd',
    featureCollection: { type: 'FeatureCollection', features: [] },
    tableIndex: 2,
  })
  if (fallbackTableGraphSourcePath !== '/fixtures/trip-demo.mmd#markdown-geo-table-2') {
    throw new Error(`expected markdown geo table source-path helper to fall back to a stable ordinal suffix when table line metadata is unavailable, got ${fallbackTableGraphSourcePath}`)
  }
}

export function testMarkdownGeoDatasetParseResultClonesRequestScopedCacheSnapshots() {
  const req = buildMarkdownGeoDatasetRegistrationRequest({
    activeDocumentPath: 'workspace:/fixtures/trip-demo.mmd#geo',
    lang: 'geojson',
    text: '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Clone Guard"},"geometry":{"type":"Point","coordinates":[103.85,1.29]}}]}',
    startLine: 9,
    endLine: 11,
  })

  const first = resolveMarkdownGeoDatasetParseResult(req)
  const second = resolveMarkdownGeoDatasetParseResult(req)

  if (first === second) {
    throw new Error('expected markdown geo dataset parse helper to clone request-scoped parse snapshots rather than sharing wrapper references')
  }
  if (!first.featureCollection || !second.featureCollection) {
    throw new Error('expected markdown geo dataset parse helper to preserve parsed FeatureCollection payloads across cache reuse')
  }
  if (first.featureCollection === second.featureCollection) {
    throw new Error('expected markdown geo dataset parse helper to clone parsed FeatureCollection payloads across cache reuse')
  }
  if (first.bounds === second.bounds) {
    throw new Error('expected markdown geo dataset parse helper to clone computed bounds snapshots across cache reuse')
  }
  if (first.textHash !== second.textHash || first.normalizedText !== second.normalizedText) {
    throw new Error('expected markdown geo dataset parse helper cache reuse to preserve canonical normalized text and text hash')
  }
}
