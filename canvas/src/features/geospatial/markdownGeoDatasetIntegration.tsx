import React from 'react'
import { InlineMarkdownGeoJsonLayerMap } from '@/features/geospatial/InlineMarkdownGeoJsonLayerMap'
import { LRUCache } from '@/lib/cache/LRUCache'
import { hashText } from '@/features/parsers/hash'
import { addGeospatialDatasetUrl, isGeospatialModeEnabled, parseGeoJsonFromText } from 'gympgrph'
import { uploadGeoJsonTextToLocalStore } from '@/features/geospatial/localGeoUpload'

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
  requestOpenGeoPanel?: () => void
}

type GeoDetectResult = { ok: boolean }
type GeoUploadCacheValue = { ok: true; url: string; name: string } | { ok: false; error: string }

const detectCache = new LRUCache<string, GeoDetectResult>(500, 10 * 60 * 1000)
const uploadCache = new LRUCache<string, GeoUploadCacheValue>(120, 30 * 60 * 1000)

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

const canParseGeoJson = (req: MarkdownGeoDatasetRegistrationRequest): boolean => {
  const raw = String(req.codeBlock.text || '')
  const trimmed = raw.trim()
  if (!trimmed) return false

  const cacheKey = `${req.codeBlock.lang}:${hashText(trimmed)}`
  const cached = detectCache.get(cacheKey)
  if (cached) return cached.ok

  try {
    const fc = parseGeoJsonFromText(trimmed)
    const ok = !!fc
    detectCache.set(cacheKey, { ok })
    return ok
  } catch {
    detectCache.set(cacheKey, { ok: false })
    return false
  }
}

export function createMarkdownGeoDatasetIntegration(args: {
  requestOpenGeoPanel?: () => void
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
        addGeospatialDatasetUrl({ url: cached.url, label: cached.name, format: 'geojson' })
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
      addGeospatialDatasetUrl({ url: uploaded.url, label: uploaded.name, format: 'geojson' })
      return { ok: true }
    },
    requestOpenGeoPanel: () => {
      args.requestOpenGeoPanel?.()
    },
  }
}
