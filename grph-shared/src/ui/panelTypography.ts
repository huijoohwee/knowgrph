export type PanelTypography = {
  fontClass: string
  textSizeClass: string
  microLabelTextSizeClass: string
  monospaceTextClass: string
  keyValueInputClass: string
  keyLabelClass: string
  panelTextClass: string
  microLabelClass: string
}

export const PANEL_TYPOGRAPHY_DEFAULTS = {
  fontClass: 'font-sans',
  textSizeClass: 'text-sm',
  microLabelTextSizeClass: 'text-[9px]',
  monospaceTextClass: 'font-mono text-xs',
  keyValueInputClass: 'w-full h-6 px-2 border border-gray-300 rounded text-right',
} as const

export function coercePanelTypography(input: Partial<PanelTypography> | null | undefined): PanelTypography {
  const fontClass =
    typeof input?.fontClass === 'string' && input.fontClass.trim() ? input.fontClass.trim() : PANEL_TYPOGRAPHY_DEFAULTS.fontClass
  const textSizeClass =
    typeof input?.textSizeClass === 'string' && input.textSizeClass.trim()
      ? input.textSizeClass.trim()
      : PANEL_TYPOGRAPHY_DEFAULTS.textSizeClass
  const microLabelTextSizeClass =
    typeof input?.microLabelTextSizeClass === 'string' && input.microLabelTextSizeClass.trim()
      ? input.microLabelTextSizeClass.trim()
      : PANEL_TYPOGRAPHY_DEFAULTS.microLabelTextSizeClass
  const monospaceTextClass =
    typeof input?.monospaceTextClass === 'string' && input.monospaceTextClass.trim()
      ? input.monospaceTextClass.trim()
      : PANEL_TYPOGRAPHY_DEFAULTS.monospaceTextClass
  const keyValueInputClass =
    typeof input?.keyValueInputClass === 'string' && input.keyValueInputClass.trim()
      ? input.keyValueInputClass.trim()
      : PANEL_TYPOGRAPHY_DEFAULTS.keyValueInputClass
  const keyLabelClass = typeof input?.keyLabelClass === 'string' && input.keyLabelClass.trim()
    ? input.keyLabelClass.trim()
    : `${fontClass} ${textSizeClass}`
  const panelTextClass = typeof input?.panelTextClass === 'string' && input.panelTextClass.trim()
    ? input.panelTextClass.trim()
    : `${fontClass} ${textSizeClass}`
  const microLabelClass = typeof input?.microLabelClass === 'string' && input.microLabelClass.trim()
    ? input.microLabelClass.trim()
    : `${fontClass} ${microLabelTextSizeClass}`
  return {
    fontClass,
    textSizeClass,
    microLabelTextSizeClass,
    monospaceTextClass,
    keyValueInputClass,
    keyLabelClass,
    panelTextClass,
    microLabelClass,
  }
}
