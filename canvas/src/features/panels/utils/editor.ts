export function centerIdInCode(
  codeText: string,
  id: string,
  codeRef: React.MutableRefObject<HTMLTextAreaElement | null>,
  findBounds: (text: string, id: string) => { start: number; end: number } | null,
  centerBlock: (el: HTMLTextAreaElement, text: string, start: number, end: number) => void,
  highlightUntilClick: boolean,
  highlightDurationMs: number,
  stickyBlockRef: React.MutableRefObject<{ start: number; end: number } | null>,
  blockHighlightTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
) {
  let attempts = 0
  const tryCenter = () => {
    attempts++
    const b = findBounds(codeText, id)
    if (b && codeRef.current) {
      codeRef.current.focus()
      codeRef.current.setSelectionRange(b.start, b.end)
      centerBlock(codeRef.current, codeText, b.start, b.end)
      if (highlightUntilClick) {
        stickyBlockRef.current = b
      } else {
        if (blockHighlightTimerRef.current) clearTimeout(blockHighlightTimerRef.current)
        blockHighlightTimerRef.current = setTimeout(() => {
          if (codeRef.current) codeRef.current.setSelectionRange(b.start, b.start)
        }, highlightDurationMs)
      }
      return
    }
    if (attempts < 10) setTimeout(tryCenter, 30)
  }
  tryCenter()
}
