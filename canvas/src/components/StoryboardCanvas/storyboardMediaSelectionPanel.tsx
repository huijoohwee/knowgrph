import React from 'react'
import { Image as ImageIcon, Plus } from 'lucide-react'
import { CardMediaLoadingSkeleton, CardMediaPreview } from '@/lib/cards/CardMediaPreview'
import { MediaDownloadOverlay, MediaInfoOverlay, MediaKindOverlay, MediaOpenLinkOverlay, MediaPromptActionOverlay } from '@/lib/ui/MediaKindOverlay'
import { MediaLightbox, type MediaLightboxPromptParameter, type MediaLightboxPromptParameters } from '@/lib/ui/MediaLightbox'
import { resolveMediaKindOverlayIcon } from '@/lib/ui/mediaKindOverlayIcon'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_RESPONSIVE_STORYBOARD_REFERENCE_LINK_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import {
  CHAT_BYTEPLUS_IMAGE_MODEL_OPTIONS,
  CHAT_BYTEPLUS_VIDEO_MODEL_OPTIONS,
  CHAT_GEMINI_VIDEO_MODEL_OPTIONS,
} from '@/lib/chatEndpointModels'
import type { StoryboardCardModel, StoryboardCardReference } from '@/components/StoryboardCanvas/storyboardModel'

export type StoryboardDisplayMedia = { kind: 'image' | 'svg' | 'video' | 'audio' | 'iframe'; url: string; srcDoc?: string }

type StoryboardMediaLoadingState = {
  label: string
  variant: 'text' | 'image' | 'video' | 'audio' | 'iframe'
}

type StoryboardMediaSelectionSlot = {
  id: string
  label: string
  media: StoryboardDisplayMedia | null
  href: string
}

const IMAGE_ASPECT_RATIO_PARAMETER_OPTIONS = [
  { value: 'landscape', label: '16:9' },
  { value: '4:3', label: '4:3' },
  { value: 'square', label: '1:1' },
  { value: '3:4', label: '3:4' },
  { value: 'portrait', label: '9:16' },
] as const

const VIDEO_ASPECT_RATIO_PARAMETER_OPTIONS = [
  { value: '16:9', label: '16:9' },
  { value: '4:3', label: '4:3' },
  { value: '1:1', label: '1:1' },
  { value: '3:4', label: '3:4' },
  { value: '9:16', label: '9:16' },
] as const

const MEDIA_RESOLUTION_PARAMETER_OPTIONS = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '2K', label: '2K' },
] as const

const MEDIA_DURATION_PARAMETER_OPTIONS = [
  { value: '4', label: '4s' },
  { value: '8', label: '8s' },
  { value: '12', label: '12s' },
] as const

const MEDIA_VARIATION_COUNT_PARAMETER_OPTIONS = [
  { value: '1', label: 'x1' },
  { value: '2', label: 'x2' },
  { value: '4', label: 'x4' },
] as const

const isStoryboardDisplayReference = (
  reference: StoryboardCardReference,
): reference is StoryboardCardReference & { kind: StoryboardDisplayMedia['kind'] } =>
  reference.kind === 'image'
  || reference.kind === 'svg'
  || reference.kind === 'video'
  || reference.kind === 'audio'
  || reference.kind === 'iframe'

function buildStoryboardMediaSelectionSlots(props: {
  card: StoryboardCardModel
  media: StoryboardDisplayMedia | null
}): StoryboardMediaSelectionSlot[] {
  const slots: StoryboardMediaSelectionSlot[] = []
  const seen = new Set<string>()
  const pushSlot = (slot: StoryboardMediaSelectionSlot) => {
    const key = `${slot.media?.kind || 'empty'}:${slot.media?.url || slot.media?.srcDoc || slot.href || slot.id}`.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    slots.push(slot)
  }
  if (props.media) {
    pushSlot({
      id: `${props.card.id}:media:primary`,
      label: props.media.kind === 'audio' ? 'Audio' : props.media.kind === 'video' ? 'Video' : 'Media 1',
      media: props.media,
      href: props.card.href,
    })
  }
  props.card.references.forEach((reference, index) => {
    if (!isStoryboardDisplayReference(reference)) return
    pushSlot({
      id: `${props.card.id}:media:reference:${index}`,
      label: `Media ${slots.length + 1}`,
      media: {
        kind: reference.kind,
        url: reference.url,
      },
      href: reference.url,
    })
  })
  return slots.slice(0, 2)
}

function readStoryboardMediaDownloadKind(media: StoryboardDisplayMedia | null): 'image' | 'video' | 'audio' | 'media' {
  if (media?.kind === 'image' || media?.kind === 'svg') return 'image'
  if (media?.kind === 'video') return 'video'
  if (media?.kind === 'audio') return 'audio'
  return 'media'
}

function normalizeStoryboardLightboxText(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function buildUniquePromptParameterOptions(values: readonly string[], currentValue: string): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const seen = new Set<string>()
  const push = (value: string) => {
    const cleanValue = normalizeStoryboardLightboxText(value)
    if (!cleanValue || seen.has(cleanValue)) return
    seen.add(cleanValue)
    options.push({ value: cleanValue, label: cleanValue })
  }
  push(currentValue)
  values.forEach(push)
  return options
}

function readStoryboardMediaLightboxDescription(card: StoryboardCardModel): string {
  for (const value of [card.prompt, card.output, card.summary, card.action]) {
    const text = normalizeStoryboardLightboxText(value)
    if (text) return text
  }
  return ''
}

function buildStoryboardMediaPromptParameters(props: {
  kind: 'image' | 'video' | 'audio' | 'media'
  model: string
}): readonly MediaLightboxPromptParameter[] {
  const currentModel = normalizeStoryboardLightboxText(props.model)
  const modelOptions = props.kind === 'image'
    ? buildUniquePromptParameterOptions(CHAT_BYTEPLUS_IMAGE_MODEL_OPTIONS, currentModel)
    : props.kind === 'video'
      ? buildUniquePromptParameterOptions([...CHAT_BYTEPLUS_VIDEO_MODEL_OPTIONS, ...CHAT_GEMINI_VIDEO_MODEL_OPTIONS], currentModel)
      : currentModel
        ? buildUniquePromptParameterOptions([currentModel], currentModel)
        : []
  const parameters: MediaLightboxPromptParameter[] = []
  if (modelOptions.length > 0) {
    parameters.push({
      id: 'model',
      label: 'Model',
      value: currentModel || modelOptions[0]?.value,
      options: modelOptions,
    })
  }
  if (props.kind === 'image') {
    parameters.push(
      { id: 'aspectRatio', label: 'Aspect', value: 'landscape', options: IMAGE_ASPECT_RATIO_PARAMETER_OPTIONS },
      { id: 'resolution', label: 'Resolution', value: '2K', options: MEDIA_RESOLUTION_PARAMETER_OPTIONS },
      { id: 'count', label: 'Count', value: '1', options: MEDIA_VARIATION_COUNT_PARAMETER_OPTIONS },
    )
  } else if (props.kind === 'video') {
    parameters.push(
      { id: 'aspectRatio', label: 'Aspect', value: '16:9', options: VIDEO_ASPECT_RATIO_PARAMETER_OPTIONS },
      { id: 'resolution', label: 'Resolution', value: '1080p', options: MEDIA_RESOLUTION_PARAMETER_OPTIONS },
      { id: 'duration', label: 'Duration', value: '8', options: MEDIA_DURATION_PARAMETER_OPTIONS },
    )
  } else if (props.kind === 'audio') {
    parameters.push(
      { id: 'duration', label: 'Duration', value: '8', options: MEDIA_DURATION_PARAMETER_OPTIONS },
      { id: 'count', label: 'Count', value: '1', options: MEDIA_VARIATION_COUNT_PARAMETER_OPTIONS },
    )
  }
  return parameters
}

export function StoryboardMediaPreview(props: {
  title: string
  href: string
  media: StoryboardDisplayMedia | null
}) {
  const { title, href, media } = props
  const interactive = media?.kind === 'video' || media?.kind === 'audio' || media?.kind === 'iframe'
  const Icon = resolveMediaKindOverlayIcon(media?.kind)
  const mediaHref = String(media?.url || '').trim()
  return (
    <section className="group relative h-full w-full overflow-hidden" aria-label={`Media preview for ${title}`} data-kg-storyboard-media-overlay-root="1">
      <CardMediaPreview
        kind={media?.kind || null}
        url={media?.url || ''}
        srcDoc={media?.srcDoc || undefined}
        title={title}
        href={href}
        interactive={interactive}
        fit="cover"
        videoControls={interactive}
        iframeScriptPolicy="allow"
        mediaClassName="h-full w-full"
      />
      {media ? <MediaKindOverlay Icon={Icon} label={media.kind} appearance="hover" /> : null}
      {mediaHref ? <MediaOpenLinkOverlay href={mediaHref} appearance="hover" /> : null}
      {mediaHref ? <MediaDownloadOverlay href={mediaHref} kind={readStoryboardMediaDownloadKind(media)} appearance="hover" /> : null}
      {media ? <MediaInfoOverlay label={`${media.kind} media: ${mediaHref || title}`} appearance="hover" /> : null}
    </section>
  )
}

export function StoryboardReferenceStrip(props: {
  cardId: string
  references: StoryboardCardReference[]
  layout?: 'strip' | 'grid'
}) {
  if (props.references.length === 0) return null
  const layout = props.layout === 'grid' ? 'grid' : 'strip'
  const visible = layout === 'grid' ? props.references : props.references.slice(0, 3)
  return (
    <section className="rounded-lg border border-black/5 bg-black/[0.025] px-2.5 py-2" aria-label="Reference pack">
      <section className="mb-2 flex items-center justify-between gap-2">
        <section className="flex items-center gap-2">
          <ImageIcon className={['h-3.5 w-3.5 shrink-0', UI_THEME_TOKENS.text.tertiary].join(' ')} aria-hidden="true" />
          <span className={['text-[10px] font-semibold uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
            Reference Pack
          </span>
        </section>
        <span className={['inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
          {props.references.length}
        </span>
      </section>
      <section className={layout === 'grid' ? 'grid max-h-40 grid-cols-2 gap-2 overflow-y-auto pb-1' : 'flex gap-2 overflow-x-auto pb-1'}>
        {visible.map((reference, index) => {
          const key = `${props.cardId}:reference:${index}`
          if (reference.kind === 'image' || reference.kind === 'svg') {
            const Icon = resolveMediaKindOverlayIcon(reference.kind)
            return (
              <span key={key} className={layout === 'grid' ? 'group relative block h-16 min-w-0' : 'group relative block h-14 w-14 shrink-0'}>
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noreferrer"
                  className={layout === 'grid' ? 'block h-full w-full overflow-hidden rounded-lg border border-black/10 bg-white' : 'block h-14 w-14 overflow-hidden rounded-lg border border-black/10 bg-white'}
                  title={reference.url}
                  draggable={false}
                  onDragStart={event => {
                    event.preventDefault()
                  }}
                >
                  <CardMediaPreview
                    kind={reference.kind}
                    url={reference.url}
                    title="Reference"
                    href={reference.url}
                    interactive={false}
                    fit="cover"
                    className="h-full w-full"
                    mediaClassName="h-full w-full"
                  />
                </a>
                <MediaKindOverlay Icon={Icon} label={reference.kind} appearance="hover" />
                <MediaOpenLinkOverlay href={reference.url} appearance="hover" />
                <MediaDownloadOverlay href={reference.url} kind="image" appearance="hover" />
              </span>
            )
          }
          return (
            <a
              key={key}
              href={reference.url}
              target="_blank"
              rel="noreferrer"
              className={[UI_RESPONSIVE_STORYBOARD_REFERENCE_LINK_CLASSNAME, 'rounded-lg border px-2 text-center text-[11px]', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.secondary].join(' ')}
              title={reference.url}
              draggable={false}
              onDragStart={event => {
                event.preventDefault()
              }}
            >
              {reference.kind === 'video' ? 'Video ref' : 'Open ref'}
            </a>
          )
        })}
      </section>
    </section>
  )
}

function StoryboardMediaSelectionSlotView(props: {
  slot: StoryboardMediaSelectionSlot
  title: string
  onAddMedia: () => void
  onOpenMedia: (slot: StoryboardMediaSelectionSlot) => void
}) {
  const { slot, title } = props
  const media = slot.media
  const mediaHref = String(media?.url || slot.href || '').trim()
  const interactive = media?.kind === 'video' || media?.kind === 'audio' || media?.kind === 'iframe'
  const lightboxKind = readStoryboardMediaDownloadKind(media)
  const canOpenLightbox = !!mediaHref && lightboxKind !== 'media'
  const Icon = resolveMediaKindOverlayIcon(media?.kind)
  const preview = media ? (
    <CardMediaPreview
      kind={media.kind}
      url={media.url}
      srcDoc={media.srcDoc}
      title={`${slot.label} for ${title}`}
      href={slot.href}
      interactive={!canOpenLightbox && interactive}
      fit="cover"
      videoControls={!canOpenLightbox && interactive}
      iframeScriptPolicy="allow"
      mediaClassName="h-full w-full"
    />
  ) : null
  return (
    <figure className="m-0 flex min-h-0 flex-col gap-1.5" data-kg-storyboard-media-slot="1">
      <figcaption className={['truncate text-[11px]', UI_THEME_TOKENS.text.secondary].join(' ')}>
        {slot.label}
      </figcaption>
      {media ? (
        <section className="group relative min-h-0 flex-1 overflow-hidden rounded-lg border border-black/5 bg-black/[0.06]" data-kg-storyboard-media-slot-frame="1">
          {preview}
          {canOpenLightbox ? (
            <button
              type="button"
              className="absolute inset-0 z-[1] cursor-zoom-in rounded-lg bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500"
              data-kg-storyboard-media-lightbox-trigger="1"
              aria-label={`Open ${slot.label} lightbox for ${title}`}
              onPointerDown={event => {
                event.stopPropagation()
              }}
              onPointerUp={event => {
                event.stopPropagation()
                props.onOpenMedia(slot)
              }}
              onMouseDown={event => {
                event.stopPropagation()
              }}
              onMouseUp={event => {
                event.stopPropagation()
                props.onOpenMedia(slot)
              }}
              onClick={event => {
                event.stopPropagation()
                props.onOpenMedia(slot)
              }}
            >
              <span className="sr-only">Open media lightbox</span>
            </button>
          ) : null}
          {canOpenLightbox ? (
            <MediaPromptActionOverlay
              appearance="hover"
              label="Modify prompt"
              onClick={() => props.onOpenMedia(slot)}
            />
          ) : null}
          <MediaKindOverlay Icon={Icon} label={media.kind} appearance="hover" />
          {mediaHref ? <MediaOpenLinkOverlay href={mediaHref} appearance="hover" /> : null}
          {mediaHref ? <MediaDownloadOverlay href={mediaHref} kind={lightboxKind} appearance="hover" /> : null}
        </section>
      ) : (
        <button
          type="button"
          className={[
            'flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-black/10 bg-black/[0.035] text-black/45',
            UI_THEME_TOKENS.button.hoverBg,
          ].join(' ')}
          aria-label={`Add media for ${title}`}
          onClick={event => {
            event.stopPropagation()
            props.onAddMedia()
          }}
        >
          <Plus className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
        </button>
      )}
    </figure>
  )
}

export function StoryboardMediaSelectionPanel(props: {
  card: StoryboardCardModel
  title: string
  media: StoryboardDisplayMedia | null
  loadingState: StoryboardMediaLoadingState | null
  model: string
  onAddMedia: () => void
  onGenerateMediaPrompt?: (card: StoryboardCardModel, prompt: string, parameters?: MediaLightboxPromptParameters) => void | Promise<void>
}) {
  const [lightboxSlotId, setLightboxSlotId] = React.useState<string | null>(null)
  const slots = buildStoryboardMediaSelectionSlots({ card: props.card, media: props.media })
  while (slots.length < 2) {
    slots.push({
      id: `${props.card.id}:media:empty:${slots.length}`,
      label: `Media ${slots.length + 1}`,
      media: null,
      href: '',
    })
  }
  const lightboxSlot = lightboxSlotId ? slots.find(slot => slot.id === lightboxSlotId) || null : null
  const lightboxMedia = lightboxSlot?.media || null
  const lightboxKind = readStoryboardMediaDownloadKind(lightboxMedia)
  const lightboxSrc = String(lightboxMedia?.url || '').trim()
  const lightboxPrompt = readStoryboardMediaLightboxDescription(props.card)
  const promptParameters = React.useMemo(
    () => buildStoryboardMediaPromptParameters({ kind: lightboxKind, model: props.model }),
    [lightboxKind, props.model],
  )
  return (
    <>
      <section className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(5.5rem,0.82fr)] gap-2 p-3" aria-label={`Media for ${props.title}`} data-kg-storyboard-media-selection-panel="1">
        <section className="grid min-h-0 grid-cols-2 gap-2" aria-label="Storyboard media slots">
          {props.loadingState ? (
            <section className="col-span-2 min-h-0 overflow-hidden rounded-lg border border-black/5 bg-black/[0.035]">
              <CardMediaLoadingSkeleton
                label={props.loadingState.label}
                variant={props.loadingState.variant}
              />
            </section>
          ) : (
            slots.map(slot => (
              <StoryboardMediaSelectionSlotView
                key={slot.id}
                slot={slot}
                title={props.title}
                onAddMedia={props.onAddMedia}
                onOpenMedia={slot => setLightboxSlotId(slot.id)}
              />
            ))
          )}
        </section>
        <section className="grid min-h-0 grid-cols-2 gap-2" aria-label="Storyboard media actions">
          <button
            type="button"
            className={[
              'flex min-h-0 items-center justify-center rounded-lg border border-dashed border-black/10 bg-black/[0.035] text-black/50',
              UI_THEME_TOKENS.button.hoverBg,
            ].join(' ')}
            data-kg-storyboard-add-media="1"
            aria-label={`Add media to storyboard card ${props.title}`}
            onClick={event => {
              event.stopPropagation()
              props.onAddMedia()
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
            <span className="sr-only">Add media</span>
          </button>
          <section className="min-h-0 rounded-lg border border-transparent" aria-hidden="true" />
        </section>
      </section>
      <MediaLightbox
        open={!!lightboxMedia && !!lightboxSrc && lightboxKind !== 'media'}
        src={lightboxSrc}
        alt={`${lightboxSlot?.label || 'Media'} for ${props.title}`}
        kind={lightboxKind}
        title={lightboxSlot?.label || props.title}
        description={lightboxPrompt}
        descriptionLabel="Prompt"
        promptValue={lightboxPrompt}
        promptSubmitLabel="Regenerate media"
        promptParameters={promptParameters}
        onPromptSubmit={props.onGenerateMediaPrompt ? (prompt, parameters) => props.onGenerateMediaPrompt?.(props.card, prompt, parameters) : undefined}
        onClose={() => setLightboxSlotId(null)}
      />
    </>
  )
}
