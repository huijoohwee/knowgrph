import React from 'react'
import { AtSign, Slash, type LucideIcon } from 'lucide-react'
import {
  KeyTypeValueHeader,
  KeyTypeValueRow,
  KeyTypeValueSectionStack,
} from '@/features/panels/ui/KeyTypeValueRow'
import {
  INLINE_SLASH_COMMAND_ACTIONS,
  INLINE_VARIABLE_COMMAND_ACTIONS,
  type InlineCommandMenuActionSpec,
} from '@/lib/command-menu/inlineCommandMenuCatalog'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { cn } from '@/lib/utils'

const commandMenuCatalogGroups = [
  { key: 'slash', label: '/', title: 'Slash commands', Icon: Slash, actions: INLINE_SLASH_COMMAND_ACTIONS },
  { key: 'variable', label: '@', title: 'Variable commands', Icon: AtSign, actions: INLINE_VARIABLE_COMMAND_ACTIONS },
] as const

function CommandPrefixType({
  Icon,
  label,
  title,
}: {
  Icon: LucideIcon
  label: string
  title: string
}) {
  return (
    <span
      className="inline-flex min-w-0 max-w-full items-center justify-start gap-1 overflow-hidden sm:justify-end"
      title={title}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', UI_THEME_TOKENS.text.secondary)} strokeWidth={1.7} aria-hidden />
      <span className="shrink-0 font-mono text-[11px]">{label}</span>
      <span className={cn('min-w-0 truncate text-[11px]', UI_THEME_TOKENS.text.tertiary)}>{title}</span>
    </span>
  )
}

function CommandCatalogRow({
  action,
  Icon,
  prefix,
  title,
}: {
  action: InlineCommandMenuActionSpec
  Icon: LucideIcon
  prefix: string
  title: string
}) {
  return (
    <section
      data-kg-command-menu-action={action.id}
      data-kg-command-menu-prefix={prefix}
    >
      <KeyTypeValueRow
        density="compact"
        align="start"
        keyNode={(
          <span className="flex min-w-0 flex-col leading-4">
            <span className={cn('truncate font-semibold', action.danger ? 'text-red-600 dark:text-red-300' : UI_THEME_TOKENS.text.primary)}>
              {action.label}
            </span>
            <span className={cn('truncate font-mono text-[11px] font-normal', UI_THEME_TOKENS.text.tertiary)}>{action.id}</span>
          </span>
        )}
        typeNode={<CommandPrefixType Icon={Icon} label={prefix} title={title} />}
        valueNode={(
          <span className="flex min-w-0 flex-col leading-4">
            <span className={cn('truncate text-[11px]', UI_THEME_TOKENS.text.secondary)}>{action.group}</span>
            <span className={cn('truncate text-[11px]', UI_THEME_TOKENS.text.tertiary)} title={action.description}>
              {action.description}
            </span>
          </span>
        )}
      />
    </section>
  )
}

export function CommandMenuCatalogPanel() {
  const panelTypography = usePanelTypography()
  return (
    <section className={cn('h-full min-h-0 overflow-auto px-1 pb-2', panelTypography.panelTextClass)} aria-label="Command Menu" data-kg-command-menu-ktv-layout="1">
      <header className={cn('mb-1 flex items-center justify-between gap-2 px-1 py-1', UI_THEME_TOKENS.panel.bg)}>
        <section className="min-w-0">
          <h2 className={cn('truncate text-xs font-semibold', UI_THEME_TOKENS.text.primary)}>Command Menu</h2>
          <p className={cn('truncate text-[10px]', UI_THEME_TOKENS.text.tertiary)}>/ and @ actions</p>
        </section>
        <section className="flex shrink-0 items-center gap-1" aria-label="Command prefixes">
          {commandMenuCatalogGroups.map(group => (
            <span
              key={group.key}
              className={cn('inline-flex h-6 min-w-6 items-center justify-center rounded border px-1 text-xs font-semibold', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}
              title={group.title}
            >
              {group.label}
            </span>
          ))}
        </section>
      </header>
      <section data-kg-command-menu-catalog="1">
        <KeyTypeValueHeader keyLabel="Command" typeLabel="Prefix" valueLabel="Group / description" stickyOffsetClassName="top-0" />
        <KeyTypeValueSectionStack>
        {commandMenuCatalogGroups.map(group => (
          group.actions.map(action => (
            <CommandCatalogRow
              key={action.id}
              action={action}
              Icon={group.Icon}
              prefix={group.label}
              title={group.title}
            />
          ))
        ))}
        </KeyTypeValueSectionStack>
      </section>
    </section>
  )
}

export default CommandMenuCatalogPanel
