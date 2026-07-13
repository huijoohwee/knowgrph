import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { waitForFrames } from '@/tests/lib/reactRootHarness'
import { useGraphStore } from '@/hooks/useGraphStore'
import { FloatingPanelChatFooter } from '@/features/chat/FloatingPanelChatSections'
import { applyFloatingPanelChatInputAppend, resolveFloatingPanelChatInputAppend } from '@/features/chat/floatingPanelChat/floatingPanelChatInputAppend'
import ToastHost from '@/components/ui/ToastHost'
import HistoryView from '@/features/panels/views/HistoryView'
import { CHAT_INPUT_APPEND_EVENT, FLOATING_PANEL_OPEN_EVENT } from '@/features/canvas/utils'
import { buildChatPromotionRetryInsertAction } from '@/features/chat/floatingPanelChat/floatingPanelChatPromotionRetryUiAction'
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

export async function testToastHostPromotionRetryActionAppendsCommandIntoChatComposer() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  const store = useGraphStore.getState()
  let root: ReturnType<typeof createRoot> | null = null
  const observedEvents: Array<{ type: 'append' | 'open'; detail: unknown }> = []
  const retryCommand = '#promotion.retry /workspace/chat/20260522T195000Z/kgc_20260522T195000Z.md /workspace/chat/20260522T195000Z/kgc-trace_20260522T195000Z.md'
  const retryToastId = 'chat-promotion-retry:/workspace/chat/20260522T195000Z/kgc_20260522T195000Z.md'
  const RetryComposerHarness = () => {
    const [input, setInput] = React.useState('')
    const [appendFocusRequestKey, setAppendFocusRequestKey] = React.useState(0)
    React.useEffect(() => {
      const handler = (event: Event) => {
        const detail = resolveFloatingPanelChatInputAppend((event as CustomEvent<{ text?: string; mode?: 'append' | 'replace' } | undefined>).detail)
        if (!detail) return
        setInput(previous => applyFloatingPanelChatInputAppend(previous, detail))
        setAppendFocusRequestKey(previous => previous + 1)
      }
      dom.window.addEventListener(CHAT_INPUT_APPEND_EVENT, handler as EventListener)
      return () => {
        dom.window.removeEventListener(CHAT_INPUT_APPEND_EVENT, handler as EventListener)
      }
    }, [])
    return (
      <>
        <FloatingPanelChatFooter
          input={input}
          setInput={setInput}
          appendFocusRequestKey={appendFocusRequestKey}
          isLoading={false}
          errorText={null}
          connectivity="unknown"
          connectivityDetail={null}
          currentNode={null}
          modelId="gpt-5-nano"
          modelOptions={['gpt-5-nano']}
          onModelChanged={() => undefined}
          uiPanelTextFontClass="text-sm"
          uiPanelMicroLabelTextSizeClass="text-xs"
          isSubmitDisabled={!input.trim()}
          onSubmit={event => event.preventDefault()}
          onStop={() => undefined}
          markdownText={null}
        />
        <ToastHost />
      </>
    )
  }
  const appendListener = (event: Event) => {
    observedEvents.push({ type: 'append', detail: (event as CustomEvent).detail })
  }
  const openListener = (event: Event) => {
    observedEvents.push({ type: 'open', detail: (event as CustomEvent).detail })
  }
  try {
    store.resetAll()
    dom.window.addEventListener(CHAT_INPUT_APPEND_EVENT, appendListener as EventListener)
    dom.window.addEventListener(FLOATING_PANEL_OPEN_EVENT, openListener as EventListener)
    store.pushUiToast({
      id: retryToastId,
      kind: 'warning',
      message: 'Artifact mirroring failed for the saved local artifacts.',
      ttlMs: null,
      log: false,
      actions: [buildChatPromotionRetryInsertAction(retryCommand, retryToastId)],
    })

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')
    root = createRoot(container)

    await act(async () => {
      root!.render(<RetryComposerHarness />)
    })
    await waitForFrames(dom.window as unknown as Window, 2)

    const insertButton = (Array.from(dom.window.document.querySelectorAll('button')) as HTMLButtonElement[]).find(
      button => button.textContent?.trim() === 'Insert Retry Command',
    )
    if (!insertButton) throw new Error('expected toast host to render the shared retry-command action button')

    await act(async () => {
      insertButton.click()
      await waitForFrames(dom.window as unknown as Window, 2)
    })

    const appendEvent = observedEvents.find(event => event.type === 'append') || null
    const openEvent = observedEvents.find(event => event.type === 'open') || null
    if (!appendEvent || (appendEvent.detail as { text?: string; mode?: string } | null)?.text !== retryCommand || (appendEvent.detail as { text?: string; mode?: string } | null)?.mode !== 'append') {
      throw new Error(`expected retry toast action to append the exact retry command into the chat composer, got ${JSON.stringify(observedEvents)}`)
    }
    if (!openEvent || (openEvent.detail as { tab?: string; open?: boolean } | null)?.tab !== 'chat' || (openEvent.detail as { tab?: string; open?: boolean } | null)?.open !== true) {
      throw new Error(`expected retry toast action to open the shared chat surface before appending the command, got ${JSON.stringify(observedEvents)}`)
    }
    const textarea = dom.window.document.querySelector('[data-kg-card-inline-viewer-edit-command-proxy="1"]') as HTMLTextAreaElement | null
    if (!textarea) throw new Error('expected retry toast action test to mount the FloatingPanel chat composer')
    if (textarea.value !== retryCommand) {
      throw new Error(`expected retry toast action to queue the exact retry command into the chat composer, got ${JSON.stringify(textarea.value)}`)
    }
    if (textarea.selectionStart !== textarea.value.length || textarea.selectionEnd !== textarea.value.length) {
      throw new Error(`expected retry toast action to place the caret at the end of the queued command, got selection=${textarea.selectionStart}:${textarea.selectionEnd} value=${JSON.stringify(textarea.value)}`)
    }
    const updatedToast = useGraphStore.getState().uiToasts.find(toast => toast.id === retryToastId) || null
    if (!updatedToast || updatedToast.kind !== 'success' || updatedToast.message !== 'Retry command queued in chat composer.' || Array.isArray(updatedToast.actions)) {
      throw new Error(`expected retry toast action to collapse into a short success confirmation, got ${JSON.stringify(useGraphStore.getState().uiToasts)}`)
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
    dom.window.removeEventListener(CHAT_INPUT_APPEND_EVENT, appendListener as EventListener)
    dom.window.removeEventListener(FLOATING_PANEL_OPEN_EVENT, openListener as EventListener)
    restore()
    restoreWindow()
  }
}
