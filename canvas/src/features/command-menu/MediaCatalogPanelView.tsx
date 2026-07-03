import React from 'react'
import { Grid2X2, List, Plus } from 'lucide-react'
import type { CommandMenuRichMediaItem } from '@/lib/command-menu/commandMenuRichMediaInventory'
import { readCommandMenuMediaNameDraft, type CommandMenuMediaNameDrafts } from '@/lib/command-menu/commandMenuMediaNameSync'
import type { UploadedMediaPanelItem } from '@/lib/storage/uploadedMediaPanelItems'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { MediaLightbox, type MediaLightboxPromptParameter, type MediaLightboxPromptParameters } from '@/lib/ui/MediaLightbox'
import { MEDIA_IMAGE_FORMAT_PREFERENCE_ATTR, MEDIA_VIDEO_FORMAT_PREFERENCE_ATTR } from '@/lib/media/mediaFormatPreference'
import { cn } from '@/lib/utils'
import { ImportUrlPrompt } from '@/features/toolbar/ImportUrlPrompt'
import { buildTimelineAnimationState } from '@/components/timeline/timelineAnimationEngine'
import type { MediaCatalogLayout, MediaCatalogSourceMetadataItem, MediaPanelActionSpec, UploadedMediaDescriptionDrafts, UploadedMediaFieldDrafts } from './mediaCatalogTypes'
import { getMediaNameSyncKey, type UploadedMediaDragMetadata } from './mediaCatalogShared'
import { MediaActionCard, MediaActionRow, MediaCandidateCard, MediaCandidateRow, MediaSourceMetadataCard, MediaSourceMetadataRow } from './mediaCatalogCandidateItems'
import { UploadedMediaCard, UploadedMediaRow } from './mediaCatalogUploadedItems'
import { buildUploadedMediaInfoLabel, readUploadedMediaDescription, readUploadedMediaFieldText } from './mediaCatalogUploadedFields'

type MediaCatalogPanelViewProps = {
  catalogLayout: MediaCatalogLayout
  generateLightboxOpen: boolean
  generateMediaBusy: boolean
  generateMediaPrompt: string
  generatePromptParameters: readonly MediaLightboxPromptParameter[]
  generatedMediaItem: UploadedMediaPanelItem | null
  importUrlBusy: boolean
  importUrlDraft: string
  importUrlPromptOpen: boolean
  lightboxItem: UploadedMediaPanelItem | null
  mediaActions: readonly MediaPanelActionSpec[]
  mediaDescriptionDrafts: UploadedMediaDescriptionDrafts
  mediaFieldDrafts: UploadedMediaFieldDrafts
  mediaItems: CommandMenuRichMediaItem[]
  mediaListRef: React.RefObject<HTMLElement | null>
  mediaNameDrafts: CommandMenuMediaNameDrafts
  panelRef: React.RefObject<HTMLElement | null>
  panelTextClass: string
  sourceMetadataItem: MediaCatalogSourceMetadataItem | null
  uploadInputRef: React.RefObject<HTMLInputElement | null>
  uploadedMediaItems: UploadedMediaPanelItem[]
  onCloseGenerateLightbox: () => void
  onCloseLightbox: () => void
  onDeleteUploadedMedia: (item: UploadedMediaPanelItem) => void
  onDescriptionChange: (item: UploadedMediaPanelItem, nextDescription: string) => void
  onDragCommandMenuMedia: (event: React.DragEvent<HTMLElement>, item: CommandMenuRichMediaItem) => void
  onDragUploadedMedia: (event: React.DragEvent<HTMLElement>, item: UploadedMediaPanelItem, metadata?: UploadedMediaDragMetadata) => void
  onFieldChange: (item: UploadedMediaPanelItem, nextFieldText: string) => void
  onGeneratePromptChange: (nextPrompt: string) => void
  onGeneratePromptSubmit: (nextPrompt: string, parameters?: MediaLightboxPromptParameters) => void | Promise<void>
  onImportUrlChange: (nextUrl: string) => void
  onImportUrlConfirm: (url: string) => void
  onImportUrlPromptOpenChange: (open: boolean) => void
  onLayoutChange: (layout: MediaCatalogLayout) => void
  onMediaNameDraftChange: (item: CommandMenuRichMediaItem, nextName: string) => void
  onNameChange: (item: UploadedMediaPanelItem, nextName: string) => void
  onNewMedia: () => void
  onPreviewUploadedMedia: (item: UploadedMediaPanelItem) => void
  onRenameMedia: (item: CommandMenuRichMediaItem, nextName: string) => void
  onRenameUploadedMedia: (item: UploadedMediaPanelItem, nextName: string) => void
  onSelectMedia: (item: CommandMenuRichMediaItem) => void
  onSelectMediaAction: (action: MediaPanelActionSpec) => void
  onSelectUploadedMedia: (item: UploadedMediaPanelItem) => void
  onUploadMediaFiles: (files: FileList | null) => void
}

export function MediaCatalogPanelView({
  catalogLayout,
  generateLightboxOpen,
  generateMediaBusy,
  generateMediaPrompt,
  generatePromptParameters,
  generatedMediaItem,
  importUrlBusy,
  importUrlDraft,
  importUrlPromptOpen,
  lightboxItem,
  mediaActions,
  mediaDescriptionDrafts,
  mediaFieldDrafts,
  mediaItems,
  mediaListRef,
  mediaNameDrafts,
  panelRef,
  panelTextClass,
  sourceMetadataItem,
  uploadInputRef,
  uploadedMediaItems,
  onCloseGenerateLightbox,
  onCloseLightbox,
  onDeleteUploadedMedia,
  onDescriptionChange,
  onDragCommandMenuMedia,
  onDragUploadedMedia,
  onFieldChange,
  onGeneratePromptChange,
  onGeneratePromptSubmit,
  onImportUrlChange,
  onImportUrlConfirm,
  onImportUrlPromptOpenChange,
  onLayoutChange,
  onMediaNameDraftChange,
  onNameChange,
  onNewMedia,
  onPreviewUploadedMedia,
  onRenameMedia,
  onRenameUploadedMedia,
  onSelectMedia,
  onSelectMediaAction,
  onSelectUploadedMedia,
  onUploadMediaFiles,
}: MediaCatalogPanelViewProps) {
  const mediaItemCount = uploadedMediaItems.length + mediaItems.length + mediaActions.length + (sourceMetadataItem ? 1 : 0)
  const animationState = React.useMemo(() => buildTimelineAnimationState({
    active: mediaItemCount > 0,
    itemCount: mediaItemCount,
    progress: mediaItemCount > 0 ? Math.min(1, mediaItemCount / 12) : 0,
    surface: 'floating-media',
  }), [mediaActions.length, mediaItemCount])
  const { style: animationStyle, ...animationAttributes } = animationState.attributes
  return (
    <section ref={panelRef} className={cn('h-full min-h-0 overflow-auto px-1 pb-2', panelTextClass)} aria-label="Media" data-kg-media-layout={catalogLayout} data-kg-media-list-layout={catalogLayout === 'list' ? '3-rows' : undefined} data-kg-media-grid-layout={catalogLayout === 'grid' ? '1' : undefined} data-kg-media-panel="1" data-kg-media-image-format-preference={MEDIA_IMAGE_FORMAT_PREFERENCE_ATTR} data-kg-media-video-format-preference={MEDIA_VIDEO_FORMAT_PREFERENCE_ATTR} {...animationAttributes} style={animationStyle}>
      <MediaLightbox
        open={!!lightboxItem}
        src={lightboxItem?.linkUrl || ''}
        alt={lightboxItem?.name || 'Uploaded media'}
        kind={lightboxItem?.kind || 'media'}
        onClose={() => onCloseLightbox()}
      />
      <MediaLightbox
        open={generateLightboxOpen}
        src={generatedMediaItem?.linkUrl || ''}
        alt={generatedMediaItem?.name || 'Generated media output'}
        kind={generatedMediaItem?.kind || 'image'}
        title="Generate Media"
        descriptionLabel="Prompt"
        promptValue={generateMediaPrompt}
        promptPlaceholder="Describe the media to generate"
        promptSubmitLabel="Generate media"
        promptSubmitting={generateMediaBusy}
        promptParameters={generatePromptParameters}
        onPromptChange={onGeneratePromptChange}
        onPromptSubmit={onGeneratePromptSubmit}
        onClose={() => onCloseGenerateLightbox()}
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
            aria-label="New Media upload"
            data-kg-media-upload-input="1"
            onChange={event => {
              void onUploadMediaFiles(event.currentTarget.files)
              event.currentTarget.value = ''
            }}
          />
          <button
            type="button"
            className={cn('inline-flex h-6 min-w-6 items-center justify-center rounded border px-1 text-xs font-semibold', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}
            title="New Media"
            aria-label="New Media"
            data-kg-media-new-button="1"
            onClick={onNewMedia}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden />
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
                  onClick={() => onLayoutChange(option.layout)}
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
      {importUrlPromptOpen ? (
        <section
          className={cn('mb-2 rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg)}
          aria-label="Import media URL"
          data-kg-media-import-url-prompt="1"
        >
          <ImportUrlPrompt
            urlDraft={importUrlDraft}
            onChange={onImportUrlChange}
            onConfirm={url => {
              void onImportUrlConfirm(url)
            }}
            onCancel={() => {
              if (importUrlBusy) return
              onImportUrlPromptOpenChange(false)
            }}
            confirmLabel={importUrlBusy ? 'Importing…' : 'Import URL'}
            autoFocus
          />
        </section>
      ) : null}
      <section ref={mediaListRef} tabIndex={-1} data-kg-media-list="1">
        {catalogLayout === 'list' ? (
          <section className="grid min-w-0 gap-2" aria-label="Media list" data-kg-media-list-rows="3">
            {sourceMetadataItem ? <MediaSourceMetadataRow item={sourceMetadataItem} /> : null}
            {uploadedMediaItems.map(item => (
              <UploadedMediaRow
                key={item.id}
                item={item}
                description={readUploadedMediaDescription(mediaDescriptionDrafts, item)}
                fieldText={readUploadedMediaFieldText(mediaFieldDrafts, item)}
                infoLabel={buildUploadedMediaInfoLabel(item)}
                onDelete={onDeleteUploadedMedia}
                onDescriptionChange={onDescriptionChange}
                onDragStart={onDragUploadedMedia}
                onFieldChange={onFieldChange}
                onNameChange={onNameChange}
                onRename={onRenameUploadedMedia}
                onSelect={onSelectUploadedMedia}
                onPreview={onPreviewUploadedMedia}
              />
            ))}
            {mediaItems.map(item => (
              <MediaCandidateRow
                key={item.key}
                item={item}
                displayName={readCommandMenuMediaNameDraft(mediaNameDrafts, getMediaNameSyncKey(item)) || item.label}
                onDragStart={onDragCommandMenuMedia}
                onSelect={onSelectMedia}
                onNameDraftChange={onMediaNameDraftChange}
                onRename={onRenameMedia}
              />
            ))}
            {mediaActions.map(action => (
              <MediaActionRow
                key={action.id}
                action={action}
                onSelect={onSelectMediaAction}
              />
            ))}
          </section>
        ) : (
          <section className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Media grid" data-kg-media-grid="1">
            {sourceMetadataItem ? <MediaSourceMetadataCard item={sourceMetadataItem} /> : null}
            {uploadedMediaItems.map(item => (
              <UploadedMediaCard
                key={item.id}
                item={item}
                description={readUploadedMediaDescription(mediaDescriptionDrafts, item)}
                fieldText={readUploadedMediaFieldText(mediaFieldDrafts, item)}
                infoLabel={buildUploadedMediaInfoLabel(item)}
                onDelete={onDeleteUploadedMedia}
                onDescriptionChange={onDescriptionChange}
                onDragStart={onDragUploadedMedia}
                onFieldChange={onFieldChange}
                onNameChange={onNameChange}
                onRename={onRenameUploadedMedia}
                onSelect={onSelectUploadedMedia}
                onPreview={onPreviewUploadedMedia}
              />
            ))}
            {mediaItems.map(item => (
              <MediaCandidateCard
                key={item.key}
                item={item}
                displayName={readCommandMenuMediaNameDraft(mediaNameDrafts, getMediaNameSyncKey(item)) || item.label}
                onDragStart={onDragCommandMenuMedia}
                onSelect={onSelectMedia}
                onNameDraftChange={onMediaNameDraftChange}
                onRename={onRenameMedia}
              />
            ))}
            {mediaActions.map(action => (
              <MediaActionCard
                key={action.id}
                action={action}
                onSelect={onSelectMediaAction}
              />
            ))}
          </section>
        )}
      </section>
    </section>
  )
}
