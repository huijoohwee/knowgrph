import React from 'react'
import { getMarkdownItFastHtml } from '@/features/markdown/markdownIt'
import { convertHtmlToMarkdownUnified } from '@/lib/markdown/htmlToMarkdownUnified'
import { areReplacementLinesNoop } from '@/features/markdown/ui/markdownEditParitySsot'
import { rewriteInlineCodeSigilsToStyledSpansHtml, rewriteSigilSpansToInlineCodeHtml } from '@/features/markdown/ui/markdownSigil'
import { replaceMarkdownLineRange } from 'grph-shared/markdown/lineEditing'
import { getSelectionOffsetsWithin, setSelectionByOffsetsWithin } from './markdownBlockContainerCore.selection'
import { buildReplacementLinesFromDraftWithPrefixes, HTML_TO_MARKDOWN_UNIFIED_DEFAULTS } from './markdownBlockContainerCore.commit'

const DEFAULT_HIGHLIGHT_EDITOR_BG = '#FEF08A'

const rewriteInlineEditorAnnotationsToStyledHtml = (html: string): string => {
  const sigilStyledHtml = rewriteInlineCodeSigilsToStyledSpansHtml(html)
  const raw = String(sigilStyledHtml || '')
  if (!raw.trim()) return raw
  if (typeof DOMParser === 'undefined') return raw
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html')
  } catch {
    return raw
  }
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return raw
  const footnoteRefNodes = Array.from(root.querySelectorAll('[data-kg-footnote-ref="1"]')) as HTMLElement[]
  footnoteRefNodes.forEach(node => {
    const label = String(node.getAttribute('data-kg-footnote-label') || node.textContent || '').trim()
    if (!label) return
    node.replaceWith(doc.createTextNode(`[^${label.replace(/^\[\^?/, '').replace(/\]$/, '')}]`))
  })
  const comments = Array.from(root.childNodes).filter(node => node.nodeType === Node.COMMENT_NODE)
  const commentWalker = doc.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
  let commentNode = commentWalker.nextNode()
  while (commentNode) {
    comments.push(commentNode)
    commentNode = commentWalker.nextNode()
  }
  for (let i = 0; i < comments.length; i += 1) {
    const comment = comments[i] as Comment
    const span = doc.createElement('span')
    span.setAttribute('data-kg-comment', '1')
    span.style.opacity = '0.65'
    span.style.fontStyle = 'italic'
    span.textContent = String(comment.nodeValue || '').trim()
    comment.replaceWith(span)
  }
  const textNodes: Text[] = []
  const textWalker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let currentNode = textWalker.nextNode()
  while (currentNode) {
    textNodes.push(currentNode as Text)
    currentNode = textWalker.nextNode()
  }
  for (let i = 0; i < textNodes.length; i += 1) {
    const textNode = textNodes[i]!
    const parent = textNode.parentElement
    if (!parent) continue
    if (parent.closest('code,[data-kg-sigil="1"],[data-kg-inline-code-token="1"],[data-kg-footnote-ref="1"],[data-kg-comment="1"],mark,[data-kg-default-highlight="1"]')) continue
    const rawText = String(textNode.nodeValue || '')
    if (!rawText.includes('==')) continue
    const regex = /==([\s\S]+?)==/g
    let lastIndex = 0
    let match: RegExpExecArray | null
    const fragment = doc.createDocumentFragment()
    let changed = false
    while ((match = regex.exec(rawText))) {
      changed = true
      if (match.index > lastIndex) {
        fragment.appendChild(doc.createTextNode(rawText.slice(lastIndex, match.index)))
      }
      const mark = doc.createElement('mark')
      mark.setAttribute('data-kg-default-highlight', '1')
      mark.style.backgroundColor = DEFAULT_HIGHLIGHT_EDITOR_BG
      mark.textContent = String(match[1] || '')
      fragment.appendChild(mark)
      lastIndex = match.index + match[0].length
    }
    if (!changed) continue
    if (lastIndex < rawText.length) {
      fragment.appendChild(doc.createTextNode(rawText.slice(lastIndex)))
    }
    textNode.replaceWith(fragment)
  }
  return root.innerHTML
}

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
  lastSerializedEditorHtmlRef: React.MutableRefObject<string>
  draftRef: React.MutableRefObject<string>
  editDirtyRef: React.MutableRefObject<boolean>
  editSessionIdRef: React.MutableRefObject<number>
  editorRef: React.MutableRefObject<HTMLElement | null>
  hostRef: React.MutableRefObject<HTMLElement | null>
  setEditing: React.Dispatch<React.SetStateAction<boolean>>
  setSessionEditLineRange: React.Dispatch<React.SetStateAction<{ startLine: number; endLine: number } | null>>
  onDraftTextChange?: (nextText: string, options?: { reflectInViewer?: boolean }) => void
}) => {
  const hasSemanticRichMarkup = React.useCallback((root: HTMLElement): boolean => {
    const nodes = Array.from(root.querySelectorAll('*'))
    for (let i = 0; i < nodes.length; i += 1) {
      const element = nodes[i] as HTMLElement
      const tag = String(element.tagName || '').toLowerCase()
      if (tag === 'span') {
        const hasSemanticSpanState =
          element.hasAttribute('data-kg-sigil')
          || element.hasAttribute('data-kg-inline-code-token')
          || element.hasAttribute('data-kg-footnote-ref')
          || element.hasAttribute('data-kg-comment')
          || element.hasAttribute('data-kg-sigil-color')
          || element.hasAttribute('data-kg-sigil-bg')
          || String(element.getAttribute('style') || '').trim().length > 0
        if (hasSemanticSpanState) return true
        continue
      }
      if (tag === 'div' || tag === 'p' || tag === 'br') continue
      return true
    }
    return false
  }, [])

  const readPlainTextFromRoot = React.useCallback((root: HTMLElement | null): string => {
    if (!root) return ''
    const nodes = Array.from(root.childNodes)
    const elementChildren = nodes.filter(n => n.nodeType === Node.ELEMENT_NODE) as HTMLElement[]
    if (elementChildren.length === 0) return String(root.textContent || '').replace(/\r/g, '')

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

  const readEditorPlainText = React.useCallback((): string => {
    return readPlainTextFromRoot(args.editorRef.current)
  }, [args.editorRef, readPlainTextFromRoot])

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

  const buildReplacementLinesFromDraft = React.useCallback((draft: string): string[] => {
    return buildReplacementLinesFromDraftWithPrefixes({
      draft,
      prefixes: args.editLinePrefixesRef.current,
      initialPresentText: args.initialPresentTextRef.current,
      editDefaultLinePrefix: args.editDefaultLinePrefix,
      hasEditStripLinePrefix: args.hasEditStripLinePrefix,
    })
  }, [args.editDefaultLinePrefix, args.editLinePrefixesRef, args.hasEditStripLinePrefix, args.initialPresentTextRef])

  const emitDraftTextChange = React.useCallback((draft: string, options?: { reflectInViewer?: boolean }) => {
    if (!args.onDraftTextChange || !Array.isArray(args.sourceLines)) return
    const replacementLines = buildReplacementLinesFromDraft(draft)
    const currentMarkdownText = args.sourceLines.join('\n')
    const nextMarkdownText = replaceMarkdownLineRange({
      markdownText: currentMarkdownText,
      startLine: args.editStartLine,
      endLine: args.editEndLine,
      replacementLines,
    })
    if (nextMarkdownText === currentMarkdownText) return
    args.onDraftTextChange(nextMarkdownText, options)
  }, [args, buildReplacementLinesFromDraft])

  const publishMarkdownDraftWithoutDomMutation = React.useCallback((draft: string) => {
    args.draftRef.current = draft
    const root = args.editorRef.current
    if (root) args.lastSerializedEditorHtmlRef.current = String(root.innerHTML || '')
    emitDraftTextChange(draft, { reflectInViewer: false })
  }, [args.draftRef, args.editorRef, args.lastSerializedEditorHtmlRef, emitDraftTextChange])

  const serializeHtmlRootToDraft = React.useCallback(async (root: HTMLElement | null): Promise<string | null> => {
    if (!root) return null
    const preservedComments: string[] = []
    const preservedHighlights: string[] = []
    const preservedUnderlines: string[] = []
    const workingRoot = root.cloneNode(true) as HTMLElement
    const underlineNodes = Array.from(workingRoot.querySelectorAll('u'))
    underlineNodes.forEach(node => {
      const token = `KGUNDERLINETOKEN${preservedUnderlines.length}KG`
      const text = String(node.textContent || '').replace(/\r/g, '')
      preservedUnderlines.push(`<u>${text}</u>`)
      node.replaceWith(workingRoot.ownerDocument.createTextNode(token))
    })
    const highlightNodes = Array.from(workingRoot.querySelectorAll('mark,[data-kg-default-highlight="1"]'))
    highlightNodes.forEach(node => {
      const token = `KGHIGHLIGHTTOKEN${preservedHighlights.length}KG`
      const text = String(node.textContent || '').replace(/\r/g, '')
      preservedHighlights.push(`==${text}==`)
      node.replaceWith(workingRoot.ownerDocument.createTextNode(token))
    })
    const commentNodes = Array.from(workingRoot.querySelectorAll('[data-kg-comment="1"]'))
    commentNodes.forEach(node => {
      const token = `KGHTMLCOMMENTTOKEN${preservedComments.length}KG`
      const text = String(node.textContent || '').replace(/\r/g, '')
      preservedComments.push(`<!-- ${text} -->`)
      node.replaceWith(workingRoot.ownerDocument.createTextNode(token))
    })
    const html = rewriteSigilSpansToInlineCodeHtml(workingRoot.innerHTML)
    const htmlForMarkdownConversion = html.replace(/<!--[\s\S]*?-->/g, match => {
      const token = `KGHTMLCOMMENTTOKEN${preservedComments.length}KG`
      preservedComments.push(match)
      return token
    })
    const plainDraft = readPlainTextFromRoot(root)
    const preferPlainTextInlineDraft =
      args.htmlRenderMode === 'inline'
      && !hasSemanticRichMarkup(root)
    if (preferPlainTextInlineDraft) {
      return String(plainDraft || '').replace(/\r/g, '').replace(/\n+$/g, '')
    }
    const result = await convertHtmlToMarkdownUnified({
      html: `<div>${htmlForMarkdownConversion}</div>`,
      ...HTML_TO_MARKDOWN_UNIFIED_DEFAULTS,
    })
    if (!result.ok) return ''
    return String(result.markdown || '')
      .replace(/KGUNDERLINETOKEN\s*(\d+)\s*KG/g, (_, idx: string) => preservedUnderlines[Number(idx)] || '')
      .replace(/KGHIGHLIGHTTOKEN\s*(\d+)\s*KG/g, (_, idx: string) => preservedHighlights[Number(idx)] || '')
      .replace(/KGHTMLCOMMENTTOKEN\s*(\d+)\s*KG/g, (_, idx: string) => preservedComments[Number(idx)] || '')
      .replace(/\s+$/g, '')
  }, [args.htmlRenderMode, hasSemanticRichMarkup, readPlainTextFromRoot])

  const htmlDraftEmitVersionRef = React.useRef(0)
  const pendingHtmlDraftSerializationRef = React.useRef<Promise<void> | null>(null)
  const readCachedHtmlDraftForCurrentDom = React.useCallback((): string | null => {
    if (args.editorPresentation !== 'html') return null
    const root = args.editorRef.current
    if (!root) return null
    const currentEditorHtml = String(root.innerHTML || '')
    if (currentEditorHtml !== args.lastSerializedEditorHtmlRef.current) return null
    return String(args.draftRef.current || '')
  }, [args.draftRef, args.editorPresentation, args.editorRef, args.lastSerializedEditorHtmlRef])
  const emitHtmlDraftTextChangeFromEditorDom = React.useCallback(() => {
    if (args.editorPresentation !== 'html') return
    if (!args.onDraftTextChange || !Array.isArray(args.sourceLines)) return
    const root = args.editorRef.current
    if (!root) return
    const currentEditorHtml = String(root.innerHTML || '')
    if (currentEditorHtml === args.lastSerializedEditorHtmlRef.current) return
    const sessionId = args.editSessionIdRef.current
    const emitVersion = htmlDraftEmitVersionRef.current + 1
    htmlDraftEmitVersionRef.current = emitVersion
    const pendingSerialization = (async () => {
      const markdown = await serializeHtmlRootToDraft(root)
      if (htmlDraftEmitVersionRef.current !== emitVersion) return
      if (args.editSessionIdRef.current !== sessionId) return
      if (typeof markdown !== 'string') return
      args.lastSerializedEditorHtmlRef.current = currentEditorHtml
      args.draftRef.current = markdown
      emitDraftTextChange(markdown)
    })()
    const trackedPendingSerialization = pendingSerialization.finally(() => {
      if (pendingHtmlDraftSerializationRef.current === trackedPendingSerialization) {
        pendingHtmlDraftSerializationRef.current = null
      }
    })
    pendingHtmlDraftSerializationRef.current = trackedPendingSerialization
  }, [args.editorPresentation, args.editSessionIdRef, args.onDraftTextChange, args.sourceLines, args.draftRef, args.editorRef, args.lastSerializedEditorHtmlRef, emitDraftTextChange, serializeHtmlRootToDraft])

  const readCurrentMarkdownDraft = React.useCallback(async (): Promise<string> => {
    if (args.editorPresentation !== 'html') return String(args.draftRef.current || '')
    const pending = pendingHtmlDraftSerializationRef.current
    if (pending) {
      try {
        await pending
      } catch {
        void 0
      }
    }
    const cached = readCachedHtmlDraftForCurrentDom()
    if (typeof cached === 'string') return cached
    const markdown = await serializeHtmlRootToDraft(args.editorRef.current)
    if (typeof markdown !== 'string') return String(args.draftRef.current || '')
    const root = args.editorRef.current
    if (root) args.lastSerializedEditorHtmlRef.current = String(root.innerHTML || '')
    args.draftRef.current = markdown
    return markdown
  }, [args.draftRef, args.editorPresentation, args.editorRef, args.lastSerializedEditorHtmlRef, readCachedHtmlDraftForCurrentDom, serializeHtmlRootToDraft])

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
        const renderedInlineHtml = lines
          .map(line => (line ? md.renderInline(line) : ''))
          .map((html, i) => (i === 0 ? html : `<br/>${html}`))
          .join('')
        el.innerHTML = rewriteInlineEditorAnnotationsToStyledHtml(renderedInlineHtml)
      }
      args.lastSerializedEditorHtmlRef.current = el.innerHTML
    } else {
      el.textContent = nextText
    }
    if (selection) {
      queueMicrotask(() => setSelectionByOffsets(selection))
    }
    emitDraftTextChange(nextText)
  }, [args, emitDraftTextChange, setSelectionByOffsets])

  const getDraft = React.useCallback(() => args.draftRef.current, [args.draftRef])

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
      const hadSemanticRoot = hasSemanticRichMarkup(root)
      void (async () => {
        const markdown = await readCurrentMarkdownDraft()
        if (args.editSessionIdRef.current !== sessionId) return
        if (typeof markdown !== 'string') {
          args.setEditing(false)
          args.setSessionEditLineRange(null)
          return
        }
        if (!markdown && hadSemanticRoot) {
          args.setEditing(false)
          args.setSessionEditLineRange(null)
          return
        }
        if (markdown === args.initialPresentTextRef.current) {
          args.setEditing(false)
          args.setSessionEditLineRange(null)
          return
        }
        const replacementLines = buildReplacementLinesFromDraft(markdown)
        // HTML inline edits can already project a transient whole-document draft into
        // the visible Markdown pane before commit. Comparing against the current
        // sourceLines would treat the final persistence step as a false no-op.
        args.onReplaceLineRange?.({ startLine: args.editStartLine, endLine: args.editEndLine, replacementLines })
        args.setEditing(false)
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
  }, [args, buildReplacementLinesFromDraft, getDraft, hasSemanticRichMarkup, readCurrentMarkdownDraft])

  const cancel = React.useCallback(() => {
    args.setEditing(false)
    args.setSessionEditLineRange(null)
  }, [args])

  return {
    readEditorPlainText,
    getSelectionOffsets,
    setSelectionByOffsets,
    setDraftToDom,
    publishMarkdownDraftWithoutDomMutation,
    readCurrentMarkdownDraft,
    emitHtmlDraftTextChangeFromEditorDom,
    getDraft,
    buildReplacementLinesFromDraft,
    commit,
    cancel,
  }
}
