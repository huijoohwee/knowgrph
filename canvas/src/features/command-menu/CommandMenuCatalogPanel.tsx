import React from 'react'
import { AtSign, Grid2X2, Hash, ImageIcon, List, Pencil, Slash, Trash2, Upload, Video, type LucideIcon } from 'lucide-react'
import { useCanvasKeyTypeValueStaticRowProps } from '@/features/panels/ui/canvasKeyTypeValueRuntime'
import {
  KeyTypeValueHeader,
  KeyTypeValueSectionStack,
} from 'grph-shared/react/keyTypeValueLayout'
import { KeyTypeValueStaticRow } from 'grph-shared/react/keyTypeValueRow'
import {
  INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID,
  INLINE_KEYWORD_COMMAND_ACTIONS,
  INLINE_SLASH_COMMAND_ACTIONS,
  INLINE_VARIABLE_COMMAND_ACTIONS,
  type InlineCommandMenuActionSpec,
} from '@/lib/command-menu/inlineCommandMenuCatalog'
import {
  type CommandMenuRichMediaItem,
  renameCommandMenuRichMediaMarkdownHref,
  useCommandMenuRichMediaInventory,
} from '@/lib/command-menu/commandMenuRichMediaInventory'
import {
  readCommandMenuMediaNameDraft,
  useCommandMenuMediaNameDrafts,
  writeCommandMenuMediaNameDraft,
} from '@/lib/command-menu/commandMenuMediaNameSync'
import { useGraphStore } from '@/hooks/useGraphStore'
import { writeWorkspaceSourceTextIfPresent } from '@/hooks/store/graph-data-slice/graphDataFrontmatterFlowSync'
import {
  deleteUploadedMediaFromKnowgrphStorage,
  listUploadedMediaFromKnowgrphStorage,
  renameUploadedMediaInKnowgrphStorage,
  type UploadedMediaStorageResult,
} from '@/lib/storage/uploadedMediaStorage'
import {
  buildUploadedMediaPanelItemFromStorage,
  buildUploadedMediaPanelItemId,
  mergeUploadedMediaPanelItems,
  readStoredUploadedMediaPanelItems,
  readUploadedMediaFileName,
  readUploadedMediaPanelDedupeKey,
  UPLOADED_MEDIA_PANEL_ITEMS_CHANGED_EVENT,
  writeStoredUploadedMediaPanelItems,
  type UploadedMediaPanelItem,
} from '@/lib/storage/uploadedMediaPanelItems'
import { uploadFilesToUploadedMediaPanel } from '@/lib/storage/uploadedMediaPanelUpload'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { ResponsiveInlineIconBadge } from '@/lib/ui/ResponsiveInlineIconBadge'
import { MediaLightbox } from '@/lib/ui/MediaLightbox'
import { MediaDownloadOverlay, MediaInfoOverlay, MediaKindOverlay, MediaOpenLinkOverlay } from '@/lib/ui/MediaKindOverlay'
import { resolveMediaKindOverlayIcon } from '@/lib/ui/mediaKindOverlayIcon'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'
import { UI_INLINE_CHIP_GROUP_CLASSNAME } from '@/lib/ui/textLayout'
import { cn } from '@/lib/utils'
import { insertMediaIntoActiveCardInlineTextEditor } from '@/lib/cards/cardInlineTextExternalCommands'

const commandMenuCatalogGroups = [
  { key: 'slash', label: '/', title: 'Slash commands', Icon: Slash, actions: INLINE_SLASH_COMMAND_ACTIONS },
  { key: 'variable', label: '@', title: 'Variable commands', Icon: AtSign, actions: INLINE_VARIABLE_COMMAND_ACTIONS },
  { key: 'keyword', label: '#', title: 'Keyword commands', Icon: Hash, actions: INLINE_KEYWORD_COMMAND_ACTIONS },
] as const

type MediaCatalogLayout = 'grid' | 'list'
type UploadedMediaDescriptionDrafts = Record<string, string>
type UploadedMediaFieldDrafts = Record<string, string>

const MEDIA_CATALOG_LAYOUT_STORAGE_KEY = 'kg.media.catalog.layout'
const MEDIA_DESCRIPTION_STORAGE_KEY = 'kg.media.descriptions'
const MEDIA_FIELDS_STORAGE_KEY = 'kg.media.fields'

function readStoredMediaCatalogLayout(): MediaCatalogLayout {
  try {
    const raw = globalThis.localStorage?.getItem(MEDIA_CATALOG_LAYOUT_STORAGE_KEY)
    return raw === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

function writeStoredMediaCatalogLayout(layout: MediaCatalogLayout): void {
  try {
    globalThis.localStorage?.setItem(MEDIA_CATALOG_LAYOUT_STORAGE_KEY, layout)
  } catch {
    void 0
  }
}

function readStoredMediaDescriptionDrafts(): UploadedMediaDescriptionDrafts {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(MEDIA_DESCRIPTION_STORAGE_KEY) || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value || '')]))
  } catch {
    return {}
  }
}

function writeStoredMediaDescriptionDrafts(drafts: UploadedMediaDescriptionDrafts): void {
  try {
    globalThis.localStorage?.setItem(MEDIA_DESCRIPTION_STORAGE_KEY, JSON.stringify(drafts))
  } catch {
    void 0
  }
}

function readStoredMediaFieldDrafts(): UploadedMediaFieldDrafts {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(MEDIA_FIELDS_STORAGE_KEY) || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value || '')]))
  } catch {
    return {}
  }
}

function writeStoredMediaFieldDrafts(drafts: UploadedMediaFieldDrafts): void {
  try {
    globalThis.localStorage?.setItem(MEDIA_FIELDS_STORAGE_KEY, JSON.stringify(drafts))
  } catch {
    void 0
  }
}

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
  compactStaticRowProps,
}: {
  action: InlineCommandMenuActionSpec
  Icon: LucideIcon
  prefix: string
  title: string
  compactStaticRowProps: Pick<
    React.ComponentProps<typeof KeyTypeValueStaticRow>,
    'textSizeClassName' | 'fontClassName' | 'densityClassName' | 'activeClassName'
  >
}) {
  return (
    <section
      data-kg-command-menu-action={action.id}
      data-kg-command-menu-prefix={prefix}
    >
      <KeyTypeValueStaticRow
        {...compactStaticRowProps}
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

const isMediaRowControlTarget = (target: EventTarget | null): boolean => {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false
  return !!target.closest('a, button, input, textarea, select, [data-kg-media-row-control="1"]')
}

const shouldHandleMediaRowPointer = (event: React.PointerEvent<HTMLElement>): boolean =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && !isMediaRowControlTarget(event.target)

const readRichMediaInsertUrl = (item: CommandMenuRichMediaItem): string =>
  String(item.openUrl || item.src || item.thumbnailUrl || '').trim()

const isOpenableMediaHref = (value: string): boolean =>
  /^(https?:|blob:|data:|\/|\.\/|\.\.\/|docs\/)/i.test(value.trim())

function readRichMediaOpenHref(item: CommandMenuRichMediaItem): string {
  const candidates = [item.openUrl, item.src, item.thumbnailUrl]
  for (const candidate of candidates) {
    const href = String(candidate || '').trim()
    if (href && isOpenableMediaHref(href)) return href
  }
  return ''
}

function getMediaNameSyncKey(item: CommandMenuRichMediaItem): string {
  const owner = item.renameOwner
  if (owner?.type === 'markdownLine') return String(owner.href || '').trim()
  return String(item.openUrl || item.src || '').trim()
}

const MEDIA_LIST_THUMBNAIL_COLUMN_CLASSNAME = 'grid-cols-[6.875rem_minmax(0,1fr)]'
const MEDIA_LIST_THUMBNAIL_FRAME_CLASSNAME = 'group relative inline-flex h-[4.625rem] w-[6.475rem] shrink-0 overflow-visible rounded border p-[2px] shadow-sm'

function mediaListThumbnailFrameClassName(extraClassName?: string): string {
  return cn(
    MEDIA_LIST_THUMBNAIL_FRAME_CLASSNAME,
    UI_THEME_TOKENS.panel.border,
    UI_THEME_TOKENS.input.bg,
    extraClassName,
  )
}

function MediaListThumbnailIconFrame({ Icon, label, infoLabel }: { Icon: LucideIcon; label: string; infoLabel?: string }) {
  return (
    <span className={mediaListThumbnailFrameClassName('items-center justify-center')}>
      <MediaKindOverlay Icon={Icon} label={label} appearance="hover" />
      <MediaInfoOverlay label={infoLabel || label} appearance="hover" />
      <Icon className={cn('h-4 w-4', UI_THEME_TOKENS.text.tertiary)} strokeWidth={1.7} aria-hidden />
    </span>
  )
}

function MediaCandidateThumb({ item }: { item: CommandMenuRichMediaItem }) {
  const thumbnail = item.thumbnailUrl || (item.kind === 'image' ? item.src || item.openUrl || '' : '')
  const openHref = readRichMediaOpenHref(item)
  if (thumbnail) {
    return (
      <span className={mediaListThumbnailFrameClassName()}>
        <MediaKindOverlay Icon={resolveMediaKindOverlayIcon(item.kind)} label={item.kind} appearance="hover" />
        <MediaInfoOverlay label={getCommandMenuMediaDescription(item)} appearance="hover" />
        <MediaOpenLinkOverlay href={openHref} appearance="hover" />
        <img src={thumbnail} alt="" className="h-full w-full rounded object-cover" data-kg-command-menu-media-thumbnail="1" />
      </span>
    )
  }
  const Icon = resolveMediaKindOverlayIcon(item.kind)
  return <MediaListThumbnailIconFrame Icon={Icon} label={item.kind} infoLabel={getCommandMenuMediaDescription(item)} />
}

function MediaCandidatePreview({ item }: { item: CommandMenuRichMediaItem }) {
  const thumbnail = item.thumbnailUrl || (item.kind === 'image' ? item.src || item.openUrl || '' : '')
  const Icon = resolveMediaKindOverlayIcon(item.kind)
  const openHref = readRichMediaOpenHref(item)
  if (thumbnail) {
    return (
      <figure className={cn('group relative m-0 aspect-[16/9] w-full overflow-hidden border-b', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}>
        <MediaKindOverlay Icon={Icon} label={item.kind} appearance="hover" />
        <MediaInfoOverlay label={getCommandMenuMediaDescription(item)} appearance="hover" />
        <MediaOpenLinkOverlay href={openHref} appearance="hover" />
        <img src={thumbnail} alt="" className="h-full w-full object-cover" data-kg-command-menu-media-thumbnail="1" loading="lazy" draggable={false} />
      </figure>
    )
  }
  return (
    <figure className={cn('group relative m-0 grid aspect-[16/9] w-full place-items-center border-b', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}>
      <MediaKindOverlay Icon={Icon} label={item.kind} appearance="hover" />
      <MediaInfoOverlay label={getCommandMenuMediaDescription(item)} appearance="hover" />
      <MediaOpenLinkOverlay href={openHref} appearance="hover" />
      <Icon className={cn('h-7 w-7', UI_THEME_TOKENS.text.tertiary)} strokeWidth={1.7} aria-hidden />
    </figure>
  )
}

function UploadedMediaPreview({
  item,
  infoLabel,
  onPreview,
}: {
  item: UploadedMediaPanelItem
  infoLabel: string
  onPreview: (item: UploadedMediaPanelItem) => void
}) {
  const Icon = resolveMediaKindOverlayIcon(item.kind)
  return (
    <button
      type="button"
      className={cn('group relative m-0 grid aspect-[16/9] w-full cursor-zoom-in place-items-center overflow-hidden border-x-0 border-b border-t-0 p-0 text-left', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}
      title={`Preview ${item.name}`}
      aria-label={`Preview ${item.name}`}
      data-kg-media-thumbnail-fullscreen={item.id}
      data-kg-media-row-control="1"
      onPointerDown={event => event.stopPropagation()}
      onClick={event => {
        event.stopPropagation()
        onPreview(item)
      }}
    >
      <MediaKindOverlay Icon={Icon} label={item.kind} appearance="hover" />
      <MediaInfoOverlay label={infoLabel} appearance="hover" />
      <MediaOpenLinkOverlay href={item.linkUrl} appearance="hover" />
      <MediaDownloadOverlay href={item.linkUrl} kind={item.kind} appearance="hover" />
      {item.kind === 'image' ? (
        <img src={item.linkUrl} alt="" className="h-full w-full object-cover" data-kg-command-menu-media-thumbnail="1" loading="lazy" draggable={false} />
      ) : (
        <Icon className={cn('h-7 w-7', UI_THEME_TOKENS.text.tertiary)} strokeWidth={1.7} aria-hidden />
      )}
    </button>
  )
}

function mediaCardClassName(): string {
  return cn(
    'min-w-0 overflow-hidden rounded border text-left shadow-sm transition-colors',
    UI_THEME_TOKENS.panel.border,
    UI_THEME_TOKENS.panel.bg,
    UI_THEME_TOKENS.button.hoverBg,
  )
}

function mediaListItemClassName(): string {
  return cn(
    'grid min-w-0 cursor-pointer gap-2 rounded border p-2 text-left shadow-sm transition-colors',
    MEDIA_LIST_THUMBNAIL_COLUMN_CLASSNAME,
    UI_THEME_TOKENS.panel.border,
    UI_THEME_TOKENS.panel.bg,
    UI_THEME_TOKENS.button.hoverBg,
  )
}

function getCommandMenuMediaSourceLabel(item: CommandMenuRichMediaItem): string {
  return item.source === 'graph' ? (item.panelTitle || 'Graph node media') : 'Markdown media'
}

function getCommandMenuMediaDescription(item: CommandMenuRichMediaItem): string {
  return item.openUrl || item.src || item.srcDoc || item.label
}

function getUploadedMediaDescriptionKey(item: UploadedMediaPanelItem): string {
  return String(item.storage?.contentHash || item.id || readUploadedMediaPanelDedupeKey(item)).trim()
}

function buildUploadedMediaDescriptionFallback(item: UploadedMediaPanelItem): string {
  const name = String(item.name || '').trim()
  const kind = item.kind.charAt(0).toUpperCase() + item.kind.slice(1)
  return name ? `${kind} media: ${name}` : `${kind} media description`
}

function readUploadedMediaDescription(
  drafts: UploadedMediaDescriptionDrafts,
  item: UploadedMediaPanelItem,
): string {
  return String(drafts[getUploadedMediaDescriptionKey(item)] || '').trim() || buildUploadedMediaDescriptionFallback(item)
}

function readUploadedMediaFieldText(
  drafts: UploadedMediaFieldDrafts,
  item: UploadedMediaPanelItem,
): string {
  return String(drafts[getUploadedMediaDescriptionKey(item)] || '').trim() || buildUploadedMediaDefaultFieldTokens(item).join(' ')
}

function normalizeUploadedMediaFieldText(value: string): string {
  return String(value || '')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean)
    .map(token => {
      const normalized = token.startsWith('#') ? token : `#${token}`
      return normalized.replace(/[^#A-Za-z0-9-]/g, '-').replace(/-{2,}/g, '-')
    })
    .filter(token => /^#[A-Za-z0-9][A-Za-z0-9-]*$/.test(token))
    .join(' ')
}

function buildUploadedMediaInfoLabel(item: UploadedMediaPanelItem): string {
  const storage = item.storage?.response.storage
  if (storage) return `R2 ${storage.r2}; D1 ${storage.d1}; KV ${storage.kv}; DO ${storage.durableObject}`
  if (item.status === 'uploading') return 'Uploading to runtime storage'
  return item.error || 'Local preview; runtime sync disabled or unavailable'
}

function buildUploadedMediaDefaultFieldTokens(item: UploadedMediaPanelItem): string[] {
  const tags = new Set<string>([`#${item.kind}`])
  const contentType = String(item.contentType || '').toLowerCase()
  const extension = String(item.name || '').split('.').pop()?.toLowerCase() || ''
  const format = extension && extension !== item.name.toLowerCase()
    ? extension
    : contentType.split('/').pop() || ''
  if (format) tags.add(`#${format.replace(/[^a-z0-9-]/g, '-')}`)
  tags.add(item.status === 'synced' ? '#synced' : item.status === 'uploading' ? '#uploading' : '#local')
  const storage = item.storage?.response.storage
  if (storage?.r2 === 'confirmed') tags.add('#r2')
  if (storage?.d1 === 'persisted') tags.add('#d1')
  if (item.sizeBytes > 0) tags.add(`#${Math.ceil(item.sizeBytes / 1024)}kb`)
  return Array.from(tags).slice(0, 6)
}

function UploadedMediaDescriptionInput({
  item,
  description,
  onDescriptionChange,
  className,
}: {
  item: UploadedMediaPanelItem
  description: string
  onDescriptionChange: (item: UploadedMediaPanelItem, nextDescription: string) => void
  className?: string
}) {
  return (
    <input
      type="text"
      value={description}
      placeholder="Add media description"
      aria-label={`Describe ${item.name}`}
      className={cn(
        'min-w-0 max-w-full truncate rounded border border-transparent bg-transparent px-1 py-0 text-[11px] outline-none',
        '!inline-block',
        UI_THEME_TOKENS.text.secondary,
        'focus:border-[color:var(--kg-border)] focus:bg-[color:var(--kg-panel-bg)]',
        className,
      )}
      data-kg-media-description-input={item.id}
      data-kg-media-row-control="1"
      style={{ display: 'inline-block' }}
      onClick={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
      onChange={event => onDescriptionChange(item, event.target.value)}
      onInput={event => onDescriptionChange(item, event.currentTarget.value)}
    />
  )
}

function UploadedMediaInlineFieldEditor({
  item,
  value,
  onChange,
  className,
}: {
  item: UploadedMediaPanelItem
  value: string
  onChange: (item: UploadedMediaPanelItem, nextValue: string) => void
  className?: string
}) {
  const [editing, setEditing] = React.useState(false)
  const normalizedValue = normalizeUploadedMediaFieldText(value)
  const commit = (nextValue: string) => {
    onChange(item, normalizeUploadedMediaFieldText(nextValue))
    setEditing(false)
  }
  if (editing) {
    return (
      <input
        type="text"
        value={value}
        aria-label={`Edit # metadata for ${item.name}`}
        className={cn(
          'min-w-[7rem] max-w-full flex-1 truncate rounded border border-transparent bg-transparent px-1 py-0 font-mono text-[10px] outline-none',
          UI_THEME_TOKENS.text.tertiary,
          'focus:border-[color:var(--kg-border)] focus:bg-[color:var(--kg-panel-bg)]',
          className,
        )}
        data-kg-media-field-input={item.id}
        data-kg-media-row-control="1"
        onClick={event => event.stopPropagation()}
        onPointerDown={event => event.stopPropagation()}
        onChange={event => onChange(item, event.target.value)}
        onInput={event => onChange(item, event.currentTarget.value)}
        onBlur={event => commit(event.currentTarget.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit(event.currentTarget.value)
            event.currentTarget.blur()
            return
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            setEditing(false)
            event.currentTarget.blur()
          }
        }}
        autoFocus
      />
    )
  }
  return (
    <button
      type="button"
      className={cn(
        UI_INLINE_CHIP_GROUP_CLASSNAME,
        'border-0 bg-transparent p-0 text-left align-baseline',
        UI_THEME_TOKENS.text.tertiary,
        className,
      )}
      title={`Edit # metadata: ${normalizedValue}`}
      aria-label={`Edit # metadata for ${item.name}`}
      data-kg-media-field-tags-inline="1"
      data-kg-media-row-control="1"
      onPointerDown={event => event.stopPropagation()}
      onClick={event => {
        event.stopPropagation()
        setEditing(true)
      }}
    >
      {renderMarkdownSigilInlineText(normalizedValue)}
    </button>
  )
}

function MediaCandidateRow({
  item,
  displayName,
  onSelect,
  onNameDraftChange,
  onRename,
}: {
  item: CommandMenuRichMediaItem
  displayName: string
  onSelect: (item: CommandMenuRichMediaItem) => void
  onNameDraftChange: (item: CommandMenuRichMediaItem, nextName: string) => void
  onRename: (item: CommandMenuRichMediaItem, nextName: string) => void
}) {
  const source = getCommandMenuMediaSourceLabel(item)
  const description = getCommandMenuMediaDescription(item)
  return (
    <article
      role="button"
      tabIndex={0}
      className={mediaListItemClassName()}
      onPointerDownCapture={event => {
        if (!shouldHandleMediaRowPointer(event)) return
        event.preventDefault()
        event.stopPropagation()
        onSelect(item)
      }}
      onClick={event => {
        if (event.detail !== 0 || isMediaRowControlTarget(event.target)) return
        onSelect(item)
      }}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onSelect(item)
      }}
      data-kg-command-menu-media-candidate={item.key}
      data-kg-command-menu-media-kind={item.kind}
      data-kg-command-menu-media-source={item.source}
      data-kg-media-list-row-layout="3-rows"
    >
      <MediaCandidateThumb item={item} />
      <section className="grid min-w-0 grid-rows-[auto_auto_auto] gap-1" aria-label={`${displayName} media summary`}>
        <header className="flex min-w-0 items-center justify-between gap-2" data-kg-media-list-row-section="title">
          <MediaCandidateNameEditor
            item={item}
            displayName={displayName}
            onDraftChange={onNameDraftChange}
            onRename={onRename}
          />
          <span className={cn('shrink-0 font-mono text-[10px]', UI_THEME_TOKENS.text.tertiary)}>@</span>
        </header>
        <section className="flex min-w-0 items-center gap-1" data-kg-media-list-row-section="meta">
          <span className={cn('min-w-0 truncate text-[11px]', UI_THEME_TOKENS.text.secondary)} title={source}>{source}</span>
        </section>
        <p className={cn('m-0 truncate text-[11px]', UI_THEME_TOKENS.text.tertiary)} title={description} data-kg-media-list-row-section="description">
          {description}
        </p>
      </section>
    </article>
  )
}

function MediaCandidateCard({
  item,
  displayName,
  onSelect,
  onNameDraftChange,
  onRename,
}: {
  item: CommandMenuRichMediaItem
  displayName: string
  onSelect: (item: CommandMenuRichMediaItem) => void
  onNameDraftChange: (item: CommandMenuRichMediaItem, nextName: string) => void
  onRename: (item: CommandMenuRichMediaItem, nextName: string) => void
}) {
  const Icon = resolveMediaKindOverlayIcon(item.kind)
  const source = getCommandMenuMediaSourceLabel(item)
  const description = getCommandMenuMediaDescription(item)
  return (
    <article
      role="button"
      tabIndex={0}
      className={mediaCardClassName()}
      onPointerDownCapture={event => {
        if (!shouldHandleMediaRowPointer(event)) return
        event.preventDefault()
        event.stopPropagation()
        onSelect(item)
      }}
      onClick={event => {
        if (event.detail !== 0 || isMediaRowControlTarget(event.target)) return
        onSelect(item)
      }}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onSelect(item)
      }}
      data-kg-command-menu-media-candidate={item.key}
      data-kg-command-menu-media-kind={item.kind}
      data-kg-command-menu-media-source={item.source}
    >
      <MediaCandidatePreview item={item} />
      <header className="min-w-0 px-2 pt-2">
        <MediaCandidateNameEditor
          item={item}
          displayName={displayName}
          onDraftChange={onNameDraftChange}
          onRename={onRename}
        />
      </header>
      <section className="min-w-0 px-2 pt-1">
        <p className={cn('m-0 mt-2 truncate text-[11px]', UI_THEME_TOKENS.text.secondary)} title={source}>{source}</p>
        <p className={cn('m-0 mt-1 line-clamp-2 text-[11px] leading-4', UI_THEME_TOKENS.text.tertiary)} title={description}>{description}</p>
      </section>
      <footer className={cn('mt-2 flex items-center justify-between gap-2 border-t px-2 py-2', UI_THEME_TOKENS.panel.border)}>
        <span className={cn('truncate font-mono text-[10px]', UI_THEME_TOKENS.text.tertiary)}>{item.source}</span>
        <span className={cn('font-mono text-[10px]', UI_THEME_TOKENS.text.tertiary)}>@</span>
      </footer>
    </article>
  )
}

function MediaCandidateNameEditor({
  item,
  displayName,
  onDraftChange,
  onRename,
}: {
  item: CommandMenuRichMediaItem
  displayName: string
  onDraftChange: (item: CommandMenuRichMediaItem, nextName: string) => void
  onRename: (item: CommandMenuRichMediaItem, nextName: string) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const commitValue = React.useCallback((value: string) => {
    const next = String(value || '').trim()
    if (!next) {
      onDraftChange(item, item.label)
      setEditing(false)
      return
    }
    if (next === item.label) {
      setEditing(false)
      return
    }
    onRename(item, next)
    setEditing(false)
  }, [item, onDraftChange, onRename])

  if (!editing) {
    return (
      <span className="flex min-w-0 items-center gap-1">
        <span
          className={cn('min-w-0 truncate px-1 text-xs font-semibold', UI_THEME_TOKENS.text.primary)}
          title={displayName}
          data-kg-command-menu-media-name-text={item.key}
        >
          {displayName}
        </span>
        <button
          type="button"
          className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border opacity-70 hover:opacity-100', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}
          title={`Rename ${displayName}`}
          aria-label={`Rename ${displayName}`}
          data-kg-command-menu-media-rename={item.key}
          data-kg-media-row-control="1"
          onPointerDown={event => event.stopPropagation()}
          onClick={event => {
            event.stopPropagation()
            setEditing(true)
          }}
        >
          <Pencil className="h-3 w-3" strokeWidth={1.7} aria-hidden />
        </button>
      </span>
    )
  }

  return (
    <input
      type="text"
      value={displayName}
      aria-label={`Rename ${displayName}`}
      className={cn(
        'min-w-0 max-w-full truncate rounded border border-transparent bg-transparent px-1 py-0 text-xs font-semibold outline-none',
        UI_THEME_TOKENS.text.primary,
        'focus:border-[color:var(--kg-border)] focus:bg-[color:var(--kg-panel-bg)]',
      )}
      data-kg-command-menu-media-name-input={item.key}
      data-kg-media-row-control="1"
      onClick={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
      onChange={event => onDraftChange(item, event.target.value)}
      onInput={event => onDraftChange(item, event.currentTarget.value)}
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
          onDraftChange(item, item.label)
          setEditing(false)
          event.currentTarget.blur()
        }
      }}
      autoFocus
    />
  )
}

function MediaActionRow({
  action,
  onSelect,
}: {
  action: InlineCommandMenuActionSpec
  onSelect: (action: InlineCommandMenuActionSpec) => void
}) {
  const mediaKind = INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID[action.id as keyof typeof INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID]
  const Icon = mediaKind === 'video' ? Video : ImageIcon
  return (
    <article
      role="button"
      tabIndex={0}
      className={mediaListItemClassName()}
      data-kg-command-menu-media-action={action.id}
      data-kg-command-menu-prefix="@"
      data-kg-media-list-row-layout="3-rows"
      onPointerDownCapture={event => {
        if (!shouldHandleMediaRowPointer(event)) return
        event.preventDefault()
        event.stopPropagation()
        onSelect(action)
      }}
      onClick={event => {
        if (event.detail !== 0 || isMediaRowControlTarget(event.target)) return
        onSelect(action)
      }}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onSelect(action)
      }}
    >
      <MediaListThumbnailIconFrame Icon={Icon} label={mediaKind || 'media'} infoLabel={action.description} />
      <section className="grid min-w-0 grid-rows-[auto_auto_auto] gap-1" aria-label={`${action.label} action summary`}>
        <header className="flex min-w-0 items-center justify-between gap-2" data-kg-media-list-row-section="title">
          <span className={cn('truncate text-xs font-semibold', UI_THEME_TOKENS.text.primary)}>{action.label}</span>
          <span className={cn('shrink-0 font-mono text-[10px]', UI_THEME_TOKENS.text.tertiary)}>@</span>
        </header>
        <section className="flex min-w-0 items-center gap-1" data-kg-media-list-row-section="meta">
          <span className={cn('min-w-0 truncate text-[11px]', UI_THEME_TOKENS.text.secondary)}>{action.group}</span>
        </section>
        <p className={cn('m-0 truncate text-[11px]', UI_THEME_TOKENS.text.tertiary)} title={action.description} data-kg-media-list-row-section="description">
          {action.description}
        </p>
      </section>
    </article>
  )
}

function MediaActionCard({
  action,
  onSelect,
}: {
  action: InlineCommandMenuActionSpec
  onSelect: (action: InlineCommandMenuActionSpec) => void
}) {
  const mediaKind = INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID[action.id as keyof typeof INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID]
  const Icon = mediaKind === 'video' ? Video : ImageIcon
  return (
    <article
      role="button"
      tabIndex={0}
      className={mediaCardClassName()}
      data-kg-command-menu-media-action={action.id}
      data-kg-command-menu-prefix="@"
      onPointerDownCapture={event => {
        if (!shouldHandleMediaRowPointer(event)) return
        event.preventDefault()
        event.stopPropagation()
        onSelect(action)
      }}
      onClick={event => {
        if (event.detail !== 0 || isMediaRowControlTarget(event.target)) return
        onSelect(action)
      }}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onSelect(action)
      }}
    >
      <figure className={cn('group relative m-0 grid aspect-[16/9] w-full place-items-center border-b', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}>
        <MediaKindOverlay Icon={Icon} label={mediaKind || 'media'} appearance="hover" />
        <MediaInfoOverlay label={action.description} appearance="hover" />
        <Icon className={cn('h-7 w-7', UI_THEME_TOKENS.text.tertiary)} strokeWidth={1.7} aria-hidden />
      </figure>
      <header className="flex min-w-0 items-start justify-between gap-2 px-2 pt-2">
        <section className="min-w-0">
          <h3 className={cn('m-0 truncate text-xs font-semibold', UI_THEME_TOKENS.text.primary)}>{action.label}</h3>
          <p className={cn('m-0 mt-1 truncate font-mono text-[10px]', UI_THEME_TOKENS.text.tertiary)}>{action.id}</p>
        </section>
        <ResponsiveInlineIconBadge Icon={Icon} label="@" />
      </header>
      <p className={cn('m-0 mt-2 truncate px-2 text-[11px]', UI_THEME_TOKENS.text.secondary)}>{action.group}</p>
      <p className={cn('m-0 mt-1 line-clamp-2 px-2 pb-2 text-[11px] leading-4', UI_THEME_TOKENS.text.tertiary)} title={action.description}>
        {action.description}
      </p>
    </article>
  )
}

function buildUploadedMediaMarkdown(args: {
  name: string
  kind: UploadedMediaPanelItem['kind']
  url: string
  contentHash: string
  objectKey: string
}): string {
  const title = args.name.replace(/[\]\n\r]/g, ' ').trim() || 'Uploaded media'
  const escapedTitle = title.replace(/"/g, '&quot;')
  const header = [
    `# Uploaded Media: ${title}`,
    '',
    `content_hash: ${args.contentHash}`,
    `object_key: ${args.objectKey}`,
    '',
  ].join('\n')
  if (args.kind === 'image') return `${header}![${title}](${args.url})\n`
  if (args.kind === 'audio') return `${header}<audio src="${args.url}" title="${escapedTitle}" controls></audio>\n`
  return `${header}<video src="${args.url}" title="${escapedTitle}" controls></video>\n`
}

function UploadedMediaRow({
  item,
  description,
  fieldText,
  infoLabel,
  onDelete,
  onDescriptionChange,
  onFieldChange,
  onNameChange,
  onRename,
  onSelect,
  onPreview,
}: {
  item: UploadedMediaPanelItem
  description: string
  fieldText: string
  infoLabel: string
  onDelete: (item: UploadedMediaPanelItem) => void
  onDescriptionChange: (item: UploadedMediaPanelItem, nextDescription: string) => void
  onFieldChange: (item: UploadedMediaPanelItem, nextFieldText: string) => void
  onNameChange: (item: UploadedMediaPanelItem, nextName: string) => void
  onRename: (item: UploadedMediaPanelItem, nextName: string) => void
  onSelect: (item: UploadedMediaPanelItem) => void
  onPreview: (item: UploadedMediaPanelItem) => void
}) {
  const [editingName, setEditingName] = React.useState(false)
  const Icon = resolveMediaKindOverlayIcon(item.kind)
  const commitName = (value: string) => {
    const nextName = String(value || '').trim()
    if (!nextName) {
      onNameChange(item, item.name)
      setEditingName(false)
      return
    }
    if (nextName !== item.name) onRename(item, nextName)
    setEditingName(false)
  }
  return (
    <article
      role="button"
      tabIndex={0}
      className={mediaListItemClassName()}
      data-kg-media-upload-item={item.id}
      data-kg-media-upload-kind={item.kind}
      data-kg-media-upload-status={item.status}
      data-kg-media-list-row-layout="3-rows"
      onPointerDownCapture={event => {
        if (!shouldHandleMediaRowPointer(event)) return
        event.preventDefault()
        event.stopPropagation()
        onSelect(item)
      }}
      onClick={event => {
        if (event.detail !== 0 || isMediaRowControlTarget(event.target)) return
        onSelect(item)
      }}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onSelect(item)
      }}
    >
      <button
        type="button"
        className={cn(mediaListThumbnailFrameClassName(), 'cursor-zoom-in')}
        title={`Preview ${item.name}`}
        aria-label={`Preview ${item.name}`}
        data-kg-media-thumbnail-fullscreen={item.id}
        data-kg-media-row-control="1"
        onPointerDown={event => event.stopPropagation()}
        onClick={event => {
          event.stopPropagation()
          onPreview(item)
        }}
      >
        <MediaKindOverlay Icon={Icon} label={item.kind} appearance="hover" />
        <MediaInfoOverlay label={infoLabel} appearance="hover" />
        <MediaOpenLinkOverlay href={item.linkUrl} appearance="hover" />
        <MediaDownloadOverlay href={item.linkUrl} kind={item.kind} appearance="hover" />
        {item.kind === 'image' ? (
          <img src={item.linkUrl} alt="" className="h-full w-full rounded object-cover" data-kg-command-menu-media-thumbnail="1" />
        ) : (
          <Icon className={cn('m-auto h-4 w-4', UI_THEME_TOKENS.text.tertiary)} strokeWidth={1.7} aria-hidden />
        )}
      </button>
      <section className="grid min-w-0 grid-rows-[auto_auto_auto] gap-1" aria-label={`${item.name} uploaded media summary`}>
        <header className="flex min-w-0 items-center justify-between gap-2" data-kg-media-list-row-section="title">
          {editingName ? (
            <input
              type="text"
              value={item.name}
              aria-label={`Rename ${item.name}`}
              className={cn(
                'min-w-0 max-w-full truncate rounded border border-transparent bg-transparent px-1 py-0 text-xs font-semibold outline-none',
                UI_THEME_TOKENS.text.primary,
                'focus:border-[color:var(--kg-border)] focus:bg-[color:var(--kg-panel-bg)]',
              )}
              data-kg-media-upload-name-input={item.id}
              data-kg-media-row-control="1"
              onClick={event => event.stopPropagation()}
              onPointerDown={event => event.stopPropagation()}
              onChange={event => onNameChange(item, event.target.value)}
              onInput={event => onNameChange(item, event.currentTarget.value)}
              onBlur={event => commitName(event.currentTarget.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitName(event.currentTarget.value)
                  event.currentTarget.blur()
                  return
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  onNameChange(item, item.storage ? readUploadedMediaFileName(item.storage) : item.name)
                  setEditingName(false)
                  event.currentTarget.blur()
                }
              }}
              autoFocus
            />
          ) : (
            <span className="flex min-w-0 items-center gap-1">
              <span
                className={cn('min-w-0 truncate px-1 text-xs font-semibold', UI_THEME_TOKENS.text.primary)}
                title={item.name}
                data-kg-media-upload-name-text={item.id}
              >
                {item.name}
              </span>
              <button
                type="button"
                className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border opacity-70 hover:opacity-100', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}
                title={`Rename ${item.name}`}
                aria-label={`Rename ${item.name}`}
                data-kg-media-upload-rename={item.id}
                data-kg-media-row-control="1"
                onPointerDown={event => event.stopPropagation()}
                onClick={event => {
                  event.stopPropagation()
                  setEditingName(true)
                }}
              >
                <Pencil className="h-3 w-3" strokeWidth={1.7} aria-hidden />
              </button>
            </span>
          )}
          <button
            type="button"
            className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}
            title="Delete media"
            aria-label={`Delete ${item.name}`}
            data-kg-media-upload-delete={item.id}
            data-kg-media-row-control="1"
            onClick={event => {
              event.stopPropagation()
              onDelete(item)
            }}
          >
            <Trash2 className="h-3 w-3" strokeWidth={1.7} aria-hidden />
          </button>
        </header>
        <section className="flex min-w-0 flex-wrap items-center gap-1" data-kg-media-list-row-section="meta">
          <UploadedMediaDescriptionInput
            item={item}
            description={description}
            onDescriptionChange={onDescriptionChange}
          />
          <UploadedMediaInlineFieldEditor
            item={item}
            value={fieldText}
            onChange={onFieldChange}
          />
        </section>
      </section>
    </article>
  )
}

function UploadedMediaCard({
  item,
  description,
  fieldText,
  infoLabel,
  onDelete,
  onDescriptionChange,
  onFieldChange,
  onNameChange,
  onRename,
  onSelect,
  onPreview,
}: {
  item: UploadedMediaPanelItem
  description: string
  fieldText: string
  infoLabel: string
  onDelete: (item: UploadedMediaPanelItem) => void
  onDescriptionChange: (item: UploadedMediaPanelItem, nextDescription: string) => void
  onFieldChange: (item: UploadedMediaPanelItem, nextFieldText: string) => void
  onNameChange: (item: UploadedMediaPanelItem, nextName: string) => void
  onRename: (item: UploadedMediaPanelItem, nextName: string) => void
  onSelect: (item: UploadedMediaPanelItem) => void
  onPreview: (item: UploadedMediaPanelItem) => void
}) {
  const [editingName, setEditingName] = React.useState(false)
  const commitName = (value: string) => {
    const nextName = String(value || '').trim()
    if (!nextName) {
      onNameChange(item, item.name)
      setEditingName(false)
      return
    }
    if (nextName !== item.name) onRename(item, nextName)
    setEditingName(false)
  }
  return (
    <article
      role="button"
      tabIndex={0}
      className={mediaCardClassName()}
      data-kg-media-upload-item={item.id}
      data-kg-media-upload-kind={item.kind}
      data-kg-media-upload-status={item.status}
      onPointerDownCapture={event => {
        if (!shouldHandleMediaRowPointer(event)) return
        event.preventDefault()
        event.stopPropagation()
        onSelect(item)
      }}
      onClick={event => {
        if (event.detail !== 0 || isMediaRowControlTarget(event.target)) return
        onSelect(item)
      }}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onSelect(item)
      }}
    >
      <UploadedMediaPreview item={item} infoLabel={infoLabel} onPreview={onPreview} />
      <header className="min-w-0 px-2 pt-2">
        {editingName ? (
          <input
            type="text"
            value={item.name}
            aria-label={`Rename ${item.name}`}
            className={cn(
              'min-w-0 max-w-full truncate rounded border border-transparent bg-transparent px-1 py-0 text-xs font-semibold outline-none',
              UI_THEME_TOKENS.text.primary,
              'focus:border-[color:var(--kg-border)] focus:bg-[color:var(--kg-panel-bg)]',
            )}
            data-kg-media-upload-name-input={item.id}
            data-kg-media-row-control="1"
            onClick={event => event.stopPropagation()}
            onPointerDown={event => event.stopPropagation()}
            onChange={event => onNameChange(item, event.target.value)}
            onInput={event => onNameChange(item, event.currentTarget.value)}
            onBlur={event => commitName(event.currentTarget.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitName(event.currentTarget.value)
                event.currentTarget.blur()
                return
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                onNameChange(item, item.storage ? readUploadedMediaFileName(item.storage) : item.name)
                setEditingName(false)
                event.currentTarget.blur()
              }
            }}
            autoFocus
          />
        ) : (
          <span className="flex min-w-0 items-center gap-1">
            <span
              className={cn('min-w-0 truncate px-1 text-xs font-semibold', UI_THEME_TOKENS.text.primary)}
              title={item.name}
              data-kg-media-upload-name-text={item.id}
            >
              {item.name}
            </span>
            <button
              type="button"
              className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border opacity-70 hover:opacity-100', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}
              title={`Rename ${item.name}`}
              aria-label={`Rename ${item.name}`}
              data-kg-media-upload-rename={item.id}
              data-kg-media-row-control="1"
              onPointerDown={event => event.stopPropagation()}
              onClick={event => {
                event.stopPropagation()
                setEditingName(true)
              }}
            >
              <Pencil className="h-3 w-3" strokeWidth={1.7} aria-hidden />
            </button>
          </span>
        )}
      </header>
      <section className="flex min-w-0 flex-wrap items-center gap-1 px-2 pt-1" data-kg-media-list-row-section="meta">
        <UploadedMediaDescriptionInput
          item={item}
          description={description}
          onDescriptionChange={onDescriptionChange}
        />
        <UploadedMediaInlineFieldEditor
          item={item}
          value={fieldText}
          onChange={onFieldChange}
        />
      </section>
      <menu className={cn('m-0 mt-2 flex list-none items-center justify-end gap-2 border-t px-2 py-2', UI_THEME_TOKENS.panel.border)} aria-label={`${item.name} media actions`}>
        <li className="list-none">
          <button
            type="button"
            className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}
            title="Delete media"
            aria-label={`Delete ${item.name}`}
            data-kg-media-upload-delete={item.id}
            data-kg-media-row-control="1"
            onClick={event => {
              event.stopPropagation()
              onDelete(item)
            }}
          >
            <Trash2 className="h-3 w-3" strokeWidth={1.7} aria-hidden />
          </button>
        </li>
      </menu>
    </article>
  )
}

export function CommandMenuReferenceCatalog({
  className,
  title = 'Command Menu',
  subtitle = '/, @, and # actions',
  compactHeader = false,
}: {
  className?: string
  title?: string
  subtitle?: string
  compactHeader?: boolean
}) {
  const panelTypography = usePanelTypography()
  const compactStaticRowProps = useCanvasKeyTypeValueStaticRowProps('compact')
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
              compactStaticRowProps={compactStaticRowProps}
            />
          ))
        ))}
        </KeyTypeValueSectionStack>
      </section>
    </section>
  )
}

export function MediaCatalogPanel() {
  const panelTypography = usePanelTypography()
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null)
  const objectUrlsRef = React.useRef<Set<string>>(new Set())
  const [catalogLayout, setCatalogLayoutState] = React.useState<MediaCatalogLayout>(readStoredMediaCatalogLayout)
  const [uploadedMediaItems, setUploadedMediaItems] = React.useState<UploadedMediaPanelItem[]>(readStoredUploadedMediaPanelItems)
  const [mediaDescriptionDrafts, setMediaDescriptionDrafts] = React.useState<UploadedMediaDescriptionDrafts>(readStoredMediaDescriptionDrafts)
  const [mediaFieldDrafts, setMediaFieldDrafts] = React.useState<UploadedMediaFieldDrafts>(readStoredMediaFieldDrafts)
  const [lightboxItem, setLightboxItem] = React.useState<UploadedMediaPanelItem | null>(null)
  const setActiveMediaKey = useGraphStore(s => s.setMarkdownPreviewActiveMediaKey)
  const setMermaidFocus = useGraphStore(s => s.setMarkdownPreviewMermaidFocus)
  const selectNode = useGraphStore(s => s.selectNode)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const updateNode = useGraphStore(s => s.updateNode)
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName)
  const markdownDocumentText = useGraphStore(s => s.markdownDocumentText || '')
  const setMarkdownDocument = useGraphStore(s => s.setMarkdownDocument)
  const sourceFiles = useGraphStore(s => s.sourceFiles)
  const setSourceFiles = useGraphStore(s => s.setSourceFiles)
  const { items } = useCommandMenuRichMediaInventory()
  const uploadedMediaKeys = React.useMemo(() => new Set(uploadedMediaItems.flatMap(item => {
    const storage = item.storage
    if (!storage) return []
    return [
      storage.contentHash,
      storage.objectKey,
      storage.publicPath,
      storage.publicUrl.split('?')[0] || storage.publicUrl,
      storage.accessUrl.split('?')[0] || storage.accessUrl,
    ].map(value => String(value || '').trim()).filter(Boolean)
  })), [uploadedMediaItems])
  const mediaItems = React.useMemo(
    () => items.filter(item => {
      if (item.kind === 'mermaid') return false
      const candidate = [item.openUrl, item.src, item.thumbnailUrl].map(value => String(value || '').split('?')[0] || String(value || ''))
      return !candidate.some(value => uploadedMediaKeys.has(value.trim()))
    }),
    [items, uploadedMediaKeys],
  )
  const mediaNameDrafts = useCommandMenuMediaNameDrafts()
  const mediaActions = React.useMemo(
    () => INLINE_VARIABLE_COMMAND_ACTIONS.filter(action => action.id === 'insert-image' || action.id === 'insert-video'),
    [],
  )
  const setCatalogLayout = React.useCallback((layout: MediaCatalogLayout) => {
    setCatalogLayoutState(layout)
    writeStoredMediaCatalogLayout(layout)
  }, [])
  React.useEffect(() => () => {
    objectUrlsRef.current.forEach(url => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        void 0
      }
    })
    objectUrlsRef.current.clear()
  }, [])
  React.useEffect(() => {
    let cancelled = false
    listUploadedMediaFromKnowgrphStorage().then(storageItems => {
      if (cancelled || storageItems.length === 0) return
      const cloudflareItems = storageItems
        .map(buildUploadedMediaPanelItemFromStorage)
        .filter((item): item is UploadedMediaPanelItem => !!item)
      if (cloudflareItems.length === 0) return
      setUploadedMediaItems(prev => {
        const next = mergeUploadedMediaPanelItems([...cloudflareItems, ...prev.map(item => (
          item.status === 'synced' ? { ...item, linkUrl: item.storage?.accessUrl || item.linkUrl } : item
        ))])
        writeStoredUploadedMediaPanelItems(next)
        return next
      })
    }).catch(() => {
      void 0
    })
    return () => {
      cancelled = true
    }
  }, [])
  React.useEffect(() => {
    const onItemsChanged = () => setUploadedMediaItems(readStoredUploadedMediaPanelItems())
    window.addEventListener(UPLOADED_MEDIA_PANEL_ITEMS_CHANGED_EVENT, onItemsChanged)
    return () => {
      window.removeEventListener(UPLOADED_MEDIA_PANEL_ITEMS_CHANGED_EVENT, onItemsChanged)
    }
  }, [])
  const appendSyncedUploadedMediaSource = React.useCallback((args: {
    itemId: string
    name: string
    kind: UploadedMediaPanelItem['kind']
    storage: UploadedMediaStorageResult
  }) => {
    const sourceId = `media-upload:${args.storage.contentHash}`
    const currentSourceFiles = useGraphStore.getState().sourceFiles || []
    if (currentSourceFiles.some(file => String(file?.id || '') === sourceId)) return
    const text = buildUploadedMediaMarkdown({
      name: args.name,
      kind: args.kind,
      url: args.storage.accessUrl,
      contentHash: args.storage.contentHash,
      objectKey: args.storage.objectKey,
    })
    const nextFile = {
      id: sourceId,
      name: `${args.name || args.itemId}.media.md`,
      text,
      enabled: true,
      geoLayerEnabled: false,
      status: 'idle' as const,
      parsedTextHash: '',
      source: {
        kind: 'local' as const,
        path: `workspace:/media/${args.storage.objectKey}.md`,
      },
    }
    setSourceFiles([...currentSourceFiles, nextFile])
  }, [setSourceFiles])
  const handleUploadMediaFiles = React.useCallback(async (fileList: FileList | null) => {
    await uploadFilesToUploadedMediaPanel({
      files: Array.from(fileList || []),
      setItems: setUploadedMediaItems,
      registerObjectUrl: url => objectUrlsRef.current.add(url),
      onSynced: ({ item, storage }) => {
        appendSyncedUploadedMediaSource({ itemId: item.id, name: item.name, kind: item.kind, storage })
      },
    })
  }, [appendSyncedUploadedMediaSource])
  const handleSelectMedia = React.useCallback((item: CommandMenuRichMediaItem) => {
    if (item.kind === 'image' || item.kind === 'audio' || item.kind === 'video') {
      const inserted = insertMediaIntoActiveCardInlineTextEditor({
        kind: item.kind,
        url: readRichMediaInsertUrl(item),
        label: readCommandMenuMediaNameDraft(mediaNameDrafts, getMediaNameSyncKey(item)) || item.label,
        sourceKey: item.key,
      })
      if (inserted) return
    }
    setMermaidFocus(null)
    setActiveMediaKey(item.key)
    if (item.source === 'graph' && item.nodeId) {
      setSelectionSource('toolbar')
      selectNode(item.nodeId)
    }
  }, [mediaNameDrafts, selectNode, setActiveMediaKey, setMermaidFocus, setSelectionSource])
  const handleMediaNameDraftChange = React.useCallback((item: CommandMenuRichMediaItem, nextName: string) => {
    const syncKey = getMediaNameSyncKey(item)
    writeCommandMenuMediaNameDraft(syncKey, nextName)
  }, [])
  const removeUploadedMediaSources = React.useCallback((storage: UploadedMediaStorageResult) => {
    const artifactSourceId = `media-upload:${storage.contentHash}`
    const nextSourceFiles = sourceFiles.filter(file => {
      const id = String(file?.id || '')
      const text = String(file?.text || '')
      return id !== artifactSourceId && !text.includes(storage.contentHash) && !text.includes(storage.objectKey)
    })
    if (nextSourceFiles.length !== sourceFiles.length) setSourceFiles(nextSourceFiles)
  }, [setSourceFiles, sourceFiles])
  const renameUploadedMediaSources = React.useCallback((storage: UploadedMediaStorageResult, nextName: string) => {
    const artifactSourceId = `media-upload:${storage.contentHash}`
    const nextSourceFiles = sourceFiles.map(file => {
      const id = String(file?.id || '')
      const text = String(file?.text || '')
      if (id !== artifactSourceId && !text.includes(storage.contentHash) && !text.includes(storage.objectKey)) return file
      const renamedText = buildUploadedMediaMarkdown({
        name: nextName,
        kind: storage.stageId === 'audio' || storage.stageId === 'video' ? storage.stageId : 'image',
        url: storage.accessUrl,
        contentHash: storage.contentHash,
        objectKey: storage.objectKey,
      })
      const nextFile = { ...file, name: `${nextName}.media.md`, text: renamedText, parsedTextHash: '' }
      writeWorkspaceSourceTextIfPresent(nextFile, renamedText, 'Command Menu uploaded media rename')
      return nextFile
    })
    setSourceFiles(nextSourceFiles)
  }, [setSourceFiles, sourceFiles])
  const handleUploadedMediaNameChange = React.useCallback((item: UploadedMediaPanelItem, nextName: string) => {
    setUploadedMediaItems(prev => prev.map(candidate => candidate.id === item.id ? { ...candidate, name: nextName } : candidate))
  }, [])
  const handleUploadedMediaDescriptionChange = React.useCallback((item: UploadedMediaPanelItem, nextDescription: string) => {
    const descriptionKey = getUploadedMediaDescriptionKey(item)
    const description = String(nextDescription || '')
    setMediaDescriptionDrafts(prev => {
      const next = { ...prev }
      if (description.trim()) {
        next[descriptionKey] = description
      } else {
        delete next[descriptionKey]
      }
      writeStoredMediaDescriptionDrafts(next)
      return next
    })
  }, [])
  const handleUploadedMediaFieldChange = React.useCallback((item: UploadedMediaPanelItem, nextFieldText: string) => {
    const fieldKey = getUploadedMediaDescriptionKey(item)
    const fieldText = String(nextFieldText || '')
    setMediaFieldDrafts(prev => {
      const next = { ...prev }
      if (fieldText.trim()) {
        next[fieldKey] = fieldText
      } else {
        delete next[fieldKey]
      }
      writeStoredMediaFieldDrafts(next)
      return next
    })
  }, [])
  const handleRenameUploadedMedia = React.useCallback((item: UploadedMediaPanelItem, nextName: string) => {
    const name = String(nextName || '').trim()
    if (!name || !item.storage) return
    setUploadedMediaItems(prev => {
      const next = prev.map(candidate => candidate.id === item.id ? { ...candidate, name } : candidate)
      writeStoredUploadedMediaPanelItems(next)
      return next
    })
    renameUploadedMediaSources(item.storage, name)
    void renameUploadedMediaInKnowgrphStorage({ storage: item.storage, name }).then(storage => {
      if (!storage) return
      setUploadedMediaItems(prev => {
        const next = mergeUploadedMediaPanelItems(prev.map(candidate => (
          candidate.id === item.id || readUploadedMediaPanelDedupeKey(candidate) === storage.contentHash
            ? { ...candidate, id: buildUploadedMediaPanelItemId(storage), name: readUploadedMediaFileName(storage), linkUrl: storage.accessUrl, storage }
            : candidate
        )))
        writeStoredUploadedMediaPanelItems(next)
        return next
      })
    }).catch(() => {
      void 0
    })
  }, [renameUploadedMediaSources])
  const handleDeleteUploadedMedia = React.useCallback((item: UploadedMediaPanelItem) => {
    setUploadedMediaItems(prev => {
      const next = prev.filter(candidate => readUploadedMediaPanelDedupeKey(candidate) !== readUploadedMediaPanelDedupeKey(item))
      writeStoredUploadedMediaPanelItems(next)
      return next
    })
    if (!item.storage) return
    removeUploadedMediaSources(item.storage)
    void deleteUploadedMediaFromKnowgrphStorage({ storage: item.storage }).catch(() => {
      void 0
    })
  }, [removeUploadedMediaSources])
  const handleSelectUploadedMedia = React.useCallback((item: UploadedMediaPanelItem) => {
    if (!item.storage || item.status !== 'synced') return
    appendSyncedUploadedMediaSource({ itemId: item.id, name: item.name, kind: item.kind, storage: item.storage })
    const inserted = insertMediaIntoActiveCardInlineTextEditor({
      kind: item.kind,
      url: item.storage.accessUrl || item.linkUrl,
      label: item.name,
      sourceKey: item.storage.contentHash,
    })
    if (inserted) return
    setMermaidFocus(null)
    setActiveMediaKey(`media-upload:${item.storage.contentHash}`)
  }, [appendSyncedUploadedMediaSource, setActiveMediaKey, setMermaidFocus])
  const handlePreviewUploadedMedia = React.useCallback((item: UploadedMediaPanelItem) => {
    setLightboxItem(item)
  }, [])
  const handleSelectMediaAction = React.useCallback((action: InlineCommandMenuActionSpec) => {
    const mediaKind = INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID[action.id as keyof typeof INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID]
    if (!mediaKind) return
    const inserted = insertMediaIntoActiveCardInlineTextEditor({
      kind: mediaKind,
      url: '',
      label: action.label,
      sourceKey: action.id,
    })
    if (inserted) return
    setMermaidFocus(null)
  }, [setMermaidFocus])
  const handleRenameMedia = React.useCallback((item: CommandMenuRichMediaItem, nextName: string) => {
    const owner = item.renameOwner
    const name = String(nextName || '').trim()
    if (!owner || !name) return
    const mediaNameSyncKey = getMediaNameSyncKey(item)
    const markdownRenameItem: CommandMenuRichMediaItem = owner.type === 'markdownLine'
      ? item
      : mediaNameSyncKey
        ? {
            ...item,
            renameOwner: {
              type: 'markdownLine',
              startLine: item.startLine || 1,
              href: mediaNameSyncKey,
              syntax: 'link',
            },
          }
        : item
    if (owner.type === 'graphNodeLabel') {
      updateNode(owner.nodeId, { label: name })
    }
    const nextText = renameCommandMenuRichMediaMarkdownHref({
      markdownText: markdownDocumentText,
      item: markdownRenameItem,
      nextName: name,
    })
    let sourceFilesChanged = false
    const nextSourceFiles = sourceFiles.map(file => {
      const fileText = String(file?.text || '')
      const renamedText = renameCommandMenuRichMediaMarkdownHref({
        markdownText: fileText,
        item: markdownRenameItem,
        nextName: name,
      })
      if (renamedText === fileText) return file
      sourceFilesChanged = true
      const nextFile = { ...file, text: renamedText, parsedTextHash: '' }
      writeWorkspaceSourceTextIfPresent(nextFile, renamedText, 'Command Menu media rename')
      return nextFile
    })
    if (sourceFilesChanged) setSourceFiles(nextSourceFiles)
    if (nextText !== markdownDocumentText) {
      setMarkdownDocument(markdownDocumentName, nextText, { applyViewPreset: false })
    }
  }, [markdownDocumentName, markdownDocumentText, setMarkdownDocument, setSourceFiles, sourceFiles, updateNode])

  return (
    <section className={cn('h-full min-h-0 overflow-auto px-1 pb-2', panelTypography.panelTextClass)} aria-label="Media" data-kg-media-layout={catalogLayout} data-kg-media-list-layout={catalogLayout === 'list' ? '3-rows' : undefined} data-kg-media-grid-layout={catalogLayout === 'grid' ? '1' : undefined} data-kg-media-panel="1">
      <MediaLightbox
        open={!!lightboxItem}
        src={lightboxItem?.linkUrl || ''}
        alt={lightboxItem?.name || 'Uploaded media'}
        kind={lightboxItem?.kind || 'media'}
        onClose={() => setLightboxItem(null)}
      />
      <header className={cn('mb-1 flex items-center justify-between gap-2 px-1 py-1', UI_THEME_TOKENS.panel.bg)}>
        <section className="min-w-0">
          <h2 className={cn('truncate text-xs font-semibold', UI_THEME_TOKENS.text.primary)}>Media</h2>
          <p className={cn('truncate text-[10px]', UI_THEME_TOKENS.text.tertiary)}>@ image, audio, video, and rich media</p>
        </section>
        <section className="flex shrink-0 items-center gap-1" aria-label="Media actions">
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*,audio/*,video/*"
            multiple
            className="sr-only"
            aria-label="Upload Media"
            data-kg-media-upload-input="1"
            onChange={event => {
              void handleUploadMediaFiles(event.currentTarget.files)
              event.currentTarget.value = ''
            }}
          />
          <button
            type="button"
            className={cn('inline-flex h-6 min-w-6 items-center justify-center rounded border px-1 text-xs font-semibold', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}
            title="Upload Media"
            aria-label="Upload Media"
            data-kg-media-upload-button="1"
            onClick={() => uploadInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden />
          </button>
          <section className={cn('inline-flex h-6 items-center overflow-hidden rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)} role="group" aria-label="Media layout" data-kg-media-layout-selector="1">
            {([
              { layout: 'list' as const, label: 'List layout', Icon: List },
              { layout: 'grid' as const, label: 'Grid layout', Icon: Grid2X2 },
            ]).map(option => {
              const Icon = option.Icon
              return (
                <button
                  key={option.layout}
                  type="button"
                  className={cn(
                    'inline-flex h-full w-6 items-center justify-center border-0 px-0',
                    catalogLayout === option.layout ? 'bg-black/10 dark:bg-white/15' : UI_THEME_TOKENS.button.hoverBg,
                    UI_THEME_TOKENS.text.secondary,
                  )}
                  title={option.label}
                  aria-label={option.label}
                  aria-pressed={catalogLayout === option.layout}
                  data-kg-media-layout-toggle={option.layout}
                  onClick={() => setCatalogLayout(option.layout)}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden />
                </button>
              )
            })}
          </section>
          <span
            className={cn('inline-flex h-6 min-w-6 items-center justify-center rounded border px-1 text-xs font-semibold', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}
            title="@ media commands"
          >
            @
          </span>
        </section>
      </header>
      <section data-kg-media-list="1">
        {catalogLayout === 'list' ? (
          <section className="grid min-w-0 gap-2" aria-label="Media list" data-kg-media-list-rows="3">
            {uploadedMediaItems.map(item => (
              <UploadedMediaRow
                key={item.id}
                item={item}
                description={readUploadedMediaDescription(mediaDescriptionDrafts, item)}
                fieldText={readUploadedMediaFieldText(mediaFieldDrafts, item)}
                infoLabel={buildUploadedMediaInfoLabel(item)}
                onDelete={handleDeleteUploadedMedia}
                onDescriptionChange={handleUploadedMediaDescriptionChange}
                onFieldChange={handleUploadedMediaFieldChange}
                onNameChange={handleUploadedMediaNameChange}
                onRename={handleRenameUploadedMedia}
                onSelect={handleSelectUploadedMedia}
                onPreview={handlePreviewUploadedMedia}
              />
            ))}
            {mediaItems.map(item => (
              <MediaCandidateRow
                key={item.key}
                item={item}
                displayName={readCommandMenuMediaNameDraft(mediaNameDrafts, getMediaNameSyncKey(item)) || item.label}
                onSelect={handleSelectMedia}
                onNameDraftChange={handleMediaNameDraftChange}
                onRename={handleRenameMedia}
              />
            ))}
            {mediaActions.map(action => (
              <MediaActionRow
                key={action.id}
                action={action}
                onSelect={handleSelectMediaAction}
              />
            ))}
          </section>
        ) : (
          <section className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Media grid" data-kg-media-grid="1">
            {uploadedMediaItems.map(item => (
              <UploadedMediaCard
                key={item.id}
                item={item}
                description={readUploadedMediaDescription(mediaDescriptionDrafts, item)}
                fieldText={readUploadedMediaFieldText(mediaFieldDrafts, item)}
                infoLabel={buildUploadedMediaInfoLabel(item)}
                onDelete={handleDeleteUploadedMedia}
                onDescriptionChange={handleUploadedMediaDescriptionChange}
                onFieldChange={handleUploadedMediaFieldChange}
                onNameChange={handleUploadedMediaNameChange}
                onRename={handleRenameUploadedMedia}
                onSelect={handleSelectUploadedMedia}
                onPreview={handlePreviewUploadedMedia}
              />
            ))}
            {mediaItems.map(item => (
              <MediaCandidateCard
                key={item.key}
                item={item}
                displayName={readCommandMenuMediaNameDraft(mediaNameDrafts, getMediaNameSyncKey(item)) || item.label}
                onSelect={handleSelectMedia}
                onNameDraftChange={handleMediaNameDraftChange}
                onRename={handleRenameMedia}
              />
            ))}
            {mediaActions.map(action => (
              <MediaActionCard
                key={action.id}
                action={action}
                onSelect={handleSelectMediaAction}
              />
            ))}
          </section>
        )}
      </section>
    </section>
  )
}

export default MediaCatalogPanel
