import { useCallback } from 'react'
import { UI_COPY } from '@/lib/config'
import { emitTextSelectionEvent } from '@/features/hooks/textSelectionEvents'

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
  smoothScrollTextareaToCenter: (el: HTMLTextAreaElement, line: number) => void
  detectIdAroundSelection: (text: string, start: number, end: number) => string | null
  scheduleIdle: (fn: () => void) => void
  tryFormatJson: (text: string) => string
  enableSelection?: boolean
}

export const useEditorTextareaHandlers = (o: EditorHandlersOptions) => {
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
    stickyBlockRef,
    countLinesUpTo,
    smoothScrollTextareaToCenter,
    detectIdAroundSelection,
    scheduleIdle,
    tryFormatJson,
    enableSelection,
  } = o

  const onChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCodeText(e.target.value)
  }, [setCodeText])

  const onSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    if (enableSelection === false) return
    const el = e.target as HTMLTextAreaElement
    const pos = el.selectionStart
    const end = el.selectionEnd
    const id = detectIdAroundSelection(codeText, pos, end)
    if (!id) return
    if (codeSelectTimerRef.current) return
    codeSelectTimerRef.current = setTimeout(() => {
      codeSelectTimerRef.current = null
      setSelectionSource('editor')
      if (nodeIdSet.has(id)) selectNode(id)
      else if (edgeIdSet.has(id)) selectEdge(id)
    }, codeSelectThrottleMs)
    publishCaret(pos, end)
  }, [codeText, codeSelectThrottleMs, detectIdAroundSelection, edgeIdSet, nodeIdSet, publishCaret, selectEdge, selectNode, setSelectionSource, enableSelection, codeSelectTimerRef])

  const onDoubleClick = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (enableSelection === false) return
    const el = e.target as HTMLTextAreaElement
    const pos = el.selectionStart
    const end = el.selectionEnd
    const id = detectIdAroundSelection(codeText, pos, end)
    if (!id) return
    setSelectionSource('editor')
    if (nodeIdSet.has(id)) selectNode(id)
    else if (edgeIdSet.has(id)) selectEdge(id)
  }, [codeText, detectIdAroundSelection, edgeIdSet, nodeIdSet, selectEdge, selectNode, setSelectionSource, enableSelection])

  const onKeyUp = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.target as HTMLTextAreaElement
    if (enableSelection !== false) {
      emitTextSelectionEvent(el)
    }
  }, [enableSelection])

  const onClick = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    const el = e.target as HTMLTextAreaElement
    if (stickyBlockRef.current) {
      const block = stickyBlockRef.current
      stickyBlockRef.current = null
      if (block) {
        el.setSelectionRange(block.start, block.start)
        const line = countLinesUpTo(codeText, block.start)
        smoothScrollTextareaToCenter(el, line)
      }
    }
    emitTextSelectionEvent(el)
  }, [codeText, countLinesUpTo, smoothScrollTextareaToCenter, stickyBlockRef])

  const onBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    scheduleIdle(() => {
      try {
        const formatted = tryFormatJson(val)
        setCodeText(formatted)
        setCodeError('')
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : ''
        setCodeError(`${UI_COPY.invalidJsonPrefix}${message}`)
      }
    })
  }, [scheduleIdle, tryFormatJson, setCodeText, setCodeError])

  return { onChange, onSelect, onDoubleClick, onKeyUp, onClick, onBlur }
}
