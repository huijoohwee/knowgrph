import React from 'react'
import { useParserUIState } from '@/features/parsers/uiState'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import SchemaSummary from '@/features/panels/ui/SchemaSummary'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

interface SchemaStepCopyAndStatusProps {
  layout: 'workflow' | 'schema'
  renderActions?: (statusBadge: React.ReactNode) => React.ReactNode
  showSchemaInlineStatus?: boolean
  onOpenSchemaUiEditor?: () => void
}

export default function SchemaStepCopyAndStatus({
  layout,
  renderActions,
  showSchemaInlineStatus,
  onOpenSchemaUiEditor,
}: SchemaStepCopyAndStatusProps) {
  const dataLoadOk = useParserUIState(s => s.dataLoadOk)
  const dataLoadMsg = useParserUIState(s => s.dataLoadMsg)
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )

  const statusNode = (
    <StatusBadge
      label="Data"
      ok={dataLoadOk}
      msg={dataLoadMsg}
    />
  )

  if (layout === 'workflow') {
    return (
      <>
        {renderActions ? (
          renderActions(statusNode)
        ) : (
          <section className="flex items-center gap-2">
            {statusNode}
          </section>
        )}
        {showSchemaInlineStatus && (
          <section
            className={[
              `mt-1 ${UI_THEME_TOKENS.text.secondary}`,
              uiPanelMicroLabelTextSizeClass,
            ].join(' ')}
          >
            <SchemaSummary
              variant="inline"
              showTitle={false}
              showDataSummary={false}
              showLintSummary
              onOpenSchemaUiEditor={onOpenSchemaUiEditor}
            />
          </section>
        )}
      </>
    )
  }

  return (
    <section
      className={[
        `mt-1 flex flex-wrap items-center gap-2 ${UI_THEME_TOKENS.text.secondary}`,
        uiPanelMicroLabelTextSizeClass,
      ].join(' ')}
    >
      {renderActions ? renderActions(statusNode) : statusNode}
      {showSchemaInlineStatus && (
        <>
          <span className={UI_THEME_TOKENS.text.tertiary}>|</span>
          <SchemaSummary
            variant="inline"
            showTitle={false}
            showDataSummary={false}
            showLintSummary
            onOpenSchemaUiEditor={onOpenSchemaUiEditor}
          />
        </>
      )}
    </section>
  )
}
