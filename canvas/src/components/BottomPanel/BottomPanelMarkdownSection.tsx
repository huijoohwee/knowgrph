import React from 'react'
import { BottomPanelMarkdownSection as CuragrphBottomPanelMarkdownSection } from 'curagrph/components/BottomPanel/BottomPanelMarkdownSection.tsx'
import type { MarkdownGeoDatasetIntegration } from 'curagrph/features/markdown/ui/MarkdownRendererTypes.ts'
import { addGeospatialDatasetUrls, setGeospatialModeEnabled } from 'gympgrph'
import { emitSidePanelOpen } from '@/features/canvas/utils'
import { uploadGeoJsonTextToLocalStore } from '@/features/geospatial/localGeoUpload'
import { InlineMarkdownGeoJsonLayerMap } from '@/features/geospatial/InlineMarkdownGeoJsonLayerMap'

type FeatureCollection = { type: 'FeatureCollection'; features: unknown[] }

const isFeatureCollection = (value: unknown): value is FeatureCollection => {
  if (!value || typeof value !== 'object') return false
  const v = value as { type?: unknown; features?: unknown }
  if (v.type !== 'FeatureCollection') return false
  return Array.isArray(v.features)
}

const hashString = (input: string): string => {
  let h = 5381
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h) ^ input.charCodeAt(i)
  }
  return (h >>> 0).toString(16)
}

const uploadPromisesByKey = new Map<string, Promise<string>>()

const deriveNameStem = (documentPath: string): string => {
  const raw = String(documentPath || '').trim()
  const base = raw.split('/').pop() || 'document'
  const stem = base.replace(/\.(md|markdown)$/i, '')
  return stem || 'document'
}

const buildUploadName = (documentPath: string, startLine: number): string => {
  const stem = deriveNameStem(documentPath)
  const line = Number.isFinite(startLine) ? Math.max(1, Math.floor(startLine)) : 1
  return `${stem}-geojson-L${line}.geojson`
}

const buildDatasetLabel = (documentPath: string, startLine: number): string => {
  const base = deriveNameStem(documentPath)
  const line = Number.isFinite(startLine) ? Math.max(1, Math.floor(startLine)) : 1
  return `${base} · GeoJSON L${line}`
}

async function uploadGeoJsonText(args: { key: string; name: string; text: string }): Promise<string> {
  const existing = uploadPromisesByKey.get(args.key)
  if (existing) return existing

  const promise = (async () => {
    const res = await uploadGeoJsonTextToLocalStore({ name: args.name, text: args.text })
    if (res.ok === true) return res.url
    throw new Error(res.error || 'Geo upload failed')
  })()

  uploadPromisesByKey.set(args.key, promise)
  try {
    return await promise
  } catch (e) {
    uploadPromisesByKey.delete(args.key)
    throw e
  }
}

const createGeoDatasetIntegration = (): MarkdownGeoDatasetIntegration => {
  return {
    renderGeoJsonFeatureCollection: req => {
      const text = String(req?.codeBlock?.text || '')
      const startLine = req?.codeBlock?.startLine || 1
      const documentPath = String(req?.sourceDocumentPath || '').trim() || 'document'
      const key = `${documentPath}:${startLine}:${hashString(text)}`
      return React.createElement(InlineMarkdownGeoJsonLayerMap, {
        geojsonText: text,
        datasetId: key,
        className: 'w-full h-[320px]',
      })
    },
    registerGeoJsonFeatureCollection: async req => {
      const text = String(req?.codeBlock?.text || '')
      const startLine = req?.codeBlock?.startLine || 1
      const documentPath = String(req?.sourceDocumentPath || '').trim() || 'document'

      let parsed: unknown = null
      try {
        parsed = JSON.parse(text)
      } catch {
        return { ok: false, error: 'Invalid JSON' }
      }
      if (!isFeatureCollection(parsed)) {
        return { ok: false, error: 'Expected GeoJSON FeatureCollection' }
      }

      const key = `${documentPath}:${startLine}:${hashString(text)}`
      const name = buildUploadName(documentPath, startLine)
      const url = await uploadGeoJsonText({ key, name, text })
      const label = buildDatasetLabel(documentPath, startLine)

      addGeospatialDatasetUrls([{ label, url, format: 'geojson' }])
      return { ok: true }
    },
    requestOpenGeoPanel: () => {
      emitSidePanelOpen({ tab: 'geo', open: true })
      setGeospatialModeEnabled(true)
    },
  }
}

type CuragrphBottomPanelMarkdownSectionProps = React.ComponentProps<typeof CuragrphBottomPanelMarkdownSection>

export function BottomPanelMarkdownSection(props: CuragrphBottomPanelMarkdownSectionProps) {
  const geoDatasetIntegration = React.useMemo(() => createGeoDatasetIntegration(), [])
  return React.createElement(CuragrphBottomPanelMarkdownSection, {
    ...props,
    geoDatasetIntegration,
  })
}
