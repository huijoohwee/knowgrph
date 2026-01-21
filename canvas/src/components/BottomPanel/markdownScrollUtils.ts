export function scrollToLineInEditor(
  textarea: HTMLTextAreaElement | null,
  line: number,
  editorRowStartByLine: Record<number, number>,
  lineHeightPx: number,
  editorPaddingTopPx: number
) {
  if (!textarea) return
  const row = editorRowStartByLine[line] ?? line
  // Calculate target top position
  const targetTop = Math.max(0, (row - 1) * lineHeightPx + editorPaddingTopPx)
  
  const apply = () => {
    textarea.scrollTop = targetTop
    // We don't focus here to avoid stealing focus if user is just viewing
    // But if it's a jump, maybe we should?
    // The previous code focused. Let's keep it if intended.
    // textarea.focus() 
  }

  // Use requestAnimationFrame for layout stability
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => apply())
    })
  } else {
    apply()
  }
}

export function scrollToLineInViewer(
  viewer: HTMLElement | null,
  line: number
) {
  if (!viewer) return

  const apply = () => {
    // Try exact match first
    let el = viewer.querySelector(`[data-start-line="${line}"]`)
    
    // If no exact match, find the nearest preceding block
    if (!el) {
      const candidates = viewer.querySelectorAll('[data-start-line]')
      let bestDiff = Infinity
      let bestEl: Element | null = null

      // Iterate to find the closest startLine <= target line
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i]
        const startLine = parseInt(candidate.getAttribute('data-start-line') || '-1', 10)
        if (isNaN(startLine)) continue

        if (startLine <= line) {
          const diff = line - startLine
          // We prefer the closest one.
          // Note: If multiple elements have same startLine (unlikely for blocks), pick last?
          // Usually first is fine.
          if (diff < bestDiff) {
            bestDiff = diff
            bestEl = candidate
          }
        }
      }
      el = bestEl
    }

    if (el) {
      const fn = (el as unknown as { scrollIntoView?: unknown }).scrollIntoView
      if (typeof fn === 'function') {
        fn.call(el, { behavior: 'smooth', block: 'start' })
      } else {
        const proto = (typeof HTMLElement !== 'undefined'
          ? (HTMLElement.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView
          : null)
        if (typeof proto === 'function') {
          proto.call(el, { behavior: 'smooth', block: 'start' })
        }
      }
    }
  }

  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => apply())
    })
  } else {
    apply()
  }
}
