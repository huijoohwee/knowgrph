import React from 'react'
import { parseMarkdownInlineCodeSemantic, parseMarkdownSigil } from '@/features/markdown/ui/markdownSigil'
import { hasExpandedSelectionInRoot } from './markdownBlockContainerCore.interaction'

type SelectionOffsets = { startOffset: number; endOffset: number }

const SELECTABLE_HTML_TOKEN_SELECTOR = '[data-kg-inline-code-token="1"],[data-kg-footnote-ref="1"],[data-kg-comment="1"]'
const CANONICAL_HTML_TOKEN_SELECTOR = `${SELECTABLE_HTML_TOKEN_SELECTOR},[data-kg-sigil="1"],code`
const ANNOTATION_WRAPPER_SELECTOR = '[data-kg-sigil="1"],[data-kg-inline-code-token="1"],[data-kg-footnote-ref="1"],[data-kg-comment="1"],code,mark,[data-kg-default-highlight="1"]'

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

  const readSelectableTokenElement = React.useCallback((root: HTMLElement, node: Node | null): HTMLElement | null => {
    const element = node?.nodeType === Node.ELEMENT_NODE ? (node as Element) : node?.parentElement || null
    if (!element) return null
    const token = element.closest(SELECTABLE_HTML_TOKEN_SELECTOR) as HTMLElement | null
    return token && root.contains(token) ? token : null
  }, [])

  const expandSelectionToSemanticToken = React.useCallback((root: HTMLElement, selection: Selection | null): Range | null => {
    const sel = selection
    if (!sel || sel.rangeCount <= 0) return null
    const liveRange = sel.getRangeAt(0)
    const startToken = readSelectableTokenElement(root, liveRange.startContainer)
    const endToken = readSelectableTokenElement(root, liveRange.endContainer)
    if (!startToken && !endToken) return null
    const expanded = liveRange.cloneRange()
    if (startToken) expanded.setStartBefore(startToken)
    if (endToken) expanded.setEndAfter(endToken)
    try {
      sel.removeAllRanges()
      sel.addRange(expanded)
    } catch {
      void 0
    }
    return expanded
  }, [readSelectableTokenElement])

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
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    expandSelectionToSemanticToken(root, sel)
    try {
      document.execCommand(cmd, false)
    } catch {
      void 0
    }
    args.emitLiveDraftTextFromDom?.()
  }, [args.emitLiveDraftTextFromDom, expandSelectionToSemanticToken, focusRootForFormatting, restoreSelectionForFormatting])

  const insertHtmlAroundSelection = React.useCallback((payload: { leftHtml: string; rightHtml: string }) => {
    const root = focusRootForFormatting()
    if (!root) return
    restoreSelectionForFormatting()
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    expandSelectionToSemanticToken(root, sel)
    if (!sel || !hasExpandedSelectionInRoot({ root, selection: sel })) return
    const range = sel.getRangeAt(0)
    const wrap = document.createElement('section')
    wrap.appendChild(range.cloneContents())
    const html = `${payload.leftHtml}${wrap.innerHTML}${payload.rightHtml}`
    try {
      document.execCommand('insertHTML', false, html)
    } catch {
      void 0
    }
    args.emitLiveDraftTextFromDom?.()
  }, [args.emitLiveDraftTextFromDom, expandSelectionToSemanticToken, focusRootForFormatting, restoreSelectionForFormatting])

  const readCommentTextFromHtmlSelection = React.useCallback((): string | null => {
    const root = focusRootForFormatting()
    if (!root) return null
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel) return null
    restoreSelectionForFormatting()
    const range = pickExpandedRangeInRoot(root, sel)
    if (!range) return null
    const container = range.commonAncestorContainer
    const node = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement
    const commentNode = node?.closest?.('[data-kg-comment="1"]') as HTMLElement | null
    if (commentNode && root.contains(commentNode)) {
      const rawText = String(commentNode.getAttribute('data-kg-comment-text') || '').trim()
      if (rawText) return rawText
      const rawComment = String(commentNode.getAttribute('data-kg-comment-raw') || '').trim()
      if (rawComment) return rawComment
    }
    return String(range.cloneContents().textContent || '').trim()
  }, [args, focusRootForFormatting, pickExpandedRangeInRoot, restoreSelectionForFormatting])

  const readMarkdownTokenFromHtmlSelection = React.useCallback((): string | null => {
    const root = focusRootForFormatting()
    if (!root) return null
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel) return null
    restoreSelectionForFormatting()
    const range = pickExpandedRangeInRoot(root, sel)
    if (!range) return null
    const container = range.commonAncestorContainer
    const node = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement
    if (!node) return null
    const commentNode = node.closest('[data-kg-comment="1"]') as HTMLElement | null
    if (commentNode && root.contains(commentNode)) {
      const rawStart = String(commentNode.getAttribute('data-kg-comment-raw-start') || '').trim()
      if (rawStart) return rawStart
      const raw = String(commentNode.getAttribute('data-kg-comment-raw') || '').trim()
      if (raw) return raw
    }
    const semanticNode = node.closest('[data-kg-inline-code-token="1"]') as HTMLElement | null
    if (semanticNode && root.contains(semanticNode)) {
      const raw = String(semanticNode.getAttribute('data-kg-inline-code-raw') || '').trim()
      if (raw) return `\`${raw}\``
    }
    const footnoteNode = node.closest('[data-kg-footnote-ref="1"]') as HTMLElement | null
    if (footnoteNode && root.contains(footnoteNode)) {
      const label = String(footnoteNode.getAttribute('data-kg-footnote-label') || footnoteNode.textContent || '').trim()
      if (label) return `[^${label.replace(/^\[\^?/, '').replace(/\]$/, '')}]`
    }
    return String(range.cloneContents().textContent || '').trim() || null
  }, [expandSelectionToSemanticToken, focusRootForFormatting, pickExpandedRangeInRoot, restoreSelectionForFormatting])

  const applyDefaultHighlightToHtmlSelection = React.useCallback(() => {
    const root = focusRootForFormatting()
    if (!root) return
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel) return
    restoreSelectionForFormatting()
    expandSelectionToSemanticToken(root, sel)
    const range = pickExpandedRangeInRoot(root, sel)
    if (!range) return
    const readFormattingTokenElement = (targetNode: Node | null): HTMLElement | null => {
      const element = targetNode?.nodeType === Node.ELEMENT_NODE ? (targetNode as Element) : targetNode?.parentElement || null
      if (!element) return null
      const token = element.closest(SELECTABLE_HTML_TOKEN_SELECTOR) as HTMLElement | null
      return token && root.contains(token) ? token : null
    }
    const readBoundaryFormattingTokenElement = (boundaryContainer: Node, boundaryOffset: number, preferPrevious: boolean): HTMLElement | null => {
      if (boundaryContainer.nodeType !== Node.ELEMENT_NODE) return readFormattingTokenElement(boundaryContainer)
      const element = boundaryContainer as Element
      const childIndex = preferPrevious ? boundaryOffset - 1 : boundaryOffset
      const childNode = childIndex >= 0 && childIndex < element.childNodes.length ? element.childNodes[childIndex] : null
      return readFormattingTokenElement(childNode) || readFormattingTokenElement(boundaryContainer)
    }
    const semanticTokenNode =
      readBoundaryFormattingTokenElement(range.startContainer, range.startOffset, false)
      || readBoundaryFormattingTokenElement(range.endContainer, range.endOffset, true)
    const readCanonicalHighlightFragment = (): DocumentFragment => {
      const fragment = document.createDocumentFragment()
      if (!semanticTokenNode || !root.contains(semanticTokenNode)) {
        fragment.appendChild(range.extractContents())
        return fragment
      }
      if (semanticTokenNode.hasAttribute('data-kg-comment')) {
        const rawStart = String(semanticTokenNode.getAttribute('data-kg-comment-raw-start') || '').trim()
        const rawEnd = String(semanticTokenNode.getAttribute('data-kg-comment-raw-end') || '').trim()
        if (rawStart && rawEnd) {
          fragment.appendChild(document.createTextNode(`${rawStart}${String(semanticTokenNode.textContent || '')}${rawEnd}`))
          range.deleteContents()
          return fragment
        }
        const rawComment = String(semanticTokenNode.getAttribute('data-kg-comment-raw') || '').trim()
        if (rawComment) {
          fragment.appendChild(document.createTextNode(rawComment))
          range.deleteContents()
          return fragment
        }
      }
      if (semanticTokenNode.hasAttribute('data-kg-footnote-ref')) {
        const label = String(semanticTokenNode.getAttribute('data-kg-footnote-label') || semanticTokenNode.textContent || '').trim()
        if (label) {
          fragment.appendChild(document.createTextNode(`[^${label.replace(/^\[\^?/, '').replace(/\]$/, '')}]`))
          range.deleteContents()
          return fragment
        }
      }
      if (semanticTokenNode.hasAttribute('data-kg-inline-code-token')) {
        const raw = String(semanticTokenNode.getAttribute('data-kg-inline-code-raw') || '').trim()
        if (raw) {
          const code = document.createElement('code')
          code.textContent = raw
          fragment.appendChild(code)
          range.deleteContents()
          return fragment
        }
      }
      fragment.appendChild(range.extractContents())
      return fragment
    }
    const frag = readCanonicalHighlightFragment()
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
  }, [args, expandSelectionToSemanticToken, focusRootForFormatting, pickExpandedRangeInRoot, restoreSelectionForFormatting])

  const applyUnderlineToHtmlSelection = React.useCallback(() => {
    execInline('underline')
  }, [execInline])

  const clearHtmlFormattingSelection = React.useCallback(() => {
    const root = focusRootForFormatting()
    if (!root) return
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel) return
    restoreSelectionForFormatting()
    expandSelectionToSemanticToken(root, sel)
    const range = pickExpandedRangeInRoot(root, sel)
    if (!range) return
    const container = range.commonAncestorContainer
    const node = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement
    if (!node || !root.contains(node)) return
    const readFormattingTokenElement = (targetNode: Node | null): HTMLElement | null => {
      const element = targetNode?.nodeType === Node.ELEMENT_NODE ? (targetNode as Element) : targetNode?.parentElement || null
      if (!element) return null
      const token = element.closest(CANONICAL_HTML_TOKEN_SELECTOR) as HTMLElement | null
      return token && root.contains(token) ? token : null
    }
    const readBoundaryFormattingTokenElement = (boundaryContainer: Node, boundaryOffset: number, preferPrevious: boolean): HTMLElement | null => {
      if (boundaryContainer.nodeType !== Node.ELEMENT_NODE) return readFormattingTokenElement(boundaryContainer)
      const element = boundaryContainer as Element
      const childIndex = preferPrevious ? boundaryOffset - 1 : boundaryOffset
      const childNode = childIndex >= 0 && childIndex < element.childNodes.length ? element.childNodes[childIndex] : null
      return readFormattingTokenElement(childNode) || readFormattingTokenElement(boundaryContainer)
    }
    const readFormattingWrapperElement = (targetNode: Node | null): HTMLElement | null => {
      const element = targetNode?.nodeType === Node.ELEMENT_NODE ? (targetNode as Element) : targetNode?.parentElement || null
      if (!element) return null
      const wrapper = element.closest('[data-kg-sigil="1"],[data-kg-default-highlight="1"],mark,a,u,strong,b,em,i,s,del,sub,sup') as HTMLElement | null
      return wrapper && root.contains(wrapper) ? wrapper : null
    }
    const semanticTokenNode =
      readBoundaryFormattingTokenElement(range.startContainer, range.startOffset, false)
      || readBoundaryFormattingTokenElement(range.endContainer, range.endOffset, true)
      || readFormattingTokenElement(node)
    const readCanonicalReplacementNode = (): Node | null => {
      const selectedText = String(range.cloneContents().textContent || '').trim()
      if ((!semanticTokenNode || !root.contains(semanticTokenNode)) && /^\[\^[^\]\n]+\]$/.test(selectedText)) {
        return document.createTextNode(selectedText)
      }
      if (!semanticTokenNode || !root.contains(semanticTokenNode)) return null
      if (semanticTokenNode.hasAttribute('data-kg-comment')) {
        const rawStart = String(semanticTokenNode.getAttribute('data-kg-comment-raw-start') || '').trim()
        const rawEnd = String(semanticTokenNode.getAttribute('data-kg-comment-raw-end') || '').trim()
        if (rawStart && rawEnd) {
          return document.createTextNode(`${rawStart}${String(semanticTokenNode.textContent || '')}${rawEnd}`)
        }
        const rawComment = String(semanticTokenNode.getAttribute('data-kg-comment-raw') || '').trim()
        if (rawComment) return document.createTextNode(rawComment)
        return null
      }
      if (semanticTokenNode.hasAttribute('data-kg-footnote-ref')) {
        const label = String(semanticTokenNode.getAttribute('data-kg-footnote-label') || semanticTokenNode.textContent || '').trim()
        if (!label) return null
        return document.createTextNode(`[^${label.replace(/^\[\^?/, '').replace(/\]$/, '')}]`)
      }
      if (semanticTokenNode.hasAttribute('data-kg-inline-code-token')) {
        const raw = String(semanticTokenNode.getAttribute('data-kg-inline-code-raw') || '').trim()
        if (raw) {
          const code = document.createElement('code')
          code.textContent = raw
          return code
        }
      }
      const rawText = String(semanticTokenNode.textContent || '').trim()
      if (!rawText) return null
      const parsedSemantic = parseMarkdownInlineCodeSemantic(rawText)
      if (parsedSemantic && parsedSemantic.kind !== 'annotation') {
        const code = document.createElement('code')
        code.textContent = parsedSemantic.code
        return code
      }
      return null
    }
    const replacement = readCanonicalReplacementNode()
    if (replacement) {
      const isFormattingWrapper = (element: HTMLElement): boolean => {
        const tag = String(element.tagName || '').toLowerCase()
        if (element.hasAttribute('data-kg-sigil')) return true
        if (element.hasAttribute('data-kg-default-highlight')) return true
        if (tag === 'mark' || tag === 'a' || tag === 'u' || tag === 'strong' || tag === 'b' || tag === 'em' || tag === 'i' || tag === 's' || tag === 'del' || tag === 'sub' || tag === 'sup') {
          return true
        }
        return false
      }
      let outermost = semanticTokenNode || readFormattingWrapperElement(range.startContainer) || readFormattingWrapperElement(range.endContainer)
      if (!outermost) return
      let current = semanticTokenNode?.parentElement || null
      if (!current && outermost) current = outermost.parentElement
      while (current && current !== root && root.contains(current) && isFormattingWrapper(current)) {
        outermost = current
        current = current.parentElement
      }
      outermost.replaceWith(replacement)
      if (replacement.nodeType === Node.ELEMENT_NODE) {
        try {
          const nextRange = document.createRange()
          nextRange.selectNodeContents(replacement)
          sel.removeAllRanges()
          sel.addRange(nextRange)
        } catch {
          void 0
        }
      }
      args.emitLiveDraftTextFromDom?.()
      return
    }
    try {
      document.execCommand('removeFormat', false)
    } catch {
      void 0
    }
    try {
      document.execCommand('unlink', false)
    } catch {
      void 0
    }
    args.emitLiveDraftTextFromDom?.()
  }, [args.emitLiveDraftTextFromDom, expandSelectionToSemanticToken, focusRootForFormatting, pickExpandedRangeInRoot, restoreSelectionForFormatting])

  const applySigilToHtmlSelection = React.useCallback((payload: { color?: string; background?: string }) => {
    const root = focusRootForFormatting()
    if (!root) return
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel) return
    restoreSelectionForFormatting()
    expandSelectionToSemanticToken(root, sel)
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
      const codeNodes = Array.from(wrapper.querySelectorAll('code,[data-kg-inline-code-token="1"]')) as HTMLElement[]
      codeNodes.reverse().forEach(codeNode => {
        if (codeNode.hasAttribute('data-kg-inline-code-token')) {
          const raw = String(codeNode.getAttribute('data-kg-inline-code-raw') || '').trim()
          if (!raw) return
          codeNode.replaceWith(document.createTextNode(raw))
          return
        }
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
        const annotation = element.closest(ANNOTATION_WRAPPER_SELECTOR) as HTMLElement | null
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
    const codeNode = node.closest('code,[data-kg-inline-code-token="1"],[data-kg-footnote-ref="1"],[data-kg-comment="1"]') as HTMLElement | null
    const withinSingleCode = !!codeNode && codeNode.contains(range.startContainer) && codeNode.contains(range.endContainer)
    if (withinSingleCode) {
      if (codeNode.hasAttribute('data-kg-comment')) {
        return
      }
      if (codeNode.hasAttribute('data-kg-footnote-ref')) {
        return
      }
      if (codeNode.hasAttribute('data-kg-inline-code-token')) {
        const raw = String(codeNode.getAttribute('data-kg-inline-code-raw') || '').trim()
        if (!raw) return
        const span = document.createElement('span')
        span.setAttribute('data-kg-sigil', '1')
        if (payload.color) span.setAttribute('data-kg-sigil-color', payload.color)
        if (payload.background) span.setAttribute('data-kg-sigil-bg', payload.background)
        span.textContent = raw
        applySpanStyle(span)
        codeNode.replaceWith(span)
        args.emitLiveDraftTextFromDom?.()
        return
      }
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
  }, [args, expandSelectionToSemanticToken, focusRootForFormatting, pickExpandedRangeInRoot, restoreSelectionForFormatting])

  const restoreCachedHtmlSelection = React.useCallback(() => {
    restoreSelectionForFormatting()
  }, [restoreSelectionForFormatting])

  return {
    readSelectionOffsetsForFormatting,
    execInline,
    insertHtmlAroundSelection,
    readCommentTextFromHtmlSelection,
    readMarkdownTokenFromHtmlSelection,
    applyDefaultHighlightToHtmlSelection,
    applyUnderlineToHtmlSelection,
    clearHtmlFormattingSelection,
    applySigilToHtmlSelection,
    restoreCachedHtmlSelection,
  }
}
