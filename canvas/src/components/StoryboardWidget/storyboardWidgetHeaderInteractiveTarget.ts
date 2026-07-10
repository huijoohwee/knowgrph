import {
  CARD_INLINE_TEXT_COMMAND_MENU_ATTRIBUTE,
  CARD_INLINE_TEXT_COMMAND_ROOT_ATTRIBUTE,
  CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE,
  isElementEventTarget,
} from '@/lib/cards/CardInlineTextEditorSupport'

const STORYBOARD_WIDGET_HEADER_INTERACTIVE_TARGET_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  'a',
  'summary',
  '[role="button"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[contenteditable="true"]',
  '[data-kg-card-inline-edit="1"]',
  `[${CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE}]`,
  `[${CARD_INLINE_TEXT_COMMAND_ROOT_ATTRIBUTE}]`,
  `[${CARD_INLINE_TEXT_COMMAND_MENU_ATTRIBUTE}]`,
  '[data-kg-card-media-interactive="1"]',
  '[data-kg-port-handle="1"]',
  '[data-kg-rich-media-resize-handle="1"]',
].join(',')

export const shouldStoryboardWidgetHeaderYieldToInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!isElementEventTarget(target)) return false
  return target.closest(STORYBOARD_WIDGET_HEADER_INTERACTIVE_TARGET_SELECTOR) != null
}
