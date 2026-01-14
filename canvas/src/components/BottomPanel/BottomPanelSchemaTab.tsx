import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MonacoTextEditor } from '@/features/monaco/MonacoTextEditor'

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
      <div className="flex-1 min-h-0 border border-gray-300 rounded overflow-hidden">
        <MonacoTextEditor
          value={schemaText}
          onChange={onSchemaTextChange}
          language="json"
          uri="inmemory://schema/editor"
          themeMode="light"
          wordWrap={false}
          className="w-full h-full"
        />
      </div>
    </div>
  )
}
