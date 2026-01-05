import React from 'react'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import { useGraphStore } from '@/hooks/useGraphStore'
import { EXPORT_UI_LABELS } from '@/lib/config'

interface ToolbarCuratorAreaProps {
  dataLoadOk: boolean | null
  dataLoadMsg: string
  isExportMenuOpen: boolean
  setIsExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  onExportGraphJsonLd: () => void
  onExportGraphJson: () => void
  onExportGraphCsvCombined: () => void
  onExportGraphMl: () => void
  onExportGraphCypher: () => void
  onCopyGraphJsonLd?: () => void
  onCopyGraphJson?: () => void
  hasSelection: boolean
  onExportSelectionJsonLd?: () => void
  onExportSelectionJson?: () => void
  onExportSelectionCsvCombined?: () => void
  onExportSelectionGraphMl?: () => void
  onExportSelectionCypher?: () => void
}

export function ToolbarCuratorArea({
  dataLoadOk,
  dataLoadMsg,
  isExportMenuOpen,
  setIsExportMenuOpen,
  onExportGraphJsonLd,
  onExportGraphJson,
  onExportGraphCsvCombined,
  onExportGraphMl,
  onExportGraphCypher,
  onCopyGraphJsonLd,
  onCopyGraphJson,
  hasSelection,
  onExportSelectionJsonLd,
  onExportSelectionJson,
  onExportSelectionCsvCombined,
  onExportSelectionGraphMl,
  onExportSelectionCypher,
}: ToolbarCuratorAreaProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )

  return (
    <div className="flex flex-col gap-1">
      {isExportMenuOpen && (
        <div className="flex flex-col gap-1 px-1">
          <div className="flex flex-wrap items-center justify-end gap-1">
            <button
              type="button"
              className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-blue-600 text-white`}
              onClick={() => {
                onExportGraphJson()
                setIsExportMenuOpen(false)
              }}
            >
              Graph JSON (default)
            </button>
            <button
              type="button"
              className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700`}
              onClick={() => {
                onExportGraphJsonLd()
                setIsExportMenuOpen(false)
              }}
            >
              Graph JSON-LD (AgenticRAG)
            </button>
            {onCopyGraphJsonLd && (
              <button
                type="button"
                className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700`}
                onClick={() => {
                  onCopyGraphJsonLd()
                  setIsExportMenuOpen(false)
                }}
              >
                {EXPORT_UI_LABELS.copyGraphJsonLd}
              </button>
            )}
            <button
              type="button"
              className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700`}
              onClick={() => {
                onExportGraphCsvCombined()
                setIsExportMenuOpen(false)
              }}
            >
              Graph CSV Combined
            </button>
            {onCopyGraphJson && (
              <button
                type="button"
                className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700`}
                onClick={() => {
                  onCopyGraphJson()
                  setIsExportMenuOpen(false)
                }}
              >
                {EXPORT_UI_LABELS.copyGraphJson}
              </button>
            )}
            <button
              type="button"
              className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700`}
              onClick={() => {
                onExportGraphMl()
                setIsExportMenuOpen(false)
              }}
            >
              GraphML
            </button>
            <button
              type="button"
              className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700`}
              onClick={() => {
                onExportGraphCypher()
                setIsExportMenuOpen(false)
              }}
            >
              Graph Cypher
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <button
              type="button"
              className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed`}
              onClick={() => {
                if (onExportSelectionJsonLd) {
                  onExportSelectionJsonLd()
                }
                setIsExportMenuOpen(false)
              }}
              disabled={!hasSelection || !onExportSelectionJsonLd}
            >
              Selection JSON-LD (AgenticRAG)
            </button>
            <button
              type="button"
              className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed`}
              onClick={() => {
                if (onExportSelectionJson) {
                  onExportSelectionJson()
                }
                setIsExportMenuOpen(false)
              }}
              disabled={!hasSelection || !onExportSelectionJson}
            >
              Selection JSON
            </button>
            <button
              type="button"
              className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed`}
              onClick={() => {
                if (onExportSelectionCsvCombined) {
                  onExportSelectionCsvCombined()
                }
                setIsExportMenuOpen(false)
              }}
              disabled={!hasSelection || !onExportSelectionCsvCombined}
            >
              Selection CSV Combined
            </button>
            <button
              type="button"
              className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed`}
              onClick={() => {
                if (onExportSelectionGraphMl) {
                  onExportSelectionGraphMl()
                }
                setIsExportMenuOpen(false)
              }}
              disabled={!hasSelection || !onExportSelectionGraphMl}
            >
              Selection GraphML
            </button>
            <button
              type="button"
              className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed`}
              onClick={() => {
                if (onExportSelectionCypher) {
                  onExportSelectionCypher()
                }
                setIsExportMenuOpen(false)
              }}
              disabled={!hasSelection || !onExportSelectionCypher}
            >
              Selection Cypher
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        <StatusBadge
          label="Data"
          ok={dataLoadOk}
          msg={dataLoadMsg}
          below
        />
      </div>
    </div>
  )
}
