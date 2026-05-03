export const FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO = 0.94
export const FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO_MIN = 0.6
export const FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO_MAX = 0.95

export const FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_PHONE = 0.98
export const FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_TABLET = 0.88
export const FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_LAPTOP = 0.35
export const FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_DESKTOP = 0.01
export const FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_MIN = 0.01
export const FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_MAX = 1

export type FrontmatterOverlayFitProxyScales = {
  phone: number
  tablet: number
  laptop: number
  desktop: number
}

export function clampFrontmatterInitialFitFillRatio(value: number): number {
  const next = Number.isFinite(value) ? value : FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO
  return Math.max(
    FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO_MIN,
    Math.min(FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO_MAX, next),
  )
}

export function clampFrontmatterOverlayFitProxyScale(value: number): number {
  const next = Number.isFinite(value) ? value : FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_DESKTOP
  return Math.max(
    FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_MIN,
    Math.min(FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_MAX, next),
  )
}

export function normalizeFrontmatterOverlayFitProxyScales(
  scales?: Partial<FrontmatterOverlayFitProxyScales> | null,
): FrontmatterOverlayFitProxyScales {
  return {
    phone: clampFrontmatterOverlayFitProxyScale(scales?.phone ?? FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_PHONE),
    tablet: clampFrontmatterOverlayFitProxyScale(scales?.tablet ?? FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_TABLET),
    laptop: clampFrontmatterOverlayFitProxyScale(scales?.laptop ?? FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_LAPTOP),
    desktop: clampFrontmatterOverlayFitProxyScale(scales?.desktop ?? FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_DESKTOP),
  }
}

export function readFrontmatterOverlayFitProxyScale(
  viewportW: number,
  scales?: Partial<FrontmatterOverlayFitProxyScales> | null,
): number {
  const normalized = normalizeFrontmatterOverlayFitProxyScales(scales)
  if (!(viewportW > 0)) return normalized.desktop
  if (viewportW <= 430) return normalized.phone
  if (viewportW <= 768) return normalized.tablet
  if (viewportW <= 1280) return normalized.laptop
  return normalized.desktop
}
