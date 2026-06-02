import { cn } from '@/lib/utils'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type UiSectionChipTone = 'primary' | 'secondary' | 'tertiary'
export type UiSectionChipStatusTone = 'success' | 'info' | 'warning' | 'error' | 'neutral'

export const UI_SECTION_CHIP_TEXT_SIZE_CLASS_NAME = 'text-xs'
export const UI_SECTION_CHIP_CHROME_CLASS_NAME = cn(
  'App-toolbar__btn',
  UI_SECTION_CHIP_TEXT_SIZE_CLASS_NAME,
  'border',
  UI_THEME_TOKENS.panel.border,
  UI_THEME_TOKENS.panel.bg,
)

const resolveSectionChipToneClassName = (tone: UiSectionChipTone): string => {
  if (tone === 'primary') return UI_THEME_TOKENS.text.primary
  if (tone === 'tertiary') return UI_THEME_TOKENS.text.tertiary
  return UI_THEME_TOKENS.text.secondary
}

export function getUiSectionChipClassName(
  tone: UiSectionChipTone = 'secondary',
  className?: string,
): string {
  return cn(
    UI_SECTION_CHIP_CHROME_CLASS_NAME,
    resolveSectionChipToneClassName(tone),
    'cursor-default',
    className,
  )
}

export function getUiSectionActionClassName(
  tone: UiSectionChipTone = 'primary',
  className?: string,
): string {
  return cn(
    UI_SECTION_CHIP_CHROME_CLASS_NAME,
    resolveSectionChipToneClassName(tone),
    UI_THEME_TOKENS.button.hoverBg,
    className,
  )
}

export function getUiSectionStatusChipClassName(
  tone: UiSectionChipStatusTone,
  className?: string,
): string {
  return cn(
    UI_SECTION_CHIP_CHROME_CLASS_NAME,
    UI_THEME_TOKENS.status[tone],
    'cursor-default',
    className,
  )
}
