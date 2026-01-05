import React from 'react'
import { SchemaTabContent } from '@/features/panels/views/ParserSchemaTabContent'
import { useGraphStore } from '@/hooks/useGraphStore'

interface SchemaUiEditorPaneProps {
  schemaError: string
  schemaUiStep31Collapsed: boolean
  schemaUiStep32Collapsed: boolean
  onToggleStep31: (next: boolean) => void
  onToggleStep32: (next: boolean) => void
  schemaUiStep33Collapsed: boolean
  onToggleStep33: (next: boolean) => void
  schemaUiStep332Collapsed: boolean
  onToggleStep332: (next: boolean) => void
}

export default function SchemaUiEditorPane({
  schemaError,
  schemaUiStep31Collapsed,
  schemaUiStep32Collapsed,
  onToggleStep31,
  onToggleStep32,
  schemaUiStep33Collapsed,
  onToggleStep33,
  schemaUiStep332Collapsed,
  onToggleStep332,
}: SchemaUiEditorPaneProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  return (
    <div className="h-full min-h-0 flex flex-col overflow-auto">
      <div
        className={[
          'py-2 text-gray-600 space-y-3',
          uiPanelKeyValueTextSizeClass,
          uiPanelTextFontClass,
        ].join(' ')}
      >
        <SchemaTabContent
          schemaError={schemaError}
          step31Collapsed={schemaUiStep31Collapsed}
          step32Collapsed={schemaUiStep32Collapsed}
          step33Collapsed={schemaUiStep33Collapsed}
          onToggleStep31={onToggleStep31}
          onToggleStep32={onToggleStep32}
          onToggleStep33={onToggleStep33}
          step332Collapsed={schemaUiStep332Collapsed}
          onToggleStep332={onToggleStep332}
        />
      </div>
    </div>
  )
}
