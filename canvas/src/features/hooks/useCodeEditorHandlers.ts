import { useCallback } from 'react'
import { UI_COPY } from '@/lib/config'

export type EditorHandlersOptions = {
  codeText: string
  setCodeText: (t: string) => void
  setCodeError: (e: string) => void
  codeSelectThrottleMs: number
  publishCaret: (start: number, end: number) => void
  nodeIdSet: Set<string>
  edgeIdSet: Set<string>
  setSelectionSource: (src: 'editor') => void
  selectNode: (id: string) => void
  selectEdge: (id: string) => void
  codeSelectTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  stickyBlockRef: React.MutableRefObject<{ start: number; end: number } | null>
  countLinesUpTo: (text: string, pos: number) => number
  smoothScrollTextareaToCenter: (el: HTMLTextAreaElement, line: number) => void // Legacy, maybe unused with Monaco?
  detectIdAroundSelection: (text: string, start: number, end: number) => string | null
  scheduleIdle: (fn: () => void) => void
  tryFormatJson: (text: string) => string
  enableSelection?: boolean
}

export const useCodeEditorHandlers = (o: EditorHandlersOptions) => {
  const {
    codeText,
    setCodeText,
    setCodeError,
    codeSelectThrottleMs,
    publishCaret,
    nodeIdSet,
    edgeIdSet,
    setSelectionSource,
    selectNode,
    selectEdge,
    codeSelectTimerRef,
    detectIdAroundSelection,
    scheduleIdle,
    tryFormatJson,
    enableSelection,
  } = o

  const onChange = useCallback((value: string) => {
    setCodeText(value)
  }, [setCodeText])

  const onSelectionChange = useCallback((start: number, end: number) => {
    if (enableSelection === false) return
    const id = detectIdAroundSelection(codeText, start, end)
    if (!id) return
    if (codeSelectTimerRef.current) return
    codeSelectTimerRef.current = setTimeout(() => {
      codeSelectTimerRef.current = null
      setSelectionSource('editor')
      if (nodeIdSet.has(id)) selectNode(id)
      else if (edgeIdSet.has(id)) selectEdge(id)
    }, codeSelectThrottleMs)
    publishCaret(start, end)
  }, [codeText, codeSelectThrottleMs, detectIdAroundSelection, edgeIdSet, nodeIdSet, publishCaret, selectEdge, selectNode, setSelectionSource, enableSelection, codeSelectTimerRef])

  const onDoubleClick = useCallback((start: number, end: number) => {
    if (enableSelection === false) return
    const id = detectIdAroundSelection(codeText, start, end)
    if (!id) return
    setSelectionSource('editor')
    if (nodeIdSet.has(id)) selectNode(id)
    else if (edgeIdSet.has(id)) selectEdge(id)
  }, [codeText, detectIdAroundSelection, edgeIdSet, nodeIdSet, selectEdge, selectNode, setSelectionSource, enableSelection])

  // onKeyUp is mostly for triggering selection in textarea, not needed for Monaco usually
  // onClick is for sticky block, need to adapt for Monaco if we keep it.
  // Sticky block logic sets selection range and scrolls.
  // We can expose a "jumpToBlock" handler or similar.
  // For now, let's omit onClick/onKeyUp unless critical.

  const onBlur = useCallback(() => {
    // We can't easily get the value here unless passed, but Monaco's onBlur doesn't pass value.
    // However, we have codeText in scope (state).
    // Note: codeText might be stale if closure is stale?
    // Actually, onChange updates state, so codeText should be relatively fresh or we use the latest from state if we trust it.
    // Better: Monaco onBlur doesn't pass value, but we can rely on `codeText` state which tracks onChange.
    scheduleIdle(() => {
      try {
        const formatted = tryFormatJson(codeText)
        setCodeText(formatted)
        setCodeError('')
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : ''
        setCodeError(`${UI_COPY.invalidJsonPrefix}${message}`)
      }
    })
  }, [scheduleIdle, tryFormatJson, setCodeText, setCodeError, codeText])

  return { onChange, onSelectionChange, onDoubleClick, onBlur }
}
