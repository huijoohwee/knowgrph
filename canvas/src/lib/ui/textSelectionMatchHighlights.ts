import React from 'react'

export type TextSelectionMatchHighlightRect = {
  id: string
  left: number
  top: number
  width: number
  height: number
}

export type TextSelectionMatchQuery = {
  text: string
  searchText: string
  range: Range
  textStartOffset?: number | null
  textEndOffset?: number | null
}

const MIN_SELECTION_MATCH_CHARS = 2
const MAX_SELECTION_MATCH_CHARS = 160
const MAX_SELECTION_MATCH_RECTS = 300

type TextSegment = {
  node: Text
  start: number
  end: number
  text: string
}

type NormalizedTextIndex = {
  text: string
  rawOffsets: number[]
}

export const normalizeSelectionMatchText = (raw: string): string =>
  String(raw || '').replace(/\s+/g, ' ').trim()

const buildNormalizedTextIndex = (segments: TextSegment[]): NormalizedTextIndex => {
  let text = ''
  const rawOffsets: number[] = []
  let pendingSpaceOffset: number | null = null

  for (const segment of segments) {
    const segmentText = String(segment.text || '')
    for (let i = 0; i < segmentText.length; i += 1) {
      const rawOffset = segment.start + i
      const char = segmentText[i] || ''
      if (/\s/.test(char)) {
        if (text.length > 0 && pendingSpaceOffset === null) {
          pendingSpaceOffset = rawOffset
        }
        continue
      }
      if (pendingSpaceOffset !== null && text.length > 0) {
        text += ' '
        rawOffsets.push(pendingSpaceOffset)
        pendingSpaceOffset = null
      }
      text += char
      rawOffsets.push(rawOffset)
    }
  }

  return { text, rawOffsets }
}

const readRawRangeForNormalizedMatch = (
  index: NormalizedTextIndex,
  startOffset: number,
  endOffset: number,
): { start: number; end: number } | null => {
  if (startOffset < 0 || endOffset <= startOffset) return null
  const rawStart = index.rawOffsets[startOffset]
  const rawLast = index.rawOffsets[endOffset - 1]
  if (!Number.isFinite(rawStart) || !Number.isFinite(rawLast)) return null
  return { start: rawStart, end: rawLast + 1 }
}

const isSelectionMatchIgnoredElement = (el: Element | null): boolean => {
  if (!el) return false
  const tagName = el.tagName.toLowerCase()
  if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') return true
  if (tagName === 'textarea' || tagName === 'input' || tagName === 'select' || tagName === 'button') return true
  if (el.getAttribute('aria-hidden') === 'true') return true
  if (el.getAttribute('contenteditable') === 'true') return true
  if (el.hasAttribute('data-kg-selection-match-ignore')) return true
  if (el.hasAttribute('data-kg-selection-match-overlay')) return true
  return false
}

const shouldSkipTextNode = (node: Text, root: HTMLElement): boolean => {
  const text = String(node.nodeValue || '')
  if (!text) return true
  let el = node.parentElement
  while (el && el !== root) {
    if (isSelectionMatchIgnoredElement(el)) return true
    el = el.parentElement
  }
  return false
}

const collectTextSegments = (root: HTMLElement): TextSegment[] => {
  const doc = root.ownerDocument
  if (!doc?.createTreeWalker) return []
  const view = doc.defaultView
  const showText = view?.NodeFilter?.SHOW_TEXT ?? 4
  const textNodeType = view?.Node?.TEXT_NODE ?? 3
  const walker = doc.createTreeWalker(root, showText)
  const segments: TextSegment[] = []
  let cursor = 0
  let current = walker.nextNode()
  while (current) {
    if (current.nodeType === textNodeType) {
      const node = current as Text
      if (!shouldSkipTextNode(node, root)) {
        const text = String(node.nodeValue || '')
        segments.push({ node, start: cursor, end: cursor + text.length, text })
        cursor += text.length
      }
    }
    current = walker.nextNode()
  }
  return segments
}

const findSegmentForOffset = (segments: TextSegment[], offset: number, endOffset: boolean): TextSegment | null => {
  for (const segment of segments) {
    if (endOffset) {
      if (offset > segment.start && offset <= segment.end) return segment
    } else if (offset >= segment.start && offset < segment.end) {
      return segment
    }
  }
  return null
}

const readTextOffsetForDomPoint = (segments: TextSegment[], node: Node, offset: number): number | null => {
  if (node.nodeType !== (node.ownerDocument?.defaultView?.Node?.TEXT_NODE ?? 3)) return null
  const segment = segments.find(item => item.node === node)
  if (!segment) return null
  const boundedOffset = Math.max(0, Math.min(String(segment.text || '').length, offset))
  return segment.start + boundedOffset
}

const readRangeTextOffsets = (
  segments: TextSegment[],
  range: Range,
): { start: number; end: number } | null => {
  const start = readTextOffsetForDomPoint(segments, range.startContainer, range.startOffset)
  const end = readTextOffsetForDomPoint(segments, range.endContainer, range.endOffset)
  if (start === null || end === null || end <= start) return null
  return { start, end }
}

const isRangeInsideRoot = (root: HTMLElement, range: Range): boolean => {
  const start = range.startContainer
  const end = range.endContainer
  return root.contains(start) && root.contains(end)
}

const compareDomPoints = (
  doc: Document,
  aNode: Node,
  aOffset: number,
  bNode: Node,
  bOffset: number,
): number => {
  try {
    const rangeCtor = doc.defaultView?.Range
    const startToStart = rangeCtor?.START_TO_START ?? 0
    const aRange = doc.createRange()
    const bRange = doc.createRange()
    aRange.setStart(aNode, aOffset)
    aRange.collapse(true)
    bRange.setStart(bNode, bOffset)
    bRange.collapse(true)
    return aRange.compareBoundaryPoints(startToStart, bRange)
  } catch {
    return 0
  }
}

const rangesIntersect = (a: Range, b: Range): boolean => {
  try {
    const doc = a.startContainer.ownerDocument
    const aStartsBeforeBEnds = compareDomPoints(doc, a.startContainer, a.startOffset, b.endContainer, b.endOffset) < 0
    const bStartsBeforeAEnds = compareDomPoints(doc, b.startContainer, b.startOffset, a.endContainer, a.endOffset) < 0
    return aStartsBeforeBEnds && bStartsBeforeAEnds
  } catch {
    return false
  }
}

const buildRangeForMatch = (
  root: HTMLElement,
  segments: TextSegment[],
  startOffset: number,
  endOffset: number,
): Range | null => {
  const startSegment = findSegmentForOffset(segments, startOffset, false)
  const endSegment = findSegmentForOffset(segments, endOffset, true)
  if (!startSegment || !endSegment) return null
  const range = root.ownerDocument.createRange()
  range.setStart(startSegment.node, startOffset - startSegment.start)
  range.setEnd(endSegment.node, endOffset - endSegment.start)
  return range
}

export const readSelectionMatchQuery = (
  root: HTMLElement | null,
  selection: Selection | null | undefined,
): TextSelectionMatchQuery | null => {
  if (!root || !selection || selection.isCollapsed || selection.rangeCount <= 0) return null
  const rawText = typeof selection.toString === 'function' ? selection.toString() : ''
  const searchText = String(rawText || '').trim()
  const text = normalizeSelectionMatchText(rawText)
  if (text.length < MIN_SELECTION_MATCH_CHARS || text.length > MAX_SELECTION_MATCH_CHARS) return null
  let range: Range | null = null
  try {
    range = selection.getRangeAt(0)
  } catch {
    range = null
  }
  if (!range || range.collapsed || !isRangeInsideRoot(root, range)) return null
  const rangeOffsets = readRangeTextOffsets(collectTextSegments(root), range)
  return {
    text,
    searchText,
    range,
    textStartOffset: rangeOffsets?.start ?? null,
    textEndOffset: rangeOffsets?.end ?? null,
  }
}

export const collectTextSelectionMatchHighlightRects = (args: {
  root: HTMLElement
  query: TextSelectionMatchQuery
  maxRects?: number
}): TextSelectionMatchHighlightRect[] => {
  const { root, query } = args
  const maxRects = Math.max(1, args.maxRects || MAX_SELECTION_MATCH_RECTS)
  const segments = collectTextSegments(root)
  if (!segments.length) return []
  const searchText = query.text
  const source = buildNormalizedTextIndex(segments)
  const sourceText = source.text
  if (!sourceText || sourceText.length < searchText.length) return []
  const rootRect = root.getBoundingClientRect()
  const out: TextSelectionMatchHighlightRect[] = []
  let searchFrom = 0
  let matchIndex = 0
  while (out.length < maxRects) {
    const matchStart = sourceText.indexOf(searchText, searchFrom)
    if (matchStart < 0) break
    const matchEnd = matchStart + searchText.length
    searchFrom = Math.max(matchEnd, matchStart + 1)
    const rawRange = readRawRangeForNormalizedMatch(source, matchStart, matchEnd)
    if (!rawRange) continue
    const matchRange = buildRangeForMatch(root, segments, rawRange.start, rawRange.end)
    if (!matchRange) continue
    if (rangesIntersect(matchRange, query.range)) continue
    let rectIndex = 0
    const rects = Array.from(matchRange.getClientRects())
    for (const rect of rects) {
      if (out.length >= maxRects) break
      if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) continue
      if (rect.width <= 0 || rect.height <= 0) continue
      const left = rect.left - rootRect.left + root.scrollLeft - root.clientLeft
      const top = rect.top - rootRect.top + root.scrollTop - root.clientTop
      out.push({
        id: `${matchIndex}:${rectIndex}:${Math.round(left)}:${Math.round(top)}:${Math.round(rect.width)}:${Math.round(rect.height)}`,
        left,
        top,
        width: rect.width,
        height: rect.height,
      })
      rectIndex += 1
    }
    matchIndex += 1
  }
  return out
}

const buildHighlightSignature = (query: TextSelectionMatchQuery | null, rects: TextSelectionMatchHighlightRect[]): string => {
  if (!query || rects.length <= 0) return ''
  return [
    query.text,
    rects
      .map(rect => `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}`)
      .join(','),
  ].join('|')
}

const scheduleNativeSelectionRestore = (
  root: HTMLElement,
  query: TextSelectionMatchQuery,
  canRestore?: () => boolean,
): void => {
  const doc = root.ownerDocument
  const win = doc.defaultView
  if (!win) return
  let clonedRange: Range | null = null
  try {
    clonedRange = query.range.cloneRange()
  } catch {
    clonedRange = null
  }
  const restore = () => {
    if (canRestore && !canRestore()) return
    if (!root.isConnected) return
    const selection = win.getSelection?.()
    if (!selection) return
    const currentText = normalizeSelectionMatchText(selection.toString?.() || '')
    if (currentText === query.text) return
    if (currentText) return
    const anchorNode = selection.anchorNode
    const focusNode = selection.focusNode
    if (
      (anchorNode && anchorNode.isConnected && !root.contains(anchorNode)) ||
      (focusNode && focusNode.isConnected && !root.contains(focusNode))
    ) return
    let restoreRange: Range | null = null
    if (clonedRange && isRangeInsideRoot(root, clonedRange)) {
      restoreRange = clonedRange
    } else if (
      typeof query.textStartOffset === 'number' &&
      Number.isFinite(query.textStartOffset) &&
      typeof query.textEndOffset === 'number' &&
      Number.isFinite(query.textEndOffset) &&
      query.textEndOffset > query.textStartOffset
    ) {
      restoreRange = buildRangeForMatch(root, collectTextSegments(root), query.textStartOffset, query.textEndOffset)
    }
    if (!restoreRange || restoreRange.collapsed) return
    try {
      selection.removeAllRanges()
      selection.addRange(restoreRange)
    } catch {
      void 0
    }
  }
  const scheduleFrame = typeof win.requestAnimationFrame === 'function'
    ? win.requestAnimationFrame.bind(win)
    : (cb: FrameRequestCallback) => win.setTimeout(() => cb(Date.now()), 0)
  scheduleFrame(() => scheduleFrame(restore))
}

export const useTextSelectionMatchHighlights = (args: {
  rootRef: React.RefObject<HTMLElement | null>
  resetKey?: string
  enabled?: boolean
}): TextSelectionMatchHighlightRect[] => {
  const { rootRef, resetKey, enabled = true } = args
  const [state, setState] = React.useState<{ signature: string; rects: TextSelectionMatchHighlightRect[] }>({
    signature: '',
    rects: [],
  })
  const stateSignatureRef = React.useRef('')

  React.useEffect(() => {
    if (!enabled) {
      stateSignatureRef.current = ''
      setState(prev => (prev.signature ? { signature: '', rects: [] } : prev))
      return
    }
    let rafId = 0
    let timerId = 0
    let disposed = false
    let pointerSelecting = false
    let restoreGeneration = 0
    const invalidateRestore = () => {
      restoreGeneration += 1
    }
    const clearScheduled = () => {
      if (rafId) {
        window.cancelAnimationFrame?.(rafId)
        rafId = 0
      }
      if (timerId) {
        window.clearTimeout(timerId)
        timerId = 0
      }
    }
    const sync = () => {
      if (disposed) return
      const root = rootRef.current
      const selection = typeof window !== 'undefined' ? window.getSelection?.() : null
      const query = readSelectionMatchQuery(root, selection)
      const rects = root && query ? collectTextSelectionMatchHighlightRects({ root, query }) : []
      const signature = buildHighlightSignature(query, rects)
      if (signature === stateSignatureRef.current) return
      if (!query || rects.length <= 0) invalidateRestore()
      stateSignatureRef.current = signature
      setState({ signature, rects })
      if (root && query && rects.length > 0) {
        const restoreToken = ++restoreGeneration
        scheduleNativeSelectionRestore(root, query, () => restoreToken === restoreGeneration && !pointerSelecting)
      }
    }
    const schedule = (allowDuringPointerSelection = false) => {
      if (pointerSelecting && !allowDuringPointerSelection) return
      if (disposed || rafId || timerId) return
      if (typeof window.requestAnimationFrame === 'function') {
        rafId = window.requestAnimationFrame(() => {
          rafId = 0
          sync()
        })
        return
      }
      timerId = window.setTimeout(() => {
        timerId = 0
        sync()
      }, 0)
    }
    const scheduleFromSelectionChange = () => {
      const selection = typeof window !== 'undefined' ? window.getSelection?.() : null
      const selectionText = normalizeSelectionMatchText(selection?.toString?.() || '')
      if (!selection || selection.isCollapsed || !selectionText) invalidateRestore()
      schedule(false)
    }
    const scheduleFromCommittedInput = () => schedule(true)
    const beginPointerSelection = (event: MouseEvent | PointerEvent) => {
      if (typeof event.button === 'number' && event.button !== 0) return
      pointerSelecting = true
      invalidateRestore()
      clearScheduled()
    }
    const finishPointerSelection = () => {
      if (!pointerSelecting) {
        scheduleFromCommittedInput()
        return
      }
      pointerSelecting = false
      scheduleFromCommittedInput()
    }
    schedule()
    document.addEventListener('selectionchange', scheduleFromSelectionChange)
    window.addEventListener('resize', scheduleFromCommittedInput)
    const root = rootRef.current
    root?.addEventListener('pointerdown', beginPointerSelection)
    root?.addEventListener('mousedown', beginPointerSelection)
    document.addEventListener('pointerup', finishPointerSelection)
    document.addEventListener('mouseup', finishPointerSelection)
    root?.addEventListener('keyup', scheduleFromCommittedInput)
    return () => {
      disposed = true
      clearScheduled()
      invalidateRestore()
      document.removeEventListener('selectionchange', scheduleFromSelectionChange)
      window.removeEventListener('resize', scheduleFromCommittedInput)
      root?.removeEventListener('pointerdown', beginPointerSelection)
      root?.removeEventListener('mousedown', beginPointerSelection)
      document.removeEventListener('pointerup', finishPointerSelection)
      document.removeEventListener('mouseup', finishPointerSelection)
      root?.removeEventListener('keyup', scheduleFromCommittedInput)
      stateSignatureRef.current = ''
    }
  }, [enabled, resetKey, rootRef])

  return state.rects
}
