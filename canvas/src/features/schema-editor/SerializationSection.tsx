import React from 'react'
import type { JSONValue } from '@/lib/graph/types'
import Subsection from '@/features/schema-editor/ui/Subsection'
import { parseJsonOrError } from '@/features/schema-editor/advancedSerialization'
import { MonacoTextEditor } from '@/features/monaco/MonacoTextEditor'

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

  return (
    <div className="space-y-3">
      <div className={`${uiPanelKeyValueTextSizeClass} font-semibold text-gray-700`}>Serialization</div>
      <Subsection title="Serialization">
        <div className="space-y-2">
          <div>
            <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700 mb-1`}>
              Predicates by Edge Label
            </div>
            <div className="w-full border border-gray-300 rounded overflow-hidden bg-white h-[92px]">
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
            </div>
            {serializationError && (
              <div className={`mt-1 ${uiPanelMicroLabelTextSizeClass} text-red-600`}>
                {serializationError}
              </div>
            )}
          </div>
          <div>
            <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700 mb-1`}>
              Types by Node
            </div>
            <div className="w-full border border-gray-300 rounded overflow-hidden bg-white h-[92px]">
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
            </div>
            {serializationError && (
              <div className={`mt-1 ${uiPanelMicroLabelTextSizeClass} text-red-600`}>
                {serializationError}
              </div>
            )}
          </div>
          <div>
            <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700 mb-1`}>
              JSON-LD Context
            </div>
            <div className="w-full border border-gray-300 rounded overflow-hidden bg-white h-[120px]">
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
            </div>
            {serializationError && (
              <div className={`mt-1 ${uiPanelMicroLabelTextSizeClass} text-red-600`}>
                {serializationError}
              </div>
            )}
          </div>
        </div>
      </Subsection>
    </div>
  )
}
