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

const STORYBOARD_CARD_INLINE_TEXT_ACTIVATION_SELECTOR = [
  '[data-kg-card-inline-edit="1"]',
  STORYBOARD_CARD_SUMMARY_ACTIVE_EDITOR_SELECTOR,
  '[data-kg-storyboard-card-output-pane="1"]',
].join(',')

export const shouldStoryboardCardTextColumnOwnSummaryEditTarget = (target: EventTarget | null, textColumn?: Element | null): boolean => {
  if (textColumn?.querySelector(STORYBOARD_CARD_SUMMARY_ACTIVE_EDITOR_SELECTOR)) return false
  if (!isElementEventTarget(target)) return true
  return !target.closest(STORYBOARD_CARD_SUMMARY_EDIT_TARGET_SKIP_SELECTOR)
}

export const shouldStoryboardCardOverlayYieldToTextEditTarget = (target: EventTarget | null): boolean => {
  if (!isElementEventTarget(target)) return false
  if (target.closest(STORYBOARD_CARD_INLINE_TEXT_ACTIVATION_SELECTOR)) return true
  const textColumn = target.closest('[data-kg-storyboard-card-text-column="1"]')
  return !!textColumn && shouldStoryboardCardTextColumnOwnSummaryEditTarget(target, textColumn)
}
