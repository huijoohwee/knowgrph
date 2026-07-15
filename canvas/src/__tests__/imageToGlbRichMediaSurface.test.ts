import { readFileSync } from 'node:fs'
import { resolveRichMediaPanelSurfaceVariant } from '@/components/richMediaPanelSurfaceVariant'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { installWheelForwardingAndBrowserZoomGuards } from 'grph-shared/dom/wheelGuards'
import {
  isCanvasOverlayBodyPanBlockingTarget,
  shouldUseCanvasOverlayBodyPan,
} from '@/lib/canvas/storyboard-widget-overlay-proxy'

function readCanvasSource(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

export function testImageToGlbOutputUsesNativeModelRichMediaSurface() {
  const variant = resolveRichMediaPanelSurfaceVariant({
    kind: 'model',
    mediaSrc: 'data:model/gltf-binary;base64,Z2xi',
    panelIsLoading: false,
    showPanelTextSurface: false,
    isEmptyPanel: false,
  } as Parameters<typeof resolveRichMediaPanelSurfaceVariant>[0])
  if (variant !== 'directMedia') {
    throw new Error(`expected GLB media to resolve to the direct native surface, got ${variant}`)
  }

  const directSurface = readCanvasSource('../components/RichMediaPanelDirectMediaSurface.tsx')
  const nativeSurface = readCanvasSource('../features/image-to-glb/ImageToGlbSurface.tsx')
  const overlayProxy = readCanvasSource('../lib/canvas/storyboard-widget-overlay-proxy.ts')
  const flowWheelOwner = readCanvasSource('../components/FlowCanvas/interactions/wheelAndGesture.ts')
  const flowPointerOwner = readCanvasSource('../components/FlowCanvas/interactions/listeners.ts')
  const requiredContracts = [
    [directSurface, "model.kind === 'model'"],
    [directSurface, '<ImageToGlbSurface'],
    [directSurface, 'data-kg-rich-media-model-surface="1"'],
    [nativeSurface, '<Canvas'],
    [nativeSurface, '<GlbAssetModel'],
    [nativeSurface, 'data-kg-image-to-glb-surface="1"'],
    [nativeSurface, 'data-kg-image-to-glb-renderer="native-three"'],
    [nativeSurface, 'data-kg-card-media-interactive={interactive'],
    [nativeSurface, 'data-kg-local-wheel-owner={interactive'],
    [nativeSurface, '<ImageToGlbPreviewCameraControls'],
    [nativeSurface, 'sourceUrl: normalizedSourceUrl'],
    [overlayProxy, "'[data-kg-rich-media-model-surface=\"1\"]'"],
    [flowWheelOwner, 'isLocalWheelOwnerEvent(event, overlayRoot)'],
    [flowWheelOwner, "resolved.kind === 'overlay' && isLocalWheelOwnerEvent(event, resolved.overlayRoot)"],
    [flowPointerOwner, 'resolved.targetEl.closest(RICH_MEDIA_LOCAL_INTERACTION_SELECTOR)'],
  ] as const
  for (const [source, token] of requiredContracts) {
    if (!source.includes(token)) throw new Error(`missing Image-to-GLB native surface contract: ${token}`)
  }
  if (nativeSurface.includes('<img')) {
    throw new Error('Image-to-GLB output must not fall back to the source image surface')
  }
}

export function testImageToGlbLocalWheelOwnerBeatsCanvasForwarding() {
  const { dom, restore } = initJsdomHarness()
  const globalValue = globalThis as typeof globalThis & {
    WheelEvent?: typeof WheelEvent
    getComputedStyle?: typeof getComputedStyle
  }
  const originalWheelEvent = globalValue.WheelEvent
  const originalGetComputedStyle = globalValue.getComputedStyle
  let cleanup: (() => void) | null = null
  try {
    globalValue.WheelEvent = dom.window.WheelEvent as unknown as typeof WheelEvent
    globalValue.getComputedStyle = dom.window.getComputedStyle.bind(dom.window) as typeof getComputedStyle
    const panel = dom.window.document.createElement('section')
    const modelOwner = dom.window.document.createElement('section')
    const canvas = dom.window.document.createElement('canvas')
    const forwardedTarget = dom.window.document.createElement('section')
    let forwardedCount = 0
    modelOwner.dataset.kgLocalWheelOwner = '1'
    modelOwner.appendChild(canvas)
    panel.appendChild(modelOwner)
    dom.window.document.body.append(panel, forwardedTarget)
    forwardedTarget.addEventListener('wheel', () => {
      forwardedCount += 1
    })
    cleanup = installWheelForwardingAndBrowserZoomGuards(panel, {
      forwardWheelBeforeScrollableTarget: true,
      forwardWheelTo: () => forwardedTarget,
    })

    const wheel = new dom.window.WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 42,
    })
    canvas.dispatchEvent(wheel)
    if (forwardedCount !== 0 || wheel.defaultPrevented) {
      throw new Error(`expected GLB-local wheel to remain with OrbitControls, forwarded=${forwardedCount} prevented=${wheel.defaultPrevented}`)
    }

    const pinchWheel = new dom.window.WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -24,
    })
    canvas.dispatchEvent(pinchWheel)
    if (forwardedCount !== 0 || pinchWheel.defaultPrevented) {
      throw new Error(`expected GLB-local pinch wheel to remain with OrbitControls, forwarded=${forwardedCount} prevented=${pinchWheel.defaultPrevented}`)
    }

    const safariGesture = new dom.window.Event('gesturechange', { bubbles: true, cancelable: true })
    canvas.dispatchEvent(safariGesture)
    if (safariGesture.defaultPrevented) {
      throw new Error('expected local GLB gesture events to bypass the canvas browser-zoom guard')
    }
  } finally {
    cleanup?.()
    globalValue.WheelEvent = originalWheelEvent
    globalValue.getComputedStyle = originalGetComputedStyle
    restore()
  }
}

export function testImageToGlbModelSurfaceBlocksStoryboardBodyPan() {
  const { dom, restore } = initJsdomHarness()
  try {
    const overlayRoot = dom.window.document.createElement('section')
    const modelSurface = dom.window.document.createElement('section')
    const canvas = dom.window.document.createElement('canvas')
    overlayRoot.dataset.kgRichMediaOverlay = '1'
    overlayRoot.dataset.kgStoryboardWidgetMode = '1'
    overlayRoot.dataset.kgOverlayPanOwner = 'canvas'
    modelSurface.dataset.kgRichMediaModelSurface = '1'
    modelSurface.appendChild(canvas)
    overlayRoot.appendChild(modelSurface)
    dom.window.document.body.appendChild(overlayRoot)

    if (!isCanvasOverlayBodyPanBlockingTarget(canvas, overlayRoot)) {
      throw new Error('expected the model viewer to be a canonical Rich Media canvas-pan blocker')
    }
    if (shouldUseCanvasOverlayBodyPan({ target: canvas, overlayRoot })) {
      throw new Error('expected model orbit/pan gestures to remain local instead of materializing Storyboard pan')
    }
  } finally {
    restore()
  }
}
