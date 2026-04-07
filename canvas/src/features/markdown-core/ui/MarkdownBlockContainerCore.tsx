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
import { MARKDOWN_INLINE_CODE_EDIT_DESCENDANT_CLASSES } from '@/features/markdown/ui/markdownInlineCodeParity'
import { areReplacementLinesNoop } from '@/features/markdown/ui/markdownEditParitySsot'
import { buildMarkdownSigil, parseMarkdownSigil, rewriteSigilSpansToInlineCodeHtml, unwrapDefaultHighlight } from '@/features/markdown/ui/markdownSigil'
import {
  captureSelectionForFloatingToolbar,
  preventDefaultMouseDown,
  preventDefaultPointerDown,
  toggleParentDetailsOpenFromSummaryClick,
} from '@/features/markdown/ui/markdownFloatingSelectionToolbar'
import {
  buildMarkdownVariableToken,
  collectMarkdownVariableBrowseRows,
  findMarkdownVariableTokenAtOffset,
} from '@/features/markdown/ui/markdownVariableReferences'

const MARKDOWN_EDIT_TYPOGRAPHY_SOURCE_SELECTOR =
  'h1,h2,h3,h4,h5,h6,p,li,blockquote,section,aside,div,span'

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
  editInlineFlow?: boolean
  editCaptureLayoutSpacing?: boolean
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
  editInlineFlow = false,
  editCaptureLayoutSpacing = true,
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
    lastNonCollapsedSelectionOffsetsRef.current = null
    lastNonCollapsedDomRangeRef.current = null
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
  const editDirtyRef = React.useRef(false)
  const editorRef = React.useRef<HTMLElement | null>(null)
  const editTypographySnapshotRef = React.useRef<React.CSSProperties | null>(null)
  const editSpacingSnapshotRef = React.useRef<React.CSSProperties | null>(null)
  const parityProbeSnapshotRef = React.useRef<{
    source: HTMLElement
    sourceMetrics: Record<string, string>
  } | null>(null)
  const initialEditorHtmlRef = React.useRef('')
  const initialPresentTextRef = React.useRef('')
  const editSessionIdRef = React.useRef(0)
  const editLinePrefixesRef = React.useRef<string[] | null>(null)
  const toolbarRef = React.useRef<HTMLElement | null>(null)
  const toolbarInteractingRef = React.useRef(false)
  const linkRangeRef = React.useRef<Range | null>(null)
  const lastNonCollapsedSelectionOffsetsRef = React.useRef<{ startOffset: number; endOffset: number } | null>(null)
  const lastNonCollapsedDomRangeRef = React.useRef<Range | null>(null)
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
      return v.replace(/[\u200B\u00A0\uFEFF]/g, '').trim().length === 0
    }
    const isBrElement = (n: Node | null): boolean => {
      if (!n || n.nodeType !== Node.ELEMENT_NODE) return false
      const tag = String((n as HTMLElement).tagName || '').toLowerCase()
      return tag === 'br'
    }
    const isEffectivelyEmptyBlockishElement = (el: Element, depth: number = 0): boolean => {
      if (depth > 5) return false
      const tag = String((el as HTMLElement).tagName || '').toLowerCase()
      if (tag !== 'div' && tag !== 'p' && tag !== 'section' && tag !== 'span') return false
      const text = String((el as HTMLElement).textContent || '').replace(/[\u200B\u00A0\uFEFF]/g, '').trim()
      if (text) return false
      const childEls = Array.from(el.children)
      if (childEls.length === 0) return true
      return childEls.every(c => {
        const childTag = String((c as HTMLElement).tagName || '').toLowerCase()
        if (childTag === 'br') return true
        return isEffectivelyEmptyBlockishElement(c, depth + 1)
      })
    }
    const isEmptyBlockElement = (el: Element): boolean => isEffectivelyEmptyBlockishElement(el, 0)

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
    const hasAnyList = !rootIsList && Array.from(root.children).some(e => {
      const tag = String(e.tagName || '').toLowerCase()
      return tag === 'ul' || tag === 'ol'
    })
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
    if (onlyList || rootIsList || hasAnyList) {
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
      const listNodes = rootIsList
        ? [root as HTMLElement]
        : (Array.from(root.querySelectorAll('ol, ul')) as HTMLElement[])
      for (const anyList of listNodes) {
        anyList.style.marginTop = '0px'
        anyList.style.marginBottom = '0px'
        anyList.style.paddingTop = '0px'
        anyList.style.paddingBottom = '0px'
        const prev = anyList.previousElementSibling as HTMLElement | null
        if (prev) {
          const prevTag = String(prev.tagName || '').toLowerCase()
          if (prevTag === 'ol' || prevTag === 'ul') anyList.style.marginTop = '0px'
        }
      }
      const unwrapSingleListWrappers = () => {
        let localChanged = false
        const children = Array.from(root.children) as HTMLElement[]
        for (const child of children) {
          const tag = String(child.tagName || '').toLowerCase()
          if (tag !== 'div' && tag !== 'p' && tag !== 'section' && tag !== 'span') continue
          const childNodes = Array.from(child.childNodes)
          const elementChildren = childNodes.filter(n => n.nodeType === Node.ELEMENT_NODE) as HTMLElement[]
          const listChildren = elementChildren.filter(el => {
            const t = String(el.tagName || '').toLowerCase()
            return t === 'ol' || t === 'ul'
          })
          if (listChildren.length !== 1) continue
          const hasMeaningfulNonList = childNodes.some(n => {
            if (n.nodeType === Node.TEXT_NODE) {
              const text = String((n as Text).nodeValue || '').replace(/[\u200B\u00A0\uFEFF]/g, '').trim()
              return text.length > 0
            }
            if (n.nodeType !== Node.ELEMENT_NODE) return false
            const t = String((n as HTMLElement).tagName || '').toLowerCase()
            if (t === 'ol' || t === 'ul' || t === 'br') return false
            return !isEmptyBlockElement(n as Element)
          })
          if (hasMeaningfulNonList) continue
          const listChild = listChildren[0]
          child.parentNode?.insertBefore(listChild, child)
          child.remove()
          localChanged = true
        }
        if (localChanged) changed = true
      }
      if (!rootIsList) unwrapSingleListWrappers()
      const normalizeListAncestorSpacing = () => {
        let localChanged = false
        const lists = Array.from(root.querySelectorAll('ol, ul')) as HTMLElement[]
        for (const listNode of lists) {
          let parent = listNode.parentElement
          while (parent && parent !== root) {
            const tag = String(parent.tagName || '').toLowerCase()
            if (tag === 'div' || tag === 'p' || tag === 'section' || tag === 'span') {
              if (parent.style.marginTop !== '0px') {
                parent.style.marginTop = '0px'
                localChanged = true
              }
              if (parent.style.marginBottom !== '0px') {
                parent.style.marginBottom = '0px'
                localChanged = true
              }
              if (parent.style.paddingTop !== '0px') {
                parent.style.paddingTop = '0px'
                localChanged = true
              }
              if (parent.style.paddingBottom !== '0px') {
                parent.style.paddingBottom = '0px'
                localChanged = true
              }
            }
            parent = parent.parentElement
          }
        }
        if (localChanged) changed = true
      }
      if (!rootIsList) normalizeListAncestorSpacing()

      const stripEmptyNodesBetweenSiblingLists = () => {
        const isListEl = (n: Node | null): n is HTMLElement => {
          if (!n || n.nodeType !== Node.ELEMENT_NODE) return false
          const tag = String((n as HTMLElement).tagName || '').toLowerCase()
          return tag === 'ol' || tag === 'ul'
        }
        const isEmptyBetween = (n: Node | null): boolean => {
          if (!n) return false
          if (n.nodeType === Node.COMMENT_NODE) return true
          if (isWhitespaceText(n)) return true
          if (isBrElement(n)) return true
          if (n.nodeType === Node.ELEMENT_NODE) return isEmptyBlockElement(n as Element)
          return false
        }

        let localChanged = false
        const lists = Array.from(root.querySelectorAll('ol, ul')) as HTMLElement[]
        for (const listEl of lists) {
          let node: Node | null = listEl.nextSibling
          const toRemove: Node[] = []
          while (node && isEmptyBetween(node)) {
            toRemove.push(node)
            node = node.nextSibling
          }
          if (!node) continue
          if (!isListEl(node)) continue
          if (node.parentNode !== listEl.parentNode) continue
          for (const n of toRemove) {
            if (n.parentNode) n.parentNode.removeChild(n)
            localChanged = true
          }
        }
        if (localChanged) changed = true
      }

      if (!rootIsList) {
        stripEmptyNodesBetweenSiblingLists()
      }
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
          const listRootCount = elems.filter(e => {
            const tag = String((e as HTMLElement).tagName || '').toLowerCase()
            return tag === 'ul' || tag === 'ol'
          }).length
          if (listRootCount > 1) return false
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
        const text = String((li as HTMLElement).textContent || '').replace(/[\u200B\u00A0\uFEFF]/g, '').trim()
        if (text) return false
        const childEls = Array.from(li.children)
        if (childEls.length === 0) return true
        const okChild = (el: Element): boolean => {
          const t = String((el as HTMLElement).tagName || '').toLowerCase()
          if (t === 'br') return true
          if (t === 'p' || t === 'div') {
            const innerText = String((el as HTMLElement).textContent || '').replace(/[\u200B\u00A0\uFEFF]/g, '').trim()
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
            const v = String((node as Text).nodeValue || '').replace(/[\u200B\u00A0\uFEFF]/g, '').trim()
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
    if (edgeTrimRafRef.current) return
    let framesLeft = editListMode ? 3 : 6
    let stableFrames = 0
    const tick = () => {
      edgeTrimRafRef.current = 0
      if (!editing) return
      const changed = trimEmptyEditableEdges()
      if (changed) stableFrames = 0
      else stableFrames += 1
      framesLeft -= 1
      if (framesLeft <= 0) return
      if (stableFrames >= (editListMode ? 1 : 2)) return
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
  }, [buildMarkdownSigil, parseMarkdownSigil])

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

  const readSelectionOffsetsForFormatting = React.useCallback((): { startOffset: number; endOffset: number } | null => {
    const selection = getSelectionOffsets()
    if (selection && selection.startOffset !== selection.endOffset) {
      lastNonCollapsedSelectionOffsetsRef.current = selection
      return selection
    }
    return lastNonCollapsedSelectionOffsetsRef.current
  }, [getSelectionOffsets])

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

  const applySigilToHtmlSelection = React.useCallback((args: { color?: string; background?: string }) => {
    const root = editorRef.current
    if (!root) return
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel) return

    const pickRange = (): Range | null => {
      if (sel.rangeCount > 0) {
        const r = sel.getRangeAt(0)
        const c = r.commonAncestorContainer
        const n = c.nodeType === Node.ELEMENT_NODE ? (c as Element) : c.parentElement
        if (n && root.contains(n) && !r.collapsed) return r
      }
      const last = lastNonCollapsedDomRangeRef.current
      if (!last || last.collapsed) return null
      const c = last.commonAncestorContainer
      const n = c.nodeType === Node.ELEMENT_NODE ? (c as Element) : c.parentElement
      if (!n || !root.contains(n)) return null
      try {
        sel.removeAllRanges()
        sel.addRange(last)
      } catch {
        return null
      }
      return last
    }

    const range = pickRange()
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

    const existingSpan = (node.closest('[data-kg-sigil="1"]') as HTMLElement | null)
    const withinSingleSigilSpan = !!existingSpan && existingSpan.contains(range.startContainer) && existingSpan.contains(range.endContainer)
    if (withinSingleSigilSpan) {
      const nextColor = args.color || existingSpan.getAttribute('data-kg-sigil-color')
      const nextBg = args.background || existingSpan.getAttribute('data-kg-sigil-bg')
      if (nextColor) existingSpan.setAttribute('data-kg-sigil-color', nextColor)
      else existingSpan.removeAttribute('data-kg-sigil-color')
      if (nextBg) existingSpan.setAttribute('data-kg-sigil-bg', nextBg)
      else existingSpan.removeAttribute('data-kg-sigil-bg')
      applySpanStyle(existingSpan)
      queueMicrotask(() => editorRef.current?.focus())
      return
    }

    const codeNode = (node.closest('code') as HTMLElement | null)
    const withinSingleCode = !!codeNode && codeNode.contains(range.startContainer) && codeNode.contains(range.endContainer)
    if (withinSingleCode) {
      const parsed = parseMarkdownSigil(String(codeNode?.textContent || ''))
      if (!parsed) return
      const nextColor = args.color ?? parsed.color
      const nextBg = args.background ?? parsed.background
      const span = document.createElement('span')
      span.setAttribute('data-kg-sigil', '1')
      if (nextColor) span.setAttribute('data-kg-sigil-color', nextColor)
      if (nextBg) span.setAttribute('data-kg-sigil-bg', nextBg)
      span.textContent = parsed.text
      applySpanStyle(span)
      codeNode.replaceWith(span)
      queueMicrotask(() => editorRef.current?.focus())
      return
    }

    const text = range.toString()
    if (!text) return
    const nextColor = args.color ?? null
    const nextBg = args.background ?? null
    const frag = range.extractContents()
    const span = document.createElement('span')
    span.setAttribute('data-kg-sigil', '1')
    if (nextColor) span.setAttribute('data-kg-sigil-color', nextColor)
    if (nextBg) span.setAttribute('data-kg-sigil-bg', nextBg)
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
    queueMicrotask(() => editorRef.current?.focus())
  }, [parseMarkdownSigil])

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

  const buildReplacementLinesFromDraft = React.useCallback((draft: string): string[] => {
    const replacementLines = String(draft || '').split(/\r?\n/)
    const prefixes = editLinePrefixesRef.current
    if (!editStripLinePrefix || !prefixes) return replacementLines
    const quotePrefixPattern = /^\s*(?:>\s*)+$/
    const allQuotePrefixed = (() => {
      if (prefixes.length === 0) return false
      let hasQuotePrefix = false
      for (let i = 0; i < prefixes.length; i += 1) {
        const prefix = String(prefixes[i] || '')
        if (quotePrefixPattern.test(prefix)) {
          hasQuotePrefix = true
          continue
        }
        const line = String(replacementLines[i] || '')
        if (!prefix && !line.trim()) continue
        return false
      }
      return hasQuotePrefix
    })()
    const baselinePresentLines = String(initialPresentTextRef.current || '').split(/\r?\n/)
    const normalizedReplacementLines = (
      allQuotePrefixed && replacementLines.length < prefixes.length
        ? [
            ...replacementLines,
            ...Array.from({ length: prefixes.length - replacementLines.length }, (_, i) => (
              baselinePresentLines[replacementLines.length + i] ?? ''
            )),
          ]
        : replacementLines
    )
    const defaultPrefix = editDefaultLinePrefix ?? prefixes.find(p => p) ?? ''
    return normalizedReplacementLines.map((line, i) => {
      const prefix = prefixes[i] ?? defaultPrefix
      if (!line.trim()) {
        if (/^\s*(?:>\s*)+$/.test(prefix) || /^\s*(?:>\s*)+$/.test(defaultPrefix)) {
          const p = prefix || defaultPrefix
          return p.trimEnd() || '>'
        }
        return ''
      }
      if (!prefix) return line
      if (line.startsWith(prefix)) return line
      const taskPrefixMatch = prefix.match(/^(\s*[-*+]\s+\[(?: |x|X)?\]\s+)$/)
      if (taskPrefixMatch) {
        const isBulletWithoutTask = /^\s*[-*+]\s+(?!\[(?: |x|X)?\]\s+)/.test(line)
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

  const applyTurnInto = React.useCallback((next: string) => {
    const applyTransformAndCommit = (action: MarkdownFormatAction | 'codeBlock' | 'heading1' | 'heading3') => {
      if (!editable || !onReplaceLineRange) return
      const root = editorRef.current
      const currentText = root ? readEditorPlainText() : getDraft()
      const nextText = (() => {
        if (action === 'codeBlock') {
          const lines = String(currentText || '').split(/\r?\n/)
          return ['```', ...lines, '```'].join('\n')
        }
        if (action === 'heading1' || action === 'heading3') {
          const level = action === 'heading1' ? 1 : 3
          const hashes = '#'.repeat(level) + ' '
          const lines = String(currentText || '').split(/\r?\n/)
          const allHave = lines.every(l => !l.trim() || l.startsWith(hashes))
          return lines
            .map(l => {
              if (!l.trim()) return l
              if (allHave) return l.startsWith(hashes) ? l.slice(hashes.length) : l
              if (/^#{1,6}\s+/.test(l)) return l.replace(/^#{1,6}\s+/, hashes)
              return `${hashes}${l}`
            })
            .join('\n')
        }
        const res = applyMarkdownFormatAction({
          text: String(currentText || ''),
          selection: { startOffset: 0, endOffset: String(currentText || '').length },
          action,
        })
        return res.nextText
      })()

      const replacementLines = buildReplacementLinesFromDraft(nextText)
      if (areReplacementLinesNoop({ sourceLines, startLine: editStartLine, endLine: editEndLine, replacementLines })) {
        setEditing(false)
        setSessionEditLineRange(null)
        return
      }
      onReplaceLineRange({ startLine: editStartLine, endLine: editEndLine, replacementLines })
      setEditing(false)
      setSessionEditLineRange(null)
    }

    if (next === 'none') return
    if (next === 'heading2') {
      if (editorPresentation === 'html') {
        applyTransformAndCommit('heading2')
        return
      }
      applyDraftAction('heading2')
      return
    }
    if (next === 'bulletList') {
      if (editorPresentation === 'html') {
        applyTransformAndCommit('bulletList')
        return
      }
      applyDraftAction('bulletList')
      return
    }
    if (next === 'numberedList') {
      if (editorPresentation === 'html') {
        applyTransformAndCommit('numberedList')
        return
      }
      applyDraftAction('numberedList')
      return
    }
    if (next === 'blockquote') {
      if (editorPresentation === 'html') {
        applyTransformAndCommit('blockquote')
        return
      }
      applyDraftAction('blockquote')
      return
    }
    if (next === 'code') {
      if (editorPresentation === 'html') {
        applyTransformAndCommit('codeBlock')
        return
      }
      const lines = String(getDraft() || '').split(/\r?\n/)
      const nextText = ['```', ...lines, '```'].join('\n')
      setDraftToDom(nextText)
      queueMicrotask(() => editorRef.current?.focus())
    }
  }, [buildReplacementLinesFromDraft, editable, editEndLine, editStartLine, editorPresentation, getDraft, onReplaceLineRange, readEditorPlainText, setDraftToDom, sourceLines])
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
    if (editorPresentation === 'html') {
      if (!editable || !onReplaceLineRange) return
      const root = editorRef.current
      const currentText = root ? readEditorPlainText() : getDraft()
      const hashes = '#'.repeat(level) + ' '
      const lines = String(currentText || '').split(/\r?\n/)
      const allHave = lines.every(l => !l.trim() || l.startsWith(hashes))
      const nextText = lines
        .map(l => {
          if (!l.trim()) return l
          if (allHave) return l.startsWith(hashes) ? l.slice(hashes.length) : l
          if (/^#{1,6}\s+/.test(l)) return l.replace(/^#{1,6}\s+/, hashes)
          return `${hashes}${l}`
        })
        .join('\n')
      const replacementLines = buildReplacementLinesFromDraft(nextText)
      if (areReplacementLinesNoop({ sourceLines, startLine: editStartLine, endLine: editEndLine, replacementLines })) {
        setEditing(false)
        setSessionEditLineRange(null)
        return
      }
      onReplaceLineRange({ startLine: editStartLine, endLine: editEndLine, replacementLines })
      setEditing(false)
      setSessionEditLineRange(null)
      return
    }
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
  }, [buildReplacementLinesFromDraft, editable, editEndLine, editStartLine, editorPresentation, getDraft, getSelectionOffsets, onReplaceLineRange, readEditorPlainText, setDraftToDom, sourceLines])
  const applyColor = React.useCallback((color: string) => {
    if (editorPresentation === 'html') {
      applySigilToHtmlSelection({ color })
      return
    }
    const sel = readSelectionOffsetsForFormatting()
    const startOffset = sel?.startOffset ?? 0
    const endOffset = sel?.endOffset ?? 0
    if (startOffset === endOffset) return
    const text = getDraft()
    const a = Math.max(0, Math.min(text.length, startOffset))
    const b = Math.max(0, Math.min(text.length, endOffset))
    const start = Math.min(a, b)
    const end = Math.max(a, b)
    const selected = text.slice(start, end)
    const unwrapped = unwrapDefaultHighlight(selected)
    const parsed = parseMarkdownSigil(unwrapped.text)
    const nextSelected = buildMarkdownSigil({
      text: parsed ? parsed.text : unwrapped.text,
      color,
      background: parsed?.background ?? null,
    })
    const wrappedSelected = unwrapped.wrapped ? `==${nextSelected}==` : nextSelected
    const nextText = `${text.slice(0, start)}${wrappedSelected}${text.slice(end)}`
    const nextStart = start + (unwrapped.wrapped ? 2 : 0)
    const nextEnd = nextStart + nextSelected.length
    setDraftToDom(nextText, { startOffset: nextStart, endOffset: nextEnd })
    queueMicrotask(() => editorRef.current?.focus())
  }, [applySigilToHtmlSelection, editorPresentation, getDraft, readSelectionOffsetsForFormatting, setDraftToDom])
  const applyHighlightColor = React.useCallback((color: string) => {
    if (editorPresentation === 'html') {
      applySigilToHtmlSelection({ background: color })
      return
    }
    const sel = readSelectionOffsetsForFormatting()
    const startOffset = sel?.startOffset ?? 0
    const endOffset = sel?.endOffset ?? 0
    if (startOffset === endOffset) return
    const text = getDraft()
    const a = Math.max(0, Math.min(text.length, startOffset))
    const b = Math.max(0, Math.min(text.length, endOffset))
    const start = Math.min(a, b)
    const end = Math.max(a, b)
    const selected = text.slice(start, end)
    const unwrapped = unwrapDefaultHighlight(selected)
    const parsed = parseMarkdownSigil(unwrapped.text)
    const nextSelected = buildMarkdownSigil({
      text: parsed ? parsed.text : unwrapped.text,
      color: parsed?.color ?? null,
      background: color,
    })
    const wrappedSelected = unwrapped.wrapped ? `==${nextSelected}==` : nextSelected
    const nextText = `${text.slice(0, start)}${wrappedSelected}${text.slice(end)}`
    const nextStart = start + (unwrapped.wrapped ? 2 : 0)
    const nextEnd = nextStart + nextSelected.length
    setDraftToDom(nextText, { startOffset: nextStart, endOffset: nextEnd })
    queueMicrotask(() => editorRef.current?.focus())
  }, [applySigilToHtmlSelection, editorPresentation, getDraft, readSelectionOffsetsForFormatting, setDraftToDom])
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
    selected = selected.replace(/^`(#[0-9a-fA-F]{6})?(\|?bg#[0-9a-fA-F]{6})?:(.+)`$/g, '$3')
    selected = selected.replace(/^==`(#[0-9a-fA-F]{6})?(\|?bg#[0-9a-fA-F]{6})?:(.+)`==$/g, '$3')
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
      const root = editorRef.current
      const hasDomMutation = !!root && root.innerHTML !== initialEditorHtmlRef.current
      if (!editDirtyRef.current) {
        if (hasDomMutation) {
          editDirtyRef.current = true
        } else {
          setEditing(false)
          setSessionEditLineRange(null)
          return
        }
      }
      if (!root) {
        setEditing(false)
        setSessionEditLineRange(null)
        return
      }
      const sessionId = editSessionIdRef.current
      setEditing(false)
      const html = rewriteSigilSpansToInlineCodeHtml(root.innerHTML)
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
        if (areReplacementLinesNoop({ sourceLines, startLine: editStartLine, endLine: editEndLine, replacementLines })) {
          setSessionEditLineRange(null)
          return
        }
        onReplaceLineRange({ startLine: editStartLine, endLine: editEndLine, replacementLines })
        setSessionEditLineRange(null)
      })()
      return
    }
    const draft = getDraft()
    if (draft === initialText) {
      setEditing(false)
      setSessionEditLineRange(null)
      return
    }
    const replacementLines = buildReplacementLinesFromDraft(draft)
    if (areReplacementLinesNoop({ sourceLines, startLine: editStartLine, endLine: editEndLine, replacementLines })) {
      setEditing(false)
      setSessionEditLineRange(null)
      return
    }
    onReplaceLineRange({ startLine: editStartLine, endLine: editEndLine, replacementLines })
    setEditing(false)
    setSessionEditLineRange(null)
  }, [editable, editEndLine, editListMode, editStartLine, editorPresentation, getDraft, initialText, onReplaceLineRange, sourceLines, buildReplacementLinesFromDraft])
  const cancel = React.useCallback(() => {
    setEditing(false)
    setSessionEditLineRange(null)
  }, [])
  const lastPointerRef = React.useRef<{ x: number; y: number } | null>(null)
  const openEditor = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!editable) return
    const target = event.target as HTMLElement | null
    if (target?.closest('button,a,input,select,textarea,[contenteditable="true"]')) return
    try {
      const baseNode = target && event.currentTarget.contains(target) ? target : event.currentTarget
      const typographySource =
        baseNode.closest(MARKDOWN_EDIT_TYPOGRAPHY_SOURCE_SELECTOR) as HTMLElement | null
      const sourceSurface = typographySource || event.currentTarget
      const computed = window.getComputedStyle(sourceSurface)
      editTypographySnapshotRef.current = {
        fontFamily: computed.fontFamily || undefined,
        fontSize: computed.fontSize || undefined,
        fontWeight: computed.fontWeight || undefined,
        fontStyle: computed.fontStyle || undefined,
        lineHeight: computed.lineHeight || undefined,
        letterSpacing: computed.letterSpacing || undefined,
        color: computed.color || undefined,
      }
      editSpacingSnapshotRef.current = editCaptureLayoutSpacing
        ? {
            textAlign: (computed.textAlign || undefined) as React.CSSProperties['textAlign'],
            wordSpacing: computed.wordSpacing || undefined,
            textIndent: computed.textIndent || undefined,
            paddingTop: computed.paddingTop || undefined,
            paddingRight: computed.paddingRight || undefined,
            paddingBottom: computed.paddingBottom || undefined,
            paddingLeft: computed.paddingLeft || undefined,
            marginTop: computed.marginTop || undefined,
            marginRight: computed.marginRight || undefined,
            marginBottom: computed.marginBottom || undefined,
            marginLeft: computed.marginLeft || undefined,
            borderTopWidth: computed.borderTopWidth || undefined,
            borderRightWidth: computed.borderRightWidth || undefined,
            borderBottomWidth: computed.borderBottomWidth || undefined,
            borderLeftWidth: computed.borderLeftWidth || undefined,
            borderTopStyle: (computed.borderTopStyle || undefined) as React.CSSProperties['borderTopStyle'],
            borderRightStyle: (computed.borderRightStyle || undefined) as React.CSSProperties['borderRightStyle'],
            borderBottomStyle: (computed.borderBottomStyle || undefined) as React.CSSProperties['borderBottomStyle'],
            borderLeftStyle: (computed.borderLeftStyle || undefined) as React.CSSProperties['borderLeftStyle'],
            borderTopColor: computed.borderTopColor || undefined,
            borderRightColor: computed.borderRightColor || undefined,
            borderBottomColor: computed.borderBottomColor || undefined,
            borderLeftColor: computed.borderLeftColor || undefined,
            borderRadius: computed.borderRadius || undefined,
            boxSizing: computed.boxSizing || undefined,
            backgroundColor: computed.backgroundColor || undefined,
            caretColor: computed.caretColor || undefined,
          } as React.CSSProperties
        : null
      const probeKeys: Array<keyof CSSStyleDeclaration> = [
        'fontFamily',
        'fontSize',
        'fontWeight',
        'fontStyle',
        'lineHeight',
        'letterSpacing',
        'color',
        'textAlign',
        'wordSpacing',
        'textIndent',
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'marginTop',
        'marginRight',
        'marginBottom',
        'marginLeft',
        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'borderLeftWidth',
        'borderTopStyle',
        'borderRightStyle',
        'borderBottomStyle',
        'borderLeftStyle',
        'borderTopColor',
        'borderRightColor',
        'borderBottomColor',
        'borderLeftColor',
        'borderRadius',
        'boxSizing',
        'backgroundColor',
        'caretColor',
      ]
      const sourceMetrics = Object.fromEntries(
        probeKeys.map(key => [String(key), String(computed[key] || '')]),
      )
      parityProbeSnapshotRef.current = {
        source: sourceSurface,
        sourceMetrics,
      }
    } catch {
      editTypographySnapshotRef.current = null
      editSpacingSnapshotRef.current = null
      parityProbeSnapshotRef.current = null
    }
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
  }, [editable, editCaptureLayoutSpacing, resolveEditLineRangeOnOpen, resolveEditMinHeightOnOpen])
  const emitParityProbe = React.useCallback(() => {
    const probe = parityProbeSnapshotRef.current
    const editor = editorRef.current
    if (!probe || !editor) return
    const probeEnabled = (() => {
      try {
        const w = window as unknown as { __KG_EDIT_PARITY_PROBE__?: boolean }
        if (w.__KG_EDIT_PARITY_PROBE__ === true) return true
        const query = new URLSearchParams(window.location.search || '')
        return query.get('kgEditParityProbe') === '1'
      } catch {
        return false
      }
    })()
    if (!probeEnabled) return
    try {
      const read = probe.sourceMetrics
      const edit = window.getComputedStyle(editor)
      const keys: Array<keyof CSSStyleDeclaration> = [
        'fontFamily',
        'fontSize',
        'fontWeight',
        'fontStyle',
        'lineHeight',
        'letterSpacing',
        'color',
        'textAlign',
        'wordSpacing',
        'textIndent',
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'marginTop',
        'marginRight',
        'marginBottom',
        'marginLeft',
        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'borderLeftWidth',
        'borderTopStyle',
        'borderRightStyle',
        'borderBottomStyle',
        'borderLeftStyle',
        'borderTopColor',
        'borderRightColor',
        'borderBottomColor',
        'borderLeftColor',
        'borderRadius',
        'boxSizing',
        'backgroundColor',
        'caretColor',
      ]
      const mismatches = keys
        .map(key => ({ key, read: String(read[String(key)] || ''), edit: String(edit[key] || '') }))
        .filter(row => row.read !== row.edit)
      const payload = {
        startLine: editStartLine,
        endLine: editEndLine,
        mismatches,
      }
      const w = window as unknown as {
        __KG_EDIT_PARITY_LAST_MISMATCH__?: unknown
        __KG_EDIT_PARITY_LAST_PAYLOAD__?: unknown
        __KG_EDIT_PARITY_MISMATCH_COUNT__?: number
      }
      w.__KG_EDIT_PARITY_LAST_PAYLOAD__ = payload
      if (mismatches.length > 0) {
        w.__KG_EDIT_PARITY_LAST_MISMATCH__ = payload
        w.__KG_EDIT_PARITY_MISMATCH_COUNT__ = Number(w.__KG_EDIT_PARITY_MISMATCH_COUNT__ || 0) + 1
      }
      window.dispatchEvent(new CustomEvent('kg-edit-parity-probe', { detail: payload }))
      if (mismatches.length > 0) {
        console.warn('kg-edit-parity-probe', payload)
      }
      console.warn(`kg-edit-parity-probe-json ${JSON.stringify(payload)}`)
    } catch {
      void 0
    }
  }, [editEndLine, editStartLine])

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
  const [variableMenu, setVariableMenu] = React.useState<{
    show: boolean
    leftPx: number
    topPx: number
    query: string
    keyInput: string
    valueInput: string
    fallbackInput: string
    mode: 'ref' | 'create' | 'update' | 'fallback'
  }>({
    show: false,
    leftPx: 0,
    topPx: 0,
    query: '',
    keyInput: '',
    valueInput: '',
    fallbackInput: '',
    mode: 'ref',
  })
  const [linkPopover, setLinkPopover] = React.useState<{ show: boolean; leftPx: number; topPx: number; href: string }>({ show: false, leftPx: 0, topPx: 0, href: '' })
  const bubbleAnchorRef = React.useRef<HTMLSpanElement | null>(null)
  const slashAnchorRef = React.useRef<HTMLSpanElement | null>(null)
  const variableAnchorRef = React.useRef<HTMLSpanElement | null>(null)
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
  const setVariableMenuStable = React.useCallback((next: {
    show: boolean
    leftPx: number
    topPx: number
    query?: string
    keyInput?: string
  }) => {
    setVariableMenu(prev => {
      const query = typeof next.query === 'string' ? next.query : prev.query
      const keyInput = typeof next.keyInput === 'string' ? next.keyInput : prev.keyInput
      if (
        prev.show === next.show &&
        Math.abs(prev.leftPx - next.leftPx) < 1 &&
        Math.abs(prev.topPx - next.topPx) < 1 &&
        prev.query === query &&
        prev.keyInput === keyInput
      ) return prev
      return { ...prev, show: next.show, leftPx: next.leftPx, topPx: next.topPx, query, keyInput }
    })
  }, [])
  const applyVariableFrontmatterCrud = React.useCallback((mode: 'create' | 'update' | 'delete', keyRaw: string, valueRaw?: string) => {
    if (!editable || !onReplaceLineRange || !Array.isArray(sourceLines)) return false
    const key = String(keyRaw || '').trim()
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(key)) return false
    const value = String(valueRaw || '').trim()
    if ((mode === 'create' || mode === 'update') && !value) return false
    const lines = sourceLines.slice()
    const hasFrontmatter = (lines[0] || '').trim() === '---'
    let fmEndIdx = -1
    if (hasFrontmatter) {
      for (let i = 1; i < lines.length; i += 1) {
        if ((lines[i] || '').trim() === '---') {
          fmEndIdx = i
          break
        }
      }
    }
    const quotedValue = `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    const keyEscaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const keyPattern = new RegExp(`^\\s*${keyEscaped}\\s*:`)
    if (hasFrontmatter && fmEndIdx > 0) {
      const fmBody = lines.slice(1, fmEndIdx)
      let replaced = false
      const nextBody = fmBody
        .map((line) => {
          if (!keyPattern.test(line)) return line
          replaced = true
          if (mode === 'delete') return ''
          return `${key}: ${quotedValue}`
        })
        .filter(line => String(line || '').trim().length > 0)
      if ((mode === 'create' || mode === 'update') && !replaced) nextBody.push(`${key}: ${quotedValue}`)
      const frontmatterLines = ['---', ...nextBody, '---']
      onReplaceLineRange({ startLine: 1, endLine: fmEndIdx + 1, replacementLines: frontmatterLines })
    } else if (lines.length > 0) {
      if (mode === 'delete') return false
      const frontmatterLines = ['---', `${key}: ${quotedValue}`, '---']
      onReplaceLineRange({
        startLine: 1,
        endLine: 1,
        replacementLines: [...frontmatterLines, '', lines[0] || ''],
      })
    } else {
      if (mode === 'delete') return false
      const frontmatterLines = ['---', `${key}: ${quotedValue}`, '---']
      onReplaceLineRange({
        startLine: Math.max(1, editStartLine),
        endLine: Math.max(1, editStartLine),
        replacementLines: [...frontmatterLines, ''],
      })
    }
    setVariableMenu(prev => ({ ...prev, show: false, keyInput: key, query: '', mode: 'ref' }))
    setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 })
    setEditing(false)
    setSessionEditLineRange(null)
    return true
  }, [editStartLine, editable, onReplaceLineRange, setSlashMenuStable, sourceLines])
  const applyVariableToken = React.useCallback((mode: 'ref' | 'create' | 'update' | 'fallback' | 'delete') => {
    if (mode === 'delete') {
      const keyFromState = String(variableMenu.keyInput || variableMenu.query || '').trim()
      if (!applyVariableFrontmatterCrud('delete', keyFromState)) return
      return
    }
    if (mode === 'create' || mode === 'update') {
      const keyFromState = String(variableMenu.keyInput || variableMenu.query || '').trim()
      if (!applyVariableFrontmatterCrud(mode, keyFromState, variableMenu.valueInput)) return
      return
    }
    const text = getDraft()
    const selection = getSelectionOffsets()
    const startOffset = selection?.startOffset ?? 0
    const endOffset = selection?.endOffset ?? 0
    const a = Math.max(0, Math.min(text.length, startOffset))
    const b = Math.max(0, Math.min(text.length, endOffset))
    const start = Math.min(a, b)
    const end = Math.max(a, b)
    const atCaretToken = findMarkdownVariableTokenAtOffset({ text, offset: end })
    const keyFromState = String(variableMenu.keyInput || variableMenu.query || '').trim()
    const keyFromToken = atCaretToken?.key || ''
    const key = keyFromState || keyFromToken
    const nextToken = buildMarkdownVariableToken({
      mode,
      key,
      value: variableMenu.valueInput,
      fallback: variableMenu.fallbackInput,
    })
    if (!nextToken) return
    const lineStartIdx = text.lastIndexOf('\n', Math.max(0, end) - 1) + 1
    const preceding = text.slice(lineStartIdx, Math.max(lineStartIdx, Math.min(text.length, end)))
    const atQueryMatch = /@([A-Za-z0-9_.-]{0,64})$/.exec(preceding)
    const atQueryStart = atQueryMatch ? end - atQueryMatch[0].length : -1
    const rangeStart = start !== end
      ? start
      : atCaretToken
      ? atCaretToken.start
      : atQueryMatch
      ? atQueryStart
      : end
    const rangeEnd = start !== end
      ? end
      : atCaretToken
      ? atCaretToken.end
      : end
    const nextText = `${text.slice(0, Math.max(0, rangeStart))}${nextToken}${text.slice(Math.max(0, rangeEnd))}`
    const cursor = Math.max(0, rangeStart) + nextToken.length
    setDraftToDom(nextText, { startOffset: cursor, endOffset: cursor })
    setVariableMenu(prev => ({ ...prev, show: false, query: '', keyInput: key, mode: 'ref' }))
    setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 })
    queueMicrotask(() => editorRef.current?.focus())
  }, [applyVariableFrontmatterCrud, getDraft, getSelectionOffsets, setDraftToDom, setSlashMenuStable, variableMenu.fallbackInput, variableMenu.keyInput, variableMenu.query, variableMenu.valueInput])
  const variableSuggestions = React.useMemo(() => {
    const query = String(variableMenu.keyInput || variableMenu.query || '').trim().toLowerCase()
    const all = collectMarkdownVariableBrowseRows({
      sourceLines,
      draftText: getDraft(),
    })
    if (!query) return all.slice(0, 8)
    return all.filter(row => row.key.toLowerCase().includes(query)).slice(0, 8)
  }, [getDraft, sourceLines, variableMenu.keyInput, variableMenu.query])
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
    const selection = getSelectionOffsets()
    if (selection && selection.startOffset !== selection.endOffset) {
      lastNonCollapsedSelectionOffsetsRef.current = selection
    }
    try {
      lastNonCollapsedDomRangeRef.current = range.cloneRange()
    } catch {
      void 0
    }
    setBubble(prev => {
      const next = { show: true, leftPx, topPx }
      if (prev.show && Math.abs(prev.leftPx - next.leftPx) < 1 && Math.abs(prev.topPx - next.topPx) < 1) return prev
      return next
    })
    setSlashMenu(prev => (prev.show ? { ...prev, show: false } : prev))
    setLinkPopover(prev => (prev.show ? { ...prev, show: false, href: '' } : prev))
  }, [editing, editDisableRichUi, getSelectionOffsets])

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
      editDirtyRef.current = false
      const el = editorRef.current
      if (el) {
        if (editorPresentation === 'html') {
          const md = getMarkdownItFastHtml()
          if (htmlRenderMode === 'block') {
            const quotePrefixPattern = /^\s*(?:>\s*)+$/
            const quoteLineStructured = (() => {
              if (stripped.length === 0) return false
              let hasQuotePrefix = false
              for (const s of stripped) {
                const prefix = String(s.prefix || '')
                const content = String(s.content || '')
                if (quotePrefixPattern.test(prefix)) {
                  hasQuotePrefix = true
                  continue
                }
                if (!prefix && !content.trim()) continue
                return false
              }
              return hasQuotePrefix
            })()
            if (quoteLineStructured) {
              const lines = String(presentText || '').split(/\r?\n/)
              el.innerHTML = lines
                .map(line => `<p>${line ? md.renderInline(line) : '<br/>'}</p>`)
                .join('')
            } else {
              const rendered = md.render(presentText)
              if (rendered.replace(/\s+/g, '').length === 0 && String(presentText || '').trim()) {
                el.textContent = presentText
              } else {
                el.innerHTML = normalizeRenderedBlockHtmlForEditor(rendered)
                trimEmptyEditableEdges()
                scheduleEdgeTrimBurst()
              }
            }
            initialEditorHtmlRef.current = el.innerHTML
          } else {
            const lines = String(presentText || '').split(/\r?\n/)
            el.innerHTML = lines
              .map(line => (line ? md.renderInline(line) : ''))
              .map((html, i) => (i === 0 ? html : `<br/>${html}`))
              .join('')
            initialEditorHtmlRef.current = el.innerHTML
          }
        } else {
          el.textContent = presentText
          initialEditorHtmlRef.current = el.innerHTML
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
    editDirtyRef.current = false
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
          initialEditorHtmlRef.current = el.innerHTML
        } else {
          const lines = String(normalizedInitialText || '').split(/\r?\n/)
          el.innerHTML = lines
            .map(line => (line ? md.renderInline(line) : ''))
            .map((html, i) => (i === 0 ? html : `<br/>${html}`))
            .join('')
          initialEditorHtmlRef.current = el.innerHTML
        }
      } else {
        el.textContent = normalizedInitialText
        initialEditorHtmlRef.current = el.innerHTML
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
  const hostInlineFlow = Tag === 'p' || Tag === 'li' || Tag === 'th' || Tag === 'td'
  const effectiveInlineFlow = editInlineFlow || hostInlineFlow
  const EditorTag = ((htmlBlockEditing || !effectiveInlineFlow) && !hostInlineFlow ? 'div' : 'span') as 'div' | 'span'
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
          ...MARKDOWN_INLINE_CODE_EDIT_DESCENDANT_CLASSES,
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
          className={effectiveInlineFlow
            ? (hostInlineFlow ? 'relative inline-block w-full min-w-0 align-baseline' : 'relative inline min-w-0 align-baseline')
            : 'relative w-full block min-w-0 flex-1'}
          style={editPreserveBlockHeight && editMinHeightPxRef.current > 0 ? { minHeight: `${editMinHeightPxRef.current}px` } : undefined}
        >
          {editStaticChildren ? (
            <span className={`pointer-events-none select-none ${effectiveInlineFlow ? 'inline align-baseline' : 'block'}`}>{editStaticChildren}</span>
          ) : null}
          {editLeftRailClassName ? <span aria-hidden className={`pointer-events-none absolute left-0 top-0 bottom-0 w-1 z-20 ${editLeftRailClassName}`} /> : null}
          <span ref={bubbleAnchorRef} className="absolute w-px h-px" style={{ left: `${bubble.leftPx}px`, top: `${bubble.topPx}px` }} />
          <span ref={slashAnchorRef} className="absolute w-px h-px" style={{ left: `${slashMenu.leftPx}px`, top: `${slashMenu.topPx}px` }} />
          <span ref={variableAnchorRef} className="absolute w-px h-px" style={{ left: `${variableMenu.leftPx}px`, top: `${variableMenu.topPx}px` }} />
          <span ref={linkAnchorRef} className="absolute w-px h-px" style={{ left: `${linkPopover.leftPx}px`, top: `${linkPopover.topPx}px` }} />

          {!editDisableRichUi && bubble.show ? (
            <AnchorOverlay anchorRef={bubbleAnchorRef} open={bubble.show} align="top-center" className={FLOATING_BUBBLE_TOOLBAR_CLASSNAME}>
              <menu
                ref={toolbarRef}
                className="list-none m-0 p-0 flex flex-wrap items-center gap-1"
                aria-label="Inline selection toolbar"
                onMouseDownCapture={() => {
                  toolbarInteractingRef.current = true
                  captureSelectionForFloatingToolbar({
                    getSelectionOffsets,
                    lastNonCollapsedSelectionOffsetsRef,
                    lastNonCollapsedDomRangeRef,
                  })
                }}
              >
            <details className="relative">
              <summary className={toolbarMenuSummaryClassName} onPointerDown={preventDefaultPointerDown} onClick={toggleParentDetailsOpenFromSummaryClick}>
                <Heading2 className="w-3 h-3" strokeWidth={1.6} />
              </summary>
              <menu className={toolbarMenuClassName} aria-label="Turn into menu">
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => applyTurnInto('heading2')}>
                    <Heading2 className="w-3 h-3 mr-1" strokeWidth={1.6} />
                    H2
                  </button>
                </li>
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => applyTurnInto('bulletList')}>
                    <List className="w-3 h-3 mr-1" strokeWidth={1.6} />
                    Bulleted list
                  </button>
                </li>
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => applyTurnInto('numberedList')}>
                    <ListOrdered className="w-3 h-3 mr-1" strokeWidth={1.6} />
                    Numbered list
                  </button>
                </li>
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => applyTurnInto('blockquote')}>
                    <Quote className="w-3 h-3 mr-1" strokeWidth={1.6} />
                    Quote
                  </button>
                </li>
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => applyTurnInto('code')}>
                    <Code className="w-3 h-3 mr-1" strokeWidth={1.6} />
                    Code block
                  </button>
                </li>
                <li className={toolbarMenuDividerClassName} />
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => applyToggleHeading(1)}>
                    <Heading2 className="w-3 h-3 mr-1" strokeWidth={1.6} />
                    H1
                  </button>
                </li>
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => applyToggleHeading(2)}>
                    <Heading2 className="w-3 h-3 mr-1" strokeWidth={1.6} />
                    H2
                  </button>
                </li>
                <li className="list-none">
                  <button type="button" className={toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => applyToggleHeading(3)}>
                    <Heading2 className="w-3 h-3 mr-1" strokeWidth={1.6} />
                    H3
                  </button>
                </li>
              </menu>
            </details>
            <details className="relative">
              <summary className={toolbarMenuSummaryClassName} onPointerDown={preventDefaultPointerDown} onClick={toggleParentDetailsOpenFromSummaryClick}>
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
              <summary className={toolbarMenuSummaryClassName} title="Highlight" onPointerDown={preventDefaultPointerDown} onClick={toggleParentDetailsOpenFromSummaryClick}>
                <Highlighter className="w-3 h-3" strokeWidth={1.8} />
              </summary>
              <menu className={toolbarMenuClassName} aria-label="Highlight menu">
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => applyWrap('==', '==')}>Default (==)</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ backgroundColor: '#FEF08A' }} onMouseDown={preventDefaultMouseDown} onClick={() => applyHighlightColor('#FEF08A')}>Yellow</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ backgroundColor: '#BBF7D0' }} onMouseDown={preventDefaultMouseDown} onClick={() => applyHighlightColor('#BBF7D0')}>Green</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ backgroundColor: '#BFDBFE' }} onMouseDown={preventDefaultMouseDown} onClick={() => applyHighlightColor('#BFDBFE')}>Blue</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ backgroundColor: '#FBCFE8' }} onMouseDown={preventDefaultMouseDown} onClick={() => applyHighlightColor('#FBCFE8')}>Pink</button></li>
              </menu>
            </details>
            <details className="relative">
              <summary className={toolbarMenuSummaryClassName} title="Text color" onPointerDown={preventDefaultPointerDown} onClick={toggleParentDetailsOpenFromSummaryClick}>
                <Palette className="w-3 h-3" strokeWidth={1.8} />
              </summary>
              <menu className={toolbarMenuClassName} aria-label="Text color menu">
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ color: '#EF4444' }} onMouseDown={preventDefaultMouseDown} onClick={() => applyColor('#EF4444')}>Red</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ color: '#10B981' }} onMouseDown={preventDefaultMouseDown} onClick={() => applyColor('#10B981')}>Green</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ color: '#3B82F6' }} onMouseDown={preventDefaultMouseDown} onClick={() => applyColor('#3B82F6')}>Blue</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ color: '#6B7280' }} onMouseDown={preventDefaultMouseDown} onClick={() => applyColor('#6B7280')}>Gray</button></li>
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
              <summary className={toolbarMenuSummaryClassName} title="More" onPointerDown={preventDefaultPointerDown} onClick={toggleParentDetailsOpenFromSummaryClick}>
                <MoreHorizontal className="w-3 h-3" strokeWidth={1.8} />
              </summary>
              <menu className={toolbarMenuClassName} aria-label="More actions">
                <li className="list-none"><button type="button" className={FLOATING_MENU_BUTTON_DISABLED_CLASSNAME} disabled>Copy</button></li>
                <li className="list-none"><button type="button" className={FLOATING_MENU_BUTTON_DISABLED_CLASSNAME} disabled>Copy link to block</button></li>
                <li className={toolbarMenuDividerClassName} />
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={applyChecklist}>Checklist</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={applyDivider}>Divider</button></li>
                <li className={toolbarMenuDividerClassName} />
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={handleDuplicate}>Duplicate</button></li>
                <li className="list-none"><button type="button" className={FLOATING_MENU_BUTTON_DANGER_CLASSNAME} onMouseDown={preventDefaultMouseDown} onClick={handleDelete}>Delete</button></li>
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
                ? { font: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', color: 'inherit', ...editTypographySnapshotRef.current }
                : {}),
              ...(editSpacingSnapshotRef.current || null),
              ...(editListMode
                ? { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
                : {}),
            }}
            onInput={(e) => {
              const el = editorRef.current
              if (!el) return
              const rawText = typeof (el as HTMLElement).innerText === 'string'
                ? (el as HTMLElement).innerText
                : String(el.textContent || '')
              const textRaw = editPreserveWhitespace ? readEditorPlainText() : rawText.replace(/\r/g, '')
              const text = editTrimEdgeNewlines
                ? textRaw.replace(/^\n+/, '').replace(/\n+$/, '')
                : textRaw
              draftRef.current = text
              editDirtyRef.current = true
              if (editTrimEmptyBlockEdges) scheduleEdgeTrimBurst()
              emitParityProbe()
              if (editDisableRichUi) return
              const sel = typeof window !== 'undefined' ? window.getSelection() : null
              if (!sel || sel.rangeCount <= 0) return
              const range = sel.getRangeAt(0)
              if (typeof (range as Range).getBoundingClientRect !== 'function') return
              const rect = range.getBoundingClientRect()
              const host = el.closest('[data-start-line]') as HTMLElement | null
              const hostRect = host?.getBoundingClientRect() || el.getBoundingClientRect()
              const leftPx = rect.left - hostRect.left
              const topPx = rect.bottom - hostRect.top + 6
              const offsets = getSelectionOffsets()
              const caretOffset = offsets?.startOffset ?? 0
              const lineStartIdx = text.lastIndexOf('\n', Math.max(0, caretOffset) - 1) + 1
              const preceding = text.slice(lineStartIdx, Math.max(lineStartIdx, Math.min(text.length, caretOffset)))
              const atMatch = /@([A-Za-z0-9_.-]{0,64})$/.exec(preceding)
              if (atMatch) {
                const query = String(atMatch[1] || '')
                setVariableMenuStable({
                  show: true,
                  leftPx,
                  topPx,
                  query,
                  keyInput: query || variableMenu.keyInput,
                })
                setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 })
                setBubble(prev => (prev.show ? { ...prev, show: false } : prev))
              } else if (/\/$/.test(preceding)) {
                setSlashMenuStable({ show: true, leftPx, topPx })
                setVariableMenuStable({ show: false, leftPx: 0, topPx: 0, query: '', keyInput: '' })
                setBubble(prev => (prev.show ? { ...prev, show: false } : prev))
              } else if (slashMenu.show) {
                setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 })
              } else if (variableMenu.show) {
                setVariableMenuStable({ show: false, leftPx: 0, topPx: 0, query: '', keyInput: '' })
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
              setVariableMenuStable({ show: false, leftPx: 0, topPx: 0, query: '', keyInput: '' })
              commit()
            }}
            onFocus={() => {
              emitParityProbe()
            }}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault()
                if (variableMenu.show) {
                  setVariableMenuStable({ show: false, leftPx: 0, topPx: 0, query: '', keyInput: '' })
                  return
                }
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
              if (event.key === 'Enter' && variableMenu.show) {
                event.preventDefault()
                applyVariableToken(variableMenu.mode === 'update' ? 'update' : variableMenu.mode)
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
          {!editDisableRichUi && variableMenu.show ? (
            <AnchorOverlay anchorRef={variableAnchorRef} open={variableMenu.show} align="bottom-left" className={FLOATING_MENU_LEFT_W220_CLASSNAME}>
              <section
                aria-label="Variable toolbar"
                onMouseDownCapture={() => {
                  toolbarInteractingRef.current = true
                  captureSelectionForFloatingToolbar({
                    getSelectionOffsets,
                    lastNonCollapsedSelectionOffsetsRef,
                    lastNonCollapsedDomRangeRef,
                  })
                }}
              >
                <menu className="list-none m-0 p-0 flex flex-wrap gap-1 mb-2">
                  <li className="list-none"><button type="button" className={FLOATING_MENU_BUTTON_CLASSNAME} onMouseDown={preventDefaultMouseDown} onClick={() => setVariableMenu(prev => ({ ...prev, mode: 'ref' }))}>Browse</button></li>
                  <li className="list-none"><button type="button" className={FLOATING_MENU_BUTTON_CLASSNAME} onMouseDown={preventDefaultMouseDown} onClick={() => setVariableMenu(prev => ({ ...prev, mode: 'create' }))}>New Variable</button></li>
                  <li className="list-none"><button type="button" className={FLOATING_MENU_BUTTON_CLASSNAME} onMouseDown={preventDefaultMouseDown} onClick={() => setVariableMenu(prev => ({ ...prev, mode: 'update' }))}>Edit Key</button></li>
                  <li className="list-none"><button type="button" className={FLOATING_MENU_BUTTON_CLASSNAME} onMouseDown={preventDefaultMouseDown} onClick={() => setVariableMenu(prev => ({ ...prev, mode: 'fallback' }))}>Reference</button></li>
                </menu>
                <input
                  className={FLOATING_POPOVER_INPUT_CLASSNAME}
                  placeholder="variable key"
                  value={variableMenu.keyInput}
                  onChange={(event) => setVariableMenu(prev => ({ ...prev, keyInput: event.target.value }))}
                />
                {(variableMenu.mode === 'create' || variableMenu.mode === 'update') ? (
                  <input
                    className={`${FLOATING_POPOVER_INPUT_CLASSNAME} mt-2`}
                    placeholder="value"
                    value={variableMenu.valueInput}
                    onChange={(event) => setVariableMenu(prev => ({ ...prev, valueInput: event.target.value }))}
                  />
                ) : null}
                {variableMenu.mode === 'fallback' ? (
                  <input
                    className={`${FLOATING_POPOVER_INPUT_CLASSNAME} mt-2`}
                    placeholder="fallback key or value"
                    value={variableMenu.fallbackInput}
                    onChange={(event) => setVariableMenu(prev => ({ ...prev, fallbackInput: event.target.value }))}
                  />
                ) : null}
                {variableSuggestions.length > 0 ? (
                  <menu className="list-none m-0 p-0 mt-2 max-h-24 overflow-auto">
                    {variableSuggestions.map(suggestion => (
                      <li key={suggestion.key} className="list-none">
                        <button
                          type="button"
                          className={FLOATING_MENU_BUTTON_CLASSNAME}
                          onMouseDown={preventDefaultMouseDown}
                          onClick={() => setVariableMenu(prev => ({ ...prev, keyInput: suggestion.key }))}
                        >
                          {`${suggestion.key}${suggestion.value != null ? ` = ${suggestion.value}` : ''}${suggestion.source === 'frontmatter' ? ' (fm)' : suggestion.source === 'inline' ? ' (inline)' : ''}`}
                        </button>
                      </li>
                    ))}
                  </menu>
                ) : null}
                <menu className="list-none m-0 p-0 mt-2 flex gap-2">
                  <li className="list-none">
                    <button
                      type="button"
                      className={FLOATING_MENU_BUTTON_CLASSNAME}
                      onMouseDown={preventDefaultMouseDown}
                      onClick={() => applyVariableToken(variableMenu.mode)}
                    >
                      Apply
                    </button>
                  </li>
                  <li className="list-none">
                    <button
                      type="button"
                      className={FLOATING_MENU_BUTTON_DANGER_CLASSNAME}
                      onMouseDown={preventDefaultMouseDown}
                      onClick={() => applyVariableToken('delete')}
                    >
                      Delete
                    </button>
                  </li>
                </menu>
              </section>
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
