import React from 'react'
import { AtSign, FileAudio, FileCode2, Hash, ImageIcon, Slash, Trash2, Upload, Video, type LucideIcon } from 'lucide-react'
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
  buildUploadedMediaAccessUrl,
  deleteUploadedMediaFromKnowgrphStorage,
  listUploadedMediaFromKnowgrphStorage,
  readUploadedMediaKind,
  renameUploadedMediaInKnowgrphStorage,
  uploadMediaFileToKnowgrphStorage,
  type UploadedMediaStorageResult,
} from '@/lib/storage/uploadedMediaStorage'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { cn } from '@/lib/utils'

const commandMenuCatalogGroups = [
  { key: 'slash', label: '/', title: 'Slash commands', Icon: Slash, actions: INLINE_SLASH_COMMAND_ACTIONS },
  { key: 'variable', label: '@', title: 'Variable commands', Icon: AtSign, actions: INLINE_VARIABLE_COMMAND_ACTIONS },
  { key: 'keyword', label: '#', title: 'Keyword commands', Icon: Hash, actions: INLINE_KEYWORD_COMMAND_ACTIONS },
] as const

type UploadedMediaPanelItem = {
  id: string
  name: string
  kind: 'image' | 'audio' | 'video'
  localUrl: string
  linkUrl: string
  contentType: string
  sizeBytes: number
  status: 'uploading' | 'synced' | 'local'
  storage: UploadedMediaStorageResult | null
  error: string | null
}

const UPLOADED_MEDIA_PANEL_STORAGE_KEY = 'knowgrph:floating-panel-media:uploaded-cloudflare-items:v1'

const isUploadedMediaPanelItemKind = (value: unknown): value is UploadedMediaPanelItem['kind'] =>
  value === 'image' || value === 'audio' || value === 'video'

const buildUploadedMediaPanelItemId = (storage: Pick<UploadedMediaStorageResult, 'contentHash' | 'objectKey'>): string =>
  `cloudflare-media:${String(storage.contentHash || storage.objectKey).trim()}`

const readUploadedMediaPanelDedupeKey = (item: UploadedMediaPanelItem): string =>
  String(item.storage?.contentHash || item.storage?.objectKey || item.id).trim()

const mergeUploadedMediaPanelItems = (items: UploadedMediaPanelItem[]): UploadedMediaPanelItem[] => {
  const nextByKey = new Map<string, UploadedMediaPanelItem>()
  for (const item of items) {
    const key = readUploadedMediaPanelDedupeKey(item)
    if (!key) continue
    const canonicalItem = item.storage
      ? { ...item, id: buildUploadedMediaPanelItemId(item.storage), linkUrl: item.storage.accessUrl || item.linkUrl }
      : item
    const existing = nextByKey.get(key)
    if (!existing || (canonicalItem.status === 'synced' && existing.status !== 'synced')) {
      nextByKey.set(key, canonicalItem)
    }
  }
  return Array.from(nextByKey.values())
}

const readStoredUploadedMediaPanelItems = (): UploadedMediaPanelItem[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(UPLOADED_MEDIA_PANEL_STORAGE_KEY)
    const parsed = JSON.parse(raw || '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap(value => {
      const item = value as Partial<UploadedMediaPanelItem>
      const storage = item.storage as UploadedMediaStorageResult | null
      if (!item.id || !item.name || !isUploadedMediaPanelItemKind(item.kind) || !storage?.publicUrl || !storage.runId) return []
      const accessUrl = buildUploadedMediaAccessUrl({ publicUrl: storage.publicUrl, runId: storage.runId })
      return [{
        id: buildUploadedMediaPanelItemId(storage),
        name: String(item.name),
        kind: item.kind,
        localUrl: '',
        linkUrl: accessUrl,
        contentType: String(item.contentType || storage.contentType || 'application/octet-stream'),
        sizeBytes: Number(item.sizeBytes || 0),
        status: 'synced' as const,
        storage: { ...storage, accessUrl },
        error: null,
      }]
    })
  } catch {
    return []
  }
}

const writeStoredUploadedMediaPanelItems = (items: UploadedMediaPanelItem[]): void => {
  if (typeof window === 'undefined') return
  try {
    const syncedItems = mergeUploadedMediaPanelItems(items).filter(item => item.status === 'synced' && item.storage)
    window.localStorage.setItem(UPLOADED_MEDIA_PANEL_STORAGE_KEY, JSON.stringify(syncedItems))
  } catch {
    void 0
  }
}

const readUploadedMediaFileName = (storage: UploadedMediaStorageResult): string => {
  const fromProvenance = typeof storage.provenance?.fileName === 'string' ? storage.provenance.fileName.trim() : ''
  if (fromProvenance) return fromProvenance
  return storage.objectKey.split('/').filter(Boolean).at(-1) || storage.shotId || 'uploaded-media'
}

const buildUploadedMediaPanelItemFromStorage = (storage: UploadedMediaStorageResult): UploadedMediaPanelItem | null => {
  const kind = storage.stageId === 'image' || storage.stageId === 'audio' || storage.stageId === 'video' ? storage.stageId : null
  if (!kind) return null
  const sizeBytes = typeof storage.provenance?.sizeBytes === 'number' ? storage.provenance.sizeBytes : 0
  return {
    id: buildUploadedMediaPanelItemId(storage),
    name: readUploadedMediaFileName(storage),
    kind,
    localUrl: '',
    linkUrl: storage.accessUrl,
    contentType: storage.contentType,
    sizeBytes,
    status: 'synced',
    storage,
    error: null,
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

function getMediaIcon(kind: CommandMenuRichMediaItem['kind']): LucideIcon {
  if (kind === 'audio') return FileAudio
  if (kind === 'image') return ImageIcon
  if (kind === 'iframe' || kind === 'webpage' || kind === 'tweet') return FileCode2
  return Video
}

function getMediaNameSyncKey(item: CommandMenuRichMediaItem): string {
  const owner = item.renameOwner
  if (owner?.type === 'markdownLine') return String(owner.href || '').trim()
  return String(item.openUrl || item.src || '').trim()
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
  displayName,
  onSelect,
  onNameDraftChange,
  onRename,
  compactStaticRowProps,
}: {
  item: CommandMenuRichMediaItem
  displayName: string
  onSelect: (item: CommandMenuRichMediaItem) => void
  onNameDraftChange: (item: CommandMenuRichMediaItem, nextName: string) => void
  onRename: (item: CommandMenuRichMediaItem, nextName: string) => void
  compactStaticRowProps: Pick<
    React.ComponentProps<typeof KeyTypeValueStaticRow>,
    'textSizeClassName' | 'fontClassName' | 'densityClassName' | 'activeClassName'
  >
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
      <KeyTypeValueStaticRow
        {...compactStaticRowProps}
        align="start"
        keyNode={(
          <span className="flex min-w-0 items-center gap-2">
            <MediaCandidateThumb item={item} />
            <span className="flex min-w-0 flex-col leading-4">
              <MediaCandidateNameInput
                item={item}
                displayName={displayName}
                onDraftChange={onNameDraftChange}
                onRename={onRename}
              />
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
  displayName,
  onDraftChange,
  onRename,
}: {
  item: CommandMenuRichMediaItem
  displayName: string
  onDraftChange: (item: CommandMenuRichMediaItem, nextName: string) => void
  onRename: (item: CommandMenuRichMediaItem, nextName: string) => void
}) {
  const commitValue = React.useCallback((value: string) => {
    const next = String(value || '').trim()
    if (!next) {
      onDraftChange(item, item.label)
      return
    }
    if (next === item.label) return
    onRename(item, next)
  }, [item, onDraftChange, onRename])

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
          event.currentTarget.blur()
        }
      }}
    />
  )
}

function MediaActionRow({
  action,
  compactStaticRowProps,
}: {
  action: InlineCommandMenuActionSpec
  compactStaticRowProps: Pick<
    React.ComponentProps<typeof KeyTypeValueStaticRow>,
    'textSizeClassName' | 'fontClassName' | 'densityClassName' | 'activeClassName'
  >
}) {
  const mediaKind = INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID[action.id as keyof typeof INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID]
  const Icon = mediaKind === 'video' ? Video : ImageIcon
  return (
    <section
      data-kg-command-menu-media-action={action.id}
      data-kg-command-menu-prefix="@"
    >
      <KeyTypeValueStaticRow
        {...compactStaticRowProps}
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
  onDelete,
  onNameChange,
  onRename,
  onSelect,
  compactStaticRowProps,
}: {
  item: UploadedMediaPanelItem
  onDelete: (item: UploadedMediaPanelItem) => void
  onNameChange: (item: UploadedMediaPanelItem, nextName: string) => void
  onRename: (item: UploadedMediaPanelItem, nextName: string) => void
  onSelect: (item: UploadedMediaPanelItem) => void
  compactStaticRowProps: Pick<
    React.ComponentProps<typeof KeyTypeValueStaticRow>,
    'textSizeClassName' | 'fontClassName' | 'densityClassName' | 'activeClassName'
  >
}) {
  const Icon = getMediaIcon(item.kind)
  const storage = item.storage?.response.storage
  const storageLabel = storage
    ? `R2 ${storage.r2}; D1 ${storage.d1}; KV ${storage.kv}; DO ${storage.durableObject}`
    : item.status === 'uploading'
      ? 'Uploading to runtime storage'
      : item.error || 'Local preview; runtime sync disabled or unavailable'
  const commitName = (value: string) => {
    const nextName = String(value || '').trim()
    if (!nextName) {
      onNameChange(item, item.name)
      return
    }
    if (nextName !== item.name) onRename(item, nextName)
  }
  return (
    <section
      role="button"
      tabIndex={0}
      data-kg-media-upload-item={item.id}
      data-kg-media-upload-kind={item.kind}
      data-kg-media-upload-status={item.status}
      onClick={() => onSelect(item)}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onSelect(item)
      }}
    >
      <KeyTypeValueStaticRow
        {...compactStaticRowProps}
        align="start"
        keyNode={(
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn('inline-flex h-8 w-14 shrink-0 overflow-hidden rounded-full border p-[2px] shadow-sm', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}>
              {item.kind === 'image' ? (
                <img src={item.linkUrl} alt="" className="h-full w-full rounded-full object-cover" data-kg-command-menu-media-thumbnail="1" />
              ) : (
                <Icon className={cn('m-auto h-4 w-4', UI_THEME_TOKENS.text.tertiary)} strokeWidth={1.7} aria-hidden />
              )}
            </span>
            <span className="flex min-w-0 flex-col leading-4">
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
                    event.currentTarget.blur()
                  }
                }}
              />
              <span className={cn('truncate font-mono text-[11px] font-normal', UI_THEME_TOKENS.text.tertiary)}>{item.kind}</span>
            </span>
          </span>
        )}
        typeNode={<CommandPrefixType Icon={Icon} label="@" title={`${item.kind} upload`} />}
        valueNode={(
          <span className="flex min-w-0 flex-col leading-4">
            <span className="flex min-w-0 items-center gap-1">
              <a
                href={item.linkUrl}
                target="_blank"
                rel="noreferrer"
                className={cn('min-w-0 truncate text-[11px] underline-offset-2 hover:underline', UI_THEME_TOKENS.text.secondary)}
                title={item.linkUrl}
                onClick={event => event.stopPropagation()}
              >
                {item.status === 'synced' ? 'Open Cloudflare media link' : 'Open local media link'}
              </a>
              <button
                type="button"
                className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}
                title="Delete media"
                aria-label={`Delete ${item.name}`}
                data-kg-media-upload-delete={item.id}
                onClick={event => {
                  event.stopPropagation()
                  onDelete(item)
                }}
              >
                <Trash2 className="h-3 w-3" strokeWidth={1.7} aria-hidden />
              </button>
            </span>
            <span className={cn('truncate text-[11px]', UI_THEME_TOKENS.text.tertiary)} title={storageLabel}>
              {storageLabel}
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
  const compactStaticRowProps = useCanvasKeyTypeValueStaticRowProps('compact')
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null)
  const objectUrlsRef = React.useRef<Set<string>>(new Set())
  const [uploadedMediaItems, setUploadedMediaItems] = React.useState<UploadedMediaPanelItem[]>(readStoredUploadedMediaPanelItems)
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
    const files = Array.from(fileList || [])
    for (const file of files) {
      const kind = readUploadedMediaKind(file)
      if (!kind) continue
      const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `media-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const localUrl = URL.createObjectURL(file)
      objectUrlsRef.current.add(localUrl)
      const initialItem: UploadedMediaPanelItem = {
        id,
        name: file.name || `uploaded-${kind}`,
        kind,
        localUrl,
        linkUrl: localUrl,
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        status: 'uploading',
        storage: null,
        error: null,
      }
      setUploadedMediaItems(prev => [initialItem, ...prev])
      try {
        const storage = await uploadMediaFileToKnowgrphStorage({ file, uploadNow: true })
        if (!storage) {
          setUploadedMediaItems(prev => prev.map(item => item.id === id ? { ...item, status: 'local', error: 'Cloudflare media upload did not confirm R2/D1 persistence' } : item))
          continue
        }
        setUploadedMediaItems(prev => {
          const next = mergeUploadedMediaPanelItems(prev.map(item => item.id === id ? {
            ...item,
            id: buildUploadedMediaPanelItemId(storage),
            name: readUploadedMediaFileName(storage),
            status: 'synced' as const,
            linkUrl: storage.accessUrl,
            storage,
            error: null,
          } : item))
          writeStoredUploadedMediaPanelItems(next)
          return next
        })
        appendSyncedUploadedMediaSource({ itemId: id, name: file.name || `uploaded-${kind}`, kind, storage })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed'
        setUploadedMediaItems(prev => prev.map(item => item.id === id ? { ...item, status: 'local', error: message } : item))
      }
    }
  }, [appendSyncedUploadedMediaSource])
  const handleSelectMedia = React.useCallback((item: CommandMenuRichMediaItem) => {
    setMermaidFocus(null)
    setActiveMediaKey(item.key)
    if (item.source === 'graph' && item.nodeId) {
      setSelectionSource('toolbar')
      selectNode(item.nodeId)
    }
  }, [selectNode, setActiveMediaKey, setMermaidFocus, setSelectionSource])
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
    setMermaidFocus(null)
    setActiveMediaKey(`media-upload:${item.storage.contentHash}`)
  }, [appendSyncedUploadedMediaSource, setActiveMediaKey, setMermaidFocus])
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
    <section className={cn('h-full min-h-0 overflow-auto px-1 pb-2', panelTypography.panelTextClass)} aria-label="Media" data-kg-media-ktv-layout="1" data-kg-media-panel="1">
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
          <span
            className={cn('inline-flex h-6 min-w-6 items-center justify-center rounded border px-1 text-xs font-semibold', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}
            title="@ media commands"
          >
            @
          </span>
        </section>
      </header>
      <section data-kg-media-list="1">
        <KeyTypeValueHeader keyLabel="Media" typeLabel="Prefix" valueLabel="Source / action" stickyOffsetClassName="top-0" />
        <KeyTypeValueSectionStack>
          {uploadedMediaItems.map(item => (
            <UploadedMediaRow
              key={item.id}
              item={item}
              onDelete={handleDeleteUploadedMedia}
              onNameChange={handleUploadedMediaNameChange}
              onRename={handleRenameUploadedMedia}
              onSelect={handleSelectUploadedMedia}
              compactStaticRowProps={compactStaticRowProps}
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
              compactStaticRowProps={compactStaticRowProps}
            />
          ))}
          {mediaActions.map(action => (
            <MediaActionRow key={action.id} action={action} compactStaticRowProps={compactStaticRowProps} />
          ))}
        </KeyTypeValueSectionStack>
      </section>
    </section>
  )
}

export default MediaCatalogPanel
