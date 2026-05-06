import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type ResolvePresentationFrameModelArgs = {
  slideMeta: Record<string, unknown>
  headMeta: Record<string, unknown>
  isAcademicTheme: boolean
}

type PresentationFrameModel = {
  baseFrameClass: string
  slideFramePaddingPx: number | undefined
}

const parseFramePaddingPx = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

const resolveFrameVariant = (
  slideMeta: Record<string, unknown>,
  headMeta: Record<string, unknown>,
): string => String(slideMeta.frame || headMeta.frame || '').trim().toLowerCase()

const resolveBaseFrameClass = (frameVariantRaw: string, isAcademicTheme: boolean): string => {
  const frameVariant = frameVariantRaw || 'default'
  let baseFrameClass = `rounded border ${UI_THEME_TOKENS.panel.border} shadow ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
  if (isAcademicTheme && !frameVariantRaw) {
    baseFrameClass = `rounded ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
  }
  if (frameVariant === 'borderless') {
    return `rounded ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
  }
  if (frameVariant === 'minimal') {
    return `rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
  }
  if (frameVariant === 'dark') {
    return 'rounded border border-gray-700 shadow bg-gray-900 text-gray-100'
  }
  return baseFrameClass
}

export const resolvePresentationFrameModel = (
  args: ResolvePresentationFrameModelArgs,
): PresentationFrameModel => {
  const frameVariantRaw = resolveFrameVariant(args.slideMeta, args.headMeta)
  const framePaddingRaw = args.slideMeta.framePadding ?? args.headMeta.framePadding
  return {
    baseFrameClass: resolveBaseFrameClass(frameVariantRaw, args.isAcademicTheme),
    slideFramePaddingPx: parseFramePaddingPx(framePaddingRaw),
  }
}
