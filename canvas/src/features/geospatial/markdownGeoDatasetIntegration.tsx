import React from 'react'
import { InlineMarkdownGeoJsonLayerMap } from '@/features/geospatial/InlineMarkdownGeoJsonLayerMap'
import { maybeAutoEnableGeospatialModeForGraphData } from '@/features/geospatial/autoEnable'
import { LRUCache } from '@/lib/cache/LRUCache'
import { hashText } from '@/features/parsers/hash'
import type { GraphData } from '@/lib/graph/types'
import { buildGraphDataFromFeatureCollection } from '@/lib/graph/io/geojsonToGraphData'
import { addGeospatialDatasetUrl, isGeospatialModeEnabled } from 'gympgrph'
import { uploadGeoJsonTextToLocalStore } from '@/features/geospatial/localGeoUpload'
import { parseGeoJsonFeatureCollectionFromText } from '@/features/geospatial/geojsonParseCache'

type MarkdownGeoDatasetRegistrationRequest = {
  sourceDocumentPath: string
  codeBlock: {
    lang: 'geojson' | 'json'
    text: string
    startLine: number
    endLine: number
  }
}

type MarkdownGeoDatasetIntegration = {
  isGeospatialModeEnabled?: () => boolean
  isGeoJsonCodeBlock?: (req: MarkdownGeoDatasetRegistrationRequest) => boolean
  renderGeoJsonFeatureCollection?: (req: MarkdownGeoDatasetRegistrationRequest) => React.ReactNode
  registerGeoJsonFeatureCollection?: (req: MarkdownGeoDatasetRegistrationRequest) => Promise<{ ok: true } | { ok: false; error: string }>
  loadGeoJsonAsGraphData?: (req: MarkdownGeoDatasetRegistrationRequest) => Promise<{ ok: true } | { ok: false; error: string }>
  requestOpenGeoPanel?: () => void
}

type GeoUploadCacheValue = { ok: true; url: string; name: string } | { ok: false; error: string }

const uploadCache = new LRUCache<string, GeoUploadCacheValue>(120, 30 * 60 * 1000)
const addUrlOnceCache = new LRUCache<string, { ok: true }>(800, 45 * 60 * 1000)

const basenameFromDocPath = (raw: string): string => {
  const s = String(raw || '').trim().replace(/\\/g, '/')
  if (!s) return ''
  const noHash = s.split('#')[0] || ''
  const parts = noHash.split('/').filter(Boolean)
  return parts[parts.length - 1] || ''
}

const sanitizeFileNameStem = (raw: string): string => {
  const s = String(raw || '').trim()
  if (!s) return ''
  const dot = s.lastIndexOf('.')
  const stem = dot > 0 ? s.slice(0, dot) : s
  return stem.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-+/, '').replace(/-+$/, '')
}

const buildGeoDatasetId = (req: MarkdownGeoDatasetRegistrationRequest): string => {
  const key = `${req.sourceDocumentPath}|${req.codeBlock.lang}|${req.codeBlock.startLine}|${req.codeBlock.endLine}|${hashText(req.codeBlock.text || '')}`
  return `kg:md:geo:${hashText(key)}`
}

const buildUploadName = (req: MarkdownGeoDatasetRegistrationRequest): string => {
  const base = basenameFromDocPath(req.sourceDocumentPath)
  const stem = sanitizeFileNameStem(base) || 'document'
  const line = Number.isFinite(req.codeBlock.startLine) ? Math.max(1, Math.floor(req.codeBlock.startLine)) : 1
  return `${stem}-L${line}.geojson`
}

const buildGraphSourcePath = (req: MarkdownGeoDatasetRegistrationRequest): string => {
  const base = String(req.sourceDocumentPath || '').trim() || 'document'
  const start = Number.isFinite(req.codeBlock.startLine) ? Math.max(1, Math.floor(req.codeBlock.startLine)) : 1
  const end = Number.isFinite(req.codeBlock.endLine) ? Math.max(start, Math.floor(req.codeBlock.endLine)) : start
  return `${base}#L${start}-L${end}`
}

const canParseGeoJson = (req: MarkdownGeoDatasetRegistrationRequest): boolean => {
  const raw = String(req.codeBlock.text || '')
  const trimmed = raw.trim()
  if (!trimmed) return false
  return !!parseGeoJsonFeatureCollectionFromText(trimmed)
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
      const datasetId = buildGeoDatasetId(req)
      return React.createElement(InlineMarkdownGeoJsonLayerMap, {
        geojsonText: req.codeBlock.text,
        datasetId,
        className: 'w-full h-full',
        useContainerHeight: true,
      })
    },
    registerGeoJsonFeatureCollection: async req => {
      const raw = String(req.codeBlock.text || '')
      const trimmed = raw.trim()
      if (!trimmed) return { ok: false, error: 'Missing GeoJSON text' }
      if (!canParseGeoJson(req)) return { ok: false, error: 'GeoJSON parse failed' }

      const uploadCacheKey = `${req.codeBlock.lang}:${hashText(trimmed)}:${buildUploadName(req)}`
      const cached = uploadCache.get(uploadCacheKey)
      if (cached && cached.ok) {
        addDatasetUrlOnce({ url: cached.url, label: cached.name })
        return { ok: true }
      }

      const uploadName = buildUploadName(req)
      const uploaded = await uploadGeoJsonTextToLocalStore({ name: uploadName, text: trimmed })
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
      const raw = String(req.codeBlock.text || '')
      const trimmed = raw.trim()
      if (!trimmed) return { ok: false, error: 'Missing GeoJSON text' }
      const normalized = parseGeoJsonFeatureCollectionFromText(trimmed)
      if (!normalized) return { ok: false, error: 'GeoJSON parse failed' }

      try {
        const graph = buildGraphDataFromFeatureCollection({
          featureCollection: normalized,
          sourcePath: buildGraphSourcePath(req),
          sourceHash: hashText(trimmed),
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
