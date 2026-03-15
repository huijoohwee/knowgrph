export function applyMediaEagerLoadingOnce(el: HTMLElement): void {
  try {
    const dataset = (el as unknown as { dataset?: Record<string, string> }).dataset
    if (dataset?.kgMediaEagerApplied) return
  } catch {
    void 0
  }

  try {
    const iframe = el.querySelector('iframe')
    if (iframe) {
      try {
        ;(iframe as unknown as { loading?: string }).loading = 'eager'
      } catch {
        void 0
      }
      try {
        iframe.setAttribute('loading', 'eager')
      } catch {
        void 0
      }
    }
  } catch {
    void 0
  }

  try {
    const img = el.querySelector('img')
    if (img) {
      try {
        ;(img as unknown as { loading?: string }).loading = 'eager'
      } catch {
        void 0
      }
      try {
        img.setAttribute('loading', 'eager')
      } catch {
        void 0
      }
    }
  } catch {
    void 0
  }

  try {
    ;(el as unknown as { dataset?: Record<string, string> }).dataset!.kgMediaEagerApplied = '1'
  } catch {
    void 0
  }
}

