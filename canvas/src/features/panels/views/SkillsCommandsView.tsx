import React from 'react'
import {
  AGENTIC_OS_BINDING_INVOCATIONS,
  AGENTIC_OS_COMMAND_INVOCATIONS,
  AGENTIC_OS_DOC_INVOCATIONS,
  type AgenticOsDictionaryInvocationKind,
} from '@/features/agentic-os/agenticOsDocInvocations'
import { renderAgenticOsInvocationKeywordChip } from '@/features/agentic-os/agenticOsInvocationChips'
import { CHAT_INVOCATION_OPTIONS } from '@/features/chat/chatInvocationRegistry'
import { CHAT_SKILL_OPTIONS } from '@/features/chat/chatSkillRegistry'
import {
  DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME,
  readInlineKeywordChipToneValue,
  resolveDataViewChipClass,
} from '@/features/markdown/ui/dataViewChipStyles'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MainPanelTypeIcon, resolveMainPanelInvocationSubjectIconKey } from '@/features/panels/ui/mainPanelHelpIconLibrary'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  FLOATING_PANEL_CATALOG_COMPACT_ROW_LAYOUT,
  floatingPanelCatalogCompactRowClassName,
  floatingPanelCatalogCompactRowMetaClassName,
  floatingPanelCatalogCompactRowTitleClassName,
} from '@/lib/ui/floatingPanelCatalogLayout'
import { UI_TEXT_TRUNCATE_CHIP } from '@/lib/ui/textLayout'
import { cn } from '@/lib/utils'

type SkillsCommandsViewProps = {
  prefixFilter?: SkillsCommandsPrefixFilter
  searchQuery?: string
}

const normalize = (value: unknown): string => String(value || '').trim().toLowerCase()
export type SkillsCommandsPrefixFilter = 'all' | 'at' | 'hash' | 'slash'
const SKILLS_COMMANDS_ICON_SLOT_CLASSNAME = 'kg-skill-command-icon inline-flex h-7 w-7 shrink-0 items-center justify-center'
const SKILLS_COMMANDS_ICON_GLYPH_CLASSNAME = 'kg-skill-command-icon-glyph'

type SkillsCommandsCatalogEntry = {
  id: string
  label: string
  token: string
  summary: string
  group: string
  kind: 'doc' | 'runtime' | 'skill' | AgenticOsDictionaryInvocationKind
  sourcePath?: string
  keywords: readonly string[]
}

const buildSkillsCommandsCatalog = (): readonly SkillsCommandsCatalogEntry[] => [
  ...CHAT_SKILL_OPTIONS.map(option => ({
    id: option.id,
    label: option.label,
    token: option.slashCommand,
    summary: option.summary,
    group: 'Chat skill',
    kind: 'skill' as const,
    keywords: option.keywords,
  })),
  ...AGENTIC_OS_COMMAND_INVOCATIONS.map(invocation => ({
    id: invocation.id,
    label: invocation.label,
    token: invocation.token,
    summary: invocation.summary,
    group: invocation.group,
    kind: invocation.kind,
    sourcePath: invocation.sourcePath,
    keywords: invocation.keywords,
  })),
  ...AGENTIC_OS_DOC_INVOCATIONS.map(doc => ({
    id: `doc:${doc.id}:slash`,
    label: doc.label,
    token: doc.slashCommand,
    summary: doc.summary,
    group: 'Agentic OS docs',
    kind: 'doc' as const,
    sourcePath: doc.sourcePath,
    keywords: [doc.hashToken, doc.atToken, ...doc.keywords],
  })),
  ...CHAT_INVOCATION_OPTIONS.map(option => ({
    id: `hash:${option.id}`,
    label: option.label,
    token: option.token,
    summary: option.summary,
    group: option.slashCommand && option.atToken
      ? 'Agentic OS docs'
      : option.sourcePath
        ? 'Agentic OS semantic dictionary'
        : 'Runtime invocation',
    kind: option.slashCommand && option.atToken ? 'doc' as const : option.sourcePath ? 'semantic' as const : 'runtime' as const,
    sourcePath: option.sourcePath,
    keywords: [option.slashCommand || '', option.atToken || '', option.toolName || '', ...option.keywords],
  })),
  ...AGENTIC_OS_BINDING_INVOCATIONS.map(invocation => ({
    id: invocation.id,
    label: invocation.label,
    token: invocation.token,
    summary: invocation.summary,
    group: invocation.group,
    kind: invocation.kind,
    sourcePath: invocation.sourcePath,
    keywords: invocation.keywords,
  })),
  ...AGENTIC_OS_DOC_INVOCATIONS.map(doc => ({
    id: `doc:${doc.id}:at`,
    label: doc.label,
    token: doc.atToken,
    summary: doc.summary,
    group: 'Agentic OS docs',
    kind: 'doc' as const,
    sourcePath: doc.sourcePath,
    keywords: [doc.slashCommand, doc.hashToken, ...doc.keywords],
  })),
]

const SKILLS_COMMANDS_CATALOG = buildSkillsCommandsCatalog()

const tokenPrefixDataAttribute = (entry: SkillsCommandsCatalogEntry): Record<string, string> => {
  if (entry.token.startsWith('/')) return { 'data-kg-skill-command-slash': entry.id }
  if (entry.token.startsWith('#')) return { 'data-kg-skill-command-hash': entry.id }
  if (entry.token.startsWith('@')) return { 'data-kg-skill-command-at': entry.id }
  return {}
}

const buildSkillsCommandsTokenChipClassName = (token: string): string => cn(
  DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME,
  'max-w-[9.5rem]',
  resolveDataViewChipClass(readInlineKeywordChipToneValue(token)),
)

function renderSkillsCommandsTokenChip(entry: SkillsCommandsCatalogEntry): React.ReactNode {
  const attrs = {
    ...tokenPrefixDataAttribute(entry),
    'data-kg-skill-command-token-chip': '1',
  }
  const className = buildSkillsCommandsTokenChipClassName(entry.token)
  const invocationChip = renderAgenticOsInvocationKeywordChip({ value: entry.token, className })
  if (React.isValidElement<{ className?: string }>(invocationChip)) {
    const chip = invocationChip as React.ReactElement<{ className?: string }>
    return React.cloneElement(chip, {
      ...attrs,
      className: cn(chip.props.className, 'shrink-0'),
    })
  }
  return (
    <span
      className={cn(className, 'shrink-0')}
      title={entry.token}
      data-kg-card-inline-keyword-pill="1"
      {...attrs}
    >
      <span className={UI_TEXT_TRUNCATE_CHIP}>{entry.token}</span>
    </span>
  )
}

function matchesSkillsCommandsPrefixFilter(entry: SkillsCommandsCatalogEntry, prefixFilter: SkillsCommandsPrefixFilter): boolean {
  if (prefixFilter === 'all') return true
  if (prefixFilter === 'slash') return entry.token.startsWith('/')
  if (prefixFilter === 'hash') return entry.token.startsWith('#')
  return entry.token.startsWith('@')
}

export default function SkillsCommandsView({ prefixFilter = 'all', searchQuery = '' }: SkillsCommandsViewProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const uiIconColorClass = useGraphStore(s => s.uiIconColorClass)
  const query = normalize(searchQuery)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const iconColorClass = uiIconColorClass && uiIconColorClass.trim().length > 0 ? uiIconColorClass : UI_THEME_TOKENS.icon.color
  const entries = React.useMemo(() => {
    const prefixEntries = SKILLS_COMMANDS_CATALOG.filter(option => matchesSkillsCommandsPrefixFilter(option, prefixFilter))
    if (!query) return prefixEntries
    return prefixEntries.filter(option => {
      const haystack = [
        option.label,
        option.token,
        option.summary,
        option.group,
        option.kind,
        option.sourcePath,
        ...option.keywords,
      ].map(normalize).join(' ')
      return haystack.includes(query)
    })
  }, [prefixFilter, query])

  return (
    <section
      className="min-h-0 pr-1"
      data-kg-floating-panel-skills-commands="true"
      data-kg-floating-panel-catalog-list="skills-commands"
      data-kg-floating-panel-skills-commands-prefix-filter={prefixFilter}
      aria-label="Skills & Commands"
    >
      <section className="grid min-w-0 gap-1" data-kg-floating-panel-catalog-list-rows={FLOATING_PANEL_CATALOG_COMPACT_ROW_LAYOUT}>
        {entries.map(option => {
          const iconKey = resolveMainPanelInvocationSubjectIconKey(option)
          const metaLabel = [option.group, option.summary, option.sourcePath].filter(Boolean).join(' | ')
          return (
            <article
              key={option.id}
              className={floatingPanelCatalogCompactRowClassName()}
              data-kg-floating-panel-catalog-row="skills-commands"
              data-kg-floating-panel-catalog-row-layout={FLOATING_PANEL_CATALOG_COMPACT_ROW_LAYOUT}
              data-kg-skill-command-row={option.id}
              data-kg-skill-command-kind={option.kind}
              data-kg-skill-command-token={option.token}
              data-kg-skill-command-icon-key={iconKey}
            >
              <span
                className={SKILLS_COMMANDS_ICON_SLOT_CLASSNAME}
                data-kg-skill-command-icon="1"
                data-kg-skill-command-icon-key={iconKey}
                data-kg-skill-command-icon-row={option.id}
                data-kg-skill-command-icon-token={option.token}
                data-kg-skill-command-icon-fidelity="toolbar"
                role="img"
                aria-label={`${option.label} icon`}
              >
                <MainPanelTypeIcon
                  iconKey={iconKey}
                  className={cn(SKILLS_COMMANDS_ICON_GLYPH_CLASSNAME, iconSizeClass, iconColorClass)}
                  strokeWidth={uiIconStrokeWidth}
                />
              </span>
              <section className="min-w-0" aria-label={`${option.label} invocation summary`}>
                <h3 className={floatingPanelCatalogCompactRowTitleClassName()} title={option.label}>
                  {option.label}
                </h3>
                <p className={floatingPanelCatalogCompactRowMetaClassName()} title={metaLabel}>
                  {option.group}
                </p>
              </section>
              {renderSkillsCommandsTokenChip(option)}
            </article>
          )
        })}
      </section>
    </section>
  )
}
