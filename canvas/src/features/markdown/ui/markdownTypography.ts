export const getMarkdownHeadingTextSizeClass = (args: { depth: number; presentation: boolean }): string => {
  const depth = Math.min(6, Math.max(1, Math.floor(args.depth)))
  const presentation = args.presentation === true
  if (presentation) {
    if (depth === 1) return 'text-5xl'
    if (depth === 2) return 'text-4xl'
    if (depth === 3) return 'text-3xl'
    if (depth === 4) return 'text-2xl'
    if (depth === 5) return 'text-xl'
    return 'text-lg'
  }
  if (depth === 1) return 'text-4xl'
  if (depth === 2) return 'text-3xl'
  if (depth === 3) return 'text-2xl'
  if (depth === 4) return 'text-xl'
  if (depth === 5) return 'text-lg'
  return 'text-base'
}

export const getMarkdownHeadingFontSizePx = (args: { depth: number; presentation: boolean }): number => {
  const depth = Math.min(6, Math.max(1, Math.floor(args.depth)))
  const presentation = args.presentation === true
  if (presentation) {
    if (depth === 1) return 48
    if (depth === 2) return 36
    if (depth === 3) return 30
    if (depth === 4) return 24
    if (depth === 5) return 20
    return 18
  }
  if (depth === 1) return 36
  if (depth === 2) return 30
  if (depth === 3) return 24
  if (depth === 4) return 20
  if (depth === 5) return 18
  return 16
}

export const getMarkdownBodyFontSizePx = (args: { presentation: boolean }): number => {
  return args.presentation ? 18 : 14
}
