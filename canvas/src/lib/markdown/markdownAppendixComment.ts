import { parseMarkdownCommentMarker } from '@/lib/markdown/markdownCommentMarker'
import { parseMarkdownInlineCodeSemantic } from '@/lib/markdown/markdownSigil'

const APPENDIX_OPEN_MARKER = '<!-- appendix -->'
const APPENDIX_CLOSE_MARKER = '<!-- /appendix -->'
const COMMENT_CLOSE_MARKER = '<!-- /comment -->'
const CALLOUT_CLOSE_MARKER = '<!-- /callout -->'
const COMMENT_RANGE_ID_RE = /`@comment:(c-[^`\s]+)`/g
const COMMENT_BLOCK_ID_RE = /<!--\s*comment\s*\|[\s\S]*?\bid:\s*(c-[^|\s>]+)[\s\S]*?-->/gi
const FOOTNOTE_DEFINITION_RE = /^\[\^[^\]\n]+\]:/m
const FOOTNOTE_REF_RE = /^\[\^([^\]\n]+)\]$/
const APPENDIX_REVIEW_ENTRY_RE = /<!--\s*(?:comment|callout)\b/m
const APPENDIX_FOOTNOTE_ENTRY_RE = /^\[\^[^\]\n]+\]:/m

type AppendixSelectionTarget =
  | { kind: 'comment'; selectedText: string; selectedMarkdown: string }
  | { kind: 'metadata'; selectedText: string; selectedMarkdown: string; label: string; metadataType: string; metadataValue: string }
  | { kind: 'callout'; selectedText: string; selectedMarkdown: string; calloutId: string }
  | { kind: 'footnote'; selectedText: string; selectedMarkdown: string; footnoteRef: string }
  | { kind: 'author-note'; selectedText: string; selectedMarkdown: string; noteText: string }

type AppendixEntryKind = 'author-note' | 'review-entry' | 'footnote' | 'metadata'

export type AppendixAuthoringPromptConfig = {
  targetKind: 'comment' | 'metadata' | 'callout' | 'footnote' | 'author-note'
  message: string
  defaultText: string
}

const zeroPadCommentId = (value: number): string => String(value).padStart(3, '0')

const escapeCommentText = (value: string): string => String(value || '').replace(/\|/g, '—').replace(/\r?\n+/g, ' ').trim()

const escapeRegex = (value: string): string => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const readCleanTargetText = (value: string): string => escapeCommentText(value) || 'selection'

const readTargetDisplayText = (target: AppendixSelectionTarget): string => {
  if (target.kind === 'callout' || target.kind === 'metadata') {
    const selectedText = readCleanTargetText(target.selectedText)
    const normalizedMarkdownText = readCleanTargetText(String(target.selectedMarkdown || '').replace(/^`|`$/g, ''))
    if (selectedText && selectedText !== normalizedMarkdownText) return selectedText
    const semantic = parseMarkdownInlineCodeSemantic(target.selectedMarkdown)
    if (semantic && semantic.kind !== 'annotation') {
      return readCleanTargetText(semantic.displayText || target.selectedText)
    }
  }
  return readCleanTargetText(target.selectedText)
}

const buildDefaultAppendixAuthoringText = (target: AppendixSelectionTarget): string => {
  const targetText = readTargetDisplayText(target)
  switch (target.kind) {
    case 'callout':
      return `TODO: expand deferred callout guidance for "${targetText}" before publish.`
    case 'footnote':
      return `TODO: expand citation for "${targetText}".`
    case 'author-note':
      return target.noteText || `@todo: expand author note for "${targetText}"`
    case 'metadata':
      return `TODO: document ${target.label} "${targetText}" in appendix context and explain why it is used here.`
    default:
      return `TODO: add long comment for "${targetText}".`
  }
}

const buildAppendixAuthoringPromptMessage = (target: AppendixSelectionTarget): string => {
  switch (target.kind) {
    case 'callout':
      return 'Callout / Admonition appendix text'
    case 'footnote':
      return 'Footnote / Citation text'
    case 'author-note':
      return 'Author note text'
    case 'metadata':
      return 'Metadata note text'
    default:
      return 'Comment text'
  }
}

const readUsedCommentIds = (markdown: string): Set<string> => {
  const used = new Set<string>()
  const source = String(markdown || '')
  COMMENT_RANGE_ID_RE.lastIndex = 0
  let rangeMatch: RegExpExecArray | null
  while ((rangeMatch = COMMENT_RANGE_ID_RE.exec(source))) {
    const id = String(rangeMatch[1] || '').trim()
    if (id) used.add(id)
  }
  COMMENT_BLOCK_ID_RE.lastIndex = 0
  let blockMatch: RegExpExecArray | null
  while ((blockMatch = COMMENT_BLOCK_ID_RE.exec(source))) {
    const id = String(blockMatch[1] || '').trim()
    if (id) used.add(id)
  }
  return used
}

const readSemanticMetadataLabel = (selectedMarkdown: string): string | null => {
  const semantic = parseMarkdownInlineCodeSemantic(selectedMarkdown)
  if (!semantic || semantic.kind === 'annotation') return null
  if (semantic.kind === 'reference') {
    if (semantic.referenceKind === 'callout') return null
    if (semantic.referenceKind === 'comment') return 'comment reference'
    return `${semantic.referenceKind} reference`
  }
  if (semantic.valueKind === 'key') return 'keyboard shortcut'
  if (semantic.valueKind === 'ui-path') return 'UI path'
  return `${semantic.valueKind} metadata`
}

const classifyAppendixSelectionTarget = (selectedMarkdown: string, selectedText: string): AppendixSelectionTarget => {
  const rawMarkdown = String(selectedMarkdown || '').trim()
  const visibleText = String(selectedText || '').trim() || rawMarkdown
  if (/^<!--[\s\S]*?-->$/.test(rawMarkdown)) {
    const parsedComment = parseMarkdownCommentMarker(rawMarkdown)
    if (parsedComment.kind === 'author-note') {
      return {
        kind: 'author-note',
        selectedText: visibleText,
        selectedMarkdown: rawMarkdown,
        noteText: parsedComment.text,
      }
    }
  }
  const footnoteMatch = rawMarkdown.match(FOOTNOTE_REF_RE)
  if (footnoteMatch) {
    return {
      kind: 'footnote',
      selectedText: visibleText,
      selectedMarkdown: rawMarkdown,
      footnoteRef: String(footnoteMatch[1] || '').trim(),
    }
  }
  const semantic = parseMarkdownInlineCodeSemantic(rawMarkdown)
  if (semantic?.kind === 'reference' && semantic.referenceKind === 'callout') {
    return {
      kind: 'callout',
      selectedText: visibleText,
      selectedMarkdown: rawMarkdown,
      calloutId: String(semantic.value || '').trim(),
    }
  }
  const metadataLabel = readSemanticMetadataLabel(rawMarkdown)
  if (metadataLabel) {
    const semanticForMetadata = parseMarkdownInlineCodeSemantic(rawMarkdown)
    const metadataType =
      semanticForMetadata?.kind === 'reference'
        ? semanticForMetadata.referenceKind
        : semanticForMetadata?.kind === 'value'
        ? semanticForMetadata.valueKind
        : metadataLabel
    const metadataValue = semanticForMetadata && semanticForMetadata.kind !== 'annotation'
      ? String(semanticForMetadata.value || semanticForMetadata.displayText || visibleText).trim()
      : visibleText
    return {
      kind: 'metadata',
      selectedText: visibleText,
      selectedMarkdown: rawMarkdown,
      label: metadataLabel,
      metadataType,
      metadataValue,
    }
  }
  return {
    kind: 'comment',
    selectedText: visibleText,
    selectedMarkdown: rawMarkdown,
  }
}

export const readAppendixAuthoringPromptConfig = (args: {
  selectedMarkdown: string
  selectedText: string
}): AppendixAuthoringPromptConfig | null => {
  const selectedMarkdown = String(args.selectedMarkdown || '').trim()
  const selectedText = String(args.selectedText || '').trim()
  if (!selectedMarkdown || !selectedText) return null
  if (/^`@comment:c-[^`\s]+`$/u.test(selectedMarkdown)) return null
  const target = classifyAppendixSelectionTarget(selectedMarkdown, selectedText)
  return {
    targetKind: target.kind,
    message: buildAppendixAuthoringPromptMessage(target),
    defaultText: buildDefaultAppendixAuthoringText(target),
  }
}

const hasExistingCalloutAppendixBlock = (markdown: string, calloutId: string): boolean => {
  const id = String(calloutId || '').trim()
  if (!id) return false
  return new RegExp(`<!--\\s*callout\\s*\\|[^\\n]*\\bid:\\s*${escapeRegex(id)}(?:\\s*\\||\\s*-->)`, 'i').test(String(markdown || ''))
}

const hasExistingFootnoteDefinition = (markdown: string, footnoteRef: string): boolean => {
  const ref = String(footnoteRef || '').trim()
  if (!ref) return false
  return new RegExp(`^\\[\\^${escapeRegex(ref)}\\]:`, 'm').test(String(markdown || ''))
}

export const readNextAppendixCommentId = (markdown: string): string => {
  const used = readUsedCommentIds(markdown)
  let maxNumeric = 0
  used.forEach(id => {
    const match = /^c-(\d+)$/.exec(id)
    if (!match) return
    const value = Number(match[1])
    if (Number.isFinite(value) && value > maxNumeric) maxNumeric = value
  })
  const nextNumeric = maxNumeric > 0 ? maxNumeric + 1 : 1
  let candidate = `c-${zeroPadCommentId(nextNumeric)}`
  while (used.has(candidate)) {
    candidate = `c-${zeroPadCommentId(Number(candidate.slice(2)) + 1)}`
  }
  return candidate
}

const buildAppendixCommentBlock = (args: { id: string; target: AppendixSelectionTarget; authoredText?: string | null }) => {
  const text = escapeCommentText(args.authoredText || buildDefaultAppendixAuthoringText(args.target))
  return [
    `<!-- comment | id: ${args.id} | author: TODO | text: ${text} -->`,
    COMMENT_CLOSE_MARKER,
  ].join('\n')
}

const buildAppendixCalloutBlock = (args: { calloutId: string; selectedMarkdown: string; selectedText: string; authoredText?: string | null }) => {
  const targetText = readTargetDisplayText({
    kind: 'callout',
    calloutId: args.calloutId,
    selectedMarkdown: args.selectedMarkdown,
    selectedText: args.selectedText,
  })
  const bodyText = escapeCommentText(args.authoredText || `TODO: expand deferred callout guidance for "${targetText}" before publish.`)
  return [
    `<!-- callout | id: ${args.calloutId} | type: note | title: ${targetText} note pending -->`,
    bodyText,
    CALLOUT_CLOSE_MARKER,
  ].join('\n')
}

const buildAppendixAuthorNote = (args: { noteText: string; selectedText: string; authoredText?: string | null }) => {
  const targetText = readCleanTargetText(args.selectedText)
  const noteText = escapeCommentText(args.authoredText || args.noteText || `@todo: expand author note for "${targetText}"`)
  return `<!-- // ${noteText} -->`
}

const buildAppendixFootnoteDefinition = (args: { footnoteRef: string; selectedText: string; authoredText?: string | null }) => {
  const text = escapeCommentText(args.authoredText || `TODO: expand citation for "${readCleanTargetText(args.selectedText)}".`)
  return `[^${args.footnoteRef}]: ${text}`
}

const buildAppendixMetadataEntry = (args: { target: Extract<AppendixSelectionTarget, { kind: 'metadata' }>; authoredText?: string | null }) => {
  const noteText = escapeCommentText(args.authoredText || buildDefaultAppendixAuthoringText(args.target))
  return `<!-- metadata | type: ${args.target.metadataType} | value: ${escapeCommentText(args.target.metadataValue)} | note: ${noteText} -->`
}

const insertReviewEntryIntoExistingAppendix = (markdown: string, block: string): string => {
  const source = String(markdown || '')
  const appendixOpenIndex = source.indexOf(APPENDIX_OPEN_MARKER)
  const appendixCloseIndex = source.indexOf(APPENDIX_CLOSE_MARKER)
  if (appendixOpenIndex < 0 || appendixCloseIndex < appendixOpenIndex) return source
  const beforeClose = source.slice(0, appendixCloseIndex)
  const afterClose = source.slice(appendixCloseIndex)
  const appendixBody = source.slice(appendixOpenIndex + APPENDIX_OPEN_MARKER.length, appendixCloseIndex)
  const footnoteMatch = FOOTNOTE_DEFINITION_RE.exec(appendixBody)
  if (footnoteMatch && typeof footnoteMatch.index === 'number') {
    const absoluteIndex = appendixOpenIndex + APPENDIX_OPEN_MARKER.length + footnoteMatch.index
    const beforeFootnotes = source.slice(0, absoluteIndex).replace(/\s*$/, '\n\n')
    const fromFootnotes = source.slice(absoluteIndex).replace(/^\s*/, '')
    return `${beforeFootnotes}${block}\n\n${fromFootnotes}`
  }
  return `${beforeClose.replace(/\s*$/, '\n\n')}${block}\n\n${afterClose.replace(/^\s*/, '')}`
}

const insertAuthorNoteIntoExistingAppendix = (markdown: string, block: string): string => {
  const source = String(markdown || '')
  const appendixOpenIndex = source.indexOf(APPENDIX_OPEN_MARKER)
  const appendixCloseIndex = source.indexOf(APPENDIX_CLOSE_MARKER)
  if (appendixOpenIndex < 0 || appendixCloseIndex < appendixOpenIndex) return source
  const appendixBodyStart = appendixOpenIndex + APPENDIX_OPEN_MARKER.length
  const appendixBody = source.slice(appendixBodyStart, appendixCloseIndex)
  const anchorMatch = appendixBody.match(APPENDIX_REVIEW_ENTRY_RE) || appendixBody.match(APPENDIX_FOOTNOTE_ENTRY_RE)
  if (anchorMatch && typeof anchorMatch.index === 'number') {
    const absoluteIndex = appendixBodyStart + anchorMatch.index
    const beforeAnchor = source.slice(0, absoluteIndex).replace(/\s*$/, '\n\n')
    const fromAnchor = source.slice(absoluteIndex).replace(/^\s*/, '')
    return `${beforeAnchor}${block}\n\n${fromAnchor}`
  }
  const beforeClose = source.slice(0, appendixCloseIndex)
  const afterClose = source.slice(appendixCloseIndex)
  return `${beforeClose.replace(/\s*$/, '\n\n')}${block}\n\n${afterClose.replace(/^\s*/, '')}`
}

const insertFootnoteIntoExistingAppendix = (markdown: string, block: string): string => {
  const source = String(markdown || '')
  const appendixOpenIndex = source.indexOf(APPENDIX_OPEN_MARKER)
  const appendixCloseIndex = source.indexOf(APPENDIX_CLOSE_MARKER)
  if (appendixOpenIndex < 0 || appendixCloseIndex < appendixOpenIndex) return source
  const beforeClose = source.slice(0, appendixCloseIndex)
  const afterClose = source.slice(appendixCloseIndex)
  return `${beforeClose.replace(/\s*$/, '\n\n')}${block}\n\n${afterClose.replace(/^\s*/, '')}`
}

const insertMetadataIntoExistingAppendix = (markdown: string, block: string): string => {
  const source = String(markdown || '')
  const appendixOpenIndex = source.indexOf(APPENDIX_OPEN_MARKER)
  const appendixCloseIndex = source.indexOf(APPENDIX_CLOSE_MARKER)
  if (appendixOpenIndex < 0 || appendixCloseIndex < appendixOpenIndex) return source
  const beforeClose = source.slice(0, appendixCloseIndex)
  const afterClose = source.slice(appendixCloseIndex)
  return `${beforeClose.replace(/\s*$/, '\n\n')}${block}\n\n${afterClose.replace(/^\s*/, '')}`
}

const appendNewAppendixBlock = (markdown: string, block: string): string => {
  const source = String(markdown || '').replace(/\s*$/, '')
  const hasTerminalDivider = /(?:^|\n)---\s*$/.test(source)
  const appendix = [
    APPENDIX_OPEN_MARKER,
    '',
    block,
    '',
    APPENDIX_CLOSE_MARKER,
  ].join('\n')
  if (hasTerminalDivider) {
    return `${source}\n\n${appendix}`
  }
  return `${source}\n\n---\n\n${appendix}`
}

const insertAppendixEntry = (markdown: string, block: string, kind: AppendixEntryKind): string => {
  const source = String(markdown || '')
  if (source.includes(APPENDIX_OPEN_MARKER) && source.includes(APPENDIX_CLOSE_MARKER)) {
    if (kind === 'author-note') return insertAuthorNoteIntoExistingAppendix(source, block)
    if (kind === 'footnote') return insertFootnoteIntoExistingAppendix(source, block)
    if (kind === 'metadata') return insertMetadataIntoExistingAppendix(source, block)
    return insertReviewEntryIntoExistingAppendix(source, block)
  }
  return appendNewAppendixBlock(source, block)
}

export const applyAppendixCommentToSelection = (args: {
  markdown: string
  startOffset: number
  endOffset: number
  selectedMarkdown: string
  selectedText: string
  authoredText?: string | null
}): { nextMarkdown: string; commentId: string; previewText: string } | null => {
  const source = String(args.markdown || '')
  const a = Math.max(0, Math.min(source.length, args.startOffset))
  const b = Math.max(0, Math.min(source.length, args.endOffset))
  const start = Math.min(a, b)
  const end = Math.max(a, b)
  if (start === end) return null
  const selected = source.slice(start, end)
  if (!selected || /\r?\n/.test(selected)) return null
  const selectedMarkdown = String(args.selectedMarkdown || selected).trim()
  const selectedText = String(args.selectedText || selected).trim()
  if (!selectedMarkdown || !selectedText) return null
  if (/^`@comment:c-[^`\s]+`$/u.test(selectedMarkdown)) return null
  const target = classifyAppendixSelectionTarget(selectedMarkdown, selectedText)
  if (target.kind === 'callout') {
    if (hasExistingCalloutAppendixBlock(source, target.calloutId)) {
      return { nextMarkdown: source, commentId: '', previewText: selectedText }
    }
    return {
      nextMarkdown: insertAppendixEntry(
        source,
        buildAppendixCalloutBlock({
          calloutId: target.calloutId,
          selectedMarkdown: target.selectedMarkdown,
          selectedText: target.selectedText,
          authoredText: args.authoredText,
        }),
        'review-entry',
      ),
      commentId: '',
      previewText: escapeCommentText(args.authoredText || buildDefaultAppendixAuthoringText(target)),
    }
  }
  if (target.kind === 'footnote') {
    if (hasExistingFootnoteDefinition(source, target.footnoteRef)) {
      return { nextMarkdown: source, commentId: '', previewText: selectedText }
    }
    return {
      nextMarkdown: insertAppendixEntry(
        source,
        buildAppendixFootnoteDefinition({
          footnoteRef: target.footnoteRef,
          selectedText: target.selectedText,
          authoredText: args.authoredText,
        }),
        'footnote',
      ),
      commentId: '',
      previewText: escapeCommentText(args.authoredText || buildDefaultAppendixAuthoringText(target)),
    }
  }
  if (target.kind === 'author-note') {
    return {
      nextMarkdown: insertAppendixEntry(
        source,
        buildAppendixAuthorNote({
          noteText: target.noteText,
          selectedText: target.selectedText,
          authoredText: args.authoredText,
        }),
        'author-note',
      ),
      commentId: '',
      previewText: escapeCommentText(args.authoredText || target.noteText || buildDefaultAppendixAuthoringText(target)),
    }
  }
  if (target.kind === 'metadata') {
    const nextMarkdown = insertAppendixEntry(
      source,
      buildAppendixMetadataEntry({ target, authoredText: args.authoredText }),
      'metadata',
    )
    return {
      nextMarkdown,
      commentId: '',
      previewText: escapeCommentText(args.authoredText || buildDefaultAppendixAuthoringText(target)),
    }
  }
  if (/^<!--[\s\S]*?-->$/.test(selectedMarkdown)) return null
  const commentId = readNextAppendixCommentId(source)
  const wrappedSelection = `\`@comment:${commentId}\`${selectedMarkdown}\`@comment:${commentId}\``
  const nextBodyMarkdown = `${source.slice(0, start)}${wrappedSelection}${source.slice(end)}`
  const nextMarkdown = insertAppendixEntry(
    nextBodyMarkdown,
    buildAppendixCommentBlock({ id: commentId, target, authoredText: args.authoredText }),
    'review-entry',
  )
  return {
    nextMarkdown,
    commentId,
    previewText: escapeCommentText(args.authoredText || buildDefaultAppendixAuthoringText(target)),
  }
}
