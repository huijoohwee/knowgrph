import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type UiIconScale = 'compact' | 'default'

export function getIconSizeClass(scale: UiIconScale | undefined): string {
  if (scale === 'compact') return 'w-3 h-3'
  return 'w-4 h-4'
}

export type UiPillVariant = 'legend' | 'badge'

export function getPillClass(
  variant: UiPillVariant,
  options: {
    baseClass?: string
    legendTextSizeClass?: string
    badgeTextSizeClass?: string
    textColorClass?: string
    extraClassName?: string
  } = {},
): string {
  const base = options.baseClass || ''
  const legendSize = options.legendTextSizeClass || 'text-xs'
  const badgeSize = options.badgeTextSizeClass || 'text-[9px]'
  const sizeClass = variant === 'legend' ? legendSize : badgeSize
  const colorClass = options.textColorClass || ''
  const extra = options.extraClassName || ''
  return [base, sizeClass, colorClass, extra].filter(Boolean).join(' ')
}

export type UiChipVariant = 'default' | 'selected'

export function getChipClass(
  variant: UiChipVariant,
  options: {
    baseClass?: string
    textSizeClass?: string
    textColorClass?: string
    extraClassName?: string
  } = {},
): string {
  const defaultBase = 'px-1.5 py-[1px] border rounded'
  const extraBase = options.baseClass || ''
  const base = extraBase ? `${defaultBase} ${extraBase}` : defaultBase
  const sizeClass = options.textSizeClass || 'text-xs'
  const defaultColorClass = variant === 'selected' ? 'text-blue-700' : UI_THEME_TOKENS.text.secondary
  const colorClass = options.textColorClass || defaultColorClass
  const extra = options.extraClassName || ''
  return [base, sizeClass, colorClass, extra].filter(Boolean).join(' ')
}

export type UiBadgeChipVariant = 'default' | 'selected' | 'neutral'

export function getBadgeChipClass(
  variant: UiBadgeChipVariant,
  options: {
    baseClass?: string
    textSizeClass?: string
    textColorClass?: string
    bgColorClass?: string
    borderColorClass?: string
    extraClassName?: string
  } = {},
): string {
  const defaultBase = 'px-1 py-[1px] rounded-full'
  const extraBase = options.baseClass || ''
  const base = extraBase ? `${defaultBase} ${extraBase}` : defaultBase
  const sizeClass = options.textSizeClass || 'text-[9px]'
  const defaultStateClass =
    variant === 'selected'
      ? 'text-blue-700 bg-blue-50 border border-blue-300'
      : variant === 'neutral'
        ? UI_THEME_TOKENS.status.neutral
        : `border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`
  const textColorClass = options.textColorClass || ''
  const bgColorClass = options.bgColorClass || ''
  const borderColorClass = options.borderColorClass || ''
  const extra = options.extraClassName || ''
  return [base, sizeClass, defaultStateClass, textColorClass, bgColorClass, borderColorClass, extra].filter(Boolean).join(' ')
}
