export async function printElementToPdf(el: HTMLElement, args?: { title?: string }): Promise<void> {
  try {
    if (typeof window === 'undefined') return
    if (!el) return
    const title = String(args?.title || 'Document')
    const prevTitle = document.title
    const printRootId = 'kg-print-root'
    const styleId = 'kg-print-style'

    const existingRoot = document.getElementById(printRootId)
    if (existingRoot) {
      try {
        existingRoot.remove()
      } catch {
        void 0
      }
    }
    const existingStyle = document.getElementById(styleId)
    if (existingStyle) {
      try {
        existingStyle.remove()
      } catch {
        void 0
      }
    }

    const root = document.createElement('div')
    root.id = printRootId
    root.style.position = 'fixed'
    root.style.inset = '0'
    root.style.zIndex = '2147483647'
    root.style.background = 'white'
    root.style.overflow = 'auto'
    root.style.padding = '14mm'

    const clone = el.cloneNode(true) as HTMLElement
    root.appendChild(clone)
    document.body.appendChild(root)

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body > *:not(#${printRootId}) { display: none !important; }
        #${printRootId} { position: static !important; inset: auto !important; overflow: visible !important; padding: 0 !important; }
        @page { margin: 14mm; }
      }
    `
    document.head.appendChild(style)

    const cleanup = () => {
      try {
        document.title = prevTitle
      } catch {
        void 0
      }
      try {
        style.remove()
      } catch {
        void 0
      }
      try {
        root.remove()
      } catch {
        void 0
      }
      try {
        window.removeEventListener('afterprint', cleanup)
      } catch {
        void 0
      }
    }

    try {
      document.title = title
    } catch {
      void 0
    }

    try {
      window.addEventListener('afterprint', cleanup)
    } catch {
      void 0
    }

    try {
      window.focus()
    } catch {
      void 0
    }
    try {
      window.print()
    } catch {
      cleanup()
    }

    setTimeout(() => {
      cleanup()
    }, 30_000)
  } catch {
    void 0
  }
}
