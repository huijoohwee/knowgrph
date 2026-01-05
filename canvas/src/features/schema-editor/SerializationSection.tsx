import React from 'react'
import type { JSONValue } from '@/lib/graph/types'
import Subsection from '@/features/schema-editor/ui/Subsection'
import { parseJsonOrError } from '@/features/schema-editor/advancedSerialization'

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

  return (
    <div className="space-y-3">
      <div className={`${uiPanelKeyValueTextSizeClass} font-semibold text-gray-700`}>Serialization</div>
      <Subsection title="Serialization">
        <div className="space-y-2">
          <div>
            <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700 mb-1`}>
              Predicates by Edge Label
            </div>
            <textarea
              rows={3}
              className={`w-full px-2 py-1 border border-gray-300 rounded text-xs bg-transparent ${uiPanelMonospaceTextClass}`}
              onBlur={e => {
                const { value, error } = parseJsonOrError(e.target.value)
                if (!error) {
                  setSerialization({ predicatesByLabel: value as Record<string, string> })
                  setSerializationError('')
                } else {
                  setSerializationError(error)
                }
              }}
            />
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
            <textarea
              rows={3}
              className={`w-full px-2 py-1 border border-gray-300 rounded text-xs bg-transparent ${uiPanelMonospaceTextClass}`}
              onBlur={e => {
                const { value, error } = parseJsonOrError(e.target.value)
                if (!error) {
                  setSerialization({ typesByNode: value as Record<string, string> })
                  setSerializationError('')
                } else {
                  setSerializationError(error)
                }
              }}
            />
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
            <textarea
              rows={4}
              className={`w-full px-2 py-1 border border-gray-300 rounded text-xs bg-transparent ${uiPanelMonospaceTextClass}`}
              onBlur={e => {
                const { value, error } = parseJsonOrError(e.target.value)
                if (!error) {
                  setSerialization({
                    context: value as Record<string, Record<string, JSONValue>>,
                  })
                  setSerializationError('')
                } else {
                  setSerializationError(error)
                }
              }}
            />
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
