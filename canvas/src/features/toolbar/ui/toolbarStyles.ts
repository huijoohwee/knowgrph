import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_INTENT_TOKENS } from 'grph-shared/ui/intentTokens'

export const UI_COLOR_PRIMARY_BLUE = UI_INTENT_TOKENS.primary.text

export const UI_COLOR_PRIMARY_BLUE_BORDER = UI_INTENT_TOKENS.primary.border

export const UI_COLOR_PRIMARY_BLUE_BG = UI_INTENT_TOKENS.primary.bg

export const UI_COLOR_PRIMARY_BLUE_INDICATOR = UI_INTENT_TOKENS.primary.indicator

export const UI_RING_PRIMARY_BLUE_INDICATOR = UI_INTENT_TOKENS.primary.ringIndicator

export const UI_COLOR_DANGER_RED_BORDER = UI_INTENT_TOKENS.danger.border

export const UI_COLOR_DANGER_RED_BG = UI_INTENT_TOKENS.danger.bg

export const UI_COLOR_DANGER_RED_TEXT = UI_INTENT_TOKENS.danger.text

export const uiPrimaryIconActiveClassName = `${UI_COLOR_PRIMARY_BLUE} ${UI_COLOR_PRIMARY_BLUE_BG}`

export const uiPrimaryIconInactiveClassName = UI_THEME_TOKENS.icon.color

export const uiPrimaryToggleActiveClassName = `${UI_COLOR_PRIMARY_BLUE_BORDER} ${UI_COLOR_PRIMARY_BLUE_BG} ${UI_THEME_TOKENS.button.activeText}`

export const uiToolbarToggleActiveClassName = uiPrimaryToggleActiveClassName

export const uiDangerButtonClassName = `App-toolbar__btn border ${UI_COLOR_DANGER_RED_BORDER} ${UI_COLOR_DANGER_RED_BG} ${UI_COLOR_DANGER_RED_TEXT}`

export const uiPrimaryPillActiveClassName = `${UI_COLOR_PRIMARY_BLUE_BG} ${UI_THEME_TOKENS.button.activeText}`

export const uiPrimaryChipActiveClassName = `${UI_COLOR_PRIMARY_BLUE_BG} ${UI_THEME_TOKENS.button.activeText} border border-blue-200 dark:border-blue-800`

export const uiPrimaryLinkClassName = `${UI_COLOR_PRIMARY_BLUE} hover:underline`

export const uiPrimaryLinkSmallClassName = `${UI_COLOR_PRIMARY_BLUE} hover:underline`

export const uiPrimaryLinkButtonClassName = `underline ${UI_COLOR_PRIMARY_BLUE} hover:text-blue-800 dark:hover:text-blue-300 focus:outline-none`
