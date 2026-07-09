import type { InlineMediaCommandCandidate } from '@/lib/command-menu/inlineCommandMenuCatalog'
import type { CardInlineTextExternalMediaCandidate } from '@/lib/cards/cardInlineTextExternalCommands'
import { normalizeInvocationTokenSpacing } from '@/lib/markdown/invocationTokens'
import { normalizeCardInlineEditorValue } from '@/lib/cards/cardInlineTextEditorUtils'
import { readTextareaInvocationMediaReferenceKey, type TextareaInvocationProjectedMediaChip, type TextareaInvocationMediaAttachment } from '@/lib/ui/textareaInvocationProjection'

export type CardInlineTextEditActivation = 'doubleClick' | 'click'

export type CardInlineTextEditorProps = {
  id?: string
  value: string
  displayValue?: string
  ariaLabel: string
  placeholder: string
  canEdit?: boolean
  editActivation?: CardInlineTextEditActivation
  editRequestKey?: string | number | null
  multiline?: boolean
  displayClassName?: string
  editorClassName?: string
  emptyClassName?: string
  markdownPreview?: boolean | 'auto'
  markdownCommandMenus?: boolean
  markdownCommandContextText?: string
  mediaCommandMode?: 'inline' | 'external'
  editorSurface?: 'control' | 'viewer'
  openOnPointerDown?: boolean
  projectedMediaAttachments?: readonly TextareaInvocationMediaAttachment[] | null
  rows?: number
  showCommandLaunchers?: boolean
  stopActivationPropagation?: boolean
  onCommit?: (nextValue: string) => void
  onEditingChange?: (editing: boolean) => void
  onMediaCommandSelect?: (candidate: InlineMediaCommandCandidate) => void
}

export type CardInlineTextCommandExternalState = {
  canEdit: boolean
  draft: string
  editing: boolean
  multiline: boolean
  onCommit?: (nextValue: string) => void
  persistCommandDraft: (nextValue: string) => void
  value: string
}

export const CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE = 'data-kg-card-inline-edit-input'
export const CARD_INLINE_TEXT_COMMAND_ROOT_ATTRIBUTE = 'data-kg-card-inline-command-root'
export const CARD_INLINE_TEXT_COMMAND_MENU_ATTRIBUTE = 'data-kg-card-inline-command-menu'
export const EDITOR_PROJECTED_MEDIA_ATTACHMENTS = null

export const normalizeCommittedCardInlineEditorValue = (value: string): string => normalizeInvocationTokenSpacing(normalizeCardInlineEditorValue(value))

export const isElementEventTarget = (target: EventTarget | null): target is Element => {
  const elementCtor = target && 'ownerDocument' in target
    ? (target as { ownerDocument?: Document | null }).ownerDocument?.defaultView?.Element
    : typeof Element !== 'undefined' ? Element : null
  return !!elementCtor && target instanceof elementCtor
}

export const shouldIgnoreInlineEditTarget = (target: EventTarget | null): boolean => {
  if (!isElementEventTarget(target)) return false
  return !!target.closest(['button', 'select', 'input', 'textarea', 'a', '[role="menu"]', '[role="menuitem"]', '[contenteditable="true"]', '[data-kg-card-media-interactive="1"]'].join(','))
}

const isCardInlineTextFieldLineClassToken = (token: string): boolean =>
  /^(block|break-words|truncate|whitespace-nowrap|whitespace-pre-wrap)$/.test(token) || token.startsWith('line-clamp-')

export const normalizeCardInlineTextDisplayClassName = (className: string, multiline: boolean): string =>
  multiline && !/\boverflow-auto\b/.test(className)
    ? className.split(/\s+/).filter(token => token && !isCardInlineTextFieldLineClassToken(token)).join(' ')
    : className

export const readCardInlineTextMediaCandidateKey = (chip: TextareaInvocationProjectedMediaChip): string =>
  readTextareaInvocationMediaReferenceKey(chip.displayLabel || chip.label)
