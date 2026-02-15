import { shouldAutoFitToScreen2d, shouldAutoZoomSelection2d } from '@/features/zoom/autoZoom2dPolicy'

export function testAutoZoom2dPolicyFlowEditorDisablesAutoZoomModes() {
  const fitAllowed = shouldAutoFitToScreen2d({
    canvas2dRenderer: 'flowEditor',
    viewPinned: false,
    fitToScreenMode: true,
    zoomToSelectionMode: false,
  })
  if (fitAllowed) {
    throw new Error('expected flowEditor to disable auto fit-to-screen')
  }

  const selAllowed = shouldAutoZoomSelection2d({
    canvas2dRenderer: 'flowEditor',
    viewPinned: false,
    zoomToSelectionMode: true,
  })
  if (selAllowed) {
    throw new Error('expected flowEditor to disable auto zoom-to-selection')
  }

  const mapFitAllowed = shouldAutoFitToScreen2d({
    canvas2dRenderer: 'flow',
    viewPinned: false,
    fitToScreenMode: true,
    zoomToSelectionMode: false,
  })
  if (!mapFitAllowed) {
    throw new Error('expected non-flowEditor renderer to allow auto fit-to-screen when enabled')
  }
}

