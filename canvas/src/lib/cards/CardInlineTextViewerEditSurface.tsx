import React from 'react'
import { getMarkdownItFastHtml } from '@/features/markdown/markdownIt'
import {
  MARKDOWN_NORMAL_TEXT_EDIT_SURFACE_CLASS,
  MARKDOWN_TEXT_EDIT_SURFACE_MIN_LINE_HEIGHT_CLASS,
} from '@/features/markdown/ui/markdownEditSurfaceLayout'
import { normalizeEscapedInlineMediaMarkdown } from '@/features/markdown/ui/inlineMediaMarkdown'
import {
  INLINE_MARKDOWN_EDIT_TOKEN_SELECTOR,
  INLINE_MARKDOWN_ZERO_LENGTH_TOKEN_ATTR,
  INLINE_MARKDOWN_ZERO_LENGTH_TOKEN_SELECTOR,
  getInlineMediaEditorMarkdownSelectionOffsets,
  readInlineMarkdownEditTokenMarkdown,
  readInlineMediaEditorMarkdownText,
  rewriteRenderedInlineMediaForEditorHtml,
} from '@/lib/markdown-core/ui/markdownBlockContainerCore.inlineMediaEditHtml'
import { readFastInlineMarkdownDraft } from '@/lib/markdown-core/ui/markdownBlockContainerCore.inlineDraftSerialization'
import {
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME,
} from '@/lib/cards/cardMarkdownPreviewUtils'
import {
  collectTextareaInvocationMediaAttachmentCandidateChips,
  readTextareaInvocationMediaReferenceKey,
  type TextareaInvocationMediaAttachment,
  type TextareaInvocationProjectedMediaChip,
} from '@/lib/ui/textareaInvocationProjection'
import { cn } from '@/lib/utils'

const CARD_INLINE_TEXT_VIEWER_VIRTUAL_MEDIA_CHIP_ATTRIBUTE = 'data-kg-card-inline-wysiwyg-virtual-media-chip'
const CARD_INLINE_TEXT_VIEWER_MEDIA_MARKDOWN_ATTRIBUTE = 'data-kg-card-inline-wysiwyg-media-markdown'

type CardInlineTextViewerPendingSelection = { start: number; end: number }
type CardInlineTextViewerMediaChipMatch = {
  chip: TextareaInvocationProjectedMediaChip
  chipIndex: number
  label: string
  start: number
  end: number
}
type CardInlineTextViewerEditSegment =
  | { kind: 'text'; value: string }
  | {
    kind: 'media'
    chip: TextareaInvocationProjectedMediaChip
    markdown: string | null
    prefixGap: boolean
  }

const pendingViewerSelections = new WeakMap<HTMLElement, CardInlineTextViewerPendingSelection>()

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const escapeHtmlAttr = (value: unknown): string =>
  escapeHtml(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

function readProjectedMediaChipLabels(chip: TextareaInvocationProjectedMediaChip): string[] {
  const labels = new Set<string>()
  const displayLabel = String(chip.displayLabel || '').trim()
  if (displayLabel) labels.add(displayLabel)
  const label = String(chip.label || '').trim()
  if (label) labels.add(label.startsWith('@') ? label : `@${label}`)
  return Array.from(labels).sort((a, b) => b.length - a.length)
}

const isProjectedMediaLabelStartBoundary = (value: string, index: number): boolean =>
  index <= 0 || /[\s([{]/.test(value[index - 1] || '')

const isProjectedMediaLabelEndBoundary = (value: string, index: number): boolean =>
  index >= value.length || /[\s.,;:!?)}\]]/.test(value[index] || '')

function findExactProjectedMediaChipMatch(args: {
  source: string
  cursor: number
  chips: readonly TextareaInvocationProjectedMediaChip[]
}): CardInlineTextViewerMediaChipMatch | null {
  let best: CardInlineTextViewerMediaChipMatch | null = null
  args.chips.forEach((chip, chipIndex) => {
    readProjectedMediaChipLabels(chip).forEach(label => {
      let searchIndex = args.cursor
      for (;;) {
        const start = args.source.indexOf(label, searchIndex)
        if (start < 0) break
        const end = start + label.length
        if (isProjectedMediaLabelStartBoundary(args.source, start) && isProjectedMediaLabelEndBoundary(args.source, end)) {
          if (
            !best
            || start < best.start
            || (start === best.start && label.length > best.label.length)
          ) {
            best = { chip, chipIndex, label, start, end }
          }
          break
        }
        searchIndex = start + 1
      }
    })
  })
  return best
}

function findKeyedProjectedMediaChipMatch(args: {
  source: string
  cursor: number
  chips: readonly TextareaInvocationProjectedMediaChip[]
}): CardInlineTextViewerMediaChipMatch | null {
  const chipKeys = args.chips.map(chip => new Set(
    readProjectedMediaChipLabels(chip)
      .map(readTextareaInvocationMediaReferenceKey)
      .filter(key => key.length >= 8),
  ))
  if (!chipKeys.some(keys => keys.size > 0)) return null
  const tokenPattern = /@[A-Za-z0-9_][A-Za-z0-9_.-]*[A-Za-z0-9]/g
  tokenPattern.lastIndex = Math.max(0, args.cursor)
  for (;;) {
    const match = tokenPattern.exec(args.source)
    if (!match) return null
    const label = String(match[0] || '')
    const start = match.index
    const end = start + label.length
    if (!isProjectedMediaLabelStartBoundary(args.source, start) || !isProjectedMediaLabelEndBoundary(args.source, end)) continue
    const key = readTextareaInvocationMediaReferenceKey(label)
    const chipIndex = chipKeys.findIndex(keys => keys.has(key))
    if (chipIndex < 0) continue
    const chip = args.chips[chipIndex]
    if (!chip) continue
    return { chip, chipIndex, label, start, end }
  }
}

function findProjectedMediaChipMatch(args: {
  source: string
  cursor: number
  chips: readonly TextareaInvocationProjectedMediaChip[]
}): CardInlineTextViewerMediaChipMatch | null {
  const exact = findExactProjectedMediaChipMatch(args)
  const keyed = findKeyedProjectedMediaChipMatch(args)
  if (!exact) return keyed
  if (!keyed) return exact
  if (exact.start < keyed.start) return exact
  if (keyed.start < exact.start) return keyed
  return exact.label.length >= keyed.label.length ? exact : keyed
}

function buildCardInlineTextViewerEditSegments(args: {
  value: string
  projectedMediaAttachments?: readonly TextareaInvocationMediaAttachment[] | null
}): CardInlineTextViewerEditSegment[] {
  const source = String(args.value || '').replace(/\r/g, '')
  const virtualChips = collectTextareaInvocationMediaAttachmentCandidateChips(args.projectedMediaAttachments)
  if (!virtualChips.length) return [{ kind: 'text', value: source }]
  const segments: CardInlineTextViewerEditSegment[] = []
  let cursor = 0
  for (;;) {
    const match = findProjectedMediaChipMatch({ source, cursor, chips: virtualChips })
    if (!match) break
    if (match.start > cursor) segments.push({ kind: 'text', value: source.slice(cursor, match.start) })
    segments.push({
      kind: 'media',
      chip: match.chip,
      markdown: match.label,
      prefixGap: false,
    })
    cursor = match.end
  }
  if (cursor < source.length) segments.push({ kind: 'text', value: source.slice(cursor) })
  return segments.length ? segments : [{ kind: 'text', value: source }]
}

function normalizeVirtualMediaDraftSpacing(value: string): string {
  return String(value || '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim()
}

function buildVirtualMediaChipHtml(args: {
  label: string
  markdown?: string | null
  mediaKind: string
  prefixGap: boolean
  source?: string
}): string {
  const title = [
    `${args.label} - ${args.mediaKind}`,
    args.source ? `Source: ${args.source}` : '',
  ].filter(Boolean).join('\n')
  const className = [
    args.prefixGap ? 'ml-[0.25em]' : '',
    'inline-flex bg-[color:var(--kg-panel-bg)]',
    CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME,
  ].filter(Boolean).join(' ')
  const markdown = String(args.markdown || '').trim()
  return [
    `<span class="${escapeHtmlAttr(className)}"`,
    ` ${CARD_INLINE_TEXT_VIEWER_VIRTUAL_MEDIA_CHIP_ATTRIBUTE}="1"`,
    markdown ? ` ${CARD_INLINE_TEXT_VIEWER_MEDIA_MARKDOWN_ATTRIBUTE}="${escapeHtmlAttr(markdown)}"` : ` ${INLINE_MARKDOWN_ZERO_LENGTH_TOKEN_ATTR}="1"`,
    ' contenteditable="false"',
    ` title="${escapeHtmlAttr(title)}">`,
    `<span class="${escapeHtmlAttr(`${CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_CLASS_NAME} bg-black/5 text-[color:var(--kg-text-secondary)]`)}" aria-label="${escapeHtmlAttr(`${args.mediaKind} media`)}" data-kg-card-inline-wysiwyg-media-thumbnail="1"></span>`,
    `<span class="${escapeHtmlAttr(CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME)}">${escapeHtml(args.label)}</span>`,
    '</span>',
  ].join('')
}

export function buildCardInlineTextViewerEditHtml(args: {
  value: string
  projectedMediaAttachments?: readonly TextareaInvocationMediaAttachment[] | null
}): string {
  const markdownIt = getMarkdownItFastHtml()
  const renderTextSegment = (value: string): string => normalizeEscapedInlineMediaMarkdown(value)
    .split(/\n/g)
    .map((line, index) => `${index > 0 ? '<br/>' : ''}${line ? markdownIt.renderInline(line) : ''}`)
    .join('')
  return buildCardInlineTextViewerEditSegments(args)
    .map(segment => segment.kind === 'text'
      ? rewriteRenderedInlineMediaForEditorHtml(renderTextSegment(segment.value))
      : buildVirtualMediaChipHtml({
        label: segment.chip.displayLabel,
        markdown: segment.markdown,
        mediaKind: segment.chip.mediaKind,
        prefixGap: segment.prefixGap,
        source: segment.chip.sourceUrl || segment.chip.thumbnailUrl || '',
      }))
    .join('')
}

export function readCardInlineTextViewerEditDraft(
  root: HTMLElement | null,
): string {
  if (!root) return ''
  const workingRoot = root.cloneNode(true) as HTMLElement
  const virtualChips = Array.from(workingRoot.querySelectorAll(`[${CARD_INLINE_TEXT_VIEWER_VIRTUAL_MEDIA_CHIP_ATTRIBUTE}="1"]`))
  virtualChips.forEach(node => {
    const markdown = String(node.getAttribute(CARD_INLINE_TEXT_VIEWER_MEDIA_MARKDOWN_ATTRIBUTE) || '').trim()
    node.replaceWith(workingRoot.ownerDocument.createTextNode(markdown || ' '))
  })
  const markdown = readFastInlineMarkdownDraft(workingRoot, 'inline')
  const draft = String(markdown ?? readInlineMediaEditorMarkdownText(workingRoot) ?? '').replace(/\r/g, '')
  return virtualChips.length ? normalizeVirtualMediaDraftSpacing(draft) : draft
}

type CardInlineTextViewerSelectionBoundary = {
  node: Node
  offset: number
}

function readElementChildBoundary(element: Element, child: Node, after: boolean): CardInlineTextViewerSelectionBoundary {
  const parent = child.parentNode || element
  return {
    node: parent,
    offset: Math.max(0, Array.from(parent.childNodes as NodeListOf<Node>).indexOf(child) + (after ? 1 : 0)),
  }
}

function readTokenMarkdownLength(element: Element): number {
  const projectedMediaMarkdown = String(element.getAttribute(CARD_INLINE_TEXT_VIEWER_MEDIA_MARKDOWN_ATTRIBUTE) || '').trim()
  if (projectedMediaMarkdown) return projectedMediaMarkdown.length
  if (element.matches(INLINE_MARKDOWN_EDIT_TOKEN_SELECTOR)) {
    return readInlineMarkdownEditTokenMarkdown(element).length
  }
  return 0
}

function isZeroLengthTokenElement(element: Element): boolean {
  return element.matches(INLINE_MARKDOWN_ZERO_LENGTH_TOKEN_SELECTOR)
}

function findSelectionBoundary(root: HTMLElement, targetOffset: number): CardInlineTextViewerSelectionBoundary {
  const target = Math.max(0, targetOffset)
  let markdownOffset = 0
  let fallback: CardInlineTextViewerSelectionBoundary = { node: root, offset: root.childNodes.length }
  const visit = (node: Node): CardInlineTextViewerSelectionBoundary | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = String(node.nodeValue || '').replace(/\r/g, '')
      const nextOffset = markdownOffset + text.length
      if (target <= nextOffset) {
        return { node, offset: Math.max(0, Math.min(text.length, target - markdownOffset)) }
      }
      markdownOffset = nextOffset
      fallback = { node, offset: text.length }
      return null
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null
    const element = node as HTMLElement
    const tag = String(element.tagName || '').toLowerCase()
    if (isZeroLengthTokenElement(element)) {
      if (target <= markdownOffset) return readElementChildBoundary(root, element, false)
      fallback = readElementChildBoundary(root, element, true)
      return null
    }
    const tokenLength = readTokenMarkdownLength(element)
    if (tokenLength > 0) {
      const nextOffset = markdownOffset + tokenLength
      if (target <= markdownOffset) return readElementChildBoundary(root, element, false)
      if (target <= nextOffset) return readElementChildBoundary(root, element, true)
      markdownOffset = nextOffset
      fallback = readElementChildBoundary(root, element, true)
      return null
    }
    if (tag === 'br') {
      const nextOffset = markdownOffset + 1
      if (target <= nextOffset) return readElementChildBoundary(root, element, true)
      markdownOffset = nextOffset
      fallback = readElementChildBoundary(root, element, true)
      return null
    }
    for (const child of Array.from(element.childNodes)) {
      const found = visit(child)
      if (found) return found
    }
    return null
  }
  for (const child of Array.from(root.childNodes)) {
    const found = visit(child)
    if (found) return found
  }
  return fallback
}

export function focusCardInlineTextViewerSelectionSoon(
  editorRef: React.RefObject<HTMLElement | null>,
  start: number,
  end: number = start,
) {
  const pendingRoot = editorRef.current
  const pendingSelection = {
    start: Math.max(0, start),
    end: Math.max(0, end),
  }
  if (pendingRoot) pendingViewerSelections.set(pendingRoot, pendingSelection)
  window.requestAnimationFrame(() => {
    const root = editorRef.current
    if (!root) return
    pendingViewerSelections.delete(root)
    const selection = root.ownerDocument.defaultView?.getSelection()
    if (!selection) return
    const range = root.ownerDocument.createRange()
    const startBoundary = findSelectionBoundary(root, pendingSelection.start)
    const endBoundary = findSelectionBoundary(root, pendingSelection.end)
    range.setStart(startBoundary.node, startBoundary.offset)
    range.setEnd(endBoundary.node, endBoundary.offset)
    root.focus({ preventScroll: true })
    selection.removeAllRanges()
    selection.addRange(range)
  })
}

export function CardInlineTextViewerEditSurface(props: {
  value: string
  ariaLabel: string
  placeholder: string
  className?: string
  commandMode: unknown
  editorRef: React.RefObject<HTMLElement | null>
  inputProxyRef: React.RefObject<HTMLTextAreaElement | null>
  projectedMediaAttachments?: readonly TextareaInvocationMediaAttachment[] | null
  isCommandMenuTarget: (target: EventTarget | null) => boolean
  onCancel: () => void
  onCommit: (nextValue?: string) => void
  onDraftChange: (nextValue: string) => void
  onFocus: () => void
  onOpenCommandMenuForSigilAtSelection: (sigil: '/' | '@' | '#', selection: { start: number; end: number }) => void
  readCommandSigilFromKeyEvent: (event: KeyboardEvent) => '/' | '@' | '#' | null
  readCommandSigilFromInsertedText: (value: string | null | undefined) => '/' | '@' | '#' | null
  cardInlineEditInputAttribute: string
}) {
  const lastRenderedHtmlRef = React.useRef('')

  const readSelection = React.useCallback(() => {
    const root = props.editorRef.current
    const selection = getInlineMediaEditorMarkdownSelectionOffsets(root)
    if (selection) return { start: selection.startOffset, end: selection.endOffset }
    const fallback = readCardInlineTextViewerEditDraft(root).length
    return { start: fallback, end: fallback }
  }, [props.editorRef])

  const syncProxySelection = React.useCallback(() => {
    const input = props.inputProxyRef.current
    if (!input) return
    const selection = readSelection()
    try {
      input.setSelectionRange(selection.start, selection.end)
    } catch {
      void 0
    }
  }, [props.inputProxyRef, readSelection])

  const publishDraftFromDom = React.useCallback(() => {
    const root = props.editorRef.current
    const next = readCardInlineTextViewerEditDraft(root)
    props.onDraftChange(next)
    syncProxySelection()
    return next
  }, [props, syncProxySelection])

  React.useLayoutEffect(() => {
    const root = props.editorRef.current
    if (!root) return
    const value = String(props.value || '').replace(/\r/g, '')
    const pendingSelection = pendingViewerSelections.get(root)
    const ownerSelection = root.ownerDocument.defaultView?.getSelection()
    const ownsSelection = !!ownerSelection
      && ownerSelection.rangeCount > 0
      && root.contains(ownerSelection.anchorNode)
      && root.contains(ownerSelection.focusNode)
    const selectionBeforeRender = pendingSelection || (ownsSelection ? readSelection() : null)
    const html = buildCardInlineTextViewerEditHtml({
      value,
      projectedMediaAttachments: props.projectedMediaAttachments,
    })
    if (html !== lastRenderedHtmlRef.current || root.innerHTML !== html) {
      const wasUnrendered = !lastRenderedHtmlRef.current
      root.innerHTML = html
      lastRenderedHtmlRef.current = html
      const nextSelection = selectionBeforeRender || (wasUnrendered ? { start: value.length, end: value.length } : null)
      if (nextSelection) {
        focusCardInlineTextViewerSelectionSoon(props.editorRef, nextSelection.start, nextSelection.end)
      }
    }
  }, [props.editorRef, props.projectedMediaAttachments, props.value, readSelection])

  return (
    <section className="relative h-full min-h-0 w-full" data-kg-card-inline-viewer-edit-shell="1">
      {!String(props.value || '').trim() ? (
        <span
          className="pointer-events-none absolute left-1.5 top-1 z-0 italic text-[color:var(--kg-text-tertiary)]"
          data-kg-card-inline-viewer-edit-placeholder="1"
        >
          {props.placeholder}
        </span>
      ) : null}
      <section
        ref={(node: HTMLElement | null) => {
          ;(props.editorRef as React.MutableRefObject<HTMLElement | null>).current = node
        }}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={props.ariaLabel}
        spellCheck
        className={cn(
          MARKDOWN_NORMAL_TEXT_EDIT_SURFACE_CLASS,
          MARKDOWN_TEXT_EDIT_SURFACE_MIN_LINE_HEIGHT_CLASS,
          'relative z-10 min-h-0 w-full focus:outline-none focus-visible:outline-none',
          '[overflow-wrap:anywhere] [caret-color:var(--kg-text-primary)]',
          props.className,
        )}
        data-kg-card-inline-viewer-edit-surface="1"
        {...{ [props.cardInlineEditInputAttribute]: '1' }}
        onBeforeInput={event => {
          if (props.commandMode) return
          const nativeEvent = event.nativeEvent as InputEvent
          if (nativeEvent.inputType !== 'insertText') return
          const sigil = props.readCommandSigilFromInsertedText(nativeEvent.data)
          if (!sigil) return
          event.preventDefault()
          props.onOpenCommandMenuForSigilAtSelection(sigil, readSelection())
        }}
        onInput={() => {
          publishDraftFromDom()
        }}
        onFocus={() => {
          props.onFocus()
          syncProxySelection()
        }}
        onBlur={event => {
          if (props.isCommandMenuTarget(event.relatedTarget)) return
          if (props.commandMode) return
          props.onCommit(publishDraftFromDom())
        }}
        onKeyDown={event => {
          event.stopPropagation()
          if (event.key === 'Escape') {
            event.preventDefault()
            props.onCancel()
            return
          }
          const sigil = props.readCommandSigilFromKeyEvent(event.nativeEvent)
          if (sigil) {
            event.preventDefault()
            props.onOpenCommandMenuForSigilAtSelection(sigil, readSelection())
            return
          }
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            props.onCommit(publishDraftFromDom())
          }
        }}
        onMouseUp={syncProxySelection}
        onKeyUp={syncProxySelection}
        onDoubleClick={event => {
          event.stopPropagation()
        }}
      />
      <textarea
        ref={props.inputProxyRef}
        value={props.value}
        readOnly
        aria-hidden="true"
        tabIndex={-1}
      className="sr-only"
      data-kg-card-inline-viewer-edit-command-proxy="1"
    />
    </section>
  )
}
