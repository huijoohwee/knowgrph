import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'

type FieldEndpointsAndCardinalitySectionProps = {
  schema: GraphSchema
  scope: 'node' | 'edge'
  ownerKey: string
  uiPanelKeyValueTextSizeClass: string
}

function parseCsvList(text: string): string[] {
  return String(text || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

function parseOptionalInt(text: string): number | undefined {
  const t = String(text || '').trim()
  if (!t) return undefined
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : undefined
}

export default function FieldEndpointsAndCardinalitySection({
  schema,
  scope,
  ownerKey,
  uiPanelKeyValueTextSizeClass,
}: FieldEndpointsAndCardinalitySectionProps) {
  const { setEndpointMatrix, setCardinalityNodeType, setCardinalityEdgeLabel } = useGraphStore()
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass ||
      'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right',
  )

  const hasOwner = Boolean(String(ownerKey || '').trim())

  const [sourcesText, setSourcesText] = React.useState('')
  const [targetsText, setTargetsText] = React.useState('')
  const [minEdgesText, setMinEdgesText] = React.useState('')
  const [maxEdgesText, setMaxEdgesText] = React.useState('')
  const [maxPerNodeText, setMaxPerNodeText] = React.useState('')

  React.useEffect(() => {
    if (!hasOwner) {
      setSourcesText('')
      setTargetsText('')
      setMinEdgesText('')
      setMaxEdgesText('')
      setMaxPerNodeText('')
      return
    }

    const endpoints = schema.endpointMatrix?.[ownerKey]
    setSourcesText((endpoints?.sources ?? []).join(', '))
    setTargetsText((endpoints?.targets ?? []).join(', '))

    if (scope === 'node') {
      const card = schema.cardinality?.nodeType?.[ownerKey]
      setMinEdgesText(typeof card?.minEdges === 'number' ? String(card.minEdges) : '')
      setMaxEdgesText(typeof card?.maxEdges === 'number' ? String(card.maxEdges) : '')
      setMaxPerNodeText('')
    } else {
      const card = schema.cardinality?.edgeLabel?.[ownerKey]
      setMaxPerNodeText(typeof card?.maxPerNode === 'number' ? String(card.maxPerNode) : '')
      setMinEdgesText('')
      setMaxEdgesText('')
    }
  }, [hasOwner, ownerKey, schema, scope])

  return (
    <div className="rounded border border-gray-200 bg-white p-3 space-y-3">
      <div className={`${uiPanelKeyValueTextSizeClass} font-semibold text-gray-800`}>
        {UI_COPY.endpointsAndCardinalityHeader}
      </div>

      {!hasOwner ? (
        <div className={`${uiPanelKeyValueTextSizeClass} text-gray-500`}>
          {UI_COPY.selectScopeToEditConstraints(scope)}
        </div>
      ) : (
        <div className="space-y-3">
          {scope === 'edge' ? (
            <div className="space-y-2">
              <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
                {UI_COPY.endpointMatrixHeader}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <label className={`block ${uiPanelKeyValueTextSizeClass} text-gray-600`} htmlFor="graph-fields-endpoint-sources">
                    {UI_COPY.sourcesPlaceholder}
                  </label>
                  <input
                    id="graph-fields-endpoint-sources"
                    value={sourcesText}
                    onChange={e => setSourcesText(e.target.value)}
                    onBlur={() => {
                      const srcs = parseCsvList(sourcesText)
                      const curTargets = schema.endpointMatrix?.[ownerKey]?.targets ?? []
                      setEndpointMatrix(ownerKey, srcs, curTargets)
                    }}
                    className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-xs text-gray-800"
                  />
                </div>
                <div className="min-w-0">
                  <label className={`block ${uiPanelKeyValueTextSizeClass} text-gray-600`} htmlFor="graph-fields-endpoint-targets">
                    {UI_COPY.targetsPlaceholder}
                  </label>
                  <input
                    id="graph-fields-endpoint-targets"
                    value={targetsText}
                    onChange={e => setTargetsText(e.target.value)}
                    onBlur={() => {
                      const tgts = parseCsvList(targetsText)
                      const curSources = schema.endpointMatrix?.[ownerKey]?.sources ?? []
                      setEndpointMatrix(ownerKey, curSources, tgts)
                    }}
                    className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-xs text-gray-800"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {scope === 'node' ? (
            <div className="space-y-2">
              <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
                {UI_COPY.edgesPerNodeTypeHeader}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-40 truncate text-xs text-gray-700">{ownerKey}</div>
                <input
                  type="number"
                  min={0}
                  placeholder={UI_COPY.minPlaceholder}
                  value={minEdgesText}
                  onChange={e => setMinEdgesText(e.target.value)}
                  onBlur={() => {
                    setCardinalityNodeType(ownerKey, parseOptionalInt(minEdgesText), parseOptionalInt(maxEdgesText))
                  }}
                  className={uiPanelKeyValueInputClass}
                />
                <input
                  type="number"
                  min={0}
                  placeholder={UI_COPY.maxPlaceholder}
                  value={maxEdgesText}
                  onChange={e => setMaxEdgesText(e.target.value)}
                  onBlur={() => {
                    setCardinalityNodeType(ownerKey, parseOptionalInt(minEdgesText), parseOptionalInt(maxEdgesText))
                  }}
                  className={uiPanelKeyValueInputClass}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>
                {UI_COPY.edgesPerLabelPerNodeHeader}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-40 truncate text-xs text-gray-700">{ownerKey}</div>
                <input
                  type="number"
                  min={0}
                  placeholder={UI_COPY.maxPerNodePlaceholder}
                  value={maxPerNodeText}
                  onChange={e => setMaxPerNodeText(e.target.value)}
                  onBlur={() => {
                    setCardinalityEdgeLabel(ownerKey, parseOptionalInt(maxPerNodeText))
                  }}
                  className={uiPanelKeyValueInputClass}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
