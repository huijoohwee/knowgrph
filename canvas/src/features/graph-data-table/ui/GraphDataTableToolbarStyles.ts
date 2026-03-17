import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens';

export const UI_COLOR_PRIMARY_BLUE = 'text-blue-600 dark:text-blue-400'

export const UI_COLOR_PRIMARY_BLUE_BORDER = 'border-blue-500 dark:border-blue-400'

export const UI_COLOR_PRIMARY_BLUE_BG = 'bg-blue-50 dark:bg-blue-900/20'

export const UI_COLOR_PRIMARY_BLUE_INDICATOR = '#60A5FA'

export const UI_RING_PRIMARY_BLUE_INDICATOR = 'ring-blue-400'

export const UI_COLOR_WARNING_AMBER_BORDER = 'border-amber-400 dark:border-amber-500'

export const UI_COLOR_WARNING_AMBER_BG = 'bg-amber-50 dark:bg-amber-900/20'

export const UI_COLOR_DANGER_RED_BORDER = 'border-red-300 dark:border-red-500'

export const UI_COLOR_DANGER_RED_BG = 'bg-red-50 dark:bg-red-900/20'

export const UI_COLOR_DANGER_RED_TEXT = 'text-red-700 dark:text-red-400'

export const uiDangerButtonClassName =
  `App-toolbar__btn border ${UI_COLOR_DANGER_RED_BORDER} ${UI_COLOR_DANGER_RED_BG} ${UI_COLOR_DANGER_RED_TEXT}`

export const uiToolbarToggleActiveClassName = `${UI_COLOR_PRIMARY_BLUE_BORDER} ${UI_COLOR_PRIMARY_BLUE_BG} ${UI_THEME_TOKENS.button.activeText}`

export const uiDataTableToggleActiveClassName = `${UI_COLOR_PRIMARY_BLUE_BORDER} ${UI_COLOR_PRIMARY_BLUE_BG} ${UI_THEME_TOKENS.button.activeText}`

export const uiPrimaryToggleActiveClassName = uiToolbarToggleActiveClassName

export const uiSecondaryToggleActiveClassName =
  `${UI_COLOR_WARNING_AMBER_BORDER} ${UI_COLOR_WARNING_AMBER_BG} text-amber-800 dark:text-amber-200`

export const uiPrimaryPillActiveClassName = `${UI_COLOR_PRIMARY_BLUE_BG} ${UI_THEME_TOKENS.button.activeText}`

export const uiPrimaryChipActiveClassName = `${UI_COLOR_PRIMARY_BLUE_BG} ${UI_THEME_TOKENS.button.activeText} border border-blue-200 dark:border-blue-800`

export const uiPrimaryIconActiveClassName = `${UI_COLOR_PRIMARY_BLUE} ${UI_COLOR_PRIMARY_BLUE_BG}`

export const uiPrimaryIconInactiveClassName = UI_THEME_TOKENS.icon.color

export const uiPrimaryLinkClassName = `${UI_COLOR_PRIMARY_BLUE} hover:underline`

export const uiPrimaryLinkSmallClassName = `${UI_COLOR_PRIMARY_BLUE} hover:underline`

export const uiPrimaryLinkButtonClassName = `underline ${UI_COLOR_PRIMARY_BLUE} hover:text-blue-800 dark:hover:text-blue-300 focus:outline-none`

export const graphDataTableToolbarButtonClassName = (active: boolean) =>
  `inline-flex items-center justify-center whitespace-nowrap font-normal transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 gap-2 border ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.panel.bg} shadow-sm ${UI_THEME_TOKENS.button.hoverBg} rounded-md h-7 px-2 shrink-0 truncate ${
    active ? `${UI_THEME_TOKENS.button.hoverBg}` : `${UI_THEME_TOKENS.panel.border}`
  }`;

export const GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS = `!${UI_THEME_TOKENS.panel.bg} !${UI_THEME_TOKENS.button.activeText} !${UI_COLOR_PRIMARY_BLUE_BORDER}`;
