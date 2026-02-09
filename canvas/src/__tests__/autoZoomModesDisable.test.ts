import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'

export function testDisableAutoZoomModesForUserGesture() {
  let fitCalls = 0
  let selCalls = 0
  disableAutoZoomModesForUserGesture({
    viewPinned: false,
    fitToScreenMode: true,
    zoomToSelectionMode: true,
    setFitToScreenMode: v => {
      if (v !== false) throw new Error('expected setFitToScreenMode(false)')
      fitCalls += 1
    },
    setZoomToSelectionMode: v => {
      if (v !== false) throw new Error('expected setZoomToSelectionMode(false)')
      selCalls += 1
    },
  })
  if (fitCalls !== 1 || selCalls !== 1) throw new Error('expected both modes to be disabled')

  fitCalls = 0
  selCalls = 0
  disableAutoZoomModesForUserGesture({
    viewPinned: true,
    fitToScreenMode: true,
    zoomToSelectionMode: true,
    setFitToScreenMode: () => {
      fitCalls += 1
    },
    setZoomToSelectionMode: () => {
      selCalls += 1
    },
  })
  if (fitCalls !== 0 || selCalls !== 0) throw new Error('expected pinned view to keep auto modes unchanged')
}

