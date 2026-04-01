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
      const target = computeViewerScrollTopForElement({
        viewerTopPx: viewer.getBoundingClientRect().top,
        viewerScrollTopPx: viewer.scrollTop,
        elementTopPx: (el as HTMLElement).getBoundingClientRect().top,
        scrollPaddingTopPx: readViewerScrollPaddingTopPx(viewer),
      })
      try {
        viewer.scrollTo({ top: target, behavior: 'smooth' })
      } catch {
        viewer.scrollTop = target
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

function readViewerScrollPaddingTopPx(viewer: HTMLElement): number {
  const parsePx = (raw: string): number => {
    const v = Number.parseFloat(String(raw || '').trim())
    if (!Number.isFinite(v)) return 0
    return Math.max(0, v)
  }
  const inline = parsePx(viewer.style.scrollPaddingTop || '')
  if (inline > 0) return inline
  try {
    const css = typeof window !== 'undefined' ? window.getComputedStyle(viewer) : null
    const computed = parsePx(css?.scrollPaddingTop || '')
    if (computed > 0) return computed
  } catch {
    void 0
  }
  return 0
}

export function computeViewerScrollTopForElement(args: {
  viewerTopPx: number
  viewerScrollTopPx: number
  elementTopPx: number
  scrollPaddingTopPx: number
}): number {
  const relativeTop = args.elementTopPx - args.viewerTopPx
  const rawTarget = args.viewerScrollTopPx + relativeTop - Math.max(0, args.scrollPaddingTopPx)
  if (!Number.isFinite(rawTarget)) return 0
  return Math.max(0, Math.round(rawTarget))
}
