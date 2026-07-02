import { shouldAutoFitToScreen2d, shouldAutoZoomSelection2d } from '@/features/zoom/autoZoom2dPolicy'

export function testAutoZoom2dPolicyStoryboardWidgetDisablesAutoZoomModes() {
  const fitAllowed = shouldAutoFitToScreen2d({
    canvas2dRenderer: 'storyboard',
    viewPinned: false,
    fitToScreenMode: true,
    zoomToSelectionMode: false,
  })
  if (!fitAllowed) throw new Error('expected storyboardWidget to allow auto fit-to-screen when enabled')

  const selAllowed = shouldAutoZoomSelection2d({
    canvas2dRenderer: 'storyboard',
    viewPinned: false,
    zoomToSelectionMode: true,
  })
  if (!selAllowed) throw new Error('expected storyboardWidget to allow auto zoom-to-selection when enabled')

  const mapFitAllowed = shouldAutoFitToScreen2d({
    canvas2dRenderer: 'flow',
    viewPinned: false,
    fitToScreenMode: true,
    zoomToSelectionMode: false,
  })
  if (!mapFitAllowed) {
    throw new Error('expected non-storyboard renderer to allow auto fit-to-screen when enabled')
  }
}
