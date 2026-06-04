import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import type { JSONValue } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { parseJsonOrError } from '@/features/schema-editor/advancedSerialization'
import { UI_COPY } from '@/lib/config.copy'
import { MonacoTextEditor } from '@/features/monaco/MonacoTextEditor'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_RESPONSIVE_GRAPH_FIELDS_TEMPLATE_EDITOR_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

type FieldTemplatesSectionProps = {
  schema: GraphSchema
  scope: 'node' | 'edge'
  ownerKey: string
  uiPanelKeyValueTextSizeClass: string
}

function isTemplateObject(v: unknown): v is Record<string, JSONValue> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export default function FieldTemplatesSection({
  schema,
  scope,
  ownerKey,
  uiPanelKeyValueTextSizeClass,
}: FieldTemplatesSectionProps) {
  const { setNodeTemplate, setEdgeTemplate } = useGraphStore()
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const panelClassName = `rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3 space-y-3`
  const headingClassName = `${uiPanelKeyValueTextSizeClass} font-semibold ${UI_THEME_TOKENS.text.primary}`
  const helperTextClassName = `${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`
  const labelClassName = `${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`
  const editorShellClassName = `${UI_RESPONSIVE_GRAPH_FIELDS_TEMPLATE_EDITOR_CLASSNAME} border ${UI_THEME_TOKENS.input.border} rounded ${UI_THEME_TOKENS.panel.bg}`

  const hasOwner = Boolean(String(ownerKey || '').trim())
  const template = scope === 'node'
    ? schema.templates?.node?.[ownerKey]
    : schema.templates?.edge?.[ownerKey]

  const [templateText, setTemplateText] = React.useState('{}')
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (!hasOwner) {
      setTemplateText('{}')
      setError('')
      return
    }
    try {
      setTemplateText(JSON.stringify(template ?? {}, null, 2))
    } catch {
      setTemplateText('{}')
    }
    setError('')
  }, [hasOwner, ownerKey, scope, template])

  return (
    <section className={panelClassName}>
      <section className={headingClassName}>
        Templates
      </section>

      {!hasOwner ? (
        <section className={helperTextClassName}>
          Select a {scope === 'node' ? 'node type' : 'edge label'} to edit templates
        </section>
      ) : (
        <section className="space-y-2">
          <section className={labelClassName}>
            {scope === 'node'
              ? `${UI_COPY.graphFieldsScopeNodeLabel} ${UI_COPY.graphFieldsLocalSchemaFacetTemplateJsonLabel}`
              : `${UI_COPY.graphFieldsScopeEdgeLabel} ${UI_COPY.graphFieldsLocalSchemaFacetTemplateJsonLabel}`}
          </section>
          <section className={editorShellClassName}>
            <MonacoTextEditor
              value={templateText}
              onChange={setTemplateText}
              language="json"
              uri={`inmemory://graph-fields/templates/${encodeURIComponent(scope)}/${encodeURIComponent(ownerKey)}`}
              themeMode="light"
              wordWrap={false}
              className={`w-full h-full ${uiPanelMonospaceTextClass}`}
              onBlur={() => {
                const { value, error: parseError } = parseJsonOrError(templateText)
                if (parseError) {
                  setError(parseError)
                  return
                }
                if (!isTemplateObject(value)) {
                  setError('Template must be a JSON object')
                  return
                }
                if (scope === 'node') setNodeTemplate(ownerKey, value)
                else setEdgeTemplate(ownerKey, value)
                setError('')
              }}
            />
          </section>
          {error ? (
            <section className={`${uiPanelKeyValueTextSizeClass} text-red-600`}>
              {error}
            </section>
          ) : null}
        </section>
      )}
    </section>
  )
}
