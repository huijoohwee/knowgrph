import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import type { JSONValue } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type GraphLayerStyleMeta = {
  fill?: string
  stroke?: string
  dash?: string
  fillOpacity?: number
  strokeWidth?: number
}

type GraphLayerMetadata = {
  defaultStyle?: GraphLayerStyleMeta
  byOwnerType?: Record<string, GraphLayerStyleMeta>
  byPropertyKey?: Record<string, GraphLayerStyleMeta>
  groupingLogic?: string
  layer?: number
  label?: string
  tooltip?: string
  schemaDrivenStylingEntrypoint?: string
}

const isRecord = (val: unknown): val is Record<string, unknown> =>
  !!val && typeof val === 'object' && !Array.isArray(val)

type FieldGraphLayersSectionProps = {
  schema: GraphSchema
  scope: 'node' | 'edge'
  ownerKey: string
  fieldKey: string
  uiPanelKeyValueTextSizeClass: string
}

export function FieldGraphLayersSection({
  schema,
  scope,
  ownerKey,
  fieldKey,
  uiPanelKeyValueTextSizeClass,
}: FieldGraphLayersSectionProps) {
  const setSchema = useGraphStore(s => s.setSchema)
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass ||
      'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right',
  )

  const hasOwner = Boolean(String(ownerKey || '').trim())
  const hasFieldKey = Boolean(String(fieldKey || '').trim())

  let effective: GraphLayerStyleMeta = {}
  const metadata = schema && schema.metadata && isRecord(schema.metadata) ? schema.metadata : null
  const graphLayersRaw =
    metadata && Object.prototype.hasOwnProperty.call(metadata, 'canvas:graphLayers')
      ? (schema.metadata?.['canvas:graphLayers'] as JSONValue | undefined)
      : undefined

  if (graphLayersRaw && isRecord(graphLayersRaw)) {
    const meta = graphLayersRaw as unknown as GraphLayerMetadata
    const base = meta.defaultStyle && isRecord(meta.defaultStyle) ? (meta.defaultStyle as GraphLayerStyleMeta) : {}
    effective = { ...base }
    if (scope === 'node' && hasOwner && meta.byOwnerType && isRecord(meta.byOwnerType)) {
      const ownerStyleRaw = meta.byOwnerType[ownerKey]
      if (ownerStyleRaw && typeof ownerStyleRaw === 'object') {
        effective = { ...effective, ...(ownerStyleRaw as GraphLayerStyleMeta) }
      }
    }
    if (hasFieldKey && meta.byPropertyKey && isRecord(meta.byPropertyKey)) {
      const propStyleRaw = meta.byPropertyKey[fieldKey]
      if (propStyleRaw && typeof propStyleRaw === 'object') {
        effective = { ...effective, ...(propStyleRaw as GraphLayerStyleMeta) }
      }
    }
  }

  const fillValue = effective.fill ?? ''
  const strokeValue = effective.stroke ?? ''
  const dashValue = effective.dash ?? ''
  const opacityValue = typeof effective.fillOpacity === 'number' && Number.isFinite(effective.fillOpacity)
    ? String(effective.fillOpacity)
    : ''
  const strokeWidthValue = typeof effective.strokeWidth === 'number' && Number.isFinite(effective.strokeWidth)
    ? String(effective.strokeWidth)
    : ''

  const disabled = !hasOwner || !hasFieldKey || scope !== 'node'

  const updateStyle = (patch: Partial<GraphLayerStyleMeta>) => {
    if (!schema) return
    const baseMetaRaw = schema.metadata && isRecord(schema.metadata) ? schema.metadata : {}
    const nextMetadata: Record<string, JSONValue> = { ...baseMetaRaw } as Record<string, JSONValue>
    const graphLayersCurrentRaw =
      nextMetadata['canvas:graphLayers'] && isRecord(nextMetadata['canvas:graphLayers'])
        ? nextMetadata['canvas:graphLayers']
        : undefined
    const graphLayersMeta: GraphLayerMetadata =
      graphLayersCurrentRaw && isRecord(graphLayersCurrentRaw)
        ? (graphLayersCurrentRaw as unknown as GraphLayerMetadata)
        : {}
    const byPropertyKey: Record<string, GraphLayerStyleMeta> = graphLayersMeta.byPropertyKey
      ? { ...graphLayersMeta.byPropertyKey }
      : {}
    const currentForField = byPropertyKey[fieldKey] ? { ...byPropertyKey[fieldKey] } : {}
    const nextForField: GraphLayerStyleMeta = { ...currentForField, ...patch }
    byPropertyKey[fieldKey] = nextForField
    const nextGraphLayers: GraphLayerMetadata = {
      ...graphLayersMeta,
      byPropertyKey,
    }
    nextMetadata['canvas:graphLayers'] = nextGraphLayers as unknown as JSONValue
    setSchema({
      ...schema,
      metadata: nextMetadata,
    })
  }

  return (
    <div className="rounded border border-gray-200 bg-white p-3 space-y-3">
      <div className={`${uiPanelKeyValueTextSizeClass} font-semibold text-gray-800`}>
        Graph layer styling
      </div>
      {disabled ? (
        <div className={`${uiPanelKeyValueTextSizeClass} text-gray-500`}>
          Select a node property field to configure graph layer styling.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
                Fill color
              </div>
              <input
                type="text"
                defaultValue={fillValue}
                onBlur={e => updateStyle({ fill: e.target.value || undefined })}
                className={uiPanelKeyValueInputClass}
                disabled={disabled}
              />
            </div>
            <div className="min-w-0">
              <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
                Stroke color
              </div>
              <input
                type="text"
                defaultValue={strokeValue}
                onBlur={e => updateStyle({ stroke: e.target.value || undefined })}
                className={uiPanelKeyValueInputClass}
                disabled={disabled}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="min-w-0">
              <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
                Fill opacity
              </div>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                defaultValue={opacityValue}
                onBlur={e => {
                  const raw = e.target.value
                  const v = raw.trim() === '' ? undefined : Number.parseFloat(raw)
                  updateStyle({ fillOpacity: Number.isFinite(v as number) ? (v as number) : undefined })
                }}
                className={uiPanelKeyValueInputClass}
                disabled={disabled}
              />
            </div>
            <div className="min-w-0">
              <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
                Stroke width
              </div>
              <input
                type="number"
                min={0}
                max={10}
                step={0.25}
                defaultValue={strokeWidthValue}
                onBlur={e => {
                  const raw = e.target.value
                  const v = raw.trim() === '' ? undefined : Number.parseFloat(raw)
                  updateStyle({ strokeWidth: Number.isFinite(v as number) ? (v as number) : undefined })
                }}
                className={uiPanelKeyValueInputClass}
                disabled={disabled}
              />
            </div>
            <div className="min-w-0">
              <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
                Dash pattern
              </div>
              <input
                type="text"
                defaultValue={dashValue}
                onBlur={e => updateStyle({ dash: e.target.value || undefined })}
                className={uiPanelKeyValueInputClass}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type GraphLayerMetadataPresetsSectionProps = {
  schema: GraphSchema
  uiPanelKeyValueTextSizeClass: string
}

export function GraphLayerMetadataPresetsSection({
  schema,
  uiPanelKeyValueTextSizeClass,
}: GraphLayerMetadataPresetsSectionProps) {
  const setSchema = useGraphStore(s => s.setSchema)
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass ||
      'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right',
  )

  const metadata = schema && schema.metadata && isRecord(schema.metadata) ? schema.metadata : null
  const hasGraphLayersMeta =
    metadata && Object.prototype.hasOwnProperty.call(metadata, 'canvas:graphLayers')
  const graphLayersRaw = hasGraphLayersMeta
    ? (schema.metadata?.['canvas:graphLayers'] as JSONValue | undefined)
    : undefined

  let effective: GraphLayerStyleMeta = {}
  let meta: GraphLayerMetadata | null = null
  if (graphLayersRaw && isRecord(graphLayersRaw)) {
    const m = graphLayersRaw as unknown as GraphLayerMetadata
    meta = m
    if (m.defaultStyle && typeof m.defaultStyle === 'object') {
      effective = { ...(m.defaultStyle as GraphLayerStyleMeta) }
    }
  }

  const fillValue = effective.fill ?? ''
  const strokeValue = effective.stroke ?? ''
  const dashValue = effective.dash ?? ''
  const opacityValue = typeof effective.fillOpacity === 'number' && Number.isFinite(effective.fillOpacity)
    ? String(effective.fillOpacity)
    : ''
  const strokeWidthValue = typeof effective.strokeWidth === 'number' && Number.isFinite(effective.strokeWidth)
    ? String(effective.strokeWidth)
    : ''

  const groupingLogicValue =
    meta && typeof meta.groupingLogic === 'string' && meta.groupingLogic.trim()
      ? meta.groupingLogic
      : ''
  const layerValue =
    meta && typeof meta.layer === 'number' && Number.isFinite(meta.layer)
      ? String(meta.layer)
      : ''
  const labelValue = meta && typeof meta.label === 'string' ? meta.label : ''
  const tooltipValue = meta && typeof meta.tooltip === 'string' ? meta.tooltip : ''
  const schemaEntrypointValue =
    meta && typeof meta.schemaDrivenStylingEntrypoint === 'string'
      ? meta.schemaDrivenStylingEntrypoint
      : ''

  const updateMetadata = (patch: Partial<GraphLayerMetadata>) => {
    if (!schema) return
    const baseMetaRaw = schema.metadata && isRecord(schema.metadata) ? schema.metadata : {}
    const nextMetadata: Record<string, JSONValue> = { ...baseMetaRaw } as Record<string, JSONValue>
    const graphLayersCurrentRaw =
      nextMetadata['canvas:graphLayers'] && isRecord(nextMetadata['canvas:graphLayers'])
        ? nextMetadata['canvas:graphLayers']
        : undefined
    const graphLayersMeta: GraphLayerMetadata =
      graphLayersCurrentRaw && isRecord(graphLayersCurrentRaw)
        ? (graphLayersCurrentRaw as unknown as GraphLayerMetadata)
        : {}
    const nextGraphLayers: GraphLayerMetadata = {
      ...graphLayersMeta,
      ...patch,
    }
    nextMetadata['canvas:graphLayers'] = nextGraphLayers as unknown as JSONValue
    setSchema({
      ...schema,
      metadata: nextMetadata,
    })
  }

  const updateDefaultStyle = (patch: Partial<GraphLayerStyleMeta>) => {
    const currentDefault =
      meta && meta.defaultStyle
        ? { ...meta.defaultStyle }
        : {}
    const nextDefault: GraphLayerStyleMeta = { ...currentDefault, ...patch }
    updateMetadata({ defaultStyle: nextDefault })
  }

  return (
    <div className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3 space-y-3`}>
      <div className={`${uiPanelKeyValueTextSizeClass} font-semibold ${UI_THEME_TOKENS.text.primary}`}>
        Graph layer defaults
      </div>
      <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
        Configure default fill, stroke, opacity, and dash used by graph layers in both 2D and 3D views. Field-level overrides live in the schema extras panel.
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>
            Default fill color
          </div>
          <input
            type="text"
            defaultValue={fillValue}
            onBlur={e => updateDefaultStyle({ fill: e.target.value || undefined })}
            className={uiPanelKeyValueInputClass}
          />
        </div>
        <div className="min-w-0">
          <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>
            Default stroke color
          </div>
          <input
            type="text"
            defaultValue={strokeValue}
            onBlur={e => updateDefaultStyle({ stroke: e.target.value || undefined })}
            className={uiPanelKeyValueInputClass}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="min-w-0">
          <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>
            Default fill opacity
          </div>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            defaultValue={opacityValue}
            onBlur={e => {
              const raw = e.target.value
              const v = raw.trim() === '' ? undefined : Number.parseFloat(raw)
              updateDefaultStyle({ fillOpacity: Number.isFinite(v as number) ? (v as number) : undefined })
            }}
            className={uiPanelKeyValueInputClass}
          />
        </div>
        <div className="min-w-0">
          <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
            Default stroke width
          </div>
          <input
            type="number"
            min={0}
            max={10}
            step={0.25}
            defaultValue={strokeWidthValue}
            onBlur={e => {
              const raw = e.target.value
              const v = raw.trim() === '' ? undefined : Number.parseFloat(raw)
              updateDefaultStyle({ strokeWidth: Number.isFinite(v as number) ? (v as number) : undefined })
            }}
            className={uiPanelKeyValueInputClass}
          />
        </div>
        <div className="min-w-0">
          <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
            Default dash pattern
          </div>
          <input
            type="text"
            defaultValue={dashValue}
            onBlur={e => updateDefaultStyle({ dash: e.target.value || undefined })}
            className={uiPanelKeyValueInputClass}
          />
        </div>
      </div>
      <div className="border-t border-gray-100 pt-3 mt-2 space-y-2">
        <div className={`${uiPanelKeyValueTextSizeClass} font-semibold text-gray-800`}>
          Metadata
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
              Grouping logic
            </div>
            <input
              type="text"
              defaultValue={groupingLogicValue}
              onBlur={e => {
                const raw = e.target.value.trim()
                updateMetadata({ groupingLogic: raw || undefined })
              }}
              className={uiPanelKeyValueInputClass}
            />
          </div>
          <div className="min-w-0">
            <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
              Layer
            </div>
            <input
              type="number"
              defaultValue={layerValue}
              onBlur={e => {
                const raw = e.target.value
                const v = raw.trim() === '' ? undefined : Number.parseFloat(raw)
                updateMetadata({
                  layer: Number.isFinite(v as number) ? (v as number) : undefined,
                })
              }}
              className={uiPanelKeyValueInputClass}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
              Label
            </div>
            <input
              type="text"
              defaultValue={labelValue}
              onBlur={e => {
                const raw = e.target.value
                updateMetadata({ label: raw.trim() || undefined })
              }}
              className={uiPanelKeyValueInputClass}
            />
          </div>
          <div className="min-w-0">
            <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
              Tooltip
            </div>
            <input
              type="text"
              defaultValue={tooltipValue}
              onBlur={e => {
                const raw = e.target.value
                updateMetadata({ tooltip: raw.trim() || undefined })
              }}
              className={uiPanelKeyValueInputClass}
            />
          </div>
        </div>
        <div className="min-w-0">
          <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
            Schema styling entrypoint
          </div>
          <input
            type="text"
            defaultValue={schemaEntrypointValue}
            onBlur={e => {
              const raw = e.target.value
              updateMetadata({ schemaDrivenStylingEntrypoint: raw.trim() || undefined })
            }}
            className={uiPanelKeyValueInputClass}
          />
        </div>
      </div>
    </div>
  )
}

