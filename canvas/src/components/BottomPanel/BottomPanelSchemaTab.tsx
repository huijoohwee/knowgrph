import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'

interface BottomPanelSchemaTabProps {
  schemaText: string
  schemaError: string
  onSchemaTextChange: (text: string) => void
}

export default function BottomPanelSchemaTab({
  schemaText,
  schemaError,
  onSchemaTextChange,
}: BottomPanelSchemaTabProps) {
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  return (
    <div className="h-full min-h-0 flex flex-col">
      {schemaError && (
        <div className={`mt-2 ${uiPanelMicroLabelTextSizeClass} text-red-600 shrink-0`}>
          {schemaError}
        </div>
      )}
      <textarea
        value={schemaText}
        onChange={e => onSchemaTextChange(e.target.value)}
        className={`w-full flex-1 min-h-0 px-2 py-2 border border-gray-300 rounded resize-none bg-transparent ${uiPanelMonospaceTextClass}`}
      />
    </div>
  )
}
