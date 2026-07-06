import React from 'react'
import { Check } from 'lucide-react'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { buildInlineMediaCommandContextFromRecord } from '@/lib/command-menu/inlineMediaCommandContext'
import { PanelField, PanelSelect, PanelTextInput } from '@/lib/ui/panelFormControls'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import type { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'

type StrybldrCardModel = ReturnType<typeof buildStoryboardBoardModel>['lanes'][number]['cards'][number]

export type StrybldrCardEditorDraft = {
  title: string
  summary: string
  action: string
  prompt: string
  order: string
}

export function StrybldrCardEditorSection(props: {
  draft: StrybldrCardEditorDraft
  editableCards: StrybldrCardModel[]
  selectedCard: StrybldrCardModel
  onDraftChange: React.Dispatch<React.SetStateAction<StrybldrCardEditorDraft>>
  onSave: () => void
  onSelectedCardIdChange: (nextCardId: string) => void
}) {
  const {
    draft,
    editableCards,
    onDraftChange,
    onSave,
    onSelectedCardIdChange,
    selectedCard,
  } = props
  const strybldrInlineTextDisplayClass = cn(
    'mt-1 w-full min-w-0 max-w-full rounded-md border px-3 py-1.5 text-xs min-h-8',
    UI_THEME_TOKENS.input.bg,
    UI_THEME_TOKENS.input.border,
    UI_THEME_TOKENS.input.text,
  )
  const strybldrInlineTextareaClass = cn(strybldrInlineTextDisplayClass, 'resize-y')
  const selectedCardInlineMediaCommandContext = React.useMemo(
    () => buildInlineMediaCommandContextFromRecord(selectedCard),
    [selectedCard],
  )
  return (
    <section className={cn('space-y-2 rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.headerBg)} aria-label="Strybldr card editor">
      <section className="flex items-center gap-2">
        <PanelSelect
          className="min-w-0 flex-1"
          value={selectedCard.id}
          aria-label="Strybldr card"
          onChange={event => onSelectedCardIdChange(event.target.value)}
        >
          {editableCards.map(card => (
            <option key={card.id} value={card.id}>
              {card.lane}: {card.title}
            </option>
          ))}
        </PanelSelect>
        <button
          type="button"
          className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
          title="Save card update"
          onClick={onSave}
        >
          <Check className="h-4 w-4" strokeWidth={1.7} aria-hidden={true} />
        </button>
      </section>
      <PanelField label="Title">
        <CardInlineTextEditor
          value={draft.title}
          ariaLabel="Strybldr card title"
          placeholder="Title"
          canEdit
          editActivation="click"
          displayClassName={strybldrInlineTextDisplayClass}
          editorClassName={strybldrInlineTextDisplayClass}
          onCommit={title => onDraftChange(cur => ({ ...cur, title }))}
        />
      </PanelField>
      <PanelField label="Summary">
        <CardInlineTextEditor
          value={draft.summary}
          ariaLabel="Strybldr card summary"
          placeholder="Summary"
          canEdit
          editActivation="click"
          multiline
          rows={2}
          markdownPreview="auto"
          markdownCommandContextText={selectedCardInlineMediaCommandContext}
          displayClassName={strybldrInlineTextareaClass}
          editorClassName={strybldrInlineTextareaClass}
          onCommit={summary => onDraftChange(cur => ({ ...cur, summary }))}
        />
      </PanelField>
      <PanelField label="Action">
        <CardInlineTextEditor
          value={draft.action}
          ariaLabel="Strybldr card action"
          placeholder="Action"
          canEdit
          editActivation="click"
          multiline
          rows={2}
          markdownPreview="auto"
          markdownCommandContextText={selectedCardInlineMediaCommandContext}
          displayClassName={strybldrInlineTextareaClass}
          editorClassName={strybldrInlineTextareaClass}
          onCommit={action => onDraftChange(cur => ({ ...cur, action }))}
        />
      </PanelField>
      <PanelField label="Prompt">
        <CardInlineTextEditor
          value={draft.prompt}
          ariaLabel="Strybldr card prompt"
          placeholder="Prompt"
          canEdit
          editActivation="click"
          multiline
          rows={2}
          markdownPreview="auto"
          markdownCommandContextText={selectedCardInlineMediaCommandContext}
          displayClassName={strybldrInlineTextareaClass}
          editorClassName={strybldrInlineTextareaClass}
          onCommit={prompt => onDraftChange(cur => ({ ...cur, prompt }))}
        />
      </PanelField>
      <PanelField label="Order">
        <PanelTextInput
          type="number"
          className="mt-1"
          value={draft.order}
          aria-label="Strybldr card order"
          onChange={event => onDraftChange(cur => ({ ...cur, order: event.target.value }))}
        />
      </PanelField>
    </section>
  )
}
