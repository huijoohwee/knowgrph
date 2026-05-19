import React from 'react'
import { parseMarkdownSigil } from '@/features/markdown/ui/markdownSigil'
import { hasExpandedSelectionInRoot } from './markdownBlockContainerCore.interaction'

type SelectionOffsets = { startOffset: number; endOffset: number }

export const useMarkdownBlockContainerHtmlFormatting = (args: {
  editorRef: React.RefObject<HTMLElement | null>
  getSelectionOffsets: () => SelectionOffsets | null
  setSelectionByOffsets: (selection: SelectionOffsets) => void
  lastNonCollapsedSelectionOffsetsRef: React.MutableRefObject<SelectionOffsets | null>
  lastNonCollapsedDomRangeRef: React.MutableRefObject<Range | null>
}) => {
  const restoreSelectionForFormatting = React.useCallback((): boolean => {
    const root = args.editorRef.current
    if (!root) return false
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel) return false
    if (hasExpandedSelectionInRoot({ root, selection: sel })) {
      const selection = args.getSelectionOffsets()
      if (selection && selection.startOffset !== selection.endOffset) {
        args.lastNonCollapsedSelectionOffsetsRef.current = selection
      }
      try {
        args.lastNonCollapsedDomRangeRef.current = sel.getRangeAt(0).cloneRange()
      } catch {
        void 0
      }
      return true
    }
    const last = args.lastNonCollapsedDomRangeRef.current
    if (last && !last.collapsed) {
      const c = last.commonAncestorContainer
      const n = c.nodeType === Node.ELEMENT_NODE ? (c as Element) : c.parentElement
      if (n && root.contains(n)) {
        try {
          sel.removeAllRanges()
          sel.addRange(last)
          return hasExpandedSelectionInRoot({ root, selection: sel })
        } catch {
          void 0
        }
      }
    }
    const offsets = args.lastNonCollapsedSelectionOffsetsRef.current
    if (offsets && offsets.startOffset !== offsets.endOffset) {
      args.setSelectionByOffsets(offsets)
      return hasExpandedSelectionInRoot({ root, selection: sel })
    }
    return false
  }, [args])

  const readSelectionOffsetsForFormatting = React.useCallback((): SelectionOffsets | null => {
    const selection = args.getSelectionOffsets()
    if (selection && selection.startOffset !== selection.endOffset) {
      args.lastNonCollapsedSelectionOffsetsRef.current = selection
      return selection
    }
    return args.lastNonCollapsedSelectionOffsetsRef.current
  }, [args])

  const execInline = React.useCallback((cmd: 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'removeFormat') => {
    const root = args.editorRef.current
    if (!root) return
    try {
      root.focus({ preventScroll: true })
    } catch {
      root.focus()
    }
    restoreSelectionForFormatting()
    try {
      document.execCommand(cmd, false)
    } catch {
      void 0
    }
  }, [args.editorRef, restoreSelectionForFormatting])

  const insertHtmlAroundSelection = React.useCallback((payload: { leftHtml: string; rightHtml: string }) => {
    const root = args.editorRef.current
    if (!root) return
    try {
      root.focus({ preventScroll: true })
    } catch {
      root.focus()
    }
    restoreSelectionForFormatting()
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel || !hasExpandedSelectionInRoot({ root, selection: sel })) return
    const range = sel.getRangeAt(0)
    const wrap = document.createElement('div')
    wrap.appendChild(range.cloneContents())
    const html = `${payload.leftHtml}${wrap.innerHTML}${payload.rightHtml}`
    try {
      document.execCommand('insertHTML', false, html)
    } catch {
      void 0
    }
  }, [args.editorRef, restoreSelectionForFormatting])

  const applySigilToHtmlSelection = React.useCallback((payload: { color?: string; background?: string }) => {
    const root = args.editorRef.current
    if (!root) return
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel) return
    restoreSelectionForFormatting()
    const pickRange = (): Range | null => {
      if (hasExpandedSelectionInRoot({ root, selection: sel })) return sel.getRangeAt(0)
      const last = args.lastNonCollapsedDomRangeRef.current
      if (last && !last.collapsed) {
        const c = last.commonAncestorContainer
        const n = c.nodeType === Node.ELEMENT_NODE ? (c as Element) : c.parentElement
        if (n && root.contains(n)) {
          try {
            sel.removeAllRanges()
            sel.addRange(last)
            if (sel.rangeCount > 0) {
              const rr = sel.getRangeAt(0)
              if (!rr.collapsed) return rr
            }
          } catch {
            void 0
          }
        }
      }
      const offsets = args.getSelectionOffsets() || args.lastNonCollapsedSelectionOffsetsRef.current
      if (offsets && offsets.startOffset !== offsets.endOffset) args.setSelectionByOffsets(offsets)
      if (hasExpandedSelectionInRoot({ root, selection: sel })) return sel.getRangeAt(0)
      return null
    }
    const findFirstWordRange = (): Range | null => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode() as Text | null
      while (node) {
        const raw = String(node.nodeValue || '')
        const m = raw.match(/[\p{L}\p{N}\p{M}_-]+/u)
        if (m && typeof m.index === 'number') {
          const fallback = document.createRange()
          fallback.setStart(node, m.index)
          fallback.setEnd(node, m.index + m[0].length)
          try {
            sel.removeAllRanges()
            sel.addRange(fallback)
          } catch {
            void 0
          }
          return fallback
        }
        node = walker.nextNode() as Text | null
      }
      return null
    }
    let range = pickRange()
    if (!range) range = findFirstWordRange()
    if (!range) return
    const container = range.commonAncestorContainer
    const node = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement
    if (!node || !root.contains(node)) return
    const applySpanStyle = (el: HTMLElement) => {
      const c = el.getAttribute('data-kg-sigil-color')
      const bg = el.getAttribute('data-kg-sigil-bg')
      if (c) el.style.color = c
      if (bg) el.style.backgroundColor = bg
    }
    const existingSpan = node.closest('[data-kg-sigil="1"]') as HTMLElement | null
    const withinSingleSigilSpan = !!existingSpan && existingSpan.contains(range.startContainer) && existingSpan.contains(range.endContainer)
    if (withinSingleSigilSpan) {
      const nextColor = payload.color || existingSpan.getAttribute('data-kg-sigil-color')
      const nextBg = payload.background || existingSpan.getAttribute('data-kg-sigil-bg')
      if (nextColor) existingSpan.setAttribute('data-kg-sigil-color', nextColor)
      else existingSpan.removeAttribute('data-kg-sigil-color')
      if (nextBg) existingSpan.setAttribute('data-kg-sigil-bg', nextBg)
      else existingSpan.removeAttribute('data-kg-sigil-bg')
      applySpanStyle(existingSpan)
      queueMicrotask(() => args.editorRef.current?.focus())
      return
    }
    const codeNode = node.closest('code') as HTMLElement | null
    const withinSingleCode = !!codeNode && codeNode.contains(range.startContainer) && codeNode.contains(range.endContainer)
    if (withinSingleCode) {
      const parsed = parseMarkdownSigil(String(codeNode?.textContent || ''))
      if (!parsed) return
      const nextColor = payload.color ?? parsed.color
      const nextBg = payload.background ?? parsed.background
      const span = document.createElement('span')
      span.setAttribute('data-kg-sigil', '1')
      if (nextColor) span.setAttribute('data-kg-sigil-color', nextColor)
      if (nextBg) span.setAttribute('data-kg-sigil-bg', nextBg)
      span.textContent = parsed.text
      applySpanStyle(span)
      codeNode.replaceWith(span)
      queueMicrotask(() => args.editorRef.current?.focus())
      return
    }
    const frag = range.extractContents()
    const span = document.createElement('span')
    span.setAttribute('data-kg-sigil', '1')
    if (payload.color) span.setAttribute('data-kg-sigil-color', payload.color)
    if (payload.background) span.setAttribute('data-kg-sigil-bg', payload.background)
    span.appendChild(frag)
    applySpanStyle(span)
    range.insertNode(span)
    try {
      range.setStart(span, 0)
      range.setEnd(span, span.childNodes.length)
      sel.removeAllRanges()
      sel.addRange(range)
    } catch {
      void 0
    }
    queueMicrotask(() => args.editorRef.current?.focus())
  }, [args, restoreSelectionForFormatting])

  const restoreCachedHtmlSelection = React.useCallback(() => {
    restoreSelectionForFormatting()
  }, [restoreSelectionForFormatting])

  return {
    readSelectionOffsetsForFormatting,
    execInline,
    insertHtmlAroundSelection,
    applySigilToHtmlSelection,
    restoreCachedHtmlSelection,
  }
}
