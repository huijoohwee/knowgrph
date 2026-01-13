export type ThemeColors = {
  bg: string;
  text: string;
  textSecondary: string;
  border: string;
  nodeStroke: string;
  edgeStroke: string;
  labelHalo: string;
  labelFill: string;
};

export const UI_THEME_COLORS: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    bg: '#ffffff',
    text: '#111827', // gray-900
    textSecondary: '#4b5563', // gray-600
    border: '#e5e7eb', // gray-200
    nodeStroke: '#ffffff',
    edgeStroke: '#9ca3af', // gray-400
    labelHalo: '#ffffff',
    labelFill: '#111827',
  },
  dark: {
    bg: '#0d1117',
    text: '#f3f4f6', // gray-100
    textSecondary: '#9ca3af', // gray-400
    border: '#374151', // gray-700
    nodeStroke: '#1f2937', // gray-800
    edgeStroke: '#4b5563', // gray-600
    labelHalo: '#0d1117',
    labelFill: '#e5e7eb',
  },
} as const;

export const UI_THEME_TOKENS = {
  button: {
    text: 'text-gray-600 dark:text-gray-300',
    hoverBg: 'hover:bg-gray-100 dark:hover:bg-gray-800',
    ring: 'ring-blue-500 dark:ring-blue-400',
    padding: 'p-2',
    activeText: 'text-blue-600 dark:text-blue-400',
    activeBg: 'bg-blue-50 dark:bg-blue-900/20',
    activeBorder: 'border-blue-500 dark:border-blue-400',
    disabledText: 'text-gray-400 dark:text-gray-600',
  },
  pill: {
    base: 'rounded-full px-2 py-0.5 border border-gray-200 dark:border-gray-700',
    text: 'text-[10px] font-medium text-gray-500 dark:text-gray-400',
    badgeText: 'text-[10px] font-bold',
  },
  badge: {
    chip: 'rounded px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800',
    text: 'text-[10px] font-mono',
  },
  icon: {
    color: 'text-gray-600 dark:text-gray-300',
    active: 'text-blue-600 dark:text-blue-400',
  },
  panel: {
    bg: 'bg-white dark:bg-[#0d1117]',
    border: 'border-gray-200 dark:border-gray-700',
    headerBg: 'bg-gray-50 dark:bg-gray-800/50',
    divider: 'border-gray-200 dark:border-gray-700',
  },
  text: {
    primary: 'text-gray-900 dark:text-gray-100',
    secondary: 'text-gray-600 dark:text-gray-400',
    tertiary: 'text-gray-500 dark:text-gray-500',
  },
  table: {
    headerBg: 'bg-gray-50 dark:bg-gray-800',
    rowHover: 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
    rowHoverAmber: 'hover:bg-amber-50 dark:hover:bg-amber-900/20',
    cellBorder: 'border-gray-200 dark:border-gray-700',
    text: 'text-gray-700 dark:text-gray-300',
    textSecondary: 'text-gray-500 dark:text-gray-500',
    rowBg: 'bg-white dark:bg-[#0d1117]',
    rowBgAlt: 'bg-white dark:bg-[#0d1117]',
    rowSelected: 'bg-blue-50 dark:bg-blue-900/20',
    rowSelectedBorder: 'ring-1 ring-inset ring-blue-500 dark:ring-blue-400',
    rowRelated: 'bg-blue-50/50 dark:bg-blue-900/10',
    rowOutside: 'bg-white dark:bg-[#0d1117]',
  },
  input: {
    bg: 'bg-white dark:bg-[#0d1117]',
    border: 'border-gray-300 dark:border-gray-600',
    text: 'text-gray-900 dark:text-gray-100',
  },
  status: {
    success: 'text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30',
    warning: 'text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/30',
    error: 'text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30',
    neutral: 'text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800',
  },
  tooltip: {
    bg: 'bg-gray-800 dark:bg-gray-700',
    text: 'text-white dark:text-gray-100',
    textSecondary: 'text-gray-300 dark:text-gray-300',
    textTertiary: 'text-gray-400 dark:text-gray-400',
  },
  code: {
    bg: 'bg-slate-50 dark:bg-slate-900/50',
    border: 'border-slate-200 dark:border-slate-800',
    text: 'text-slate-900 dark:text-slate-200',
  },
} as const;
