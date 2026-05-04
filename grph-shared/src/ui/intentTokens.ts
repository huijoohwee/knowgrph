export const UI_INTENT_TOKENS = {
  primary: {
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500 dark:border-blue-400',
    softBorder: 'border-blue-200 dark:border-blue-800',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    solidBg: 'bg-blue-600 dark:bg-blue-500',
    solidText: 'text-white',
    hoverText: 'hover:text-blue-800 dark:hover:text-blue-300',
    indicator: '#60A5FA',
    ringIndicator: 'ring-blue-400',
  },
  success: {
    border: 'border-emerald-400 dark:border-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-800 dark:text-emerald-200',
    accentBg: 'bg-emerald-400 dark:bg-emerald-600',
  },
  info: {
    border: 'border-blue-400 dark:border-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-800 dark:text-blue-200',
    accentBg: 'bg-blue-400 dark:bg-blue-600',
  },
  example: {
    border: 'border-indigo-400 dark:border-indigo-600',
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    text: 'text-indigo-800 dark:text-indigo-200',
    accentBg: 'bg-indigo-400 dark:bg-indigo-600',
  },
  neutral: {
    border: 'border-slate-300 dark:border-slate-600',
    bg: 'bg-slate-50 dark:bg-slate-900/20',
    text: 'text-slate-800 dark:text-slate-200',
    accentBg: 'bg-slate-300 dark:bg-slate-600',
  },
  warning: {
    border: 'border-amber-400 dark:border-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-800 dark:text-amber-200',
    accentBg: 'bg-amber-400 dark:bg-amber-600',
  },
  danger: {
    border: 'border-red-300 dark:border-red-500',
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-400',
    accentBg: 'bg-red-400 dark:bg-red-600',
  },
} as const
