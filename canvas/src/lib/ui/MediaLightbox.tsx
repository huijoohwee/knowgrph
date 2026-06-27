import React from 'react'
import { FileAudio, Image as ImageIcon, Maximize2, Wand2, X } from 'lucide-react'
import RichMediaPanel from '@/components/RichMediaPanel'
import type { MarkdownMediaDownloadKind } from '@/lib/markdown-core/ui/mediaDownload'
import PreviewOverlay from '@/features/panels/views/preview-panel/ui/PreviewOverlay'
import { buildStaticRichMediaPanelOverlayState } from '@/lib/render/richMediaSsot'
import { PanelSelect, PanelTextarea } from '@/lib/ui/panelFormControls'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

export type MediaLightboxPromptParameterOption = {
  value: string
  label: string
}

export type MediaLightboxPromptParameter = {
  id: string
  label: string
  value?: string
  options: readonly MediaLightboxPromptParameterOption[]
}

export type MediaLightboxPromptParameters = Record<string, string>

type MediaLightboxProps = {
  open: boolean
  src: string
  alt: string
  kind: MarkdownMediaDownloadKind
  title?: string
  description?: string
  descriptionLabel?: string
  promptValue?: string
  promptPlaceholder?: string
  promptSubmitLabel?: string
  promptSubmitting?: boolean
  promptParameters?: readonly MediaLightboxPromptParameter[]
  onPromptChange?: (value: string) => void
  onPromptSubmit?: (value: string, parameters?: MediaLightboxPromptParameters) => void | Promise<void>
  onClose: () => void
}

function normalizePromptDraft(value: string): string {
  return String(value || '').replace(/\r\n?/g, '\n').trim()
}

function readPromptParameterValues(parameters: readonly MediaLightboxPromptParameter[]): MediaLightboxPromptParameters {
  const values: MediaLightboxPromptParameters = {}
  for (const parameter of parameters) {
    const id = String(parameter.id || '').trim()
    if (!id || parameter.options.length === 0) continue
    const currentValue = String(parameter.value || '').trim()
    const fallbackValue = String(parameter.options[0]?.value || '').trim()
    values[id] = currentValue || fallbackValue
  }
  return values
}

export function MediaLightbox({
  open,
  src,
  alt,
  kind,
  title,
  description,
  descriptionLabel,
  promptValue,
  promptPlaceholder,
  promptSubmitLabel,
  promptSubmitting,
  promptParameters,
  onPromptChange,
  onPromptSubmit,
  onClose,
}: MediaLightboxProps) {
  const rootRef = React.useRef<HTMLElement | null>(null)
  const [promptDraft, setPromptDraft] = React.useState(() => normalizePromptDraft(String(promptValue ?? description ?? '')))
  const [parameterValues, setParameterValues] = React.useState<MediaLightboxPromptParameters>(() => readPromptParameterValues(promptParameters || []))
  const [promptPending, setPromptPending] = React.useState(false)
  const displayTitle = String(title || '').trim()
  const detailText = String(description || '').replace(/\s+/g, ' ').trim()
  const detailLabel = String(descriptionLabel || 'Prompt').replace(/\s+/g, ' ').trim()
  const promptDraftSeed = normalizePromptDraft(String(promptValue ?? description ?? ''))
  const editablePrompt = Boolean(onPromptChange || onPromptSubmit)
  const promptBusy = Boolean(promptSubmitting || promptPending)
  const canSubmitPrompt = Boolean(onPromptSubmit && promptDraft.trim() && !promptBusy)
  const parameterControls = React.useMemo(
    () => (promptParameters || []).filter(parameter => String(parameter.id || '').trim() && parameter.options.length > 0),
    [promptParameters],
  )
  const hasDetails = editablePrompt || !!detailText
  const hasMediaSource = !!String(src || '').trim()
  const isImage = kind === 'image'
  const isVideo = kind === 'video'
  const richMediaRenderKind = isImage ? 'image' : isVideo ? 'video' : 'audio'
  const lightboxPanelState = React.useMemo(
    () => hasMediaSource ? buildStaticRichMediaPanelOverlayState({ renderKind: richMediaRenderKind }) : null,
    [hasMediaSource, richMediaRenderKind],
  )

  React.useEffect(() => {
    if (!open) return
    setPromptDraft(promptDraftSeed)
  }, [open, promptDraftSeed])

  React.useEffect(() => {
    if (!open) return
    setParameterValues(readPromptParameterValues(parameterControls))
  }, [open, parameterControls])

  const enterFullscreen = React.useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const requestFullscreen = (root as HTMLElement & { requestFullscreen?: () => Promise<void> }).requestFullscreen
    try {
      void requestFullscreen?.call(root)
    } catch {
      void 0
    }
  }, [])

  const submitPrompt = React.useCallback(() => {
    if (!onPromptSubmit || promptBusy) return
    const nextPrompt = promptDraft.trim()
    if (!nextPrompt) return
    const result = onPromptSubmit(nextPrompt, parameterValues)
    if (result && typeof (result as Promise<void>).then === 'function') {
      setPromptPending(true)
      void Promise.resolve(result).finally(() => setPromptPending(false))
    }
  }, [onPromptSubmit, parameterValues, promptBusy, promptDraft])

  return (
    <PreviewOverlay
      open={open && (hasMediaSource || editablePrompt)}
      onClose={onClose}
      overlayClassName="bg-black/85"
      panelClassName="relative h-[min(94dvh,58rem)] w-[min(94vw,76rem)] overflow-hidden rounded-none border-0 bg-transparent shadow-none"
    >
      <section
        ref={rootRef}
        className="relative grid h-full w-full grid-rows-[3rem_minmax(0,1fr)_auto] bg-black text-white"
        data-kg-media-lightbox="1"
        data-kg-media-lightbox-kind={kind}
        aria-label="Media lightbox"
      >
        <header className="relative z-20 flex min-w-0 items-center justify-center px-14">
          {displayTitle ? (
            <h2 className="truncate text-sm font-semibold text-white" data-kg-media-lightbox-title="1">
              {displayTitle}
            </h2>
          ) : (
            <span className="sr-only">{alt}</span>
          )}
        </header>
        <menu
          className="absolute right-2 top-2 z-20 m-0 flex list-none items-center gap-1 p-0"
          aria-label="Media lightbox actions"
        >
          <li className="list-none">
            <button
              type="button"
              className={cn('inline-flex h-8 w-8 items-center justify-center rounded border bg-black/50 text-white backdrop-blur-sm', UI_THEME_TOKENS.panel.border)}
              title="Enter fullscreen"
              aria-label="Enter fullscreen"
              data-kg-media-lightbox-fullscreen="1"
              onClick={event => {
                event.stopPropagation()
                enterFullscreen()
              }}
            >
              <Maximize2 className="h-4 w-4" strokeWidth={1.7} aria-hidden />
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={cn('inline-flex h-8 w-8 items-center justify-center rounded border bg-black/50 text-white backdrop-blur-sm', UI_THEME_TOKENS.panel.border)}
              title="Close"
              aria-label="Close media lightbox"
              data-kg-media-lightbox-close="1"
              onClick={event => {
                event.stopPropagation()
                onClose()
              }}
            >
              <X className="h-4 w-4" strokeWidth={1.7} aria-hidden />
            </button>
          </li>
        </menu>
        <section className="min-h-0" aria-label="Generated media output" data-kg-media-lightbox-media-panel="1">
          {!hasMediaSource ? (
            <section className="grid h-full w-full place-items-center p-6" data-kg-media-lightbox-empty-output="1">
              <section className={cn('grid min-h-48 w-[min(88vw,36rem)] place-items-center gap-3 rounded border border-dashed p-6 text-center', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}>
                <ImageIcon className={cn('h-8 w-8', UI_THEME_TOKENS.text.tertiary)} strokeWidth={1.7} aria-hidden />
                <p className={cn('m-0 max-w-sm text-sm', UI_THEME_TOKENS.text.secondary)}>Generated media will appear here.</p>
              </section>
            </section>
          ) : (
            <section className="flex h-full w-full items-center justify-center p-6" data-kg-media-lightbox-player="1">
              <section className="grid h-full w-full max-w-5xl place-items-center gap-4">
                {isImage ? (
                  <section className="h-full w-full max-h-[70dvh]" data-kg-media-lightbox-image="1">
                    <RichMediaPanel
                      title={displayTitle || alt || 'Image'}
                      url={src}
                      openUrl={src}
                      kind="image"
                      interactive
                      panelChrome="flowEditor"
                      scrollOwner="media"
                      panel={lightboxPanelState || undefined}
                      style={{ height: '100%' }}
                    />
                  </section>
                ) : isVideo ? (
                  <section className="h-full w-full max-h-[70dvh]" data-kg-media-lightbox-video="1">
                    <RichMediaPanel
                      title={displayTitle || alt || 'Video'}
                      url={src}
                      openUrl={src}
                      kind="video"
                      interactive
                      videoControls
                      panelChrome="flowEditor"
                      scrollOwner="media"
                      panel={lightboxPanelState || undefined}
                      style={{ height: '100%' }}
                    />
                  </section>
                ) : (
                  <section className="grid h-full w-full max-h-[24rem] place-items-center gap-4" data-kg-media-lightbox-audio="1">
                    <FileAudio className="h-10 w-10 text-white/70" strokeWidth={1.7} aria-hidden />
                    <section className="w-full max-w-3xl">
                      <RichMediaPanel
                        title={displayTitle || alt || 'Audio'}
                        url={src}
                        openUrl={src}
                        kind="audio"
                        interactive
                        panelChrome="flowEditor"
                        scrollOwner="media"
                        panel={lightboxPanelState || undefined}
                        style={{ height: '10rem' }}
                      />
                    </section>
                  </section>
                )}
                <span className="sr-only">{alt}</span>
              </section>
            </section>
          )}
        </section>
        {hasDetails ? (
          <section className={cn('mx-auto mb-5 grid w-[min(92vw,38rem)] gap-3 rounded-lg border p-4 text-sm shadow-xl backdrop-blur-md', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.tooltip.bg, UI_THEME_TOKENS.tooltip.text)} aria-label={detailLabel || 'Prompt'} data-kg-media-lightbox-details="1" data-kg-media-lightbox-prompt-panel="1">
            {editablePrompt ? (
              <form
                className="grid gap-3"
                aria-label={`${detailLabel || 'Prompt'} generator`}
                data-kg-media-lightbox-prompt-form="1"
                onSubmit={event => {
                  event.preventDefault()
                  submitPrompt()
                }}
              >
                <PanelTextarea
                  variant="transparent"
                  rowHeightPreset="compact"
                  rows={5}
                  className={cn('text-sm leading-6', UI_THEME_TOKENS.tooltip.text, UI_THEME_TOKENS.input.placeholder, UI_THEME_TOKENS.focus.primaryBorderRing)}
                  value={promptDraft}
                  placeholder={promptPlaceholder || detailLabel || 'Prompt'}
                  aria-label={detailLabel || 'Prompt'}
                  data-kg-media-lightbox-description="1"
                  data-kg-media-lightbox-prompt="1"
                  data-kg-media-lightbox-prompt-input="1"
                  onChange={event => {
                    const nextValue = event.currentTarget.value
                    setPromptDraft(nextValue)
                    onPromptChange?.(nextValue)
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      submitPrompt()
                    }
                  }}
                />
                <footer className={cn('flex min-w-0 items-center gap-2 border-t pt-2', UI_THEME_TOKENS.panel.divider)} data-kg-media-lightbox-parameter-row="1">
                  <section className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto" aria-label="Media generation parameters">
                    {parameterControls.map(parameter => (
                      <label
                        key={parameter.id}
                        className={cn(
                          'block shrink-0',
                          parameter.id === 'model' ? 'w-[13.25rem]' : 'w-[5.25rem]',
                        )}
                      >
                        <span className="sr-only">{parameter.label}</span>
                        <PanelSelect
                          variant="transparent"
                          className={cn('h-8 truncate text-xs', UI_THEME_TOKENS.tooltip.text, UI_THEME_TOKENS.focus.primaryBorderRing)}
                          value={parameterValues[parameter.id] || parameter.options[0]?.value || ''}
                          aria-label={parameter.label}
                          data-kg-media-lightbox-parameter={parameter.id}
                          onChange={event => {
                            const nextValue = event.currentTarget.value
                            setParameterValues(current => ({ ...current, [parameter.id]: nextValue }))
                          }}
                        >
                          {parameter.options.map(option => (
                            <option key={`${parameter.id}:${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </PanelSelect>
                      </label>
                    ))}
                  </section>
                  <button
                    type="submit"
                    className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-45', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.primaryOutline)}
                    disabled={!canSubmitPrompt}
                    title={promptSubmitLabel || 'Generate media'}
                    aria-label={promptSubmitLabel || 'Generate media'}
                    data-kg-media-lightbox-prompt-submit="1"
                  >
                    <Wand2 className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden />
                    <span className="sr-only">{promptSubmitLabel || 'Generate media'}</span>
                  </button>
                </footer>
              </form>
            ) : detailText ? <p className="m-0 leading-relaxed" data-kg-media-lightbox-description="1" data-kg-media-lightbox-prompt="1">{detailText}</p> : null}
          </section>
        ) : null}
      </section>
    </PreviewOverlay>
  )
}
