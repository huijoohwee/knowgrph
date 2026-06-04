import React from 'react'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import {
  uiToolbarAreaActionRowClassName,
  uiToolbarAreaCompactActionRowClassName,
  uiToolbarAreaInsetStackClassName,
  uiToolbarAreaStackClassName,
} from '@/features/toolbar/ui/toolbarStyles'
import { EXPORT_UI_LABELS, UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

interface ToolbarGraphFieldsAreaProps {
  graphFieldsOpOk: boolean | null
  graphFieldsOpMsg: string | null
  onExportGraphFieldSettingsJsonLd: () => void
  isExportMenuOpen: boolean
  setIsExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export function ToolbarGraphFieldsArea({
  graphFieldsOpOk,
  graphFieldsOpMsg,
  onExportGraphFieldSettingsJsonLd,
  isExportMenuOpen,
  setIsExportMenuOpen,
}: ToolbarGraphFieldsAreaProps) {
  return (
    <section className={uiToolbarAreaStackClassName}>
      {isExportMenuOpen && (
        <section className={uiToolbarAreaInsetStackClassName}>
          <section className={uiToolbarAreaCompactActionRowClassName}>
            <button
              type="button"
              className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={() => {
                onExportGraphFieldSettingsJsonLd()
                setIsExportMenuOpen(false)
              }}
            >
              {EXPORT_UI_LABELS.exportGraphFieldSettingsJsonLd}
            </button>
          </section>
        </section>
      )}
      <section className={uiToolbarAreaActionRowClassName}>
        <StatusBadge label={UI_LABELS.graphFields} ok={graphFieldsOpOk} msg={graphFieldsOpMsg || undefined} />
      </section>
    </section>
  )
}
