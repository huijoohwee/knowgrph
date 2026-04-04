import React from 'react'
import { applyMarkdownFormatAction, type MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import {
  AlignLeft,
  Bold,
  Code,
  Eraser,
  Heading2,
  Highlighter,
  Italic,
  Link as LinkIcon,
  MessageSquare,
  MoreHorizontal,
  List,
  ListOrdered,
  Quote,
  Superscript,
  Subscript,
  Strikethrough,
  Underline,
  Palette,
} from 'lucide-react'
import { AnchorOverlay } from '@/lib/ui/overlay'
import { getMarkdownItFastHtml } from '@/features/markdown/markdownIt'
import { convertHtmlToMarkdownUnified } from '@/lib/markdown/htmlToMarkdownUnified'
import {
  FLOATING_MENU_BUTTON_CLASSNAME,
  FLOATING_MENU_BUTTON_DANGER_CLASSNAME,
  FLOATING_MENU_BUTTON_DISABLED_CLASSNAME,
  FLOATING_MENU_DIVIDER_CLASSNAME,
  FLOATING_BUBBLE_TOOLBAR_CLASSNAME,
  FLOATING_BUBBLE_BUTTON_CLASSNAME,
  FLOATING_POPOVER_PANEL_CLASSNAME,
  FLOATING_POPOVER_INPUT_CLASSNAME,
  FLOATING_MENU_LEFT_W220_CLASSNAME,
} from '@/components/BottomPanel/markdownWorkspace/main/viewer/floatingMenuStyles'

type MarkdownBlockContainerProps = {
  as: React.ElementType
  className?: string
  highlightClass: string
  highlightStyle?: React.CSSProperties
  startLine: number
  endLine?: number
  editLineRange?: { startLine: number; endLine: number }
  resolveEditLineRangeOnOpen?: (eventTarget: HTMLElement | null) => { startLine: number; endLine: number } | null
  resolveEditMinHeightOnOpen?: (eventTarget: HTMLElement | null, currentTarget: HTMLElement) => number | null
  id?: string
  defaultOpen?: boolean
  open?: boolean
  children: React.ReactNode
  inlineEditable?: boolean
  sourceLines?: string[]
  onReplaceLineRange?: (args: { startLine: number; endLine: number; replacementLines: string[] }) => void
  editorClassName?: string
  editStripLinePrefix?: (line: string) => { prefix: string; content: string }
  editDefaultLinePrefix?: string
  editKeepLinePrefixesInEditor?: boolean
  editTrimEmptyBlockEdges?: boolean
  editEnforceSingleListRoot?: boolean
  editTrimEdgeNewlines?: boolean
  editListMode?: 'ordered' | 'unordered'
  editPresentation?: 'markdown' | 'html'
  editHtmlRender?: 'inline' | 'block'
  editHtmlDisableDefaultBlockFlow?: boolean
  editLeftRailClassName?: string
  forbidCopy?: boolean
  onInlineEditStateChange?: (active: boolean) => void
  editDisableRichUi?: boolean
  editStaticChildren?: React.ReactNode
  editTypographyMode?: 'inherit' | 'none'
  editPreserveWhitespace?: boolean
  editPreserveBlockHeight?: boolean
}

export const MarkdownBlockContainer = React.forwardRef<HTMLElement, MarkdownBlockContainerProps & React.HTMLAttributes<HTMLElement>>(({
  as: Tag,
  className,
  highlightClass,
  highlightStyle,
  startLine,
  endLine,
  editLineRange,
  resolveEditLineRangeOnOpen,
  resolveEditMinHeightOnOpen,
  id,
  children,
  inlineEditable = false,
  sourceLines,
  onReplaceLineRange,
  editorClassName,
  editStripLinePrefix,
  editDefaultLinePrefix,
  editKeepLinePrefixesInEditor = false,
  editTrimEmptyBlockEdges = false,
  editEnforceSingleListRoot = false,
  editTrimEdgeNewlines = false,
  editListMode,
  editPresentation = 'markdown',
  editHtmlRender = 'inline',
  editHtmlDisableDefaultBlockFlow = false,
  editLeftRailClassName,
  forbidCopy = false,
  onInlineEditStateChange,
  editDisableRichUi = false,
  editStaticChildren,
  editTypographyMode = 'inherit',
  editPreserveWhitespace = false,
  editPreserveBlockHeight = true,
  ...rest
}, ref) => {
  const cls = [className, highlightClass].filter(Boolean).join(' ')
  const originalOnClick = (rest as React.HTMLAttributes<HTMLElement>).onClick
  const [editing, setEditing] = React.useState(false)
  const [sessionEditLineRange, setSessionEditLineRange] = React.useState<{ startLine: number; endLine: number } | null>(null)
  React.useEffect(() => {
    if (!onInlineEditStateChange) return
    onInlineEditStateChange(editing)
    return () => {
      if (editing) onInlineEditStateChange(false)
    }
  }, [editing, onInlineEditStateChange])
  React.useEffect(() => {
    if (editing) return
    if (!sessionEditLineRange) return
    setSessionEditLineRange(null)
  }, [editing, sessionEditLineRange])
  const editable = inlineEditable && Array.isArray(sourceLines) && !!onReplaceLineRange && Number.isFinite(startLine)
  const effectiveEndLine = endLine ?? startLine
  const effectiveEditLineRange = sessionEditLineRange || editLineRange || null
  const editStartLine = effectiveEditLineRange && Number.isFinite(effectiveEditLineRange.startLine) ? effectiveEditLineRange.startLine : startLine
  const editEndLine = effectiveEditLineRange && Number.isFinite(effectiveEditLineRange.endLine) ? effectiveEditLineRange.endLine : effectiveEndLine
  const initialText = React.useMemo(() => {
    if (!editable || !sourceLines) return ''
    const startIndex = Math.max(0, Math.floor(editStartLine) - 1)
    const endIndex = Math.max(startIndex + 1, Math.floor(editEndLine))
    return sourceLines.slice(startIndex, endIndex).join('\n')
  }, [editable, editEndLine, editStartLine, sourceLines])
  const draftRef = React.useRef('')
  const editorRef = React.useRef<HTMLElement | null>(null)
  const initialPresentTextRef = React.useRef('')
  const editSessionIdRef = React.useRef(0)
  const editLinePrefixesRef = React.useRef<string[] | null>(null)
  const toolbarRef = React.useRef<HTMLElement | null>(null)
  const toolbarInteractingRef = React.useRef(false)
  const linkRangeRef = React.useRef<Range | null>(null)
  const editorPresentation = editPresentation === 'html' ? 'html' : 'markdown'
  const htmlRenderMode = editHtmlRender === 'block' ? 'block' : 'inline'
  const normalizeRenderedBlockHtmlForEditor = React.useCallback((renderedHtml: string): string => {
    if (!editListMode) return renderedHtml
    return String(renderedHtml || '')
      .replace(/>\s+</g, '><')
      .trim()
  }, [editListMode])

  const trimEmptyEditableEdges = React.useCallback((): boolean => {
    if (!editTrimEmptyBlockEdges) return false
    const root = editorRef.current
    if (!root) return false
    const isWhitespaceText = (n: Node | null): boolean => {
      if (!n || n.nodeType !== Node.TEXT_NODE) return false
      const v = String((n as Text).nodeValue || '')
      return v.replace(/\u200B/g, '').trim().length === 0
    }
    const isBrElement = (n: Node | null): boolean => {
      if (!n || n.nodeType !== Node.ELEMENT_NODE) return false
      const tag = String((n as HTMLElement).tagName || '').toLowerCase()
      return tag === 'br'
    }
    const isEmptyBlockElement = (el: Element): boolean => {
      const tag = String((el as HTMLElement).tagName || '').toLowerCase()
      if (tag !== 'div' && tag !== 'p' && tag !== 'section') return false
      const text = String((el as HTMLElement).textContent || '').replace(/\u200B/g, '').trim()
      if (text) return false
      const childEls = Array.from(el.children)
      if (childEls.length === 0) return true
      return childEls.every(c => String((c as HTMLElement).tagName || '').toLowerCase() === 'br')
    }

    let changed = false
    const pruneLeading = () => {
      while (isWhitespaceText(root.firstChild) || isBrElement(root.firstChild)) {
        root.firstChild?.remove()
        changed = true
      }
      while (root.firstElementChild && isEmptyBlockElement(root.firstElementChild)) {
        root.firstElementChild.remove()
        changed = true
      }
    }
    const pruneTrailing = () => {
      while (isWhitespaceText(root.lastChild) || isBrElement(root.lastChild)) {
        root.lastChild?.remove()
        changed = true
      }
      while (root.lastElementChild && isEmptyBlockElement(root.lastElementChild)) {
        root.lastElementChild.remove()
        changed = true
      }
    }

    pruneLeading()
    pruneTrailing()

    const rootTag = String((root as HTMLElement).tagName || '').toLowerCase()
    const rootIsList = rootTag === 'ul' || rootTag === 'ol'
    const onlyList = (() => {
      const elems = Array.from(root.children)
      const meaningful = elems.filter(e => {
        const tag = String(e.tagName || '').toLowerCase()
        return tag !== 'br'
      })
      if (meaningful.length !== 1) return false
      const tag = String(meaningful[0]?.tagName || '').toLowerCase()
      return tag === 'ul' || tag === 'ol'
    })()
    if (onlyList || rootIsList) {
      pruneLeading()
      pruneTrailing()

      let listEl = (
        rootIsList
          ? root
          : Array.from(root.children).find(e => {
              const tag = String(e.tagName || '').toLowerCase()
              return tag === 'ul' || tag === 'ol'
            })
      ) as HTMLElement | undefined
      if (editEnforceSingleListRoot && listEl) {
        if (rootIsList) {
          const childList = Array.from(root.children).find(e => {
            const tag = String(e.tagName || '').toLowerCase()
            return tag === 'ul' || tag === 'ol'
          }) as HTMLElement | undefined
          if (childList) {
            root.innerHTML = childList.innerHTML
            changed = true
            listEl = root
          }
        }
        const shouldRewriteRoot = (() => {
          if (rootIsList) return false
          const elems = Array.from(root.children)
          if (elems.length !== 1) return true
          if (elems[0] !== listEl) return true
          const leading = root.firstChild
          const trailing = root.lastChild
          const isWhitespaceNode = (n: Node | null) =>
            !!n && n.nodeType === Node.TEXT_NODE && String((n as Text).nodeValue || '').trim().length === 0
          if (leading && leading !== listEl && !isWhitespaceNode(leading)) return true
          if (trailing && trailing !== listEl && !isWhitespaceNode(trailing)) return true
          return false
        })()
        if (shouldRewriteRoot) {
          root.innerHTML = listEl.outerHTML
          changed = true
          listEl = root.firstElementChild as HTMLElement | undefined
        }
      }
      const isEmptyLi = (li: Element): boolean => {
        const tag = String((li as HTMLElement).tagName || '').toLowerCase()
        if (tag !== 'li') return false
        const text = String((li as HTMLElement).textContent || '').replace(/\u200B/g, '').trim()
        if (text) return false
        const childEls = Array.from(li.children)
        if (childEls.length === 0) return true
        const okChild = (el: Element): boolean => {
          const t = String((el as HTMLElement).tagName || '').toLowerCase()
          if (t === 'br') return true
          if (t === 'p' || t === 'div') {
            const innerText = String((el as HTMLElement).textContent || '').replace(/\u200B/g, '').trim()
            if (innerText) return false
            const innerChildren = Array.from(el.children)
            return innerChildren.length === 0 || innerChildren.every(c => String((c as HTMLElement).tagName || '').toLowerCase() === 'br')
          }
          return false
        }
        return childEls.every(okChild)
      }
      if (listEl) {
        listEl.style.marginTop = '0px'
        listEl.style.marginBottom = '0px'
        listEl.style.paddingTop = '0px'
        listEl.style.paddingBottom = '0px'
        for (const node of Array.from(listEl.childNodes)) {
          if (node.nodeType === Node.TEXT_NODE) {
            const v = String((node as Text).nodeValue || '').replace(/\u200B/g, '').trim()
            if (!v) {
              node.remove()
              changed = true
            }
            continue
          }
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = String((node as HTMLElement).tagName || '').toLowerCase()
            if (tag === 'br') {
              node.remove()
              changed = true
            }
          }
        }
        const isEmptyInlineContainer = (el: Element): boolean => {
          const t = String((el as HTMLElement).tagName || '').toLowerCase()
          if (t !== 'p' && t !== 'div') return false
          const text = String((el as HTMLElement).textContent || '').replace(/\u200B/g, '').trim()
          if (text) return false
          const children = Array.from(el.children)
          return children.length === 0 || children.every(c => String((c as HTMLElement).tagName || '').toLowerCase() === 'br')
        }
        const trimLiEdgeBlocks = (li: Element) => {
          while (li.firstChild && isWhitespaceText(li.firstChild)) {
            li.firstChild.remove()
            changed = true
          }
          while (li.lastChild && isWhitespaceText(li.lastChild)) {
            li.lastChild.remove()
            changed = true
          }
          while (li.firstChild && isBrElement(li.firstChild)) {
            li.firstChild.remove()
            changed = true
          }
          while (li.lastChild && isBrElement(li.lastChild)) {
            li.lastChild.remove()
            changed = true
          }
          while (li.firstElementChild && isEmptyInlineContainer(li.firstElementChild)) {
            li.firstElementChild.remove()
            changed = true
          }
          while (li.lastElementChild && isEmptyInlineContainer(li.lastElementChild)) {
            li.lastElementChild.remove()
            changed = true
          }
        }
        for (const li of Array.from(listEl.children)) {
          trimLiEdgeBlocks(li)
        }
        while (listEl.firstElementChild && isEmptyLi(listEl.firstElementChild)) {
          listEl.firstElementChild.remove()
          changed = true
        }
        while (listEl.lastElementChild && isEmptyLi(listEl.lastElementChild)) {
          listEl.lastElementChild.remove()
          changed = true
        }
        if (changed && listEl.children.length === 0) {
          const li = document.createElement('li')
          li.appendChild(document.createElement('br'))
          listEl.appendChild(li)
        }
      }
    }

    if (changed && root.childNodes.length === 0) {
      root.appendChild(document.createElement('br'))
    }
    return changed
  }, [editEnforceSingleListRoot, editTrimEmptyBlockEdges])

  const edgeTrimRafRef = React.useRef(0)
  const scheduleEdgeTrimBurst = React.useCallback(() => {
    if (!editTrimEmptyBlockEdges) return
    if (editListMode) return
    if (edgeTrimRafRef.current) return
    let framesLeft = 6
    let stableFrames = 0
    const tick = () => {
      edgeTrimRafRef.current = 0
      if (!editing) return
      const changed = trimEmptyEditableEdges()
      if (changed) stableFrames = 0
      else stableFrames += 1
      framesLeft -= 1
      if (framesLeft <= 0) return
      if (stableFrames >= 2) return
      edgeTrimRafRef.current = window.requestAnimationFrame(tick)
    }
    edgeTrimRafRef.current = window.requestAnimationFrame(tick)
  }, [editListMode, editTrimEmptyBlockEdges, editing, trimEmptyEditableEdges])
  const readEditorPlainText = React.useCallback((): string => {
    const el = editorRef.current
    if (!el) return ''
    const nodes = Array.from(el.childNodes)
    const elementChildren = nodes.filter(n => n.nodeType === Node.ELEMENT_NODE) as HTMLElement[]
    if (elementChildren.length === 0) return String(el.textContent || '').replace(/\r/g, '')

    const allBlock = elementChildren.every(n => {
      const tag = String(n.tagName || '').toLowerCase()
      return tag === 'div' || tag === 'p' || tag === 'pre'
    })
    if (allBlock) {
      const lines = elementChildren.map(n => String(n.textContent || ''))
      return lines.join('\n').replace(/\r/g, '')
    }

    let out = ''
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        out += String((node as Text).nodeValue || '')
        return
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return
      const elem = node as HTMLElement
      const tag = String(elem.tagName || '').toLowerCase()
      if (tag === 'br') {
        out += '\n'
        return
      }
      const children = Array.from(node.childNodes)
      for (const c of children) walk(c)
      if (tag === 'div' || tag === 'p' || tag === 'pre') out += '\n'
    }
    for (const n of nodes) walk(n)
    if (out.endsWith('\n')) out = out.slice(0, -1)
    return out.replace(/\r/g, '')
  }, [])

  const editMinHeightPxRef = React.useRef<number>(0)

  const getSelectionOffsets = React.useCallback((): { startOffset: number; endOffset: number } | null => {
    const root = editorRef.current
    if (!root) return null
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel || sel.rangeCount <= 0) return null
    const range = sel.getRangeAt(0)
    const container = range.commonAncestorContainer
    const node = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement
    if (!node || !root.contains(node)) return null

    const startRange = range.cloneRange()
    startRange.selectNodeContents(root)
    try {
      startRange.setEnd(range.startContainer, range.startOffset)
    } catch {
      return null
    }

    const endRange = range.cloneRange()
    endRange.selectNodeContents(root)
    try {
      endRange.setEnd(range.endContainer, range.endOffset)
    } catch {
      return null
    }

    const startOffset = startRange.toString().length
    const endOffset = endRange.toString().length
    if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset)) return null
    return { startOffset: Math.max(0, startOffset), endOffset: Math.max(0, endOffset) }
  }, [])

  const setSelectionByOffsets = React.useCallback((args: { startOffset: number; endOffset: number }) => {
    const root = editorRef.current
    if (!root) return
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel) return

    const start = Math.max(0, Math.min(args.startOffset, args.endOffset))
    const end = Math.max(0, Math.max(args.startOffset, args.endOffset))
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

    let currentNode: Text | null = null
    let currentOffset = 0
    let startNode: Text | null = null
    let startNodeOffset = 0
    let endNode: Text | null = null
    let endNodeOffset = 0

    while ((currentNode = walker.nextNode() as Text | null)) {
      const len = currentNode.nodeValue?.length ?? 0
      const nextOffset = currentOffset + len

      if (!startNode && start <= nextOffset) {
        startNode = currentNode
        startNodeOffset = Math.max(0, start - currentOffset)
      }
      if (!endNode && end <= nextOffset) {
        endNode = currentNode
        endNodeOffset = Math.max(0, end - currentOffset)
      }
      if (startNode && endNode) break
      currentOffset = nextOffset
    }

    if (!startNode) {
      const text = root.textContent || ''
      root.textContent = text
      startNode = root.firstChild as Text | null
      startNodeOffset = 0
    }
    if (!endNode) {
      const text = root.textContent || ''
      root.textContent = text
      endNode = root.firstChild as Text | null
      endNodeOffset = (endNode?.nodeValue?.length ?? 0)
    }
    if (!startNode || !endNode) return

    const range = document.createRange()
    range.setStart(startNode, Math.max(0, Math.min(startNodeOffset, startNode.nodeValue?.length ?? 0)))
    range.setEnd(endNode, Math.max(0, Math.min(endNodeOffset, endNode.nodeValue?.length ?? 0)))
    try {
      sel.removeAllRanges()
      sel.addRange(range)
    } catch {
      void 0
    }
  }, [])

  const setDraftToDom = React.useCallback((nextText: string, selection?: { startOffset: number; endOffset: number }) => {
    const el = editorRef.current
    if (!el) return
    draftRef.current = nextText
    if (editorPresentation === 'html') {
      const md = getMarkdownItFastHtml()
      if (htmlRenderMode === 'block') {
        const rendered = md.render(nextText)
        if (rendered.replace(/\s+/g, '').length === 0 && String(nextText || '').trim()) {
          el.textContent = nextText
        } else {
          el.innerHTML = normalizeRenderedBlockHtmlForEditor(rendered)
        }
      } else {
        const lines = String(nextText || '').split(/\r?\n/)
        el.innerHTML = lines
          .map(line => (line ? md.renderInline(line) : ''))
          .map((html, i) => (i === 0 ? html : `<br/>${html}`))
          .join('')
      }
    } else {
      el.textContent = nextText
    }
    if (selection) {
      queueMicrotask(() => setSelectionByOffsets(selection))
    }
  }, [editorPresentation, htmlRenderMode, normalizeRenderedBlockHtmlForEditor, setSelectionByOffsets])

  const getDraft = React.useCallback(() => draftRef.current, [])

  const execInline = React.useCallback((cmd: 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'removeFormat') => {
    const root = editorRef.current
    if (!root) return
    root.focus()
    try {
      document.execCommand(cmd, false)
    } catch {
      void 0
    }
  }, [])

  const insertHtmlAroundSelection = React.useCallback((args: { leftHtml: string; rightHtml: string }) => {
    const root = editorRef.current
    if (!root) return
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel || sel.rangeCount <= 0) return
    const range = sel.getRangeAt(0)
    const container = range.commonAncestorContainer
    const node = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement
    if (!node || !root.contains(node)) return
    const wrap = document.createElement('div')
    wrap.appendChild(range.cloneContents())
    const html = `${args.leftHtml}${wrap.innerHTML}${args.rightHtml}`
    root.focus()
    try {
      document.execCommand('insertHTML', false, html)
    } catch {
      void 0
    }
  }, [])

  const applyDraftAction = React.useCallback((action: MarkdownFormatAction) => {
    if (editorPresentation === 'html') {
      if (action === 'bold') execInline('bold')
      if (action === 'italic') execInline('italic')
      if (action === 'strike') execInline('strikeThrough')
      if (action === 'inlineCode') insertHtmlAroundSelection({ leftHtml: '<code>', rightHtml: '</code>' })
      if (action === 'link') {
        const root = editorRef.current
        if (!root) return
        const sel = typeof window !== 'undefined' ? window.getSelection() : null
        if (sel && sel.rangeCount > 0) linkRangeRef.current = sel.getRangeAt(0).cloneRange()
        const rect = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).getBoundingClientRect() : null
        const host = root.closest('[data-start-line]') as HTMLElement | null
        const hostRect = host?.getBoundingClientRect() || root.getBoundingClientRect()
        const leftPx = rect ? rect.left - hostRect.left : 0
        const topPx = rect ? rect.bottom - hostRect.top + 6 : 0
        setLinkPopover({ show: true, leftPx, topPx, href: '' })
        setBubble(prev => (prev.show ? { ...prev, show: false } : prev))
      }
      return
    }
    const selection = getSelectionOffsets()
    const startOffset = selection?.startOffset ?? 0
    const endOffset = selection?.endOffset ?? 0
    const result = applyMarkdownFormatAction({
      text: getDraft(),
      selection: { startOffset, endOffset },
      action,
    })
    setDraftToDom(result.nextText, result.nextSelection)
    queueMicrotask(() => editorRef.current?.focus())
  }, [editorPresentation, execInline, getDraft, getSelectionOffsets, insertHtmlAroundSelection, setDraftToDom])
  const applyWrap = React.useCallback((left: string, right: string) => {
    const current = getDraft()
    const selection = getSelectionOffsets()
    const startOffset = selection?.startOffset ?? 0
    const endOffset = selection?.endOffset ?? 0
    const a = Math.max(0, Math.min(current.length, startOffset))
    const b = Math.max(0, Math.min(current.length, endOffset))
    const start = Math.min(a, b)
    const end = Math.max(a, b)
    const selected = current.slice(start, end)
    const nextText = `${current.slice(0, start)}${left}${selected}${right}${current.slice(end)}`
    const nextStart = start + left.length
    const nextEnd = nextStart + selected.length
    setDraftToDom(nextText, { startOffset: nextStart, endOffset: nextEnd })
    queueMicrotask(() => editorRef.current?.focus())
  }, [getDraft, getSelectionOffsets, setDraftToDom])
  const applyTurnInto = React.useCallback((next: string) => {
    if (next === 'none') return
    if (next === 'heading2') {
      applyDraftAction('heading2')
      return
    }
    if (next === 'bulletList') {
      applyDraftAction('bulletList')
      return
    }
    if (next === 'numberedList') {
      applyDraftAction('numberedList')
      return
    }
    if (next === 'blockquote') {
      applyDraftAction('blockquote')
      return
    }
    if (next === 'code') {
      const lines = String(getDraft() || '').split(/\r?\n/)
      const nextText = ['```', ...lines, '```'].join('\n')
      setDraftToDom(nextText)
      queueMicrotask(() => editorRef.current?.focus())
    }
  }, [applyDraftAction, getDraft, setDraftToDom])
  const applyAlign = React.useCallback((next: string) => {
    if (next === 'none') return
    if (next === 'left') {
      const current = getDraft()
      const nextText = current.replace(/^<div align="(center|right|left)">\n?([\s\S]*?)\n?<\/div>$/i, '$2')
      setDraftToDom(nextText)
      queueMicrotask(() => editorRef.current?.focus())
      return
    }
    setDraftToDom(`<div align="${next}">\n${getDraft()}\n</div>`)
    queueMicrotask(() => editorRef.current?.focus())
  }, [getDraft, setDraftToDom])
  const applyToggleHeading = React.useCallback((level: 1 | 2 | 3) => {
    const selection = getSelectionOffsets()
    const startOffset = selection?.startOffset ?? 0
    const endOffset = selection?.endOffset ?? 0
    const text = getDraft()
    const hashes = '#'.repeat(level) + ' '
    const a = Math.max(0, Math.min(text.length, startOffset))
    const b = Math.max(0, Math.min(text.length, endOffset))
    const startLineIdx = (() => {
      const i = text.lastIndexOf('\n', a - 1)
      return i < 0 ? 0 : i + 1
    })()
    const endLineIdx = (() => {
      const i = text.indexOf('\n', b)
      return i < 0 ? text.length : i
    })()
    const block = text.slice(startLineIdx, endLineIdx)
    const lines = block.split('\n')
    const allHave = lines.every(l => !l.trim() || l.startsWith(hashes))
    const nextLines = lines.map(l => {
      if (!l.trim()) return l
      if (allHave) return l.startsWith(hashes) ? l.slice(hashes.length) : l
      return l.replace(/^#{1,6}\s+/, hashes).startsWith(hashes) ? l.replace(/^#{1,6}\s+/, hashes) : `${hashes}${l}`
    })
    const nextBlock = nextLines.join('\n')
    const nextText = text.slice(0, startLineIdx) + nextBlock + text.slice(endLineIdx)
    const delta = nextBlock.length - block.length
    setDraftToDom(nextText, { startOffset: startOffset, endOffset: endOffset + delta })
    queueMicrotask(() => editorRef.current?.focus())
  }, [getDraft, getSelectionOffsets, setDraftToDom])
  const applyColor = React.useCallback((color: string) => {
    if (editorPresentation === 'html') {
      insertHtmlAroundSelection({ leftHtml: `<span style="color:${color}">`, rightHtml: '</span>' })
      return
    }
    const sel = getSelectionOffsets()
    const startOffset = sel?.startOffset ?? 0
    const endOffset = sel?.endOffset ?? 0
    if (startOffset === endOffset) return
    const text = getDraft()
    const a = Math.max(0, Math.min(text.length, startOffset))
    const b = Math.max(0, Math.min(text.length, endOffset))
    const start = Math.min(a, b)
    const end = Math.max(a, b)
    const selected = text.slice(start, end)
    const left = `<span style="color:${color}">`
    const right = `</span>`
    const nextText = `${text.slice(0, start)}${left}${selected}${right}${text.slice(end)}`
    const nextStart = start + left.length
    const nextEnd = nextStart + selected.length
    setDraftToDom(nextText, { startOffset: nextStart, endOffset: nextEnd })
    queueMicrotask(() => editorRef.current?.focus())
  }, [editorPresentation, getDraft, getSelectionOffsets, insertHtmlAroundSelection, setDraftToDom])
  const applyHighlightColor = React.useCallback((color: string) => {
    if (editorPresentation === 'html') {
      insertHtmlAroundSelection({ leftHtml: `<mark style="background-color:${color}">`, rightHtml: '</mark>' })
      return
    }
    const sel = getSelectionOffsets()
    const startOffset = sel?.startOffset ?? 0
    const endOffset = sel?.endOffset ?? 0
    if (startOffset === endOffset) return
    const text = getDraft()
    const a = Math.max(0, Math.min(text.length, startOffset))
    const b = Math.max(0, Math.min(text.length, endOffset))
    const start = Math.min(a, b)
    const end = Math.max(a, b)
    const selected = text.slice(start, end)
    const left = `<mark style="background-color:${color}">`
    const right = `</mark>`
    const nextText = `${text.slice(0, start)}${left}${selected}${right}${text.slice(end)}`
    const nextStart = start + left.length
    const nextEnd = nextStart + selected.length
    setDraftToDom(nextText, { startOffset: nextStart, endOffset: nextEnd })
    queueMicrotask(() => editorRef.current?.focus())
  }, [editorPresentation, getDraft, getSelectionOffsets, insertHtmlAroundSelection, setDraftToDom])
  const applyChecklist = React.useCallback(() => {
    if (editorPresentation === 'html') return
    const selection = getSelectionOffsets()
    const startOffset = selection?.startOffset ?? 0
    const endOffset = selection?.endOffset ?? 0
    const text = getDraft()
    const a = Math.max(0, Math.min(text.length, startOffset))
    const b = Math.max(0, Math.min(text.length, endOffset))
    const start = Math.min(a, b)
    const end = Math.max(a, b)
    const lineStart = (() => {
      const idx = text.lastIndexOf('\n', start - 1)
      return idx < 0 ? 0 : idx + 1
    })()
    const lineEnd = (() => {
      const idx = text.indexOf('\n', end)
      return idx < 0 ? text.length : idx
    })()
    const block = text.slice(lineStart, lineEnd)
    const lines = block.split('\n')
    const allChecklist = lines.every(line => !line.trim() || /^- \[( |x|X)\] /.test(line))
    const nextLines = lines.map(line => {
      if (!line.trim()) return line
      if (allChecklist) return line.replace(/^- \[( |x|X)\] /, '')
      if (/^- /.test(line)) return line.replace(/^- /, '- [ ] ')
      return `- [ ] ${line}`
    })
    const nextBlock = nextLines.join('\n')
    const nextText = `${text.slice(0, lineStart)}${nextBlock}${text.slice(lineEnd)}`
    const delta = nextBlock.length - block.length
    setDraftToDom(nextText, { startOffset: startOffset, endOffset: endOffset + delta })
    queueMicrotask(() => editorRef.current?.focus())
  }, [editorPresentation, getDraft, getSelectionOffsets, setDraftToDom])
  const applyDivider = React.useCallback(() => {
    if (editorPresentation === 'html') return
    const selection = getSelectionOffsets()
    const startOffset = selection?.startOffset ?? 0
    const text = getDraft()
    const lineEnd = (() => {
      const idx = text.indexOf('\n', startOffset)
      return idx < 0 ? text.length : idx
    })()
    const needsLeadingBreak = lineEnd > 0 && text[lineEnd - 1] !== '\n'
    const insert = `${needsLeadingBreak ? '\n' : ''}\n---\n`
    const nextText = `${text.slice(0, lineEnd)}${insert}${text.slice(lineEnd)}`
    const cursor = lineEnd + insert.length
    setDraftToDom(nextText, { startOffset: cursor, endOffset: cursor })
    queueMicrotask(() => editorRef.current?.focus())
  }, [editorPresentation, getDraft, getSelectionOffsets, setDraftToDom])
  const applyClearFormatting = React.useCallback(() => {
    if (editorPresentation === 'html') {
      execInline('removeFormat')
      try {
        document.execCommand('unlink', false)
      } catch {
        void 0
      }
      return
    }
    const sel = getSelectionOffsets()
    const startOffset = sel?.startOffset ?? 0
    const endOffset = sel?.endOffset ?? 0
    if (startOffset === endOffset) return
    const text = getDraft()
    const a = Math.max(0, Math.min(text.length, startOffset))
    const b = Math.max(0, Math.min(text.length, endOffset))
    const start = Math.min(a, b)
    const end = Math.max(a, b)
    let selected = text.slice(start, end)
    selected = selected.replace(/^\*\*([\s\S]*?)\*\*$/g, '$1')
    selected = selected.replace(/^\*([\s\S]*?)\*$/g, '$1')
    selected = selected.replace(/^~~([\s\S]*?)~~$/g, '$1')
    selected = selected.replace(/^`([\s\S]*?)`$/g, '$1')
    selected = selected.replace(/^==([\s\S]*?)==$/g, '$1')
    selected = selected.replace(/^<u>([\s\S]*?)<\/u>$/gi, '$1')
    selected = selected.replace(/^<mark>([\s\S]*?)<\/mark>$/gi, '$1')
    selected = selected.replace(/^<span[^>]*>([\s\S]*?)<\/span>$/gi, '$1')
    selected = selected.replace(/^\[([\s\S]*?)\]\((?:[^)]*)\)$/g, '$1')
    const nextText = `${text.slice(0, start)}${selected}${text.slice(end)}`
    const nextEnd = start + selected.length
    setDraftToDom(nextText, { startOffset: start, endOffset: nextEnd })
    queueMicrotask(() => editorRef.current?.focus())
  }, [editorPresentation, execInline, getDraft, getSelectionOffsets, setDraftToDom])
  const buildReplacementLinesFromDraft = React.useCallback((draft: string): string[] => {
    const replacementLines = String(draft || '').split(/\r?\n/)
    const prefixes = editLinePrefixesRef.current
    if (!editStripLinePrefix || !prefixes) return replacementLines
    const defaultPrefix = editDefaultLinePrefix ?? prefixes.find(p => p) ?? ''
    return replacementLines.map((line, i) => {
      const prefix = prefixes[i] ?? defaultPrefix
      if (!line.trim()) {
        if (/^\s*>\s*$/.test(prefix) || /^\s*>\s*$/.test(defaultPrefix)) {
          const p = prefix || defaultPrefix
          return p.trimEnd() || '>'
        }
        return ''
      }
      if (!prefix) return line
      if (line.startsWith(prefix)) return line
      const taskPrefixMatch = prefix.match(/^(\s*[-*+]\s+\[( |x|X)\]\s+)$/)
      if (taskPrefixMatch) {
        const isBulletWithoutTask = /^\s*[-*+]\s+(?!\[(?: |x|X)\]\s+)/.test(line)
        if (isBulletWithoutTask) {
          return line.replace(/^\s*([-*+])\s+/, `${taskPrefixMatch[1] || '- [ ] '}`)
        }
      }
      if (/^\s*#{1,6}\s+/.test(line)) return line
      if (/^\s*>\s?/.test(line)) return line
      if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) return line
      return `${prefix}${line}`
    })
  }, [editDefaultLinePrefix, editStripLinePrefix])
  const handleDuplicate = React.useCallback(() => {
    if (!editable || !onReplaceLineRange) return
    const replacementLines = buildReplacementLinesFromDraft(getDraft() || '')
    onReplaceLineRange({ startLine: editStartLine, endLine: editEndLine, replacementLines: [...replacementLines, ...replacementLines] })
    setEditing(false)
    setSessionEditLineRange(null)
  }, [editable, editEndLine, editStartLine, getDraft, onReplaceLineRange, buildReplacementLinesFromDraft])
  const handleDelete = React.useCallback(() => {
    if (!editable || !onReplaceLineRange) return
    onReplaceLineRange({ startLine: editStartLine, endLine: editEndLine, replacementLines: [] })
    setEditing(false)
    setSessionEditLineRange(null)
  }, [editable, editEndLine, editStartLine, onReplaceLineRange])
  const commit = React.useCallback(() => {
    if (!editable || !onReplaceLineRange) return
    if (editorPresentation === 'html') {
      const sessionId = editSessionIdRef.current
      const root = editorRef.current
      setEditing(false)
      if (!root) return
      const html = root.innerHTML
      void (async () => {
        const wrapperTag = 'div'
        const result = await convertHtmlToMarkdownUnified({
          html: `<${wrapperTag}>${html}</${wrapperTag}>`,
          fidelityLevel: 2,
          includeImages: true,
        })
        if (!result.ok) return
        if (editSessionIdRef.current !== sessionId) return
        const markdown = String(result.markdown || '').replace(/\s+$/g, '')
        if (markdown === initialPresentTextRef.current) return
        const replacementLines = buildReplacementLinesFromDraft(markdown)
        onReplaceLineRange({ startLine: editStartLine, endLine: editEndLine, replacementLines })
        setSessionEditLineRange(null)
      })()
      return
    }
    const draft = getDraft()
    if (draft === initialText) {
      setEditing(false)
      return
    }
    const replacementLines = buildReplacementLinesFromDraft(draft)
    onReplaceLineRange({ startLine: editStartLine, endLine: editEndLine, replacementLines })
    setEditing(false)
    setSessionEditLineRange(null)
  }, [editable, editEndLine, editListMode, editStartLine, editorPresentation, getDraft, initialText, onReplaceLineRange, buildReplacementLinesFromDraft])
  const cancel = React.useCallback(() => {
    setEditing(false)
    setSessionEditLineRange(null)
  }, [])
  const lastPointerRef = React.useRef<{ x: number; y: number } | null>(null)
  const openEditor = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!editable) return
    const target = event.target as HTMLElement | null
    if (target?.closest('button,a,input,select,textarea,[contenteditable="true"]')) return
    const resolvedRange = resolveEditLineRangeOnOpen?.(target ?? null) ?? null
    setSessionEditLineRange(resolvedRange)
    lastPointerRef.current = { x: event.clientX, y: event.clientY }
    try {
      const resolvedH = resolveEditMinHeightOnOpen?.(target ?? null, event.currentTarget)
      const h = Number.isFinite(resolvedH as number)
        ? Number(resolvedH)
        : event.currentTarget.getBoundingClientRect().height
      editMinHeightPxRef.current = Number.isFinite(h) ? Math.max(0, h) : 0
    } catch {
      editMinHeightPxRef.current = 0
    }
    editSessionIdRef.current += 1
    event.preventDefault()
    event.stopPropagation()
    setEditing(prev => (prev ? prev : true))
  }, [editable, resolveEditLineRangeOnOpen, resolveEditMinHeightOnOpen])

  const placeCaretFromClientPoint = React.useCallback(() => {
    const point = lastPointerRef.current
    if (!point) return
    const root = editorRef.current
    if (!root) return

    const getRange = (): Range | null => {
      const docAny = document as unknown as {
        caretRangeFromPoint?: (x: number, y: number) => Range | null
      }
      const caretFromPointAny = document as unknown as {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
      }
      if (typeof caretFromPointAny.caretPositionFromPoint === 'function') {
        try {
          const pos = caretFromPointAny.caretPositionFromPoint(point.x, point.y)
          if (!pos) return null
          const range = document.createRange()
          range.setStart(pos.offsetNode, pos.offset)
          range.collapse(true)
          return range
        } catch {
          return null
        }
      }
      if (typeof docAny.caretRangeFromPoint === 'function') {
        try {
          return docAny.caretRangeFromPoint(point.x, point.y)
        } catch {
          return null
        }
      }
      return null
    }

    const range = getRange()
    if (!range) return
    const container = range.startContainer
    const node = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement
    if (!node || !root.contains(node)) return

    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel) return
    try {
      sel.removeAllRanges()
      sel.addRange(range)
    } catch {
      void 0
    }
  }, [])

  const [bubble, setBubble] = React.useState<{ show: boolean; leftPx: number; topPx: number }>({ show: false, leftPx: 0, topPx: 0 })
  const [slashMenu, setSlashMenu] = React.useState<{ show: boolean; leftPx: number; topPx: number }>({ show: false, leftPx: 0, topPx: 0 })
  const [linkPopover, setLinkPopover] = React.useState<{ show: boolean; leftPx: number; topPx: number; href: string }>({ show: false, leftPx: 0, topPx: 0, href: '' })
  const bubbleAnchorRef = React.useRef<HTMLSpanElement | null>(null)
  const slashAnchorRef = React.useRef<HTMLSpanElement | null>(null)
  const linkAnchorRef = React.useRef<HTMLSpanElement | null>(null)
  const bubbleRafRef = React.useRef(0)
  const setSlashMenuStable = React.useCallback((next: { show: boolean; leftPx: number; topPx: number }) => {
    setSlashMenu(prev => {
      if (
        prev.show === next.show &&
        Math.abs(prev.leftPx - next.leftPx) < 1 &&
        Math.abs(prev.topPx - next.topPx) < 1
      ) return prev
      return next
    })
  }, [])
  const updateBubble = React.useCallback(() => {
    if (!editing) return
    if (editDisableRichUi) return
    const root = editorRef.current
    if (!root) return
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel || sel.rangeCount <= 0) {
      setBubble(prev => (prev.show ? { ...prev, show: false } : prev))
      return
    }
    const range = sel.getRangeAt(0)
    if (range.collapsed) {
      setBubble(prev => (prev.show ? { ...prev, show: false } : prev))
      return
    }
    const container = range.commonAncestorContainer
    const node = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement
    if (!node || !root.contains(node)) {
      setBubble(prev => (prev.show ? { ...prev, show: false } : prev))
      return
    }
    const rect = range.getBoundingClientRect()
    if (!rect || (!rect.width && !rect.height)) {
      setBubble(prev => (prev.show ? { ...prev, show: false } : prev))
      return
    }
    const host = root.closest('[data-start-line]') as HTMLElement | null
    const hostRect = host?.getBoundingClientRect() || root.getBoundingClientRect()
    const rawLeftPx = rect.left + rect.width / 2 - hostRect.left
    const maxX = Math.max(0, hostRect.width - 16)
    const leftPx = Math.max(16, Math.min(maxX, rawLeftPx))
    const topPx = rect.top - hostRect.top
    setBubble(prev => {
      const next = { show: true, leftPx, topPx }
      if (prev.show && Math.abs(prev.leftPx - next.leftPx) < 1 && Math.abs(prev.topPx - next.topPx) < 1) return prev
      return next
    })
    setSlashMenu(prev => (prev.show ? { ...prev, show: false } : prev))
    setLinkPopover(prev => (prev.show ? { ...prev, show: false, href: '' } : prev))
  }, [editing, editDisableRichUi])

  React.useEffect(() => {
    if (!editing) return
    if (editDisableRichUi) return
    const root = editorRef.current
    if (!root) return
    const schedule = () => {
      if (bubbleRafRef.current) return
      bubbleRafRef.current = window.requestAnimationFrame(() => {
        bubbleRafRef.current = 0
        updateBubble()
      })
    }
    const onSelectionChange = () => schedule()
    document.addEventListener('selectionchange', onSelectionChange)
    root.addEventListener('keyup', schedule)
    root.addEventListener('mouseup', schedule)
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange)
      root.removeEventListener('keyup', schedule)
      root.removeEventListener('mouseup', schedule)
      if (bubbleRafRef.current) {
        window.cancelAnimationFrame(bubbleRafRef.current)
        bubbleRafRef.current = 0
      }
    }
  }, [editing, editDisableRichUi, updateBubble])

  React.useEffect(() => {
    if (!editing) return
    const rawLines = String(initialText || '').split(/\r?\n/)
    if (editStripLinePrefix) {
      const stripped = rawLines.map(line => editStripLinePrefix(line))
      editLinePrefixesRef.current = stripped.map(s => s.prefix)
      const presentTextRaw = editKeepLinePrefixesInEditor
        ? rawLines.join('\n')
        : stripped.map(s => s.content).join('\n')
      const presentText = editTrimEdgeNewlines
        ? presentTextRaw.replace(/^\n+/, '').replace(/\n+$/, '')
        : presentTextRaw
      initialPresentTextRef.current = presentText
      draftRef.current = presentText
      const el = editorRef.current
      if (el) {
        if (editorPresentation === 'html') {
          const md = getMarkdownItFastHtml()
          if (htmlRenderMode === 'block') {
            const rendered = md.render(presentText)
            if (rendered.replace(/\s+/g, '').length === 0 && String(presentText || '').trim()) {
              el.textContent = presentText
            } else {
              el.innerHTML = normalizeRenderedBlockHtmlForEditor(rendered)
              trimEmptyEditableEdges()
              scheduleEdgeTrimBurst()
            }
          } else {
            const lines = String(presentText || '').split(/\r?\n/)
            el.innerHTML = lines
              .map(line => (line ? md.renderInline(line) : ''))
              .map((html, i) => (i === 0 ? html : `<br/>${html}`))
              .join('')
          }
        } else {
          el.textContent = presentText
        }
        queueMicrotask(() => {
          el.focus()
          placeCaretFromClientPoint()
          if (!editDisableRichUi) updateBubble()
          if (editTrimEmptyBlockEdges) {
            queueMicrotask(() => {
              trimEmptyEditableEdges()
              scheduleEdgeTrimBurst()
              if (editListMode) {
                window.requestAnimationFrame(() => {
                  trimEmptyEditableEdges()
                  window.requestAnimationFrame(() => {
                    trimEmptyEditableEdges()
                  })
                })
              }
            })
          }
        })
      }
      return
    }
    editLinePrefixesRef.current = null
    const normalizedInitialText = editTrimEdgeNewlines
      ? initialText.replace(/^\n+/, '').replace(/\n+$/, '')
      : initialText
    initialPresentTextRef.current = normalizedInitialText
    draftRef.current = normalizedInitialText
    const el = editorRef.current
    if (el) {
      if (editorPresentation === 'html') {
        const md = getMarkdownItFastHtml()
        if (htmlRenderMode === 'block') {
          const rendered = md.render(normalizedInitialText)
          if (rendered.replace(/\s+/g, '').length === 0 && String(normalizedInitialText || '').trim()) {
            el.textContent = normalizedInitialText
          } else {
            el.innerHTML = normalizeRenderedBlockHtmlForEditor(rendered)
            trimEmptyEditableEdges()
            scheduleEdgeTrimBurst()
          }
        } else {
          const lines = String(normalizedInitialText || '').split(/\r?\n/)
          el.innerHTML = lines
            .map(line => (line ? md.renderInline(line) : ''))
            .map((html, i) => (i === 0 ? html : `<br/>${html}`))
            .join('')
        }
      } else {
        el.textContent = normalizedInitialText
      }
      queueMicrotask(() => {
        el.focus()
        placeCaretFromClientPoint()
        if (!editDisableRichUi) updateBubble()
        if (editTrimEmptyBlockEdges) {
          queueMicrotask(() => {
            trimEmptyEditableEdges()
            scheduleEdgeTrimBurst()
            if (editListMode) {
              window.requestAnimationFrame(() => {
                trimEmptyEditableEdges()
                window.requestAnimationFrame(() => {
                  trimEmptyEditableEdges()
                })
              })
            }
          })
        }
      })
    }
  }, [
    editing,
    initialText,
    editStripLinePrefix,
    editorPresentation,
    htmlRenderMode,
    placeCaretFromClientPoint,
    updateBubble,
    editDisableRichUi,
    editKeepLinePrefixesInEditor,
    editTrimEdgeNewlines,
    normalizeRenderedBlockHtmlForEditor,
    trimEmptyEditableEdges,
    scheduleEdgeTrimBurst,
  ])

  React.useEffect(() => {
    if (!editing) return
    if (!editTrimEmptyBlockEdges) return
    scheduleEdgeTrimBurst()
    return () => {
      if (edgeTrimRafRef.current) {
        window.cancelAnimationFrame(edgeTrimRafRef.current)
        edgeTrimRafRef.current = 0
      }
    }
  }, [editing, editTrimEmptyBlockEdges, scheduleEdgeTrimBurst])
  const toolbarMenuClassName = FLOATING_MENU_LEFT_W220_CLASSNAME
  const toolbarMenuButtonClassName = FLOATING_MENU_BUTTON_CLASSNAME
  const toolbarMenuDividerClassName = FLOATING_MENU_DIVIDER_CLASSNAME
  const toolbarMenuSummaryClassName = FLOATING_BUBBLE_BUTTON_CLASSNAME
  const htmlBlockEditing = editorPresentation === 'html' && htmlRenderMode === 'block'
  const EditorTag = (
    htmlBlockEditing
      ? 'div'
      : 'span'
  ) as 'div' | 'span'
  const htmlEditNormalizeClassName =
    editorPresentation === 'html'
      ? [
          '[&_p]:m-0',
          '[&_h1]:m-0',
          '[&_h2]:m-0',
          '[&_h3]:m-0',
          '[&_h4]:m-0',
          '[&_h5]:m-0',
          '[&_h6]:m-0',
          '[&_h1]:text-inherit',
          '[&_h2]:text-inherit',
          '[&_h3]:text-inherit',
          '[&_h4]:text-inherit',
          '[&_h5]:text-inherit',
          '[&_h6]:text-inherit',
          '[&_h1]:font-inherit',
          '[&_h2]:font-inherit',
          '[&_h3]:font-inherit',
          '[&_h4]:font-inherit',
          '[&_h5]:font-inherit',
          '[&_h6]:font-inherit',
          '[&_ul]:m-0',
          '[&_ol]:m-0',
          '[&_li]:m-0',
          '[&_blockquote]:m-0',
          '[&_pre]:m-0',
          '[&_hr]:m-0',
          '[&>*:first-child]:mt-0',
          '[&>*:last-child]:mb-0',
          '[&_p:first-child]:mt-0',
          '[&_p:last-child]:mb-0',
          '[&_ul:first-child]:mt-0',
          '[&_ul:last-child]:mb-0',
          '[&_ol:first-child]:mt-0',
          '[&_ol:last-child]:mb-0',
          '[&_blockquote:first-child]:mt-0',
          '[&_blockquote:last-child]:mb-0',
          '[&_a]:break-words',
          '[&_a]:text-blue-600',
          '[&_a]:hover:underline',
          '[&_code]:font-mono',
          '[&_code]:border-0',
          '[&_code]:ring-1',
          '[&_code]:ring-inset',
          '[&_code]:ring-[color:var(--kg-code-border)]',
          '[&_code]:bg-[color:var(--kg-code-bg)]',
          '[&_code]:text-[color:var(--kg-code-text)]',
          '[&_code]:align-baseline',
          '[&_code]:leading-[var(--kg-inline-code-line-height,inherit)]',
          '[&_code]:px-1.5',
          '[&_code]:py-0',
          '[&_code]:rounded',
          '[&_code]:text-[length:var(--kg-inline-code-font-size,inherit)]',
          '[&_mark]:px-0.5',
          '[&_mark]:rounded-sm',
          '[&_mark]:text-yellow-700',
          '[&_mark]:bg-yellow-50',
          '[&_mark]:border',
          '[&_mark]:border-yellow-200',
          'dark:[&_mark]:text-yellow-400',
          'dark:[&_mark]:bg-yellow-900/30',
          'dark:[&_mark]:border-yellow-800',
        ].join(' ')
      : ''
  const htmlEditBlockFlowClassName =
    editorPresentation === 'html' && htmlRenderMode === 'block' && !editHtmlDisableDefaultBlockFlow
      ? [
          '[&_p]:mt-2',
          '[&_p]:mb-2',
          '[&_ul]:mt-3',
          '[&_ul]:mb-3',
          '[&_ul]:pl-5',
          '[&_ul]:list-disc',
          '[&_ol]:mt-3',
          '[&_ol]:mb-3',
          '[&_ol]:pl-5',
          '[&_ol]:list-decimal',
          '[&_li]:mt-0',
          '[&_li]:mb-0',
          '[&_blockquote]:mt-4',
          '[&_blockquote]:mb-4',
          '[&_blockquote]:pl-4',
          '[&_blockquote]:py-2',
          '[&_blockquote]:border-l-4',
          '[&_blockquote]:border-blue-400',
          'dark:[&_blockquote]:border-blue-600',
          '[&_blockquote]:italic',
        ].join(' ')
      : ''

  return (
    <Tag
      ref={ref}
      {...(rest as unknown as Record<string, unknown>)}
      id={id}
      className={cls}
      style={highlightStyle}
      data-start-line={startLine}
      data-end-line={endLine ?? startLine}
      onClick={(event: React.MouseEvent<HTMLElement>) => {
        originalOnClick?.(event)
        if (event.defaultPrevented) return
        openEditor(event)
      }}
      onDoubleClick={openEditor}
    >
      {editing && editable ? (
        <span
          className="relative w-full block min-w-0 flex-1"
          style={editPreserveBlockHeight && editMinHeightPxRef.current > 0 ? { minHeight: `${editMinHeightPxRef.current}px` } : undefined}
        >
          {editStaticChildren ? (
            <span className="pointer-events-none select-none block">{editStaticChildren}</span>
          ) : null}
          {editLeftRailClassName ? <span aria-hidden className={`pointer-events-none absolute left-0 top-0 bottom-0 w-1 z-20 ${editLeftRailClassName}`} /> : null}
          <span ref={bubbleAnchorRef} className="absolute w-px h-px" style={{ left: `${bubble.leftPx}px`, top: `${bubble.topPx}px` }} />
          <span ref={slashAnchorRef} className="absolute w-px h-px" style={{ left: `${slashMenu.leftPx}px`, top: `${slashMenu.topPx}px` }} />
          <span ref={linkAnchorRef} className="absolute w-px h-px" style={{ left: `${linkPopover.leftPx}px`, top: `${linkPopover.topPx}px` }} />

          {!editDisableRichUi && bubble.show ? (
            <AnchorOverlay anchorRef={bubbleAnchorRef} open={bubble.show} align="top-center" className={FLOATING_BUBBLE_TOOLBAR_CLASSNAME}>
              <menu
                ref={toolbarRef}
                className="list-none m-0 p-0 flex flex-wrap items-center gap-1"
                aria-label="Inline selection toolbar"
                onMouseDownCapture={() => {
                  toolbarInteractingRef.current = true
                }}
              >
            <details className="relative">
              <summary className={toolbarMenuSummaryClassName}>
                <Heading2 className="w-3 h-3" strokeWidth={1.6} />
              </summary>
              <menu className={toolbarMenuClassName} aria-label="Turn into menu">
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onClick={() => applyTurnInto('heading2')}>
                    <Heading2 className="w-3 h-3 mr-1" strokeWidth={1.6} />
                    H2
                  </button>
                </li>
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onClick={() => applyTurnInto('bulletList')}>
                    <List className="w-3 h-3 mr-1" strokeWidth={1.6} />
                    Bulleted list
                  </button>
                </li>
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onClick={() => applyTurnInto('numberedList')}>
                    <ListOrdered className="w-3 h-3 mr-1" strokeWidth={1.6} />
                    Numbered list
                  </button>
                </li>
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onClick={() => applyTurnInto('blockquote')}>
                    <Quote className="w-3 h-3 mr-1" strokeWidth={1.6} />
                    Quote
                  </button>
                </li>
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onClick={() => applyTurnInto('code')}>
                    <Code className="w-3 h-3 mr-1" strokeWidth={1.6} />
                    Code block
                  </button>
                </li>
                <li className={toolbarMenuDividerClassName} />
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onClick={() => applyToggleHeading(1)}>
                    <Heading2 className="w-3 h-3 mr-1" strokeWidth={1.6} />
                    H1
                  </button>
                </li>
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onClick={() => applyToggleHeading(2)}>
                    <Heading2 className="w-3 h-3 mr-1" strokeWidth={1.6} />
                    H2
                  </button>
                </li>
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onClick={() => applyToggleHeading(3)}>
                    <Heading2 className="w-3 h-3 mr-1" strokeWidth={1.6} />
                    H3
                  </button>
                </li>
              </menu>
            </details>
            <details className="relative">
              <summary className={toolbarMenuSummaryClassName}>
                <AlignLeft className="w-3 h-3" strokeWidth={1.8} />
              </summary>
              <menu className={toolbarMenuClassName} aria-label="Align menu">
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onClick={() => applyAlign('left')}>
                    Left
                  </button>
                </li>
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onClick={() => applyAlign('center')}>
                    Center
                  </button>
                </li>
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onClick={() => applyAlign('right')}>
                    Right
                  </button>
                </li>
              </menu>
            </details>
            <button
              type="button"
              className={FLOATING_BUBBLE_BUTTON_CLASSNAME}
              onMouseDown={event => event.preventDefault()}
              onClick={() => applyDraftAction('bold')}
              title="Bold"
            >
              <Bold className="w-3 h-3" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className={FLOATING_BUBBLE_BUTTON_CLASSNAME}
              onMouseDown={event => event.preventDefault()}
              onClick={() => applyDraftAction('inlineCode')}
              title="Code"
            >
              <Code className="w-3 h-3" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className={FLOATING_BUBBLE_BUTTON_CLASSNAME}
              onMouseDown={event => event.preventDefault()}
              onClick={() => applyDraftAction('italic')}
              title="Italic"
            >
              <Italic className="w-3 h-3" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className={FLOATING_BUBBLE_BUTTON_CLASSNAME}
              onMouseDown={event => event.preventDefault()}
              onClick={() => applyDraftAction('link')}
              title="Link"
            >
              <LinkIcon className="w-3 h-3" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className={FLOATING_BUBBLE_BUTTON_CLASSNAME}
              onMouseDown={event => event.preventDefault()}
              onClick={() => applyDraftAction('strike')}
              title="Strikethrough"
            >
              <Strikethrough className="w-3 h-3" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className={FLOATING_BUBBLE_BUTTON_CLASSNAME}
              onMouseDown={event => event.preventDefault()}
              onClick={() => applyWrap('<u>', '</u>')}
              title="Underline"
            >
              <Underline className="w-3 h-3" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className={FLOATING_BUBBLE_BUTTON_CLASSNAME}
              onMouseDown={event => event.preventDefault()}
              onClick={() => applyWrap('^', '^')}
              title="Superscript"
            >
              <Superscript className="w-3 h-3" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className={FLOATING_BUBBLE_BUTTON_CLASSNAME}
              onMouseDown={event => event.preventDefault()}
              onClick={() => applyWrap('~', '~')}
              title="Subscript"
            >
              <Subscript className="w-3 h-3" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className={FLOATING_BUBBLE_BUTTON_CLASSNAME}
              onMouseDown={event => event.preventDefault()}
              onClick={() => applyWrap('$', '$')}
              title="Math"
            >
              <span className="text-[10px] leading-none">∑</span>
            </button>
            <details className="relative">
              <summary className={toolbarMenuSummaryClassName} title="Highlight">
                <Highlighter className="w-3 h-3" strokeWidth={1.8} />
              </summary>
              <menu className={toolbarMenuClassName} aria-label="Highlight menu">
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onClick={() => applyWrap('==', '==')}>Color</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onClick={() => applyWrap('<mark>', '</mark>')}>Background</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ backgroundColor: '#fef08a' }} onClick={() => applyHighlightColor('#fef08a')}>Yellow</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ backgroundColor: '#bbf7d0' }} onClick={() => applyHighlightColor('#bbf7d0')}>Green</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ backgroundColor: '#bfdbfe' }} onClick={() => applyHighlightColor('#bfdbfe')}>Blue</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ backgroundColor: '#fbcfe8' }} onClick={() => applyHighlightColor('#fbcfe8')}>Pink</button></li>
              </menu>
            </details>
            <details className="relative">
              <summary className={toolbarMenuSummaryClassName} title="Text color">
                <Palette className="w-3 h-3" strokeWidth={1.8} />
              </summary>
              <menu className={toolbarMenuClassName} aria-label="Text color menu">
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ color: '#ef4444' }} onClick={() => applyColor('#ef4444')}>Red</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ color: '#10b981' }} onClick={() => applyColor('#10b981')}>Green</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ color: '#3b82f6' }} onClick={() => applyColor('#3b82f6')}>Blue</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ color: '#6b7280' }} onClick={() => applyColor('#6b7280')}>Gray</button></li>
              </menu>
            </details>
            <button
              type="button"
              className={FLOATING_BUBBLE_BUTTON_CLASSNAME}
              onMouseDown={event => event.preventDefault()}
              onClick={applyClearFormatting}
              title="Clear formatting"
            >
              <Eraser className="w-3 h-3" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className={FLOATING_BUBBLE_BUTTON_CLASSNAME}
              onMouseDown={event => event.preventDefault()}
              onClick={() => applyWrap('<!-- ', ' -->')}
              title="Comment"
            >
              <MessageSquare className="w-3 h-3" strokeWidth={1.8} />
            </button>
            <details className="relative">
              <summary className={toolbarMenuSummaryClassName} title="More">
                <MoreHorizontal className="w-3 h-3" strokeWidth={1.8} />
              </summary>
              <menu className={toolbarMenuClassName} aria-label="More actions">
                <li className="list-none"><button type="button" className={FLOATING_MENU_BUTTON_DISABLED_CLASSNAME} disabled>Copy</button></li>
                <li className="list-none"><button type="button" className={FLOATING_MENU_BUTTON_DISABLED_CLASSNAME} disabled>Copy link to block</button></li>
                <li className={toolbarMenuDividerClassName} />
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onMouseDown={event => event.preventDefault()} onClick={applyChecklist}>Checklist</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onMouseDown={event => event.preventDefault()} onClick={applyDivider}>Divider</button></li>
                <li className={toolbarMenuDividerClassName} />
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onMouseDown={event => event.preventDefault()} onClick={handleDuplicate}>Duplicate</button></li>
                <li className="list-none"><button type="button" className={FLOATING_MENU_BUTTON_DANGER_CLASSNAME} onMouseDown={event => event.preventDefault()} onClick={handleDelete}>Delete</button></li>
              </menu>
            </details>
              </menu>
            </AnchorOverlay>
          ) : null}
          <EditorTag
            ref={(node: HTMLElement | null) => {
              editorRef.current = node
            }}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            role="textbox"
            aria-multiline="true"
            aria-label="Edit markdown block"
            className={[
              editorClassName || 'w-full min-h-[24px] whitespace-pre-wrap break-words outline-none bg-transparent',
              htmlBlockEditing ? 'block' : '',
              htmlEditNormalizeClassName,
              htmlEditBlockFlowClassName,
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              ...(editTypographyMode === 'inherit'
                ? { font: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', color: 'inherit' }
                : {}),
              ...(editListMode
                ? { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
                : {}),
            }}
            onInput={(e) => {
              const el = editorRef.current
              if (!el) return
              const text = editPreserveWhitespace ? readEditorPlainText() : el.innerText.replace(/\r/g, '')
              draftRef.current = text
              if (editDisableRichUi) return
              const sel = typeof window !== 'undefined' ? window.getSelection() : null
              if (!sel || sel.rangeCount <= 0) return
              const range = sel.getRangeAt(0)
              const rect = range.getBoundingClientRect()
              const host = el.closest('[data-start-line]') as HTMLElement | null
              const hostRect = host?.getBoundingClientRect() || el.getBoundingClientRect()
              const leftPx = rect.left - hostRect.left
              const topPx = rect.bottom - hostRect.top + 6
              const offsets = getSelectionOffsets()
              const caretOffset = offsets?.startOffset ?? 0
              const lineStartIdx = text.lastIndexOf('\n', Math.max(0, caretOffset) - 1) + 1
              const preceding = text.slice(lineStartIdx, Math.max(lineStartIdx, Math.min(text.length, caretOffset)))
              if (/\/$/.test(preceding)) {
                setSlashMenuStable({ show: true, leftPx, topPx })
                setBubble(prev => (prev.show ? { ...prev, show: false } : prev))
              } else if (slashMenu.show) {
                setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 })
              }
            }}
            onCopy={(event) => {
              if (!forbidCopy) return
              event.preventDefault()
            }}
            onCut={(event) => {
              if (!forbidCopy) return
              event.preventDefault()
            }}
            onBlur={() => {
              if (toolbarInteractingRef.current) {
                toolbarInteractingRef.current = false
                queueMicrotask(() => editorRef.current?.focus())
                return
              }
              commit()
            }}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault()
                cancel()
                return
              }
              if (editDisableRichUi) {
                if (forbidCopy && (event.metaKey || event.ctrlKey)) {
                  const key = String(event.key || '').toLowerCase()
                  if (key === 'c' || key === 'x') {
                    event.preventDefault()
                    return
                  }
                }
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  commit()
                }
                return
              }
              if (event.key === 'Enter' && slashMenu.show) {
                event.preventDefault()
                return
              }
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                commit()
              }
              if (forbidCopy && (event.metaKey || event.ctrlKey)) {
                const key = String(event.key || '').toLowerCase()
                if (key === 'c' || key === 'x') {
                  event.preventDefault()
                  return
                }
              }
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault()
                const el = editorRef.current
                if (!el) return
                const sel = typeof window !== 'undefined' ? window.getSelection() : null
                if (!sel || sel.rangeCount <= 0) return
                const range = sel.getRangeAt(0)
                linkRangeRef.current = range.cloneRange()
                const rect = range.getBoundingClientRect()
                const host = el.closest('[data-start-line]') as HTMLElement | null
                const hostRect = host?.getBoundingClientRect() || el.getBoundingClientRect()
                const leftPx = rect.left - hostRect.left
                const topPx = rect.bottom - hostRect.top + 6
                setLinkPopover({ show: true, leftPx, topPx, href: '' })
                setBubble(prev => (prev.show ? { ...prev, show: false } : prev))
              }
            }}
          />
          {!editDisableRichUi && slashMenu.show ? (
            <AnchorOverlay anchorRef={slashAnchorRef} open={slashMenu.show} align="bottom-left" className={FLOATING_MENU_LEFT_W220_CLASSNAME}>
              <menu className="list-none m-0 p-0" aria-label="Slash commands" onMouseDownCapture={() => { toolbarInteractingRef.current = true }}>
                <li className="list-none"><button type="button" className={FLOATING_MENU_BUTTON_CLASSNAME} onClick={() => { applyDraftAction('heading2'); setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 }) }}>Heading</button></li>
                <li className="list-none"><button type="button" className={FLOATING_MENU_BUTTON_CLASSNAME} onClick={() => { applyDraftAction('bulletList'); setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 }) }}>Bulleted list</button></li>
                <li className="list-none"><button type="button" className={FLOATING_MENU_BUTTON_CLASSNAME} onClick={() => { applyDraftAction('numberedList'); setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 }) }}>Numbered list</button></li>
                <li className="list-none"><button type="button" className={FLOATING_MENU_BUTTON_CLASSNAME} onClick={() => { applyDraftAction('blockquote'); setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 }) }}>Quote</button></li>
                <li className="list-none"><button type="button" className={FLOATING_MENU_BUTTON_CLASSNAME} onClick={() => { applyToggleHeading(1); setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 }) }}>H1</button></li>
                <li className="list-none"><button type="button" className={FLOATING_MENU_BUTTON_CLASSNAME} onClick={() => { applyToggleHeading(2); setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 }) }}>H2</button></li>
                <li className="list-none"><button type="button" className={FLOATING_MENU_BUTTON_CLASSNAME} onClick={() => { applyToggleHeading(3); setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 }) }}>H3</button></li>
              </menu>
            </AnchorOverlay>
          ) : null}
          {!editDisableRichUi && linkPopover.show ? (
            <AnchorOverlay anchorRef={linkAnchorRef} open={linkPopover.show} align="bottom-left" className={FLOATING_POPOVER_PANEL_CLASSNAME}>
              <section onMouseDownCapture={() => { toolbarInteractingRef.current = true }} aria-label="Edit link">
              <form onSubmit={(e) => {
                e.preventDefault()
                const href = linkPopover.href.trim()
                if (!href) { setLinkPopover({ show: false, leftPx: 0, topPx: 0, href: '' }); return }
                if (editorPresentation === 'html') {
                  const root = editorRef.current
                  const sel = typeof window !== 'undefined' ? window.getSelection() : null
                  const r = linkRangeRef.current
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
                  setLinkPopover({ show: false, leftPx: 0, topPx: 0, href: '' })
                  queueMicrotask(() => editorRef.current?.focus())
                  return
                }
                const sel = getSelectionOffsets()
                const startOffset = sel?.startOffset ?? 0
                const endOffset = sel?.endOffset ?? 0
                if (startOffset === endOffset) { setLinkPopover({ show: false, leftPx: 0, topPx: 0, href: '' }); return }
                const text = getDraft()
                const a = Math.max(0, Math.min(text.length, startOffset))
                const b = Math.max(0, Math.min(text.length, endOffset))
                const start = Math.min(a, b)
                const end = Math.max(a, b)
                const label = text.slice(start, end)
                const nextText = `${text.slice(0, start)}[${label}](${href})${text.slice(end)}`
                const cursor = start + label.length + 3 + href.length
                setDraftToDom(nextText, { startOffset: cursor, endOffset: cursor })
                setLinkPopover({ show: false, leftPx: 0, topPx: 0, href: '' })
                queueMicrotask(() => editorRef.current?.focus())
              }}>
                <input
                  type="url"
                  autoFocus
                  placeholder="https://example.com"
                  className={FLOATING_POPOVER_INPUT_CLASSNAME}
                  value={linkPopover.href}
                  onChange={(e) => setLinkPopover(prev => ({ ...prev, href: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setLinkPopover({ show: false, leftPx: 0, topPx: 0, href: '' })
                      queueMicrotask(() => editorRef.current?.focus())
                    }
                  }}
                />
                <menu className="mt-2 flex gap-2">
                  <button type="submit" className={FLOATING_BUBBLE_BUTTON_CLASSNAME}>Apply</button>
                  <button type="button" className={FLOATING_BUBBLE_BUTTON_CLASSNAME} onClick={() => { setLinkPopover({ show: false, leftPx: 0, topPx: 0, href: '' }); queueMicrotask(() => editorRef.current?.focus()) }}>Cancel</button>
                </menu>
              </form>
              </section>
            </AnchorOverlay>
          ) : null}
        </span>
      ) : (
        children
      )}
    </Tag>
  )
})
