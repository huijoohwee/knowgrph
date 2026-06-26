import { CardMediaEmptyPlaceholder, CardMediaLoadingSkeleton } from '@/lib/cards/CardMediaPreview'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { CardMarkdownPreview } from '@/lib/cards/CardMarkdownPreview'
import { CARD_MARKDOWN_PREVIEW_EMBEDDED_SURFACE_CLASS_NAME } from '@/lib/cards/cardMarkdownPreviewUtils'
import type { RichMediaPanelProps } from './RichMediaPanel.types'
import type { RichMediaPanelModel } from './useRichMediaPanelModel'

export function RichMediaPanelTextSurface(args: {
  model: RichMediaPanelModel
  props: RichMediaPanelProps
}) {
  const { model, props } = args
  if (model.showPanelInlineTextEditor) {
    return (
      <section
        aria-label="Rich media markdown preview"
        data-kg-rich-media-markdown-preview="1"
        data-kg-rich-media-inline-edit="1"
        data-kg-canvas-wheel-ignore="true"
        data-kg-media-scroll-surface="1"
        className={CARD_MARKDOWN_PREVIEW_EMBEDDED_SURFACE_CLASS_NAME}
        style={{
          borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
          height: '100%',
          overflowX: 'hidden',
          overflowY: 'auto',
          overscrollBehaviorX: 'none',
          overscrollBehaviorY: 'contain',
          pointerEvents: 'auto',
          scrollbarGutter: 'stable',
          touchAction: 'pan-y',
          width: '100%',
        }}
        onPointerDownCapture={event => {
          try {
            event.stopPropagation()
          } catch {
            void 0
          }
        }}
        onWheelCapture={event => {
          try {
            event.stopPropagation()
          } catch {
            void 0
          }
        }}
      >
        <CardInlineTextEditor
          value={model.panelDisplayText}
          ariaLabel={`${model.title} text`}
          placeholder="Add text"
          canEdit
          editActivation="click"
          multiline
          rows={8}
          markdownPreview="auto"
          markdownCommandMenus
          markdownCommandContextText={model.panelMarkdownCommandContextText}
          onCommit={nextValue => {
            const nextText = String(nextValue || '')
            model.setPanelDraftText(nextText)
            props.onPanelChange?.({ activeTab: 'text', freezeConnectedOutput: true, text: nextText })
          }}
          displayClassName="block h-full min-h-full w-full overflow-y-auto overflow-x-hidden"
          editorClassName="block h-full min-h-full w-full overflow-y-auto overflow-x-hidden font-mono text-xs leading-5"
        />
      </section>
    )
  }
  if (model.showPanelMarkdownPreview) {
    return (
      <section
        aria-label="Rich media markdown preview"
        data-kg-rich-media-markdown-preview="1"
        data-kg-canvas-wheel-ignore="true"
        data-kg-media-scroll-surface="1"
        className={CARD_MARKDOWN_PREVIEW_EMBEDDED_SURFACE_CLASS_NAME}
        style={{
          borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
          height: '100%',
          overflowX: 'hidden',
          overflowY: 'auto',
          overscrollBehaviorX: 'none',
          overscrollBehaviorY: 'contain',
          pointerEvents: 'auto',
          scrollbarGutter: 'stable',
          touchAction: 'pan-y',
          width: '100%',
        }}
      >
        <CardMarkdownPreview
          markdownText={model.panelDisplayText}
          activeDocumentPath={model.panelMarkdownDocumentPath}
          uiPanelTextFontClass={model.uiPanelTextFontClass}
          uiPanelMonospaceTextClass={model.uiPanelMonospaceTextClass}
          richMediaDataAttrs
        />
      </section>
    )
  }
  if (model.panelIsLoading) {
    return (
      <CardMediaLoadingSkeleton
        label={model.panelLoadingLabel}
        variant={model.loadingSkeletonVariant}
        richMediaDataAttrs
      />
    )
  }
  if (model.isEmptyPanel) {
    return (
      <CardMediaEmptyPlaceholder
        variant={model.expectedEmptyPlaceholderVariant}
        richMediaDataAttrs
      />
    )
  }
  return null
}
