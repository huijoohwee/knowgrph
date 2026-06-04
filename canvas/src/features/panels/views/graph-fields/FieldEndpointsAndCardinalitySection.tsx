import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  UI_RESPONSIVE_GRAPH_FIELDS_COMFORTABLE_FIELD_INPUT_CLASSNAME,
  UI_RESPONSIVE_GRAPH_FIELDS_OWNER_VALUE_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import { GRAPH_FIELDS_COMPACT_FIELD_GRID_CLASS_NAME } from '@/features/panels/views/graph-fields/graphFieldResponsiveClasses'
import { PANEL_TYPOGRAPHY_DEFAULTS } from 'grph-shared/ui/panelTypography'

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
      PANEL_TYPOGRAPHY_DEFAULTS.keyValueInputClass,
  )

  const hasOwner = Boolean(String(ownerKey || '').trim())

  const [sourcesText, setSourcesText] = React.useState('')
  const [targetsText, setTargetsText] = React.useState('')
  const [minEdgesText, setMinEdgesText] = React.useState('')
  const [maxEdgesText, setMaxEdgesText] = React.useState('')
  const [maxPerNodeText, setMaxPerNodeText] = React.useState('')
  const panelClassName = `rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3 space-y-3`
  const headingClassName = `${uiPanelKeyValueTextSizeClass} font-semibold ${UI_THEME_TOKENS.text.primary}`
  const helperTextClassName = `${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`
  const sectionLabelClassName = `${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`
  const fieldLabelClassName = `block ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`
  const textInputClassName = `${UI_RESPONSIVE_GRAPH_FIELDS_COMFORTABLE_FIELD_INPUT_CLASSNAME} w-full rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} text-xs ${UI_THEME_TOKENS.input.text} ${UI_THEME_TOKENS.focus.primaryBorderRing}`
  const ownerValueClassName = `${UI_RESPONSIVE_GRAPH_FIELDS_OWNER_VALUE_CLASSNAME} text-xs ${UI_THEME_TOKENS.text.secondary}`

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
    <section className={panelClassName}>
      <section className={headingClassName}>
        {UI_COPY.endpointsAndCardinalityHeader}
      </section>

      {!hasOwner ? (
        <section className={helperTextClassName}>
          {UI_COPY.selectScopeToEditConstraints(scope)}
        </section>
      ) : (
        <section className="space-y-3">
          {scope === 'edge' ? (
            <section className="space-y-2">
              <section className={sectionLabelClassName}>
                {UI_COPY.endpointMatrixHeader}
              </section>
              <section className={GRAPH_FIELDS_COMPACT_FIELD_GRID_CLASS_NAME}>
                <section className="min-w-0">
                  <label className={fieldLabelClassName} htmlFor="graph-fields-endpoint-sources">
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
                    className={textInputClassName}
                  />
                </section>
                <section className="min-w-0">
                  <label className={fieldLabelClassName} htmlFor="graph-fields-endpoint-targets">
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
                    className={textInputClassName}
                  />
                </section>
              </section>
            </section>
          ) : null}

          {scope === 'node' ? (
            <section className="space-y-2">
              <section className={sectionLabelClassName}>
                {UI_COPY.edgesPerNodeTypeHeader}
              </section>
              <section className="flex items-center gap-2">
                <section className={ownerValueClassName}>{ownerKey}</section>
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
              </section>
            </section>
          ) : (
            <section className="space-y-2">
              <section className={sectionLabelClassName}>
                {UI_COPY.edgesPerLabelPerNodeHeader}
              </section>
              <section className="flex items-center gap-2">
                <section className={ownerValueClassName}>{ownerKey}</section>
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
              </section>
            </section>
          )}
        </section>
      )}
    </section>
  )
}
