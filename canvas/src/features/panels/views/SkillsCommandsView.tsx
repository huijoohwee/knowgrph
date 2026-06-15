import React from 'react'
import { CHAT_SKILL_OPTIONS } from '@/features/chat/chatSkillRegistry'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'

type SkillsCommandsViewProps = {
  searchQuery?: string
}

const normalize = (value: unknown): string => String(value || '').trim().toLowerCase()

export default function SkillsCommandsView({ searchQuery = '' }: SkillsCommandsViewProps) {
  const panelTypography = usePanelTypography()
  const query = normalize(searchQuery)
  const entries = React.useMemo(() => {
    if (!query) return CHAT_SKILL_OPTIONS
    return CHAT_SKILL_OPTIONS.filter(option => {
      const haystack = [
        option.label,
        option.slashCommand,
        option.summary,
        ...option.keywords,
      ].map(normalize).join(' ')
      return haystack.includes(query)
    })
  }, [query])

  return (
    <section
      className="h-full min-h-0 overflow-auto pr-1"
      data-kg-main-panel-skills-commands="true"
      aria-label="Skills & Commands"
    >
      <section className="space-y-2">
        {entries.map(option => (
          <article
            key={option.id}
            className={`rounded border p-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`}
            data-kg-skill-command-row={option.id}
          >
            <section className="flex items-center justify-between gap-2">
              <h3 className={`${panelTypography.panelTextClass} ${UI_THEME_TOKENS.text.primary}`}>
                {option.label}
              </h3>
              <code
                className={`rounded border px-1.5 py-0.5 ${panelTypography.monospaceTextClass} ${panelTypography.microLabelClass} ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.text.secondary}`}
                data-kg-skill-command-slash={option.id}
              >
                {option.slashCommand}
              </code>
            </section>
            <p className={`mt-1 ${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>
              {option.summary}
            </p>
          </article>
        ))}
      </section>
    </section>
  )
}
