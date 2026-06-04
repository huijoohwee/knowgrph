import React from 'react'
import type { JSONValue } from '@/lib/graph/types'
import Subsection from '@/features/schema-editor/ui/Subsection'
import { parseJsonOrError } from '@/features/schema-editor/advancedSerialization'
import { MonacoTextEditor } from '@/features/monaco/MonacoTextEditor'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  UI_RESPONSIVE_SCHEMA_EDITOR_SERIALIZATION_COMPACT_EDITOR_CLASSNAME,
  UI_RESPONSIVE_SCHEMA_EDITOR_SERIALIZATION_EDITOR_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'

type SerializationSectionProps = {
  uiPanelKeyValueTextSizeClass: string
  uiPanelMonospaceTextClass: string
  uiPanelMicroLabelTextSizeClass: string
  setSerialization: (patch: {
    predicatesByLabel?: Record<string, string>
    typesByNode?: Record<string, string>
    context?: Record<string, Record<string, JSONValue>>
  }) => void
}

export default function SerializationSection({
  uiPanelKeyValueTextSizeClass,
  uiPanelMonospaceTextClass,
  uiPanelMicroLabelTextSizeClass,
  setSerialization,
}: SerializationSectionProps) {
  const [serializationError, setSerializationError] = React.useState('')
  const [predicatesText, setPredicatesText] = React.useState('{}')
  const [typesText, setTypesText] = React.useState('{}')
  const [contextText, setContextText] = React.useState('{}')
  const sectionHeadingClassName = `${uiPanelKeyValueTextSizeClass} font-semibold ${UI_THEME_TOKENS.text.secondary}`
  const fieldLabelClassName = `${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.secondary} mb-1`
  const editorShellClassName = `w-full border ${UI_THEME_TOKENS.input.border} rounded overflow-hidden ${UI_THEME_TOKENS.panel.bg}`

  return (
    <section className="space-y-3">
      <section className={sectionHeadingClassName}>Serialization</section>
      <Subsection title="Serialization">
        <section className="space-y-2">
          <section>
            <section className={fieldLabelClassName}>
              Predicates by Edge Label
            </section>
            <section className={`${editorShellClassName} ${UI_RESPONSIVE_SCHEMA_EDITOR_SERIALIZATION_COMPACT_EDITOR_CLASSNAME}`}>
              <MonacoTextEditor
                value={predicatesText}
                onChange={setPredicatesText}
                language="json"
                uri="inmemory://schema/serialization/predicatesByLabel"
                themeMode="light"
                wordWrap={false}
                className={`w-full h-full ${uiPanelMonospaceTextClass}`}
                onBlur={() => {
                  const { value, error } = parseJsonOrError(predicatesText)
                  if (!error) {
                    setSerialization({ predicatesByLabel: value as Record<string, string> })
                    setSerializationError('')
                    return
                  }
                  setSerializationError(error)
                }}
              />
            </section>
            {serializationError && (
              <section className={`mt-1 ${uiPanelMicroLabelTextSizeClass} text-red-600`}>
                {serializationError}
              </section>
            )}
          </section>
          <section>
            <section className={fieldLabelClassName}>
              Types by Node
            </section>
            <section className={`${editorShellClassName} ${UI_RESPONSIVE_SCHEMA_EDITOR_SERIALIZATION_COMPACT_EDITOR_CLASSNAME}`}>
              <MonacoTextEditor
                value={typesText}
                onChange={setTypesText}
                language="json"
                uri="inmemory://schema/serialization/typesByNode"
                themeMode="light"
                wordWrap={false}
                className={`w-full h-full ${uiPanelMonospaceTextClass}`}
                onBlur={() => {
                  const { value, error } = parseJsonOrError(typesText)
                  if (!error) {
                    setSerialization({ typesByNode: value as Record<string, string> })
                    setSerializationError('')
                    return
                  }
                  setSerializationError(error)
                }}
              />
            </section>
            {serializationError && (
              <section className={`mt-1 ${uiPanelMicroLabelTextSizeClass} text-red-600`}>
                {serializationError}
              </section>
            )}
          </section>
          <section>
            <section className={fieldLabelClassName}>
              JSON-LD Context
            </section>
            <section className={`${editorShellClassName} ${UI_RESPONSIVE_SCHEMA_EDITOR_SERIALIZATION_EDITOR_CLASSNAME}`}>
              <MonacoTextEditor
                value={contextText}
                onChange={setContextText}
                language="json"
                uri="inmemory://schema/serialization/context"
                themeMode="light"
                wordWrap={false}
                className={`w-full h-full ${uiPanelMonospaceTextClass}`}
                onBlur={() => {
                  const { value, error } = parseJsonOrError(contextText)
                  if (!error) {
                    setSerialization({
                      context: value as Record<string, Record<string, JSONValue>>,
                    })
                    setSerializationError('')
                    return
                  }
                  setSerializationError(error)
                }}
              />
            </section>
            {serializationError && (
              <section className={`mt-1 ${uiPanelMicroLabelTextSizeClass} text-red-600`}>
                {serializationError}
              </section>
            )}
          </section>
        </section>
      </Subsection>
    </section>
  )
}
