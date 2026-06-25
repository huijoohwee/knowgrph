import React from 'react'
import { ImageIcon, Link, Pencil, Upload, Video, Wand2 } from 'lucide-react'
import { INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID, INLINE_UPLOAD_MEDIA_VARIABLE_ACTION_ID } from '@/lib/command-menu/inlineCommandMenuCatalog'
import type { CommandMenuRichMediaItem } from '@/lib/command-menu/commandMenuRichMediaInventory'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { ResponsiveInlineIconBadge } from '@/lib/ui/ResponsiveInlineIconBadge'
import { MediaInfoOverlay, MediaKindOverlay } from '@/lib/ui/MediaKindOverlay'
import { resolveMediaKindOverlayIcon } from '@/lib/ui/mediaKindOverlayIcon'
import { cn } from '@/lib/utils'
import { MEDIA_GENERATE_MEDIA_ACTION_ID, MEDIA_IMPORT_URL_ACTION_ID, type MediaPanelActionSpec } from './mediaCatalogTypes'
import {
  MediaCandidatePreview,
  MediaCandidateThumb,
  MediaListThumbnailIconFrame,
  getCommandMenuMediaDescription,
  getCommandMenuMediaSourceLabel,
  isMediaRowControlTarget,
  mediaCardClassName,
  mediaListItemClassName,
  shouldHandleMediaRowPointer,
} from './mediaCatalogShared'

export function MediaCandidateRow({
  item,
  displayName,
  onDragStart,
  onSelect,
  onNameDraftChange,
  onRename,
}: {
  item: CommandMenuRichMediaItem
  displayName: string
  onDragStart: (event: React.DragEvent<HTMLElement>, item: CommandMenuRichMediaItem) => void
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
      draggable={true}
      className={mediaListItemClassName()}
      onDragStart={event => onDragStart(event, item)}
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
      data-kg-media-draggable="1"
      data-kg-command-menu-media-kind={item.kind}
      data-kg-command-menu-media-source={item.source}
      data-kg-media-list-row-layout="3-rows"
    >
      <MediaCandidateThumb item={item} onDragStart={onDragStart} />
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

export function MediaCandidateCard({
  item,
  displayName,
  onDragStart,
  onSelect,
  onNameDraftChange,
  onRename,
}: {
  item: CommandMenuRichMediaItem
  displayName: string
  onDragStart: (event: React.DragEvent<HTMLElement>, item: CommandMenuRichMediaItem) => void
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
      draggable={true}
      className={mediaCardClassName()}
      onDragStart={event => onDragStart(event, item)}
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
      data-kg-media-draggable="1"
      data-kg-command-menu-media-kind={item.kind}
      data-kg-command-menu-media-source={item.source}
    >
      <MediaCandidatePreview item={item} onDragStart={onDragStart} />
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

export function MediaActionRow({
  action,
  onSelect,
}: {
  action: MediaPanelActionSpec
  onSelect: (action: MediaPanelActionSpec) => void
}) {
  const mediaKind = INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID[action.id as keyof typeof INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID]
  const Icon = action.id === INLINE_UPLOAD_MEDIA_VARIABLE_ACTION_ID
    ? Upload
    : action.id === MEDIA_IMPORT_URL_ACTION_ID
      ? Link
      : action.id === MEDIA_GENERATE_MEDIA_ACTION_ID
        ? Wand2
        : mediaKind === 'video' ? Video : ImageIcon
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
      <MediaListThumbnailIconFrame Icon={Icon} label={mediaKind || action.label} infoLabel={action.description} />
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

export function MediaActionCard({
  action,
  onSelect,
}: {
  action: MediaPanelActionSpec
  onSelect: (action: MediaPanelActionSpec) => void
}) {
  const mediaKind = INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID[action.id as keyof typeof INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID]
  const Icon = action.id === INLINE_UPLOAD_MEDIA_VARIABLE_ACTION_ID
    ? Upload
    : action.id === MEDIA_IMPORT_URL_ACTION_ID
      ? Link
      : action.id === MEDIA_GENERATE_MEDIA_ACTION_ID
        ? Wand2
        : mediaKind === 'video' ? Video : ImageIcon
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
        <MediaKindOverlay Icon={Icon} label={mediaKind || action.label} appearance="hover" />
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
