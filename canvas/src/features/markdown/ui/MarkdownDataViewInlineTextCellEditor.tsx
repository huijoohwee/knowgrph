import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { MARKDOWN_TEXT_EDIT_SURFACE_MIN_LINE_HEIGHT_CLASS } from './markdownEditSurfaceLayout'

export function MarkdownDataViewInlineTextCellEditor(props: {
  ariaLabel: string
  initialValue: string
  textClassName: string
  markdownCommandContextText?: string
  onCommit: (nextValue: string) => void
  onCancel: () => void
}) {
  return (
    <CardInlineTextEditor
      value={String(props.initialValue ?? '')}
      ariaLabel={props.ariaLabel}
      placeholder="—"
      canEdit
      editActivation="click"
      editRequestKey={`${props.ariaLabel}:${props.initialValue}`}
      multiline
      markdownPreview="auto"
      markdownCommandContextText={props.markdownCommandContextText}
      rows={2}
      displayClassName={['inline-block w-full', MARKDOWN_TEXT_EDIT_SURFACE_MIN_LINE_HEIGHT_CLASS, 'whitespace-pre-wrap break-words outline-none', props.textClassName].join(' ')}
      editorClassName={['inline-block w-full', MARKDOWN_TEXT_EDIT_SURFACE_MIN_LINE_HEIGHT_CLASS, 'whitespace-pre-wrap break-words outline-none', props.textClassName].join(' ')}
      onCommit={props.onCommit}
      onEditingChange={editing => {
        if (!editing) props.onCancel()
      }}
    />
  )
}
