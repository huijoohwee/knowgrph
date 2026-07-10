import { resetBrowserLocalSurfaceSnapshotsForTests } from '@/features/agent-ready/browserLocalSurfaceSnapshots'
import { resetGraphStoreForTests } from '@/hooks/useGraphStore'
import { resetGlobalUserSelectLock } from '@/lib/canvas/interaction-user-select'
import { resetSpacePanHeldForTests } from '@/lib/canvas/space-pan'
import { resetJsdomHarnessAnimationFramesForTests, restoreActiveJsdomGlobalsForTests } from '@/tests/lib/jsdomHarness'

const clearDocumentSurface = (): void => {
  if (typeof document === 'undefined') return
  try {
    document.body?.replaceChildren()
  } catch {
    try {
      if (document.body) document.body.innerHTML = ''
    } catch {
      void 0
    }
  }
  try {
    document.body?.removeAttribute('style')
    document.body?.className && document.body.removeAttribute('class')
  } catch {
    void 0
  }
  try {
    document.documentElement?.removeAttribute('style')
    document.documentElement?.className && document.documentElement.removeAttribute('class')
  } catch {
    void 0
  }
  try {
    const selection = typeof window !== 'undefined' && typeof window.getSelection === 'function'
      ? window.getSelection()
      : null
    selection?.removeAllRanges?.()
  } catch {
    void 0
  }
}

const clearBrowserStorage = (): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage?.clear?.()
  } catch {
    void 0
  }
  try {
    window.sessionStorage?.clear?.()
  } catch {
    void 0
  }
}

export const resetCanvasTestRuntime = (): void => {
  resetJsdomHarnessAnimationFramesForTests()
  resetSpacePanHeldForTests()
  restoreActiveJsdomGlobalsForTests()
  resetGlobalUserSelectLock()
  resetBrowserLocalSurfaceSnapshotsForTests()
  resetGraphStoreForTests()
  clearDocumentSurface()
  clearBrowserStorage()
}
