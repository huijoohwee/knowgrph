import React from 'react'
import { InlineMarkdownGeoJsonLayerMap } from '@/features/geospatial/InlineMarkdownGeoJsonLayerMap'
import { maybeAutoEnableGeospatialModeForGraphData } from '@/features/geospatial/autoEnable'
import { SimpleTtlLruCache } from '@/lib/cache/SimpleTtlLruCache'
import type { GraphData } from '@/lib/graph/types'
import { buildGraphDataFromFeatureCollection } from '@/lib/graph/io/geojsonToGraphData'
import { addGeospatialDatasetUrl, isGeospatialModeEnabled } from '@/lib/gympgrph/api'
import { uploadGeoJsonTextToLocalStore } from '@/features/geospatial/localGeoUpload'
import type {
  MarkdownGeoDatasetIntegration,
  MarkdownGeoDatasetRegistrationRequest,
} from './markdownGeoDatasetContract'
import {
  buildMarkdownGeoDatasetGraphSourcePath,
  buildMarkdownGeoDatasetId,
  buildMarkdownGeoDatasetRequestFingerprint,
  buildMarkdownGeoDatasetUploadName,
} from './markdownGeoDatasetRequest'
import {
  buildMarkdownGeoFeatureCollectionGraphSourceHash,
} from './markdownGeoContentSignature'
import { resolveMarkdownGeoDatasetParseResult } from './markdownGeoParse'

type GeoUploadCacheValue = { ok: true; url: string; name: string } | { ok: false; error: string }

const uploadCache = new SimpleTtlLruCache<string, GeoUploadCacheValue>(120, 30 * 60 * 1000)
const addUrlOnceCache = new SimpleTtlLruCache<string, { ok: true }>(800, 45 * 60 * 1000)

const canParseGeoJson = (req: MarkdownGeoDatasetRegistrationRequest): boolean => {
  return !!resolveMarkdownGeoDatasetParseResult(req).featureCollection
}

const addDatasetUrlOnce = (args: { url: string; label: string }) => {
  const rawUrl = String(args.url || '').trim()
  const rawLabel = String(args.label || '').trim()
  if (!rawUrl) return
  const label = rawLabel || 'GeoJSON dataset'

  const cacheKey = rawUrl
  if (addUrlOnceCache.get(cacheKey)) return

  addGeospatialDatasetUrl({ url: rawUrl, label, format: 'geojson' })
  addUrlOnceCache.set(cacheKey, { ok: true })
}

export function createMarkdownGeoDatasetIntegration(args: {
  requestOpenGeoPanel?: () => void
  loadGraphData?: (graphData: GraphData) => void
} = {}): MarkdownGeoDatasetIntegration {
  return {
    isGeospatialModeEnabled: () => {
      try {
        return isGeospatialModeEnabled()
      } catch {
        return false
      }
    },
    isGeoJsonCodeBlock: req => {
      return canParseGeoJson(req)
    },
    renderGeoJsonFeatureCollection: req => {
      const datasetId = buildMarkdownGeoDatasetId(req)
      const parsed = resolveMarkdownGeoDatasetParseResult(req)
      return React.createElement(InlineMarkdownGeoJsonLayerMap, {
        geojsonText: parsed.normalizedText,
        datasetId,
        featureCollection: parsed.featureCollection,
        className: 'w-full h-full',
        useContainerHeight: true,
      })
    },
    registerGeoJsonFeatureCollection: async req => {
      const parsed = resolveMarkdownGeoDatasetParseResult(req)
      if (!parsed.normalizedText) return { ok: false, error: 'Missing GeoJSON text' }
      if (!parsed.featureCollection) return { ok: false, error: 'GeoJSON parse failed' }

      const uploadName = buildMarkdownGeoDatasetUploadName(req)
      const uploadCacheKey = buildMarkdownGeoDatasetRequestFingerprint(req)
      const cached = uploadCache.get(uploadCacheKey)
      if (cached && cached.ok) {
        addDatasetUrlOnce({ url: cached.url, label: cached.name })
        return { ok: true }
      }

      const uploaded = await uploadGeoJsonTextToLocalStore({ name: uploadName, text: parsed.normalizedText })
      if (uploaded.ok === false) {
        const err = typeof (uploaded as { error?: unknown }).error === 'string' ? String((uploaded as { error?: unknown }).error) : ''
        uploadCache.set(uploadCacheKey, { ok: false, error: err })
        return { ok: false, error: err || 'Geo upload failed' }
      }
      uploadCache.set(uploadCacheKey, uploaded)
      addDatasetUrlOnce({ url: uploaded.url, label: uploaded.name })
      return { ok: true }
    },
    loadGeoJsonAsGraphData: async req => {
      const parsed = resolveMarkdownGeoDatasetParseResult(req)
      if (!parsed.normalizedText) return { ok: false, error: 'Missing GeoJSON text' }
      if (!parsed.featureCollection) return { ok: false, error: 'GeoJSON parse failed' }

      try {
        const graph = buildGraphDataFromFeatureCollection({
          featureCollection: parsed.featureCollection,
          sourcePath: buildMarkdownGeoDatasetGraphSourcePath(req),
          sourceHash: buildMarkdownGeoFeatureCollectionGraphSourceHash(parsed.featureCollection),
        })
        if (!graph) return { ok: false, error: 'GeoJSON produced no graph nodes' }
        args.loadGraphData?.(graph)
        await maybeAutoEnableGeospatialModeForGraphData({ graphData: graph })
        return { ok: true }
      } catch (err) {
        if (err && typeof err === 'object' && 'message' in err) {
          const msg = (err as { message?: unknown }).message
          if (typeof msg === 'string' && msg.trim()) return { ok: false, error: msg.trim() }
        }
        return { ok: false, error: 'GeoJSON graph conversion failed' }
      }
    },
    requestOpenGeoPanel: () => {
      args.requestOpenGeoPanel?.()
    },
  }
}
