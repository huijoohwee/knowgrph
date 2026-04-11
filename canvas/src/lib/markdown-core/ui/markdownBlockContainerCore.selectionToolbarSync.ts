import React from 'react'
import { cancelCoalescedTask, scheduleCoalescedTask } from '@/lib/async/coalescedScheduler'
import { captureSelectionForFloatingToolbar } from '@/features/markdown/ui/markdownFloatingSelectionToolbar'
import { computeBubblePosition, getRangeRectSafe, resolveActiveSelectionRange } from './markdownBlockContainerCore.interaction'

type BubbleState = { show: boolean; leftPx: number; topPx: number }

export const useMarkdownBlockContainerSelectionToolbarSync = (args: {
  editing: boolean
  editDisableRichUi: boolean
  editorRef: React.RefObject<HTMLElement | null>
  getSelectionOffsets: () => { startOffset: number; endOffset: number } | null
  setBubble: React.Dispatch<React.SetStateAction<BubbleState>>
  setSlashMenu: React.Dispatch<React.SetStateAction<{ show: boolean; leftPx: number; topPx: number }>>
  setLinkPopover: React.Dispatch<React.SetStateAction<{ show: boolean; leftPx: number; topPx: number; href: string }>>
  toolbarInteractingRef: React.MutableRefObject<boolean>
  toolbarInteractionUntilRef: React.MutableRefObject<number>
  lastNonCollapsedSelectionOffsetsRef: React.MutableRefObject<{ startOffset: number; endOffset: number } | null>
  lastNonCollapsedDomRangeRef: React.MutableRefObject<Range | null>
  selectionSyncSuspendUntilRef: React.MutableRefObject<number>
  bubbleRafRef: React.MutableRefObject<number>
  selectionSyncBurstTokenRef: React.MutableRefObject<number>
  lastBubbleProbeRef: React.MutableRefObject<'show' | 'hide' | null>
  blurCommitTimerRef: React.MutableRefObject<number>
  bubbleScheduleKey: string
  editorMouseUpSyncScheduleKey: string
  probe: (name: string, data?: Record<string, unknown>) => void
}) => {
  const {
    editing,
    editDisableRichUi,
    editorRef,
    getSelectionOffsets,
    setBubble,
    setSlashMenu,
    setLinkPopover,
    toolbarInteractingRef,
    toolbarInteractionUntilRef,
    lastNonCollapsedSelectionOffsetsRef,
    lastNonCollapsedDomRangeRef,
    selectionSyncSuspendUntilRef,
    bubbleRafRef,
    selectionSyncBurstTokenRef,
    lastBubbleProbeRef,
    blurCommitTimerRef,
    bubbleScheduleKey,
    editorMouseUpSyncScheduleKey,
    probe,
  } = args
  const lastSelectionSignatureRef = React.useRef<string>('')
  const lastHostRectSignatureRef = React.useRef<string>('')
  const holdToolbarInteraction = React.useCallback(() => {
    if (blurCommitTimerRef.current) {
      window.clearTimeout(blurCommitTimerRef.current)
      blurCommitTimerRef.current = 0
    }
    toolbarInteractingRef.current = true
    toolbarInteractionUntilRef.current = Date.now() + 900
    const cached = lastNonCollapsedSelectionOffsetsRef.current
    if (!(cached && cached.startOffset !== cached.endOffset)) {
      captureSelectionForFloatingToolbar({
        getSelectionOffsets,
        lastNonCollapsedSelectionOffsetsRef,
        lastNonCollapsedDomRangeRef,
      })
    }
  }, [blurCommitTimerRef, getSelectionOffsets, lastNonCollapsedDomRangeRef, lastNonCollapsedSelectionOffsetsRef, toolbarInteractionUntilRef, toolbarInteractingRef])

  const updateBubble = React.useCallback(() => {
    if (!editing) return
    if (editDisableRichUi) return
    if (toolbarInteractingRef.current) return
    const root = editorRef.current
    if (!root) return
    const selection = getSelectionOffsets()
    const selectionSignature = selection ? `${selection.startOffset}:${selection.endOffset}` : ''
    const hostForSignature = root.closest('[data-start-line]') as HTMLElement | null
    const hostRectForSignature = hostForSignature?.getBoundingClientRect() || root.getBoundingClientRect()
    const hostRectSignature = `${Math.round(hostRectForSignature.left)}:${Math.round(hostRectForSignature.top)}:${Math.round(hostRectForSignature.width)}:${Math.round(hostRectForSignature.height)}`
    if (
      selectionSignature &&
      selectionSignature === lastSelectionSignatureRef.current &&
      hostRectSignature === lastHostRectSignatureRef.current &&
      lastBubbleProbeRef.current === 'show'
    ) {
      return
    }
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    const activeRange = resolveActiveSelectionRange({
      root,
      selection: sel,
      cachedRange: lastNonCollapsedDomRangeRef.current,
    })
    if (!activeRange) {
      if (lastBubbleProbeRef.current !== 'hide') {
        lastBubbleProbeRef.current = 'hide'
        probe('bubble.hide', { reason: 'no-active-range' })
      }
      lastSelectionSignatureRef.current = ''
      lastHostRectSignatureRef.current = ''
      setBubble(prev => (prev.show ? { ...prev, show: false } : prev))
      return
    }
    const rect = getRangeRectSafe(activeRange)
    const { leftPx, topPx } = computeBubblePosition({ rangeRect: rect, root })
    if (selection && selection.startOffset !== selection.endOffset) {
      lastNonCollapsedSelectionOffsetsRef.current = selection
    }
    try {
      lastNonCollapsedDomRangeRef.current = activeRange.cloneRange()
    } catch {
      void 0
    }
    setBubble(prev => {
      const next = { show: true, leftPx, topPx }
      if (prev.show && Math.abs(prev.leftPx - next.leftPx) < 1 && Math.abs(prev.topPx - next.topPx) < 1) return prev
      if (lastBubbleProbeRef.current !== 'show') {
        lastBubbleProbeRef.current = 'show'
        probe('bubble.show')
      }
      return next
    })
    if (selectionSignature) {
      lastSelectionSignatureRef.current = selectionSignature
      lastHostRectSignatureRef.current = hostRectSignature
    }
    setSlashMenu(prev => (prev.show ? { ...prev, show: false } : prev))
    setLinkPopover(prev => (prev.show ? { ...prev, show: false, href: '' } : prev))
  }, [editDisableRichUi, editing, editorRef, getSelectionOffsets, lastNonCollapsedDomRangeRef, lastNonCollapsedSelectionOffsetsRef, lastBubbleProbeRef, probe, setBubble, setLinkPopover, setSlashMenu, toolbarInteractingRef])

  const syncSelectionToolbarState = React.useCallback(() => {
    if (!editDisableRichUi) updateBubble()
  }, [editDisableRichUi, updateBubble])

  const runSelectionSyncBurst = React.useCallback((fn: () => void) => {
    selectionSyncBurstTokenRef.current += 1
    const token = selectionSyncBurstTokenRef.current
    queueMicrotask(() => {
      if (selectionSyncBurstTokenRef.current !== token) return
      fn()
    })
  }, [selectionSyncBurstTokenRef])

  React.useEffect(() => {
    if (!editing) return
    if (editDisableRichUi) return
    const root = editorRef.current
    if (!root) return
    const schedule = () => {
      if (toolbarInteractingRef.current) return
      const selNow = typeof window !== 'undefined' ? window.getSelection() : null
      if (selNow && selNow.rangeCount > 0) {
        const rr = selNow.getRangeAt(0)
        const cc = rr.commonAncestorContainer
        const nn = cc.nodeType === Node.ELEMENT_NODE ? (cc as Element) : cc.parentElement
        if (!rr.collapsed && nn && !root.contains(nn) && !lastNonCollapsedDomRangeRef.current) return
      }
      if (Date.now() < selectionSyncSuspendUntilRef.current) {
        if (!selNow || selNow.rangeCount <= 0) return
        const rr = selNow.getRangeAt(0)
        if (rr.collapsed) return
        const cc = rr.commonAncestorContainer
        const nn = cc.nodeType === Node.ELEMENT_NODE ? (cc as Element) : cc.parentElement
        if (!nn || !root.contains(nn)) return
      }
      if (bubbleRafRef.current) return
      bubbleRafRef.current = 1
      scheduleCoalescedTask(bubbleScheduleKey, () => {
        bubbleRafRef.current = 0
        updateBubble()
      }, 0)
    }
    const onSelectionChange = () => schedule()
    document.addEventListener('selectionchange', onSelectionChange)
    root.addEventListener('keyup', schedule)
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange)
      root.removeEventListener('keyup', schedule)
      cancelCoalescedTask(bubbleScheduleKey)
      cancelCoalescedTask(editorMouseUpSyncScheduleKey)
      bubbleRafRef.current = 0
    }
  }, [
    bubbleRafRef,
    bubbleScheduleKey,
    editDisableRichUi,
    editing,
    editorMouseUpSyncScheduleKey,
    editorRef,
    lastNonCollapsedDomRangeRef,
    selectionSyncSuspendUntilRef,
    toolbarInteractingRef,
    updateBubble,
  ])

  return {
    holdToolbarInteraction,
    updateBubble,
    syncSelectionToolbarState,
    runSelectionSyncBurst,
  }
}
