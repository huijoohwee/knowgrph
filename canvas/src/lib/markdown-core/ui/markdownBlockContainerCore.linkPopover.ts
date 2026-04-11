import React from 'react'

export const useMarkdownBlockContainerLinkPopover = (args: {
  editorPresentation: 'markdown' | 'html'
  linkPopover: { show: boolean; leftPx: number; topPx: number; href: string }
  setLinkPopover: React.Dispatch<React.SetStateAction<{ show: boolean; leftPx: number; topPx: number; href: string }>>
  editorRef: React.MutableRefObject<HTMLElement | null>
  linkRangeRef: React.MutableRefObject<Range | null>
  getSelectionOffsets: () => { startOffset: number; endOffset: number } | null
  getDraft: () => string
  setDraftToDom: (nextText: string, selection?: { startOffset: number; endOffset: number }) => void
}) => {
  const handleLinkCancel = React.useCallback(() => {
    args.setLinkPopover({ show: false, leftPx: 0, topPx: 0, href: '' })
    queueMicrotask(() => args.editorRef.current?.focus())
  }, [args.editorRef, args.setLinkPopover])

  const handleLinkHrefChange = React.useCallback((href: string) => {
    args.setLinkPopover(prev => ({ ...prev, href }))
  }, [args.setLinkPopover])

  const handleLinkInputKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    handleLinkCancel()
  }, [handleLinkCancel])

  const handleLinkSubmit = React.useCallback((event: React.FormEvent) => {
    event.preventDefault()
    const href = args.linkPopover.href.trim()
    if (!href) {
      handleLinkCancel()
      return
    }
    if (args.editorPresentation === 'html') {
      const root = args.editorRef.current
      const sel = typeof window !== 'undefined' ? window.getSelection() : null
      const r = args.linkRangeRef.current
      if (root && sel && r) {
        try {
          sel.removeAllRanges()
          sel.addRange(r)
        } catch {
          void 0
        }
        root.focus()
        try {
          document.execCommand('createLink', false, href)
        } catch {
          void 0
        }
      }
      handleLinkCancel()
      return
    }
    const sel = args.getSelectionOffsets()
    const startOffset = sel?.startOffset ?? 0
    const endOffset = sel?.endOffset ?? 0
    if (startOffset === endOffset) {
      handleLinkCancel()
      return
    }
    const text = args.getDraft()
    const a = Math.max(0, Math.min(text.length, startOffset))
    const b = Math.max(0, Math.min(text.length, endOffset))
    const start = Math.min(a, b)
    const end = Math.max(a, b)
    const label = text.slice(start, end)
    const nextText = `${text.slice(0, start)}[${label}](${href})${text.slice(end)}`
    const cursor = start + label.length + 3 + href.length
    args.setDraftToDom(nextText, { startOffset: cursor, endOffset: cursor })
    handleLinkCancel()
  }, [args, handleLinkCancel])

  return {
    handleLinkCancel,
    handleLinkHrefChange,
    handleLinkInputKeyDown,
    handleLinkSubmit,
  }
}
