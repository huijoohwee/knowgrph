import React from 'react'
import { applyMarkdownFormatAction, type MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import {
  FLOATING_MENU_BUTTON_CLASSNAME,
  FLOATING_MENU_DIVIDER_CLASSNAME,
  FLOATING_MENU_TRIGGER_CLASSNAME,
  FLOATING_BUBBLE_TOOLBAR_CLASSNAME,
  FLOATING_MENU_LEFT_W220_CLASSNAME,
} from '@/components/BottomPanel/markdownWorkspace/main/viewer/floatingMenuStyles'

type MarkdownBlockContainerProps = {
  as: React.ElementType
  className?: string
  highlightClass: string
  highlightStyle?: React.CSSProperties
  startLine: number
  endLine?: number
  id?: string
  defaultOpen?: boolean
  open?: boolean
  children: React.ReactNode
  inlineEditable?: boolean
  sourceLines?: string[]
  onReplaceLineRange?: (args: { startLine: number; endLine: number; replacementLines: string[] }) => void
  editorClassName?: string
}

export const MarkdownBlockContainer = React.forwardRef<HTMLElement, MarkdownBlockContainerProps & React.HTMLAttributes<HTMLElement>>(({
  as: Tag,
  className,
  highlightClass,
  highlightStyle,
  startLine,
  endLine,
  id,
  children,
  inlineEditable = false,
  sourceLines,
  onReplaceLineRange,
  editorClassName,
  ...rest
}, ref) => {
  const cls = [className, highlightClass].filter(Boolean).join(' ')
  const originalOnClick = (rest as React.HTMLAttributes<HTMLElement>).onClick
  const [editing, setEditing] = React.useState(false)
  const editable = inlineEditable && Array.isArray(sourceLines) && !!onReplaceLineRange && Number.isFinite(startLine)
  const effectiveEndLine = endLine ?? startLine
  const initialText = React.useMemo(() => {
    if (!editable || !sourceLines) return ''
    const startIndex = Math.max(0, Math.floor(startLine) - 1)
    const endIndex = Math.max(startIndex + 1, Math.floor(effectiveEndLine))
    return sourceLines.slice(startIndex, endIndex).join('\n')
  }, [editable, effectiveEndLine, sourceLines, startLine])
  const draftRef = React.useRef('')
  const editorRef = React.useRef<HTMLDivElement | null>(null)
  const toolbarRef = React.useRef<HTMLElement | null>(null)
  const toolbarInteractingRef = React.useRef(false)

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
    el.textContent = nextText
    draftRef.current = nextText
    if (selection) {
      queueMicrotask(() => setSelectionByOffsets(selection))
    }
  }, [setSelectionByOffsets])

  const getDraft = React.useCallback(() => draftRef.current, [])

  const applyDraftAction = React.useCallback((action: MarkdownFormatAction) => {
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
  }, [getDraft, getSelectionOffsets, setDraftToDom])
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
  }, [getDraft, getSelectionOffsets, setDraftToDom])
  const applyClearFormatting = React.useCallback(() => {
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
  }, [getDraft, getSelectionOffsets, setDraftToDom])
  const handleDuplicate = React.useCallback(() => {
    if (!editable || !onReplaceLineRange) return
    const replacementLines = String(getDraft() || '').split(/\r?\n/)
    onReplaceLineRange({ startLine, endLine: effectiveEndLine, replacementLines: [...replacementLines, ...replacementLines] })
    setEditing(false)
  }, [editable, effectiveEndLine, getDraft, onReplaceLineRange, startLine])
  const handleDelete = React.useCallback(() => {
    if (!editable || !onReplaceLineRange) return
    onReplaceLineRange({ startLine, endLine: effectiveEndLine, replacementLines: [] })
    setEditing(false)
  }, [editable, effectiveEndLine, onReplaceLineRange, startLine])
  const commit = React.useCallback(() => {
    if (!editable || !onReplaceLineRange) return
    const draft = getDraft()
    if (draft === initialText) {
      setEditing(false)
      return
    }
    const replacementLines = String(draft || '').split(/\r?\n/)
    onReplaceLineRange({ startLine, endLine: effectiveEndLine, replacementLines })
    setEditing(false)
  }, [editable, effectiveEndLine, getDraft, initialText, onReplaceLineRange, startLine])
  const cancel = React.useCallback(() => {
    setEditing(false)
  }, [])
  const lastPointerRef = React.useRef<{ x: number; y: number } | null>(null)
  const openEditor = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!editable) return
    const target = event.target as HTMLElement | null
    if (target?.closest('button,a,input,select,textarea,[contenteditable="true"]')) return
    lastPointerRef.current = { x: event.clientX, y: event.clientY }
    event.preventDefault()
    event.stopPropagation()
    setEditing(prev => (prev ? prev : true))
  }, [editable])

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
  const bubbleRafRef = React.useRef(0)
  const updateBubble = React.useCallback(() => {
    if (!editing) return
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
  }, [editing])

  React.useEffect(() => {
    if (!editing) return
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
  }, [editing, updateBubble])

  React.useEffect(() => {
    if (!editing) return
    draftRef.current = initialText
    const el = editorRef.current
    if (el) {
      el.textContent = initialText
      queueMicrotask(() => {
        el.focus()
        placeCaretFromClientPoint()
        updateBubble()
      })
    }
  }, [editing, initialText, placeCaretFromClientPoint, updateBubble])
  const toolbarMenuClassName = FLOATING_MENU_LEFT_W220_CLASSNAME
  const toolbarMenuButtonClassName = FLOATING_MENU_BUTTON_CLASSNAME
  const toolbarMenuDividerClassName = FLOATING_MENU_DIVIDER_CLASSNAME
  const toolbarMenuSummaryClassName = FLOATING_MENU_TRIGGER_CLASSNAME

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
        <section className="relative w-full">
          {bubble.show ? (
            <menu
              ref={toolbarRef}
              className={FLOATING_BUBBLE_TOOLBAR_CLASSNAME}
              aria-label="Inline selection toolbar"
              style={{ left: `${bubble.leftPx}px`, top: `${Math.max(0, bubble.topPx - 10)}px`, transform: 'translate(-50%, -100%)' }}
              onMouseDownCapture={() => {
                toolbarInteractingRef.current = true
              }}
            >
            <details className="relative">
              <summary className={toolbarMenuSummaryClassName}>Turn into ...</summary>
              <menu className={toolbarMenuClassName} aria-label="Turn into menu">
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onClick={() => applyTurnInto('heading2')}>Heading</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onClick={() => applyTurnInto('bulletList')}>Bulleted list</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onClick={() => applyTurnInto('numberedList')}>Numbered list</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onClick={() => applyTurnInto('blockquote')}>Quote</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onClick={() => applyTurnInto('code')}>Code block</button></li>
                <li className={toolbarMenuDividerClassName} />
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onClick={() => applyToggleHeading(1)}>H1</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onClick={() => applyToggleHeading(2)}>H2</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onClick={() => applyToggleHeading(3)}>H3</button></li>
              </menu>
            </details>
            <details className="relative">
              <summary className={toolbarMenuSummaryClassName}>Align ...</summary>
              <menu className={toolbarMenuClassName} aria-label="Align menu">
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onClick={() => applyAlign('left')}>Left</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onClick={() => applyAlign('center')}>Center</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onClick={() => applyAlign('right')}>Right</button></li>
              </menu>
            </details>
            <button type="button" className="h-6 rounded border border-gray-200 bg-white px-2" onMouseDown={event => event.preventDefault()} onClick={() => applyDraftAction('bold')}>Bold</button>
            <button type="button" className="h-6 rounded border border-gray-200 bg-white px-2" onMouseDown={event => event.preventDefault()} onClick={() => applyDraftAction('inlineCode')}>Code</button>
            <button type="button" className="h-6 rounded border border-gray-200 bg-white px-2" onMouseDown={event => event.preventDefault()} onClick={() => applyDraftAction('italic')}>Italic</button>
            <button type="button" className="h-6 rounded border border-gray-200 bg-white px-2" onMouseDown={event => event.preventDefault()} onClick={() => applyDraftAction('link')}>Link</button>
            <button type="button" className="h-6 rounded border border-gray-200 bg-white px-2" onMouseDown={event => event.preventDefault()} onClick={() => applyDraftAction('strike')}>Strikethrough</button>
            <button type="button" className="h-6 rounded border border-gray-200 bg-white px-2" onMouseDown={event => event.preventDefault()} onClick={() => applyWrap('<u>', '</u>')}>Underline</button>
            <details className="relative">
              <summary className={toolbarMenuSummaryClassName}>Highlight</summary>
              <menu className={toolbarMenuClassName} aria-label="Highlight menu">
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onClick={() => applyWrap('==', '==')}>Color</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onClick={() => applyWrap('<mark>', '</mark>')}>Background</button></li>
              </menu>
            </details>
            <details className="relative">
              <summary className={toolbarMenuSummaryClassName}>Text color</summary>
              <menu className={toolbarMenuClassName} aria-label="Text color menu">
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ color: '#ef4444' }} onClick={() => applyColor('#ef4444')}>Red</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ color: '#10b981' }} onClick={() => applyColor('#10b981')}>Green</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ color: '#3b82f6' }} onClick={() => applyColor('#3b82f6')}>Blue</button></li>
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} style={{ color: '#6b7280' }} onClick={() => applyColor('#6b7280')}>Gray</button></li>
              </menu>
            </details>
            <button type="button" className="h-6 rounded border border-gray-200 bg-white px-2" onMouseDown={event => event.preventDefault()} onClick={applyClearFormatting}>Clear</button>
            <button type="button" className="h-6 rounded border border-gray-200 bg-white px-2" onMouseDown={event => event.preventDefault()} onClick={() => applyWrap('<!-- ', ' -->')}>Comment</button>
            <details className="relative">
              <summary className={toolbarMenuSummaryClassName}>More</summary>
              <menu className={toolbarMenuClassName} aria-label="More actions">
                <li className="list-none"><button type="button" className="w-full text-left px-2 py-1.5 rounded text-xs bg-gray-100 text-gray-400 border border-gray-200" disabled>Copy</button></li>
                <li className="list-none"><button type="button" className="w-full text-left px-2 py-1.5 rounded text-xs bg-gray-100 text-gray-400 border border-gray-200" disabled>Copy link to block</button></li>
                <li className={toolbarMenuDividerClassName} />
                <li className="list-none"><button type="button" className={toolbarMenuButtonClassName} onMouseDown={event => event.preventDefault()} onClick={handleDuplicate}>Duplicate</button></li>
                <li className="list-none"><button type="button" className="w-full text-left px-2 py-1.5 rounded text-xs border border-red-200 text-red-600 hover:bg-red-50" onMouseDown={event => event.preventDefault()} onClick={handleDelete}>Delete</button></li>
              </menu>
            </details>
            </menu>
          ) : null}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            role="textbox"
            aria-multiline="true"
            aria-label="Edit markdown block"
            className={editorClassName || 'w-full min-h-[24px] whitespace-pre-wrap break-words outline-none bg-transparent'}
            onInput={() => {
              const el = editorRef.current
              if (!el) return
              draftRef.current = el.innerText.replace(/\r/g, '')
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
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                commit()
              }
            }}
          />
        </section>
      ) : (
        children
      )}
    </Tag>
  )
})
