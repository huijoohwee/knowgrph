export const UI_COLOR_PRIMARY_BLUE = 'text-blue-600'

export const UI_COLOR_PRIMARY_BLUE_BORDER = 'border-blue-500'

export const UI_COLOR_PRIMARY_BLUE_BG = 'bg-blue-50'

export const UI_COLOR_PRIMARY_BLUE_INDICATOR = '#60A5FA'

export const UI_RING_PRIMARY_BLUE_INDICATOR = 'ring-blue-400'

export const UI_COLOR_WARNING_AMBER_BORDER = 'border-amber-400'

export const UI_COLOR_WARNING_AMBER_BG = 'bg-amber-50'

export const UI_COLOR_DANGER_RED_BORDER = 'border-red-300'

export const UI_COLOR_DANGER_RED_BG = 'bg-red-50'

export const UI_COLOR_DANGER_RED_TEXT = 'text-red-700'

export const uiDangerButtonClassName =
  `App-toolbar__btn text-xs border ${UI_COLOR_DANGER_RED_BORDER} ${UI_COLOR_DANGER_RED_BG} ${UI_COLOR_DANGER_RED_TEXT}`

export const uiToolbarToggleActiveClassName = `${UI_COLOR_PRIMARY_BLUE_BORDER} ${UI_COLOR_PRIMARY_BLUE_BG} text-blue-700`

export const uiDataTableToggleActiveClassName = `${UI_COLOR_PRIMARY_BLUE_BORDER} ${UI_COLOR_PRIMARY_BLUE_BG} text-blue-700`

export const uiPrimaryToggleActiveClassName = uiToolbarToggleActiveClassName

export const uiSecondaryToggleActiveClassName =
  `${UI_COLOR_WARNING_AMBER_BORDER} ${UI_COLOR_WARNING_AMBER_BG} text-amber-800`

export const uiPrimaryPillActiveClassName = `${UI_COLOR_PRIMARY_BLUE_BG} text-blue-700`

export const uiPrimaryChipActiveClassName = `${UI_COLOR_PRIMARY_BLUE_BG} text-blue-700 border border-blue-200`

export const uiPrimaryIconActiveClassName = UI_COLOR_PRIMARY_BLUE

export const uiPrimaryIconInactiveClassName = 'text-gray-600'

export const uiPrimaryLinkClassName = `${UI_COLOR_PRIMARY_BLUE} hover:underline`

export const uiPrimaryLinkSmallClassName = `text-xs ${UI_COLOR_PRIMARY_BLUE} hover:underline`

export const uiPrimaryLinkButtonClassName = `underline ${UI_COLOR_PRIMARY_BLUE} hover:text-blue-800 focus:outline-none`

export const graphDataTableToolbarButtonClassName = (active: boolean) =>
  `inline-flex items-center justify-center whitespace-nowrap font-normal transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 gap-2 border border-gray-200 bg-white shadow-sm hover:bg-gray-50 rounded-md text-xs h-7 px-2 shrink-0 truncate ${
    active ? 'bg-gray-100' : ''
  }`;

export const GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS = '!bg-white !text-blue-600 !border-blue-600';
