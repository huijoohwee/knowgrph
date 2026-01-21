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

export const UI_THEME_COLORS_CSS: ThemeColors = {
  bg: 'var(--kg-panel-bg)',
  text: 'var(--kg-text-primary)',
  textSecondary: 'var(--kg-text-secondary)',
  border: 'var(--kg-border)',
  nodeStroke: 'var(--kg-canvas-node-stroke)',
  edgeStroke: 'var(--kg-canvas-edge-stroke)',
  labelHalo: 'var(--kg-canvas-label-halo)',
  labelFill: 'var(--kg-canvas-label-fill)',
} as const;

export function resolveCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

export function resolveThemeColors(): ThemeColors {
  return {
    bg: resolveCssVar('--kg-panel-bg', '#ffffff'),
    text: resolveCssVar('--kg-text-primary', '#111827'),
    textSecondary: resolveCssVar('--kg-text-secondary', '#4b5563'),
    border: resolveCssVar('--kg-border', '#e5e7eb'),
    nodeStroke: resolveCssVar('--kg-canvas-node-stroke', '#ffffff'),
    edgeStroke: resolveCssVar('--kg-canvas-edge-stroke', '#9ca3af'),
    labelHalo: resolveCssVar('--kg-canvas-label-halo', '#ffffff'),
    labelFill: resolveCssVar('--kg-canvas-label-fill', '#111827'),
  };
}

export const UI_THEME_TOKENS = {
  button: {
    text: 'text-[color:var(--kg-text-secondary)]',
    hoverBg: 'hover:bg-black/5 dark:hover:bg-white/5',
    ring: 'ring-blue-500 dark:ring-blue-400',
    padding: 'p-2',
    activeText: 'text-blue-600 dark:text-blue-400',
    activeBg: 'bg-blue-50 dark:bg-blue-900/20',
    activeBorder: 'border-blue-500 dark:border-blue-400',
    disabledText: 'text-black/40 dark:text-white/30',
  },
  pill: {
    base: 'rounded-full px-2 py-0.5 border border-[color:var(--kg-border)]',
    text: 'text-[10px] font-medium text-[color:var(--kg-text-secondary)]',
    badgeText: 'text-[10px] font-bold',
  },
  badge: {
    chip: 'rounded px-1.5 py-0.5 bg-black/5 dark:bg-white/5',
    text: 'text-[10px] font-mono',
  },
  icon: {
    color: 'text-[color:var(--kg-text-secondary)]',
    active: 'text-blue-600 dark:text-blue-400',
  },
  panel: {
    bg: 'bg-[var(--kg-panel-bg)]',
    border: 'border-[color:var(--kg-border)]',
    headerBg: 'bg-[rgba(var(--panel-bg-rgb),0.75)]',
    divider: 'border-[color:var(--kg-divider)]',
  },
  text: {
    primary: 'text-[color:var(--kg-text-primary)]',
    secondary: 'text-[color:var(--kg-text-secondary)]',
    tertiary: 'text-[color:var(--kg-text-tertiary)]',
  },
  table: {
    headerBg: 'bg-gray-50 dark:bg-gray-800',
    rowHover: 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
    rowHoverAmber: 'hover:bg-amber-50 dark:hover:bg-amber-900/20',
    cellBorder: 'border-[color:var(--kg-border)]',
    text: 'text-[color:var(--kg-text-primary)]',
    textSecondary: 'text-[color:var(--kg-text-secondary)]',
    rowBg: 'bg-[var(--kg-panel-bg)]',
    rowBgAlt: 'bg-[var(--kg-panel-bg)]',
    rowSelected: 'bg-blue-50 dark:bg-blue-900/20',
    rowSelectedBorder: 'ring-1 ring-inset ring-blue-500 dark:ring-blue-400',
    rowRelated: 'bg-blue-50/50 dark:bg-blue-900/10',
    rowOutside: 'bg-[var(--kg-panel-bg)]',
  },
  input: {
    bg: 'bg-[var(--kg-panel-bg)]',
    border: 'border-[color:var(--kg-border)]',
    text: 'text-[color:var(--kg-text-primary)]',
  },
  status: {
    success: 'text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30',
    warning: 'text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/30',
    error: 'text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30',
    neutral: 'text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800',
  },
  tooltip: {
    bg: 'bg-[var(--kg-tooltip-bg)]',
    text: 'text-[color:var(--kg-tooltip-text)]',
    textSecondary: 'text-[color:var(--kg-tooltip-text)] opacity-80',
    textTertiary: 'text-[color:var(--kg-tooltip-text)] opacity-70',
  },
  code: {
    bg: 'bg-[color:var(--kg-code-bg)]',
    border: 'border-[color:var(--kg-code-border)]',
    text: 'text-[color:var(--kg-code-text)]',
  },
} as const;
