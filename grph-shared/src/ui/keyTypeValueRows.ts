import { UI_THEME_TOKENS } from './themeTokens.js'

export const KTV_ROW_TEXT_CELL_CLASS_NAME = 'flex min-w-0 max-w-full overflow-hidden'
export const KTV_ROW_LABEL_CELL_CLASS_NAME = `${KTV_ROW_TEXT_CELL_CLASS_NAME} text-ellipsis whitespace-nowrap`
export const KTV_ROW_VALUE_CELL_CLASS_NAME = `${KTV_ROW_TEXT_CELL_CLASS_NAME} self-stretch px-2 gap-2 justify-start sm:justify-end ${UI_THEME_TOKENS.text.secondary}`

export const KTV_KEY_ICON_SLIDER_INPUT_GRID_CLASS_NAME = 'grid-cols-[minmax(0,0.9fr)_minmax(1rem,1rem)_minmax(0,0.55fr)_minmax(0,1.15fr)] sm:grid-cols-[minmax(0,1fr)_minmax(0,0.05fr)_minmax(0,0.55fr)_minmax(0,1.4fr)]'
export const KTV_KEY_ICON_VALUE_GRID_CLASS_NAME = 'grid-cols-[minmax(0,1fr)_minmax(1.25rem,1.75rem)_minmax(0,1fr)] sm:grid-cols-[minmax(0,1.1fr)_minmax(1.25rem,1.75rem)_minmax(0,1.2fr)]'
export const KTV_KEY_VALUE_GRID_CLASS_NAME = 'grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'
export const KTV_KEY_TYPE_VALUE_GRID_CLASS_NAME = 'grid-cols-[minmax(0,0.95fr)_minmax(2.75rem,0.42fr)_minmax(0,1.2fr)] sm:grid-cols-[minmax(0,1fr)_minmax(3rem,4.75rem)_minmax(0,1.45fr)]'
