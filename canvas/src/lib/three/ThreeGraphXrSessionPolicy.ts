import type { WebGLRenderer } from 'three'

export type XrSessionMode = 'immersive-ar' | 'immersive-vr'

export type XrSessionSupport = Partial<Record<XrSessionMode, boolean>>

export type XrSessionInit = {
  optionalFeatures: string[]
  domOverlay?: { root: Element }
}

export const XR_SESSION_MODE_ORDER: readonly XrSessionMode[] = ['immersive-ar', 'immersive-vr']

const XR_BASE_OPTIONAL_FEATURES = ['local-floor', 'bounded-floor', 'hand-tracking'] as const
const XR_AR_OPTIONAL_FEATURES = ['hit-test', 'light-estimation'] as const

export function chooseXrSessionMode(support: XrSessionSupport, current?: XrSessionMode): XrSessionMode | null {
  if (current && support[current] === true) return current
  return XR_SESSION_MODE_ORDER.find(mode => support[mode] === true) || null
}

export function buildXrSessionInit(mode: XrSessionMode, domOverlayRoot?: Element | null): XrSessionInit {
  const optionalFeatures = new Set<string>(XR_BASE_OPTIONAL_FEATURES)
  const init: XrSessionInit = { optionalFeatures: Array.from(optionalFeatures) }
  if (mode === 'immersive-ar') {
    for (const feature of XR_AR_OPTIONAL_FEATURES) optionalFeatures.add(feature)
    if (domOverlayRoot) {
      optionalFeatures.add('dom-overlay')
      init.domOverlay = { root: domOverlayRoot }
    }
  }
  init.optionalFeatures = Array.from(optionalFeatures)
  return init
}

export function resolveXrDomOverlayRoot(renderer: WebGLRenderer | null): Element | null {
  if (typeof document === 'undefined') return null
  return renderer?.domElement?.parentElement || document.body || null
}
