import React from 'react'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import {
  uiToolbarAreaActionRowClassName,
  uiToolbarAreaCompactActionRowClassName,
  uiToolbarAreaInsetStackClassName,
  uiToolbarAreaStackClassName,
} from '@/features/toolbar/ui/toolbarStyles'
import { UI_LABELS } from '@/lib/config'
import { applySchemaUiSnapshotIfNeeded } from '@/features/schema-editor/utils'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

interface ToolbarSchemaConfigAreaProps {
  schemaOpOk: boolean | null
  schemaOpMsg: string | null
  isExportMenuOpen: boolean
  setIsExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  onExportSchemaJson: () => void
  onExportSchemaJsonLd: () => void
  onExportSchemaCsv: () => void
  onCopySchemaJsonLd?: () => void
  onCopySchemaJson?: () => void
  onOpenWorkflowTab: () => void
}

export function ToolbarSchemaConfigArea({
  schemaOpOk,
  schemaOpMsg,
  isExportMenuOpen,
  setIsExportMenuOpen,
  onExportSchemaJson,
  onExportSchemaJsonLd,
  onExportSchemaCsv,
  onCopySchemaJsonLd,
  onCopySchemaJson,
  onOpenWorkflowTab,
}: ToolbarSchemaConfigAreaProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const neutralToolbarButtonClassName = `App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg}`
  const primaryToolbarButtonClassName = `App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.button.primarySolid}`
  return (
    <section className={uiToolbarAreaStackClassName}>
      {isExportMenuOpen && (
        <section className={uiToolbarAreaInsetStackClassName}>
          <section className={uiToolbarAreaCompactActionRowClassName}>
            <button
              type="button"
              className={primaryToolbarButtonClassName}
              onClick={() => {
                try {
                  applySchemaUiSnapshotIfNeeded()
                } catch {
                  void 0
                }
                try {
                  onExportSchemaJson()
                } catch {
                  void 0
                }
                setIsExportMenuOpen(false)
                onOpenWorkflowTab()
              }}
            >
              Schema JSON (default)
            </button>
            <button
              type="button"
              className={neutralToolbarButtonClassName}
              onClick={() => {
                try {
                  applySchemaUiSnapshotIfNeeded()
                } catch {
                  void 0
                }
                try {
                  onExportSchemaJsonLd()
                } catch {
                  void 0
                }
                setIsExportMenuOpen(false)
                onOpenWorkflowTab()
              }}
            >
              Schema JSON-LD (AgenticRAG)
            </button>
            <button
              type="button"
              className={neutralToolbarButtonClassName}
              onClick={() => {
                try {
                  applySchemaUiSnapshotIfNeeded()
                } catch {
                  void 0
                }
                try {
                  onExportSchemaCsv()
                } catch {
                  void 0
                }
                setIsExportMenuOpen(false)
                onOpenWorkflowTab()
              }}
            >
              Schema CSV
            </button>
          </section>
          <section className={uiToolbarAreaCompactActionRowClassName}>
            {onCopySchemaJsonLd && (
              <button
                type="button"
                className={neutralToolbarButtonClassName}
                onClick={() => {
                  try {
                    onCopySchemaJsonLd()
                  } catch {
                    void 0
                  }
                  setIsExportMenuOpen(false)
                  onOpenWorkflowTab()
                }}
              >
                Copy Schema JSON-LD (AgenticRAG)
              </button>
            )}
            {onCopySchemaJson && (
              <button
                type="button"
                className={neutralToolbarButtonClassName}
                onClick={() => {
                  try {
                    onCopySchemaJson()
                  } catch {
                    void 0
                  }
                  setIsExportMenuOpen(false)
                  onOpenWorkflowTab()
                }}
              >
                Copy Schema JSON
              </button>
            )}
          </section>
        </section>
      )}
      <section className={uiToolbarAreaActionRowClassName}>
        <StatusBadge label={UI_LABELS.schemaConfigurator} ok={schemaOpOk} msg={schemaOpMsg || undefined} />
      </section>
    </section>
  )
}
