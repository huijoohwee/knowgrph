import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { KTV_SECTION_TITLE_CLASS_NAME } from '@/features/panels/ui/KeyTypeValueRow'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export const MAIN_PANEL_SECTION_HEADER_ROOT_CLASS_NAME =
  `mb-1 flex min-h-8 min-w-0 max-w-full items-center justify-between gap-1 ${UI_THEME_TOKENS.panel.bg}`

export const MAIN_PANEL_SECTION_HEADER_TITLE_CLASS_NAME =
  `min-w-0 flex-1 overflow-hidden ${KTV_SECTION_TITLE_CLASS_NAME}`

export const MAIN_PANEL_SECTION_HEADER_ACTIONS_CLASS_NAME =
  'flex shrink-0 flex-wrap items-center justify-end gap-1'

type MainPanelSectionHeaderProps = {
  title: React.ReactNode
  actions?: React.ReactNode
  ariaLabel?: string
  className?: string
  titleClassName?: string
  actionsClassName?: string
}

export default function MainPanelSectionHeader({
  title,
  actions,
  ariaLabel,
  className,
  titleClassName,
  actionsClassName,
}: MainPanelSectionHeaderProps) {
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )

  return (
    <header
      className={[
        MAIN_PANEL_SECTION_HEADER_ROOT_CLASS_NAME,
        uiPanelTextFontClass,
        className || '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={ariaLabel}
    >
      <section
        className={[
          MAIN_PANEL_SECTION_HEADER_TITLE_CLASS_NAME,
          titleClassName || '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {title}
      </section>
      {actions ? (
        <section
          className={[
            MAIN_PANEL_SECTION_HEADER_ACTIONS_CLASS_NAME,
            actionsClassName || '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {actions}
        </section>
      ) : null}
    </header>
  )
}
