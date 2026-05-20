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
  emitLiveDraftTextFromDom?: () => void
}) => {
  const DEFAULT_HIGHLIGHT_EDITOR_BG = '#FEF08A'

  const focusRootForFormatting = React.useCallback(() => {
    const root = args.editorRef.current
    if (!root) return null
    try {
      root.focus({ preventScroll: true })
    } catch {
      root.focus()
    }
    return root
  }, [args.editorRef])

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

  const pickExpandedRangeInRoot = React.useCallback((root: HTMLElement, selection: Selection | null): Range | null => {
    const sel = selection
    if (!sel) return null
    if (hasExpandedSelectionInRoot({ root, selection: sel })) return sel.getRangeAt(0)
    const last = args.lastNonCollapsedDomRangeRef.current
    if (last && !last.collapsed) {
      const common = last.commonAncestorContainer
      const node = common.nodeType === Node.ELEMENT_NODE ? (common as Element) : common.parentElement
      if (node && root.contains(node)) {
        try {
          sel.removeAllRanges()
          sel.addRange(last)
          if (sel.rangeCount > 0) {
            const restoredRange = sel.getRangeAt(0)
            if (!restoredRange.collapsed) return restoredRange
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
    const root = focusRootForFormatting()
    if (!root) return
    restoreSelectionForFormatting()
    try {
      document.execCommand(cmd, false)
    } catch {
      void 0
    }
    args.emitLiveDraftTextFromDom?.()
  }, [args.emitLiveDraftTextFromDom, focusRootForFormatting, restoreSelectionForFormatting])

  const insertHtmlAroundSelection = React.useCallback((payload: { leftHtml: string; rightHtml: string }) => {
    const root = focusRootForFormatting()
    if (!root) return
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
    args.emitLiveDraftTextFromDom?.()
  }, [args.emitLiveDraftTextFromDom, focusRootForFormatting, restoreSelectionForFormatting])

  const applyCommentToHtmlSelection = React.useCallback((): string | null => {
    const root = focusRootForFormatting()
    if (!root) return null
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel) return null
    restoreSelectionForFormatting()
    const range = pickExpandedRangeInRoot(root, sel)
    if (!range) return null
    const frag = range.extractContents()
    const selectedText = String(frag.textContent || '').trim()
    const span = document.createElement('span')
    span.setAttribute('data-kg-comment', '1')
    span.style.opacity = '0.65'
    span.style.fontStyle = 'italic'
    span.appendChild(frag)
    range.insertNode(span)
    try {
      range.setStart(span, 0)
      range.setEnd(span, span.childNodes.length)
      sel.removeAllRanges()
      sel.addRange(range)
    } catch {
      void 0
    }
    return selectedText
  }, [args, focusRootForFormatting, pickExpandedRangeInRoot, restoreSelectionForFormatting])

  const applyDefaultHighlightToHtmlSelection = React.useCallback(() => {
    const root = focusRootForFormatting()
    if (!root) return
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel) return
    restoreSelectionForFormatting()
    const range = pickExpandedRangeInRoot(root, sel)
    if (!range) return
    const frag = range.extractContents()
    const mark = document.createElement('mark')
    mark.setAttribute('data-kg-default-highlight', '1')
    mark.style.backgroundColor = DEFAULT_HIGHLIGHT_EDITOR_BG
    mark.appendChild(frag)
    range.insertNode(mark)
    try {
      range.setStart(mark, 0)
      range.setEnd(mark, mark.childNodes.length)
      sel.removeAllRanges()
      sel.addRange(range)
    } catch {
      void 0
    }
    args.emitLiveDraftTextFromDom?.()
  }, [args, focusRootForFormatting, pickExpandedRangeInRoot, restoreSelectionForFormatting])

  const applyUnderlineToHtmlSelection = React.useCallback(() => {
    execInline('underline')
  }, [execInline])

  const applySigilToHtmlSelection = React.useCallback((payload: { color?: string; background?: string }) => {
    const root = focusRootForFormatting()
    if (!root) return
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel) return
    restoreSelectionForFormatting()
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
    let range = pickExpandedRangeInRoot(root, sel)
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
    const normalizeExtractedSigilFragment = (fragment: DocumentFragment): {
      fragment: DocumentFragment
      color: string | null
      background: string | null
    } => {
      const wrapper = document.createElement('span')
      wrapper.appendChild(fragment)
      let nextColor = payload.color || null
      let nextBg = payload.background || null
      const mergeSigilState = (color: string | null | undefined, background: string | null | undefined) => {
        if (!nextColor && color) nextColor = color
        if (!nextBg && background) nextBg = background
      }
      const codeNodes = Array.from(wrapper.querySelectorAll('code')) as HTMLElement[]
      codeNodes.reverse().forEach(codeNode => {
        const parsed = parseMarkdownSigil(String(codeNode.textContent || ''))
        if (!parsed) return
        mergeSigilState(parsed.color, parsed.background)
        codeNode.replaceWith(document.createTextNode(parsed.text))
      })
      const highlightNodes = Array.from(wrapper.querySelectorAll('mark,[data-kg-default-highlight="1"]')) as HTMLElement[]
      highlightNodes.reverse().forEach(highlightNode => {
        mergeSigilState(null, DEFAULT_HIGHLIGHT_EDITOR_BG)
        highlightNode.replaceWith(...Array.from(highlightNode.childNodes))
      })
      const sigilNodes = Array.from(wrapper.querySelectorAll('[data-kg-sigil="1"]')) as HTMLElement[]
      sigilNodes.reverse().forEach(sigilNode => {
        mergeSigilState(
          sigilNode.getAttribute('data-kg-sigil-color'),
          sigilNode.getAttribute('data-kg-sigil-bg'),
        )
        sigilNode.replaceWith(...Array.from(sigilNode.childNodes))
      })
      const normalized = document.createDocumentFragment()
      while (wrapper.firstChild) normalized.appendChild(wrapper.firstChild)
      return {
        fragment: normalized,
        color: nextColor,
        background: nextBg,
      }
    }
    const expandRangeToAnnotationBoundaries = (inputRange: Range): Range => {
      const expanded = inputRange.cloneRange()
      const readAnnotationElement = (containerNode: Node): HTMLElement | null => {
        const element = containerNode.nodeType === Node.ELEMENT_NODE ? (containerNode as Element) : containerNode.parentElement
        if (!element) return null
        const annotation = element.closest('[data-kg-sigil="1"],code,mark,[data-kg-default-highlight="1"]') as HTMLElement | null
        return annotation && root.contains(annotation) ? annotation : null
      }
      const startAnnotation = readAnnotationElement(expanded.startContainer)
      const endAnnotation = readAnnotationElement(expanded.endContainer)
      if (startAnnotation) expanded.setStartBefore(startAnnotation)
      if (endAnnotation) expanded.setEndAfter(endAnnotation)
      return expanded
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
      args.emitLiveDraftTextFromDom?.()
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
      args.emitLiveDraftTextFromDom?.()
      return
    }
    const workingRange = expandRangeToAnnotationBoundaries(range)
    const extracted = workingRange.extractContents()
    const normalized = normalizeExtractedSigilFragment(extracted)
    const span = document.createElement('span')
    span.setAttribute('data-kg-sigil', '1')
    if (normalized.color) span.setAttribute('data-kg-sigil-color', normalized.color)
    if (normalized.background) span.setAttribute('data-kg-sigil-bg', normalized.background)
    span.appendChild(normalized.fragment)
    applySpanStyle(span)
    workingRange.insertNode(span)
    try {
      workingRange.setStart(span, 0)
      workingRange.setEnd(span, span.childNodes.length)
      sel.removeAllRanges()
      sel.addRange(workingRange)
    } catch {
      void 0
    }
    args.emitLiveDraftTextFromDom?.()
  }, [args, focusRootForFormatting, pickExpandedRangeInRoot, restoreSelectionForFormatting])

  const restoreCachedHtmlSelection = React.useCallback(() => {
    restoreSelectionForFormatting()
  }, [restoreSelectionForFormatting])

  return {
    readSelectionOffsetsForFormatting,
    execInline,
    insertHtmlAroundSelection,
    applyCommentToHtmlSelection,
    applyDefaultHighlightToHtmlSelection,
    applyUnderlineToHtmlSelection,
    applySigilToHtmlSelection,
    restoreCachedHtmlSelection,
  }
}
