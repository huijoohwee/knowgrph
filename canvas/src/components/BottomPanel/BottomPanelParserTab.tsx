import React from 'react'
import { useParserUIState } from '@/features/parsers/uiState'
import { AGENTIC_RAG_PARSER_DESCRIPTION } from '@/lib/config'
import {
  ParserSelectionSection,
  ParserDataSection,
} from '@/features/panels/views/ParserSections'
import GraphRagTextPipelineSection from '@/features/panels/views/GraphRagTextPipelineSection'
import type {
  ParserSelectionSectionProps,
  ParserDataSectionProps,
} from '@/features/panels/views/ParserSectionsModel'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MonacoTextEditor } from '@/features/monaco/MonacoTextEditor'

interface BottomPanelParserTabProps {
  parserScriptText: string
  parserError: string
  parserErrorHook: string
  parserUiEditorOpen: boolean
  parserSelectionProps: ParserSelectionSectionProps
  parserDataProps: ParserDataSectionProps
}

export default function BottomPanelParserTab({
  parserScriptText,
  parserError,
  parserErrorHook,
  parserUiEditorOpen,
  parserSelectionProps,
  parserDataProps,
}: BottomPanelParserTabProps) {
  const setScriptText = useParserUIState(s => s.setScriptText)
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )

  return (
    <div className="h-full min-h-0 flex flex-col overflow-auto">
      {(parserError || parserErrorHook) && (
        <div className={`py-1 ${uiPanelMicroLabelTextSizeClass} text-red-600`}>
          {parserError || parserErrorHook}
        </div>
      )}
      <div className="flex-1 min-h-0">
        {parserUiEditorOpen ? (
          <div className="h-full min-h-0 flex flex-col overflow-auto">
            <div className={`mt-2 mb-1 ${uiPanelMicroLabelTextSizeClass} text-gray-600`}>
              {AGENTIC_RAG_PARSER_DESCRIPTION}
            </div>
            <div className={`py-1 ${uiPanelKeyValueTextSizeClass} text-gray-600 space-y-3`}>
              <ParserSelectionSection {...parserSelectionProps} />
              <ParserDataSection {...parserDataProps} />
              <GraphRagTextPipelineSection />
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex-1 min-h-0 border border-gray-300 rounded overflow-hidden">
            <MonacoTextEditor
              value={parserScriptText}
              onChange={(val) => {
                setScriptText(val)
              }}
              language="python"
              uri="inmemory://parser/script"
              themeMode="light"
              wordWrap={false}
              className="w-full h-full"
            />
          </div>
        )}
      </div>
    </div>
  )
}
