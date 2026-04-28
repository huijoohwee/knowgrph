import React from 'react'
import { getMarkdownItFastHtml } from '@/features/markdown/markdownIt'
import { convertHtmlToMarkdownUnified } from '@/lib/markdown/htmlToMarkdownUnified'
import { areReplacementLinesNoop } from '@/features/markdown/ui/markdownEditParitySsot'
import { rewriteSigilSpansToInlineCodeHtml } from '@/features/markdown/ui/markdownSigil'
import { getSelectionOffsetsWithin, setSelectionByOffsetsWithin } from './markdownBlockContainerCore.selection'
import { buildReplacementLinesFromDraftWithPrefixes, HTML_TO_MARKDOWN_UNIFIED_DEFAULTS } from './markdownBlockContainerCore.commit'

export const useMarkdownBlockContainerDraftCommit = (args: {
  editable: boolean
  onReplaceLineRange?: (args: { startLine: number; endLine: number; replacementLines: string[] }) => void
  sourceLines?: string[]
  editStartLine: number
  editEndLine: number
  initialText: string
  editorPresentation: 'markdown' | 'html'
  htmlRenderMode: 'inline' | 'block'
  normalizeRenderedBlockHtmlForEditor: (renderedHtml: string) => string
  editDefaultLinePrefix?: string
  hasEditStripLinePrefix: boolean
  editLinePrefixesRef: React.MutableRefObject<string[] | null>
  initialPresentTextRef: React.MutableRefObject<string>
  initialEditorHtmlRef: React.MutableRefObject<string>
  draftRef: React.MutableRefObject<string>
  editDirtyRef: React.MutableRefObject<boolean>
  editSessionIdRef: React.MutableRefObject<number>
  editorRef: React.MutableRefObject<HTMLElement | null>
  hostRef: React.MutableRefObject<HTMLElement | null>
  setEditing: React.Dispatch<React.SetStateAction<boolean>>
  setSessionEditLineRange: React.Dispatch<React.SetStateAction<{ startLine: number; endLine: number } | null>>
}) => {
  const hasSemanticRichMarkup = React.useCallback((root: HTMLElement): boolean => {
    const nodes = Array.from(root.querySelectorAll('*'))
    for (let i = 0; i < nodes.length; i += 1) {
      const tag = String(nodes[i].tagName || '').toLowerCase()
      if (tag === 'div' || tag === 'p' || tag === 'span' || tag === 'br') continue
      return true
    }
    return false
  }, [])

  const readEditorPlainText = React.useCallback((): string => {
    const el = args.editorRef.current
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
  }, [args.editorRef])

  const getSelectionOffsets = React.useCallback((): { startOffset: number; endOffset: number } | null => {
    const root = args.editorRef.current
    if (!root) return null
    return getSelectionOffsetsWithin(root)
  }, [args.editorRef])

  const setSelectionByOffsets = React.useCallback((selection: { startOffset: number; endOffset: number }) => {
    const root = args.editorRef.current
    if (!root) return
    setSelectionByOffsetsWithin(root, selection)
  }, [args.editorRef])

  const setDraftToDom = React.useCallback((nextText: string, selection?: { startOffset: number; endOffset: number }) => {
    const el = args.editorRef.current
      || (args.hostRef.current?.querySelector('[contenteditable="true"]') as HTMLElement | null)
      || (typeof document !== 'undefined'
        ? ((document.querySelector('[aria-label="Edit markdown block"]') as HTMLElement | null)
          || (document.querySelector('[contenteditable="true"]') as HTMLElement | null))
        : null)
    if (!el) return
    if (!args.editorRef.current) args.editorRef.current = el
    args.draftRef.current = nextText
    if (args.editorPresentation === 'html') {
      const md = getMarkdownItFastHtml()
      if (args.htmlRenderMode === 'block') {
        const rendered = md.render(nextText)
        if (rendered.replace(/\s+/g, '').length === 0 && String(nextText || '').trim()) el.textContent = nextText
        else el.innerHTML = args.normalizeRenderedBlockHtmlForEditor(rendered)
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
  }, [args, setSelectionByOffsets])

  const getDraft = React.useCallback(() => args.draftRef.current, [args.draftRef])

  const buildReplacementLinesFromDraft = React.useCallback((draft: string): string[] => {
    return buildReplacementLinesFromDraftWithPrefixes({
      draft,
      prefixes: args.editLinePrefixesRef.current,
      initialPresentText: args.initialPresentTextRef.current,
      editDefaultLinePrefix: args.editDefaultLinePrefix,
      hasEditStripLinePrefix: args.hasEditStripLinePrefix,
    })
  }, [args.editDefaultLinePrefix, args.editLinePrefixesRef, args.hasEditStripLinePrefix, args.initialPresentTextRef])

  const commit = React.useCallback(() => {
    if (!args.editable || !args.onReplaceLineRange) return
    if (args.editorPresentation === 'html') {
      const root = args.editorRef.current
      const hasDomMutation = !!root && root.innerHTML !== args.initialEditorHtmlRef.current
      if (!args.editDirtyRef.current) {
        if (hasDomMutation) args.editDirtyRef.current = true
        else {
          args.setEditing(false)
          args.setSessionEditLineRange(null)
          return
        }
      }
      if (!root) {
        args.setEditing(false)
        args.setSessionEditLineRange(null)
        return
      }
      const sessionId = args.editSessionIdRef.current
      args.setEditing(false)
      const html = rewriteSigilSpansToInlineCodeHtml(root.innerHTML)
      void (async () => {
        const plainDraft = readEditorPlainText()
        const preferPlainTextInlineCommit =
          args.htmlRenderMode === 'inline'
          && !hasSemanticRichMarkup(root)
        const markdown = preferPlainTextInlineCommit
          ? String(plainDraft || '').replace(/\r/g, '').replace(/\n+$/g, '')
          : await (async () => {
            const result = await convertHtmlToMarkdownUnified({
              html: `<div>${html}</div>`,
              ...HTML_TO_MARKDOWN_UNIFIED_DEFAULTS,
            })
            if (!result.ok) return ''
            return String(result.markdown || '').replace(/\s+$/g, '')
          })()
        if (args.editSessionIdRef.current !== sessionId) return
        if (!preferPlainTextInlineCommit && !markdown) return
        if (markdown === args.initialPresentTextRef.current) return
        const replacementLines = buildReplacementLinesFromDraft(markdown)
        if (areReplacementLinesNoop({ sourceLines: args.sourceLines, startLine: args.editStartLine, endLine: args.editEndLine, replacementLines })) {
          args.setSessionEditLineRange(null)
          return
        }
        args.onReplaceLineRange?.({ startLine: args.editStartLine, endLine: args.editEndLine, replacementLines })
        args.setSessionEditLineRange(null)
      })()
      return
    }
    const draft = getDraft()
    if (draft === args.initialText) {
      args.setEditing(false)
      args.setSessionEditLineRange(null)
      return
    }
    const replacementLines = buildReplacementLinesFromDraft(draft)
    if (areReplacementLinesNoop({ sourceLines: args.sourceLines, startLine: args.editStartLine, endLine: args.editEndLine, replacementLines })) {
      args.setEditing(false)
      args.setSessionEditLineRange(null)
      return
    }
    args.onReplaceLineRange({ startLine: args.editStartLine, endLine: args.editEndLine, replacementLines })
    args.setEditing(false)
    args.setSessionEditLineRange(null)
  }, [args, buildReplacementLinesFromDraft, getDraft, hasSemanticRichMarkup, readEditorPlainText])

  const cancel = React.useCallback(() => {
    args.setEditing(false)
    args.setSessionEditLineRange(null)
  }, [args])

  return {
    readEditorPlainText,
    getSelectionOffsets,
    setSelectionByOffsets,
    setDraftToDom,
    getDraft,
    buildReplacementLinesFromDraft,
    commit,
    cancel,
  }
}
