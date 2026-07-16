import React from 'react'

import type { StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { StoryboardCardMetaScrollRail } from '@/components/StoryboardWidgetCanvas/StoryboardCardMetaScrollRail'
import { shouldStoryboardCardTextColumnOwnSummaryEditTarget } from '@/components/StoryboardWidgetCanvas/storyboardCardSummaryEditTarget'
import type { StoryboardCardTextModel } from '@/components/StoryboardWidgetCanvas/storyboardCardTextModel'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import {
  CARD_TEXT_SURFACE_COLUMN_CLASS_NAME,
  CARD_TEXT_SURFACE_EDIT_CLASS_NAME,
  CARD_TEXT_SURFACE_SCROLL_CLASS_NAME,
  CARD_TEXT_SURFACE_TEXT_CLASS_NAME,
  CARD_TEXT_SURFACE_VIEW_CLASS_NAME,
} from '@/lib/cards/cardTextSurfaceFrame'
import type { GraphNodeCardTextFieldSpec } from '@/lib/cards/graphNodeCardFields'
import type { InlineMediaCommandCandidate } from '@/lib/command-menu/inlineCommandMenuCatalog'
import type { TextareaInvocationMediaAttachment } from '@/lib/ui/textareaInvocationProjection'
import { cn } from '@/lib/utils'

export function StoryboardCardTextEditSurface(props: {
  card: StoryboardCardModel
  textModel: StoryboardCardTextModel
  projectedMediaAttachments: readonly TextareaInvocationMediaAttachment[] | null
  storyboardCommandContextText: string
  onCommitLane: (card: StoryboardCardModel, nextValue: string) => void
  onCommitText: (card: StoryboardCardModel, field: GraphNodeCardTextFieldSpec, nextValue: string) => void
  onCommitType: (card: StoryboardCardModel, nextValue: string) => void
  onMediaCommandSelect: (candidate: InlineMediaCommandCandidate) => void
  onActivate: () => void
}) {
  const {
    card,
    onCommitLane,
    onCommitText,
    onCommitType,
    onMediaCommandSelect,
    onActivate,
    projectedMediaAttachments,
    storyboardCommandContextText,
    textModel,
  } = props
  const [editRequestKey, setEditRequestKey] = React.useState<number | null>(null)
  const requestPrimaryEdit = React.useCallback((event: React.SyntheticEvent<HTMLElement>) => {
    if (!shouldStoryboardCardTextColumnOwnSummaryEditTarget(event.target, event.currentTarget)) return
    event.preventDefault()
    event.stopPropagation()
    setEditRequestKey(key => (key || 0) + 1)
  }, [])

  return (
    <section
      className={CARD_TEXT_SURFACE_COLUMN_CLASS_NAME}
      data-kg-storyboard-card-text-column="1"
      onPointerDownCapture={requestPrimaryEdit}
      onMouseDownCapture={requestPrimaryEdit}
      style={{ borderColor: 'var(--kg-border)' }}
    >
      <StoryboardCardMetaScrollRail card={card} onCommitLane={onCommitLane} onCommitType={onCommitType} />
      <section
        className={CARD_TEXT_SURFACE_SCROLL_CLASS_NAME}
        data-kg-canvas-pointer-ignore="true"
        data-kg-canvas-wheel-ignore="true"
        data-kg-media-scroll-surface="1"
        data-kg-storyboard-card-active-text-field={textModel.primaryField.id}
        data-kg-storyboard-card-brief="1"
        data-kg-storyboard-card-summary-scroll="1"
        onWheelCapture={event => event.stopPropagation()}
      >
        <CardInlineTextEditor
          id={`storyboard-card-shared-text-${card.id}`}
          value={textModel.primaryRaw || card.slugline || ''}
          displayValue={textModel.primaryDisplay || card.slugline || ''}
          ariaLabel={`${textModel.primaryField.label} for ${card.id}`}
          placeholder={textModel.primaryField.placeholder}
          canEdit
          editActivation="click"
          editRequestKey={editRequestKey}
          multiline
          displayLineClamp="none"
          markdownPreview="auto"
          markdownCommandContextText={storyboardCommandContextText}
          mediaCommandMode="external"
          editorSurface="viewer"
          inlineChipDensity="compact"
          openOnPointerDown
          rows={2}
          projectedMediaAttachments={projectedMediaAttachments}
          showCommandLaunchers={false}
          onCommit={nextValue => onCommitText(card, textModel.primaryField, nextValue)}
          onEditingChange={editing => { if (editing) onActivate() }}
          onMediaCommandSelect={onMediaCommandSelect}
          displayClassName={cn(CARD_TEXT_SURFACE_VIEW_CLASS_NAME, CARD_TEXT_SURFACE_TEXT_CLASS_NAME)}
          editorClassName={cn(CARD_TEXT_SURFACE_EDIT_CLASS_NAME, CARD_TEXT_SURFACE_TEXT_CLASS_NAME)}
        />
      </section>
    </section>
  )
}

export function StoryboardCardOutputEditSurface(props: {
  card: StoryboardCardModel
  textModel: StoryboardCardTextModel
  onCommitText: (card: StoryboardCardModel, field: GraphNodeCardTextFieldSpec, nextValue: string) => void
  onActivate: () => void
}) {
  const { card, onActivate, onCommitText, textModel } = props
  const outputField = textModel.secondaryEditable ? textModel.secondaryField : null
  const [editRequestKey, setEditRequestKey] = React.useState<number | null>(null)
  const requestOutputEdit = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.currentTarget.querySelector('[data-kg-card-inline-viewer-edit-surface="1"][contenteditable="true"]')) return
    setEditRequestKey(key => (key || 0) + 1)
  }, [])
  if (!outputField) return null
  return (
    <section
      aria-label={`Output input for ${card.id}`}
      className={CARD_TEXT_SURFACE_COLUMN_CLASS_NAME}
      data-kg-canvas-pointer-ignore="true"
      data-kg-storyboard-card-output-pane="1"
      onPointerDownCapture={requestOutputEdit}
      style={{ borderColor: 'var(--kg-border)' }}
    >
      <section
        className={CARD_TEXT_SURFACE_SCROLL_CLASS_NAME}
        data-kg-canvas-wheel-ignore="true"
        data-kg-media-scroll-surface="1"
        data-kg-storyboard-card-active-text-field={outputField.id}
        onWheelCapture={event => event.stopPropagation()}
      >
        <CardInlineTextEditor
          id={`storyboard-card-output-${card.id}`}
          value={textModel.secondaryRaw}
          displayValue={textModel.secondaryDisplay || textModel.secondaryRaw}
          ariaLabel={`${outputField.label} for ${card.id}`}
          placeholder={outputField.placeholder}
          canEdit
          editActivation="click"
          editRequestKey={editRequestKey}
          multiline
          displayLineClamp="none"
          markdownPreview="auto"
          markdownCommandMenus={false}
          editorSurface="viewer"
          inlineChipDensity="compact"
          openOnPointerDown
          rows={4}
          showCommandLaunchers={false}
          onCommit={nextValue => onCommitText(card, outputField, nextValue)}
          onEditingChange={editing => { if (editing) onActivate() }}
          displayClassName={cn(CARD_TEXT_SURFACE_VIEW_CLASS_NAME, CARD_TEXT_SURFACE_TEXT_CLASS_NAME)}
          editorClassName={cn(CARD_TEXT_SURFACE_EDIT_CLASS_NAME, CARD_TEXT_SURFACE_TEXT_CLASS_NAME)}
        />
      </section>
    </section>
  )
}
