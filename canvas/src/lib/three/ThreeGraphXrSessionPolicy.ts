import type { WebGLRenderer } from 'three'

export type XrSessionMode = 'immersive-ar' | 'immersive-vr'

export type XrSessionReferenceSpaceKind = 'local-floor' | 'local'

export type XrSessionReferenceSpace<TSpace extends object = object> = Readonly<{
  kind: XrSessionReferenceSpaceKind
  space: TSpace
}>

export type XrSessionSupport = Partial<Record<XrSessionMode, boolean>>

export type XrSessionInit = {
  optionalFeatures: string[]
  domOverlay?: { root: Element }
}

export const XR_SESSION_MODE_ORDER: readonly XrSessionMode[] = ['immersive-ar', 'immersive-vr']
export const XR_SESSION_REFERENCE_SPACE_ORDER: readonly XrSessionReferenceSpaceKind[] = ['local-floor', 'local']

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

export async function requestPreferredXrReferenceSpace<TSpace extends object>(session: {
  requestReferenceSpace?: (kind: XrSessionReferenceSpaceKind) => Promise<TSpace>
}): Promise<XrSessionReferenceSpace<TSpace>> {
  if (!session.requestReferenceSpace) throw new Error('XR reference spaces are unavailable')
  let lastError: unknown = null
  for (const kind of XR_SESSION_REFERENCE_SPACE_ORDER) {
    try {
      return { kind, space: await session.requestReferenceSpace(kind) }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('No supported XR reference space was found')
}

export function resolveXrDomOverlayRoot(renderer: WebGLRenderer | null): Element | null {
  if (typeof document === 'undefined') return null
  return renderer?.domElement?.parentElement || document.body || null
}
