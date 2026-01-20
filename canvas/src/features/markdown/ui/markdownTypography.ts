export const getMarkdownHeadingTextSizeClass = (args: { depth: number; presentation: boolean }): string => {
  const depth = Math.min(6, Math.max(1, Math.floor(args.depth)))
  const presentation = args.presentation === true
  if (depth === 1) return presentation ? 'text-5xl' : 'text-3xl'
  if (depth === 2) return presentation ? 'text-4xl' : 'text-2xl'
  if (depth === 3) return presentation ? 'text-3xl' : 'text-xl'
  return presentation ? 'text-2xl' : 'text-lg'
}

export const getMarkdownHeadingFontSizePx = (args: { depth: number; presentation: boolean }): number => {
  const depth = Math.min(6, Math.max(1, Math.floor(args.depth)))
  const presentation = args.presentation === true
  if (presentation) {
    if (depth === 1) return 48
    if (depth === 2) return 36
    if (depth === 3) return 30
    return 24
  }
  if (depth === 1) return 30
  if (depth === 2) return 24
  if (depth === 3) return 20
  return 18
}

export const getMarkdownBodyFontSizePx = (args: { presentation: boolean }): number => {
  return args.presentation ? 24 : 14
}

