import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import type { JSONValue } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { parseJsonOrError } from '@/features/schema-editor/advancedSerialization'
import { UI_COPY } from '@/lib/config.copy'
import { MonacoTextEditor } from '@/features/monaco/MonacoTextEditor'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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
  const editorShellClassName = `w-full border ${UI_THEME_TOKENS.input.border} rounded overflow-hidden ${UI_THEME_TOKENS.panel.bg} h-[168px]`

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
    <div className={panelClassName}>
      <div className={headingClassName}>
        Templates
      </div>

      {!hasOwner ? (
        <div className={helperTextClassName}>
          Select a {scope === 'node' ? 'node type' : 'edge label'} to edit templates
        </div>
      ) : (
        <div className="space-y-2">
          <div className={labelClassName}>
            {scope === 'node'
              ? `${UI_COPY.graphFieldsScopeNodeLabel} ${UI_COPY.graphFieldsLocalSchemaFacetTemplateJsonLabel}`
              : `${UI_COPY.graphFieldsScopeEdgeLabel} ${UI_COPY.graphFieldsLocalSchemaFacetTemplateJsonLabel}`}
          </div>
          <div className={editorShellClassName}>
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
          </div>
          {error ? (
            <div className={`${uiPanelKeyValueTextSizeClass} text-red-600`}>
              {error}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
