export type PanelTypography = {
  fontClass: string
  textSizeClass: string
  microLabelTextSizeClass: string
  monospaceTextClass: string
  keyValueInputClass: string
  panelTextClass: string
  microLabelClass: string
}

export function coercePanelTypography(input: Partial<PanelTypography> | null | undefined): PanelTypography {
  const fontClass = typeof input?.fontClass === 'string' && input.fontClass.trim() ? input.fontClass.trim() : 'font-sans'
  const textSizeClass =
    typeof input?.textSizeClass === 'string' && input.textSizeClass.trim() ? input.textSizeClass.trim() : 'text-sm'
  const microLabelTextSizeClass =
    typeof input?.microLabelTextSizeClass === 'string' && input.microLabelTextSizeClass.trim()
      ? input.microLabelTextSizeClass.trim()
      : 'text-[9px]'
  const monospaceTextClass =
    typeof input?.monospaceTextClass === 'string' && input.monospaceTextClass.trim()
      ? input.monospaceTextClass.trim()
      : 'font-mono text-xs'
  const keyValueInputClass =
    typeof input?.keyValueInputClass === 'string' && input.keyValueInputClass.trim()
      ? input.keyValueInputClass.trim()
      : 'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right'
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
    panelTextClass,
    microLabelClass,
  }
}

