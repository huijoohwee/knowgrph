import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS,
  MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS,
} from './MarkdownBlockGutter'

export const MARKDOWN_LIST_ROW_GUTTER_GROUP_CLASS = 'relative group/list-row'
export const MARKDOWN_LIST_ROW_VIEW_INLINE_CLASS = 'inline'
export const MARKDOWN_LIST_ROW_EDITOR_CLASS = 'inline whitespace-pre-wrap break-words align-baseline outline-none bg-transparent'
export const MARKDOWN_LIST_TASK_CHECKBOX_CLASS = 'mr-2 translate-y-[1px]'
export const MARKDOWN_LIST_MARKER_FIRST_CHARACTER_ALIGN_CLASS = 'list-inside pl-0'
export const MARKDOWN_LIST_VERTICAL_SPACING_CLASS = 'space-y-1.5'
export const MARKDOWN_LIST_ROW_GUTTER_PADDING_CLASS = `${MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS} ${MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS}`

export const getMarkdownListSurfaceClass = (ordered: boolean): string => {
  const listClass = ordered ? 'list-decimal' : 'list-disc'
  return `${listClass} ${MARKDOWN_LIST_MARKER_FIRST_CHARACTER_ALIGN_CLASS} ${MARKDOWN_LIST_VERTICAL_SPACING_CLASS} marker:${UI_THEME_TOKENS.text.tertiary}`
}
