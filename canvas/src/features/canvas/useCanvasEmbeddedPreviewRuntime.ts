import React from 'react'

export function useCanvasEmbeddedPreviewRuntime(search: string): {
  isEmbeddedPreview: boolean
  setIsEmbeddedPreview: React.Dispatch<React.SetStateAction<boolean>>
  detectEmbeddedPreviewWriteback: () => boolean
} {
  const detectEmbeddedPreview = React.useCallback(() => {
    try {
      const q = new URLSearchParams(String(search || '')).get('kgPreview') === '1'
      if (q) return true
      const w = window as unknown as { frameElement?: Element | null; parent?: Window | null }
      const parent = w?.parent
      if (!parent || parent === window) return false
      const frameEl = w?.frameElement
      if (!frameEl) return false
      return String(frameEl.getAttribute('data-kg-preview') || '') === '1'
    } catch {
      return false
    }
  }, [search])

  const detectEmbeddedPreviewWriteback = React.useCallback(() => {
    try {
      const w = window as unknown as { frameElement?: Element | null }
      const frameEl = w?.frameElement
      if (!frameEl) return false
      return String(frameEl.getAttribute('data-kg-preview-writeback') || '') === '1'
    } catch {
      return false
    }
  }, [])

  const [isEmbeddedPreview, setIsEmbeddedPreview] = React.useState<boolean>(() => detectEmbeddedPreview())

  React.useEffect(() => {
    setIsEmbeddedPreview(prev => prev || detectEmbeddedPreview())
  }, [detectEmbeddedPreview])

  return {
    isEmbeddedPreview,
    setIsEmbeddedPreview,
    detectEmbeddedPreviewWriteback,
  }
}
