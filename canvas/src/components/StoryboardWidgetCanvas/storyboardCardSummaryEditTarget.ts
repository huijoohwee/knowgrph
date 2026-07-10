import { CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE, isElementEventTarget } from '@/lib/cards/CardInlineTextEditorSupport'

const STORYBOARD_CARD_SUMMARY_EDIT_TARGET_SKIP_SELECTOR = [
  '[data-kg-card-inline-edit="1"]',
  'button',
  'input',
  'textarea',
  'select',
  'a',
  '[role="menu"]',
  '[role="menuitem"]',
  '[contenteditable="true"]',
  '[data-kg-card-inline-command-menu]',
].join(',')

const STORYBOARD_CARD_SUMMARY_ACTIVE_EDITOR_SELECTOR = [
  `[${CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE}]`,
  '[data-kg-card-inline-viewer-edit-surface="1"]',
].join(',')

export const shouldStoryboardCardTextColumnOwnSummaryEditTarget = (target: EventTarget | null, textColumn?: Element | null): boolean => {
  if (textColumn?.querySelector(STORYBOARD_CARD_SUMMARY_ACTIVE_EDITOR_SELECTOR)) return false
  if (!isElementEventTarget(target)) return true
  return !target.closest(STORYBOARD_CARD_SUMMARY_EDIT_TARGET_SKIP_SELECTOR)
}
