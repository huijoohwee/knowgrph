import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { useGraphStore } from '@/hooks/useGraphStore'
import ToastHost from '@/components/ui/ToastHost'
import HistoryView from '@/features/panels/views/HistoryView'
import { buildKnowgrphStorageConflictReviewLogActionId } from '@/lib/storage/knowgrphStorageConflictActions'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testToastHostRendersSharedActionsAndDispatchesUiRuntime() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  const store = useGraphStore.getState()
  let root: ReturnType<typeof createRoot> | null = null
  try {
    store.resetAll()
    store.setBottomSurfaceCollapsed(true)
    store.setBottomSurfaceTab('stats')
    store.pushUiToast({
      id: 'toast:action',
      kind: 'warning',
      message: 'Storage conflict requires review.',
      ttlMs: null,
      log: false,
      actions: [
        {
          id: buildKnowgrphStorageConflictReviewLogActionId('kgws:toast'),
          label: 'Review Log',
          tone: 'neutral',
        },
      ],
    })

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')
    root = createRoot(container)

    await act(async () => {
      root!.render(<ToastHost />)
    })
    await tick()

    const reviewButton = (Array.from(dom.window.document.querySelectorAll('button')) as HTMLButtonElement[]).find(
      button => button.textContent?.trim() === 'Review Log',
    )
    if (!reviewButton) throw new Error('expected toast host to render shared action button')

    await act(async () => {
      reviewButton.click()
      await tick()
    })

    const nextState = useGraphStore.getState()
    if (nextState.bottomSurfaceCollapsed !== false) {
      throw new Error('expected toast action to open the bottom surface through the shared ui runtime')
    }
    if (nextState.bottomSurfaceTab !== 'history') {
      throw new Error('expected toast action to route to History via the shared ui runtime')
    }
  } finally {
    try {
      await act(async () => {
        root?.unmount()
      })
      await tick()
    } catch {
      void 0
    }
    restore()
    restoreWindow()
  }
}

export async function testHistoryViewRendersSharedLogActionsAndDispatchesUiRuntime() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  const store = useGraphStore.getState()
  let root: ReturnType<typeof createRoot> | null = null
  try {
    store.resetAll()
    store.setBottomSurfaceCollapsed(true)
    store.setBottomSurfaceTab('stats')
    store.pushUiLog({
      kind: 'warning',
      source: 'storage:conflict',
      message: 'Storage conflict retained local change.',
      actions: [
        {
          id: buildKnowgrphStorageConflictReviewLogActionId('kgws:history'),
          label: 'Review Log',
          tone: 'neutral',
        },
      ],
    })

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')
    root = createRoot(container)

    await act(async () => {
      root!.render(<HistoryView searchQuery="" />)
    })
    await tick()

    const historyChooser = (Array.from(dom.window.document.querySelectorAll('button')) as HTMLButtonElement[]).find(
      button => button.getAttribute('aria-label')?.startsWith('History section:'),
    )
    if (!historyChooser) throw new Error('expected History section chooser')

    await act(async () => {
      historyChooser.click()
      await tick()
    })

    const logTab = (Array.from(dom.window.document.querySelectorAll('button')) as HTMLButtonElement[]).find(
      button => button.textContent?.trim() === 'Log',
    )
    if (!logTab) throw new Error('expected Log option')

    await act(async () => {
      logTab.click()
      await tick()
    })

    const reviewButton = (Array.from(dom.window.document.querySelectorAll('button')) as HTMLButtonElement[]).find(
      button => button.textContent?.trim() === 'Review Log',
    )
    if (!reviewButton) throw new Error('expected history view log row to render shared action button')

    await act(async () => {
      reviewButton.click()
      await tick()
    })

    const nextState = useGraphStore.getState()
    if (nextState.bottomSurfaceCollapsed !== false) {
      throw new Error('expected history log action to open the bottom surface through the shared ui runtime')
    }
    if (nextState.bottomSurfaceTab !== 'history') {
      throw new Error('expected history log action to keep the shared runtime routed to History')
    }
  } finally {
    try {
      await act(async () => {
        root?.unmount()
      })
      await tick()
    } catch {
      void 0
    }
    restore()
    restoreWindow()
  }
}
