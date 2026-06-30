import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  XR_SESSION_MODE_ORDER,
  buildXrSessionInit,
  chooseXrSessionMode,
} from '@/lib/three/ThreeGraphXrSessionPolicy'

export function testXrSessionPolicyPrefersNativeArWithoutProviderDependency() {
  if (XR_SESSION_MODE_ORDER.join('|') !== 'immersive-ar|immersive-vr') {
    throw new Error(`expected XR session support checks to prefer AR before VR, got ${XR_SESSION_MODE_ORDER.join('|')}`)
  }
  if (chooseXrSessionMode({ 'immersive-ar': true, 'immersive-vr': true }) !== 'immersive-ar') {
    throw new Error('expected XR session selection to prefer immersive AR when both modes are available')
  }
  if (chooseXrSessionMode({ 'immersive-ar': false, 'immersive-vr': true }) !== 'immersive-vr') {
    throw new Error('expected XR session selection to fall back to immersive VR when AR is unavailable')
  }
  if (chooseXrSessionMode({ 'immersive-ar': true, 'immersive-vr': true }, 'immersive-vr') !== 'immersive-vr') {
    throw new Error('expected XR session selection to preserve an explicitly selected supported mode')
  }
  if (chooseXrSessionMode({ 'immersive-ar': false, 'immersive-vr': false }) !== null) {
    throw new Error('expected XR session selection to return null when no native XR session is supported')
  }

  const overlayRoot = {} as Element
  const arInit = buildXrSessionInit('immersive-ar', overlayRoot)
  const arFeatures = new Set(arInit.optionalFeatures)
  for (const feature of ['local-floor', 'bounded-floor', 'hand-tracking', 'hit-test', 'light-estimation', 'dom-overlay']) {
    if (!arFeatures.has(feature)) throw new Error(`expected immersive AR session init to include ${feature}`)
  }
  if (arInit.domOverlay?.root !== overlayRoot) {
    throw new Error('expected immersive AR session init to bind DOM overlay root when supplied')
  }

  const vrInit = buildXrSessionInit('immersive-vr', overlayRoot)
  const vrFeatures = new Set(vrInit.optionalFeatures)
  if (vrFeatures.has('hit-test') || vrFeatures.has('dom-overlay') || vrInit.domOverlay) {
    throw new Error('expected immersive VR session init to avoid AR-only hit-test/dom-overlay options')
  }

  const source = [
    readFileSync(resolve(process.cwd(), 'src/lib/three/ThreeGraphXr.tsx'), 'utf8'),
    readFileSync(resolve(process.cwd(), 'src/lib/three/ThreeGraphXrSessionPolicy.ts'), 'utf8'),
  ].join('\n')
  for (const forbiddenProviderToken of ['8thwall', 'XR8', 'addCameraPipelineModule']) {
    if (source.includes(forbiddenProviderToken)) {
      throw new Error(`expected XR Mode to stay provider-neutral without copied external runtime token ${forbiddenProviderToken}`)
    }
  }
  if (!source.includes('Promise.all(') || !source.includes('XR_SESSION_MODE_ORDER.map')) {
    throw new Error('expected XR support detection to check native AR/VR modes in parallel through the shared order')
  }
  if (!source.includes('requestSession(sessionMode, buildXrSessionInit(sessionMode, resolveXrDomOverlayRoot(renderer)))')) {
    throw new Error('expected XR session entry to use the shared native WebXR session-init policy')
  }
}
