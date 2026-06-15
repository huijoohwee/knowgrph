import React from 'react'
import { AtSign, FileAudio, FileCode2, ImageIcon, Slash, Video, type LucideIcon } from 'lucide-react'
import {
  KeyTypeValueHeader,
  KeyTypeValueRow,
  KeyTypeValueSectionStack,
} from '@/features/panels/ui/KeyTypeValueRow'
import {
  INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID,
  INLINE_SLASH_COMMAND_ACTIONS,
  INLINE_VARIABLE_COMMAND_ACTIONS,
  type InlineCommandMenuActionSpec,
} from '@/lib/command-menu/inlineCommandMenuCatalog'
import {
  type CommandMenuRichMediaItem,
  renameCommandMenuRichMediaMarkdownLine,
  useCommandMenuRichMediaInventory,
} from '@/lib/command-menu/commandMenuRichMediaInventory'
import { useGraphStore } from '@/hooks/useGraphStore'
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

function getMediaIcon(kind: CommandMenuRichMediaItem['kind']): LucideIcon {
  if (kind === 'audio') return FileAudio
  if (kind === 'image') return ImageIcon
  if (kind === 'iframe' || kind === 'webpage' || kind === 'tweet') return FileCode2
  return Video
}

function MediaCandidateThumb({ item }: { item: CommandMenuRichMediaItem }) {
  const thumbnail = item.thumbnailUrl || (item.kind === 'image' ? item.src || item.openUrl || '' : '')
  if (thumbnail) {
    return (
      <span className={cn('inline-flex h-8 w-14 shrink-0 overflow-hidden rounded-full border p-[2px] shadow-sm', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}>
        <img src={thumbnail} alt="" className="h-full w-full rounded-full object-cover" data-kg-command-menu-media-thumbnail="1" />
      </span>
    )
  }
  const Icon = getMediaIcon(item.kind)
  return (
    <span className={cn('inline-flex h-8 w-14 shrink-0 items-center justify-center rounded-full border shadow-sm', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}>
      <Icon className={cn('h-4 w-4', UI_THEME_TOKENS.text.tertiary)} strokeWidth={1.7} aria-hidden />
    </span>
  )
}

function MediaCandidateRow({
  item,
  onSelect,
  onRename,
}: {
  item: CommandMenuRichMediaItem
  onSelect: (item: CommandMenuRichMediaItem) => void
  onRename: (item: CommandMenuRichMediaItem, nextName: string) => void
}) {
  const Icon = getMediaIcon(item.kind)
  const source = item.source === 'graph' ? (item.panelTitle || 'Graph node media') : 'Markdown media'
  const description = item.openUrl || item.src || item.srcDoc || item.label
  return (
    <section
      className="block w-full cursor-pointer text-left"
      onClick={() => onSelect(item)}
      data-kg-command-menu-media-candidate={item.key}
      data-kg-command-menu-media-kind={item.kind}
      data-kg-command-menu-media-source={item.source}
    >
      <KeyTypeValueRow
        density="compact"
        align="start"
        keyNode={(
          <span className="flex min-w-0 items-center gap-2">
            <MediaCandidateThumb item={item} />
            <span className="flex min-w-0 flex-col leading-4">
              <MediaCandidateNameInput item={item} onRename={onRename} />
              <span className={cn('truncate font-mono text-[11px] font-normal', UI_THEME_TOKENS.text.tertiary)}>{item.kind}</span>
            </span>
          </span>
        )}
        typeNode={<CommandPrefixType Icon={Icon} label="@" title={`${item.kind} media`} />}
        valueNode={(
          <span className="flex min-w-0 flex-col leading-4">
            <span className={cn('truncate text-[11px]', UI_THEME_TOKENS.text.secondary)}>{source}</span>
            <span className={cn('truncate text-[11px]', UI_THEME_TOKENS.text.tertiary)} title={description}>
              {description}
            </span>
          </span>
        )}
      />
    </section>
  )
}

function MediaCandidateNameInput({
  item,
  onRename,
}: {
  item: CommandMenuRichMediaItem
  onRename: (item: CommandMenuRichMediaItem, nextName: string) => void
}) {
  const [draft, setDraft] = React.useState(item.label)
  React.useEffect(() => {
    setDraft(item.label)
  }, [item.label, item.key])

  const commitValue = React.useCallback((value: string) => {
    const next = String(value || '').trim()
    if (!next || next === item.label) {
      setDraft(item.label)
      return
    }
    onRename(item, next)
  }, [item, onRename])

  return (
    <input
      type="text"
      value={draft}
      aria-label={`Rename ${item.label}`}
      className={cn(
        'min-w-0 max-w-full truncate rounded border border-transparent bg-transparent px-1 py-0 text-xs font-semibold outline-none',
        UI_THEME_TOKENS.text.primary,
        'focus:border-[color:var(--kg-border)] focus:bg-[color:var(--kg-panel-bg)]',
      )}
      data-kg-command-menu-media-name-input={item.key}
      onClick={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
      onChange={event => setDraft(event.target.value)}
      onBlur={event => commitValue(event.currentTarget.value)}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commitValue(event.currentTarget.value)
          event.currentTarget.blur()
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          setDraft(item.label)
          event.currentTarget.blur()
        }
      }}
    />
  )
}

function MediaActionRow({ action }: { action: InlineCommandMenuActionSpec }) {
  const mediaKind = INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID[action.id as keyof typeof INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID]
  const Icon = mediaKind === 'video' ? Video : ImageIcon
  return (
    <section
      data-kg-command-menu-media-action={action.id}
      data-kg-command-menu-prefix="@"
    >
      <KeyTypeValueRow
        density="compact"
        align="start"
        keyNode={(
          <span className="flex min-w-0 flex-col leading-4">
            <span className={cn('truncate font-semibold', UI_THEME_TOKENS.text.primary)}>{action.label}</span>
            <span className={cn('truncate font-mono text-[11px] font-normal', UI_THEME_TOKENS.text.tertiary)}>{action.id}</span>
          </span>
        )}
        typeNode={<CommandPrefixType Icon={Icon} label="@" title="@ media command" />}
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

export function CommandMenuReferenceCatalog({
  className,
  title = 'Command Menu',
  subtitle = '/ and @ actions',
  compactHeader = false,
}: {
  className?: string
  title?: string
  subtitle?: string
  compactHeader?: boolean
}) {
  const panelTypography = usePanelTypography()
  return (
    <section className={cn('min-h-0 overflow-auto px-1 pb-2', panelTypography.panelTextClass, className)} aria-label="Command Menu" data-kg-command-menu-ktv-layout="1" data-kg-command-menu-reference-catalog="1">
      <header className={cn('mb-1 flex items-center justify-between gap-2 px-1 py-1', compactHeader ? '' : UI_THEME_TOKENS.panel.bg)}>
        <section className="min-w-0">
          <h2 className={cn('truncate text-xs font-semibold', UI_THEME_TOKENS.text.primary)}>{title}</h2>
          <p className={cn('truncate text-[10px]', UI_THEME_TOKENS.text.tertiary)}>{subtitle}</p>
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

export function CommandMenuCatalogPanel() {
  const panelTypography = usePanelTypography()
  const setActiveMediaKey = useGraphStore(s => s.setMarkdownPreviewActiveMediaKey)
  const setMermaidFocus = useGraphStore(s => s.setMarkdownPreviewMermaidFocus)
  const selectNode = useGraphStore(s => s.selectNode)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const updateNode = useGraphStore(s => s.updateNode)
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName)
  const markdownDocumentText = useGraphStore(s => s.markdownDocumentText || '')
  const setMarkdownDocument = useGraphStore(s => s.setMarkdownDocument)
  const { items } = useCommandMenuRichMediaInventory()
  const mediaItems = React.useMemo(
    () => items.filter(item => item.kind !== 'mermaid'),
    [items],
  )
  const mediaActions = React.useMemo(
    () => INLINE_VARIABLE_COMMAND_ACTIONS.filter(action => action.id === 'insert-image' || action.id === 'insert-video'),
    [],
  )
  const handleSelectMedia = React.useCallback((item: CommandMenuRichMediaItem) => {
    setMermaidFocus(null)
    setActiveMediaKey(item.key)
    if (item.source === 'graph' && item.nodeId) {
      setSelectionSource('toolbar')
      selectNode(item.nodeId)
    }
  }, [selectNode, setActiveMediaKey, setMermaidFocus, setSelectionSource])
  const handleRenameMedia = React.useCallback((item: CommandMenuRichMediaItem, nextName: string) => {
    const owner = item.renameOwner
    const name = String(nextName || '').trim()
    if (!owner || !name) return
    if (owner.type === 'graphNodeLabel') {
      updateNode(owner.nodeId, { label: name })
      return
    }
    const nextText = renameCommandMenuRichMediaMarkdownLine({
      markdownText: markdownDocumentText,
      item,
      nextName: name,
    })
    if (nextText === markdownDocumentText) return
    setMarkdownDocument(markdownDocumentName, nextText, { applyViewPreset: false })
  }, [markdownDocumentName, markdownDocumentText, setMarkdownDocument, updateNode])

  return (
    <section className={cn('h-full min-h-0 overflow-auto px-1 pb-2', panelTypography.panelTextClass)} aria-label="Command Menu" data-kg-command-menu-ktv-layout="1" data-kg-command-menu-media-panel="1">
      <header className={cn('mb-1 flex items-center justify-between gap-2 px-1 py-1', UI_THEME_TOKENS.panel.bg)}>
        <section className="min-w-0">
          <h2 className={cn('truncate text-xs font-semibold', UI_THEME_TOKENS.text.primary)}>Command Menu</h2>
          <p className={cn('truncate text-[10px]', UI_THEME_TOKENS.text.tertiary)}>@ image, audio, video, and rich media</p>
        </section>
        <section className="flex shrink-0 items-center gap-1" aria-label="Command prefixes">
          <span
            className={cn('inline-flex h-6 min-w-6 items-center justify-center rounded border px-1 text-xs font-semibold', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}
            title="@ media commands"
          >
            @
          </span>
        </section>
      </header>
      <section data-kg-command-menu-media-list="1">
        <KeyTypeValueHeader keyLabel="Media" typeLabel="Prefix" valueLabel="Source / action" stickyOffsetClassName="top-0" />
        <KeyTypeValueSectionStack>
          {mediaItems.map(item => (
            <MediaCandidateRow key={item.key} item={item} onSelect={handleSelectMedia} onRename={handleRenameMedia} />
          ))}
          {mediaActions.map(action => (
            <MediaActionRow key={action.id} action={action} />
          ))}
        </KeyTypeValueSectionStack>
      </section>
    </section>
  )
}

export default CommandMenuCatalogPanel
