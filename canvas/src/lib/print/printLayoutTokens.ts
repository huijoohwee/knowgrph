import { resolvePrintInsetsMm } from '@/lib/workspace/workspaceLayoutSettings'

export type PrintOrientation = 'portrait' | 'landscape'
export const PRESENTATION_SLIDE_ASPECT_RATIO = 16 / 9
export const PRESENTATION_BASE_SLIDE_SIZE_PX = {
  width: 1920,
  height: 1080,
} as const

type BoxInsetsMm = {
  top: number
  right: number
  bottom: number
  left: number
}

type ResolvePrintLayoutPresetOptions = {
  horizontalInsetScale?: number
  verticalInsetScale?: number
}

type EffectivePrintInsetsMm = {
  pageMarginMm: BoxInsetsMm
  rootPaddingMm: BoxInsetsMm
}

type PrintLayoutPreset = {
  pageSizeIn: { width: number; height: number }
}

const PRINT_LAYOUT_PRESETS: Readonly<Record<PrintOrientation, PrintLayoutPreset>> = {
  portrait: {
    // ISO A4 portrait
    pageSizeIn: { width: 8.2677165354, height: 11.6929133858 },
  },
  landscape: {
    // ISO A4 landscape
    pageSizeIn: { width: 11.6929133858, height: 8.2677165354 },
  },
}

const toMmShorthand = (insets: BoxInsetsMm): string =>
  `${insets.top}mm ${insets.right}mm ${insets.bottom}mm ${insets.left}mm`

const toInPageSize = (size: { width: number; height: number }): string =>
  `${size.width}in ${size.height}in`

export const resolvePrintLayoutPreset = (
  orientation: PrintOrientation,
  options?: ResolvePrintLayoutPresetOptions,
): {
  pageSizeCss: string
  pageMarginCss: string
  rootPaddingCss: string
} => {
  const preset = PRINT_LAYOUT_PRESETS[orientation]
  const effectiveInsets = resolveEffectivePrintInsetsMm(orientation, options)
  return {
    pageSizeCss: toInPageSize(preset.pageSizeIn),
    pageMarginCss: toMmShorthand(effectiveInsets.pageMarginMm),
    rootPaddingCss: toMmShorthand(effectiveInsets.rootPaddingMm),
  }
}

export const resolveEffectivePrintInsetsMm = (
  orientation: PrintOrientation,
  options?: ResolvePrintLayoutPresetOptions,
): EffectivePrintInsetsMm => {
  const pageMarginMm = resolvePrintInsetsMm(orientation, 'pageMarginMm')
  const rootPaddingMm = resolvePrintInsetsMm(orientation, 'rootPaddingMm')
  const horizontalScale = Number(options?.horizontalInsetScale)
  const effectiveHorizontalScale = Number.isFinite(horizontalScale) && horizontalScale > 0 ? horizontalScale : 1
  const verticalScale = Number(options?.verticalInsetScale)
  const effectiveVerticalScale = Number.isFinite(verticalScale) && verticalScale > 0 ? verticalScale : 1
  if (effectiveHorizontalScale !== 1) {
    pageMarginMm.right *= effectiveHorizontalScale
    pageMarginMm.left *= effectiveHorizontalScale
    rootPaddingMm.right *= effectiveHorizontalScale
    rootPaddingMm.left *= effectiveHorizontalScale
  }
  if (effectiveVerticalScale !== 1) {
    pageMarginMm.top *= effectiveVerticalScale
    pageMarginMm.bottom *= effectiveVerticalScale
    rootPaddingMm.top *= effectiveVerticalScale
    rootPaddingMm.bottom *= effectiveVerticalScale
  }
  return { pageMarginMm, rootPaddingMm }
}

export const resolvePrintViewportSizeMm = (
  orientation: PrintOrientation,
  options?: ResolvePrintLayoutPresetOptions,
): { widthMm: number; heightMm: number } => {
  const preset = PRINT_LAYOUT_PRESETS[orientation]
  const effectiveInsets = resolveEffectivePrintInsetsMm(orientation, options)
  const pageWidthMm = preset.pageSizeIn.width * 25.4
  const pageHeightMm = preset.pageSizeIn.height * 25.4
  const widthMm = Math.max(
    1,
    pageWidthMm
      - effectiveInsets.pageMarginMm.left
      - effectiveInsets.pageMarginMm.right
      - effectiveInsets.rootPaddingMm.left
      - effectiveInsets.rootPaddingMm.right,
  )
  const heightMm = Math.max(
    1,
    pageHeightMm
      - effectiveInsets.pageMarginMm.top
      - effectiveInsets.pageMarginMm.bottom
      - effectiveInsets.rootPaddingMm.top
      - effectiveInsets.rootPaddingMm.bottom,
  )
  return { widthMm, heightMm }
}

export const resolvePrintPageSizeMm = (
  orientation: PrintOrientation,
): { widthMm: number; heightMm: number } => {
  const preset = PRINT_LAYOUT_PRESETS[orientation]
  return {
    widthMm: preset.pageSizeIn.width * 25.4,
    heightMm: preset.pageSizeIn.height * 25.4,
  }
}

type ResolvePrintGeometryMmArgs = {
  orientation: PrintOrientation
  horizontalInsetScale?: number
  verticalInsetScale?: number
  presentationVerticalInsetSymmetry?: boolean
}

export const resolvePrintGeometryMm = (
  args: ResolvePrintGeometryMmArgs,
): {
  pageSizeMm: { widthMm: number; heightMm: number }
  effectiveInsetsMm: EffectivePrintInsetsMm
  viewportMm: { widthMm: number; heightMm: number }
  presentationSlideMm: { widthMm: number; heightMm: number }
} => {
  const orientation = args.orientation
  const effectiveInsetsMm = resolveEffectivePrintInsetsMm(orientation, {
    horizontalInsetScale: args.horizontalInsetScale,
    verticalInsetScale: args.verticalInsetScale,
  })
  if (args.presentationVerticalInsetSymmetry) {
    effectiveInsetsMm.pageMarginMm.bottom = effectiveInsetsMm.pageMarginMm.top
    effectiveInsetsMm.rootPaddingMm.bottom = effectiveInsetsMm.rootPaddingMm.top
  }
  const pageSizeMm = resolvePrintPageSizeMm(orientation)
  const viewportMm = {
    widthMm: Math.max(
      1,
      pageSizeMm.widthMm
        - effectiveInsetsMm.pageMarginMm.left
        - effectiveInsetsMm.pageMarginMm.right
        - effectiveInsetsMm.rootPaddingMm.left
        - effectiveInsetsMm.rootPaddingMm.right,
    ),
    heightMm: Math.max(
      1,
      pageSizeMm.heightMm
        - effectiveInsetsMm.pageMarginMm.top
        - effectiveInsetsMm.pageMarginMm.bottom
        - effectiveInsetsMm.rootPaddingMm.top
        - effectiveInsetsMm.rootPaddingMm.bottom,
    ),
  }
  const presentationSlideWidthMm =
    viewportMm.widthMm / Math.max(1, viewportMm.heightMm) > PRESENTATION_SLIDE_ASPECT_RATIO
      ? viewportMm.heightMm * PRESENTATION_SLIDE_ASPECT_RATIO
      : viewportMm.widthMm
  const presentationSlideHeightMm = presentationSlideWidthMm / PRESENTATION_SLIDE_ASPECT_RATIO
  return {
    pageSizeMm,
    effectiveInsetsMm,
    viewportMm,
    presentationSlideMm: {
      widthMm: presentationSlideWidthMm,
      heightMm: presentationSlideHeightMm,
    },
  }
}
