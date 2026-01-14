import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownPreviewTokens } from '@/features/markdown/ui/useMarkdownPreviewTokens'
import {
  reorderMarkdownHeadings,
  buildTocTree,
} from '@/features/markdown/ui/markdownSectionUtils'
import { findSelectionTarget } from '@/features/markdown/ui/markdownPreviewSelection'
import { slugify } from '@/features/parsers/markdownJsonLd'
import { splitSlides } from '@/features/markdown/ui/markdownPreviewSlides'
import { parseMermaidConfigFromFrontmatter } from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import type { GraphData } from '@/lib/graph/types'
import { scrollToLineInViewer } from '../markdownScrollUtils'
import type { MarkdownLayoutMode } from '../BottomPanelMarkdownSection'
import { type MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import type { TokensHeading } from '@/features/markdown/ui/MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'

type UseBottomPanelMarkdownLogicProps = {
  markdownText: string
  markdownPreviewText: string
  markdownDocumentName: string | null
  markdownDocumentText: string | null
  previewBasePath: string
  markdownLayoutMode: MarkdownLayoutMode
  setMarkdownLayoutMode: (mode: MarkdownLayoutMode) => void
  setMarkdownPresentationMode: (mode: boolean) => void
  setMarkdownText: (text: string) => void
  setMarkdownDocument: (name: string | null, text: string) => void
  editorTextAreaRef: React.RefObject<MonacoTextEditorHandle | null>
  viewerRef: React.RefObject<HTMLDivElement>
  editorRowStartByLine: Record<number, number>
  lineHeightPx: number
  editorPaddingTopPx: number
  selectNode: (id: string) => void
  selectEdge: (id: string) => void
  setSelectionSource: (source: string) => void
  selectionSource: string
  selectedNodeId: string | null
  selectedEdgeId: string | null
  graphData: GraphData | null
  onShowInGraphDataTable?: (line: number) => void
  onShowInSlidesGallery?: (line: number) => void
}

export function useBottomPanelMarkdownLogic(props: UseBottomPanelMarkdownLogicProps) {
  const {
    markdownText,
    markdownPreviewText,
    markdownDocumentName,
    previewBasePath,
    markdownLayoutMode,
    setMarkdownLayoutMode,
    setMarkdownPresentationMode,
    setMarkdownText,
    setMarkdownDocument,
    editorTextAreaRef,
    viewerRef,
    editorRowStartByLine,
    lineHeightPx,
    editorPaddingTopPx,
    selectNode,
    selectEdge,
    setSelectionSource,
    selectionSource,
    selectedNodeId,
    selectedEdgeId,
    graphData,
  } = props

  const [showSidebar, setShowSidebar] = React.useState(true)
  const [collapsedIds, setCollapsedIds] = React.useState<Set<string>>(new Set())
  const [pendingScrollLine, setPendingScrollLine] = React.useState<number | null>(null)
  const jumpFlashSeqRef = React.useRef(0)
  const [jumpFlash, setJumpFlash] = React.useState<{ line: number; seq: number } | null>(null)
  
  const selectionFlashDurationMs = useGraphStore(s => s.selectionFlashDurationMs || 500)
  const markdownSelectionFlashMode = useGraphStore(s => s.markdownSelectionFlashMode || 'auto')

  const setMarkdownPreviewMermaidFocus = useGraphStore(s => s.setMarkdownPreviewMermaidFocus)
  const setMarkdownPreviewActiveMediaKey = useGraphStore(s => s.setMarkdownPreviewActiveMediaKey)

  // --- Flash Effect Logic ---
  React.useEffect(() => {
    if (!jumpFlash) return

    // If manual mode, do not set timeout
    if (markdownSelectionFlashMode === 'manual') {
      const clearHandler = () => {
        setJumpFlash(null)
      }
      // Add a small delay before listening to clicks to avoid immediate clearing if triggered by a click
      const timer = setTimeout(() => {
        window.addEventListener('click', clearHandler, { capture: true, once: true })
      }, 100)
      
      return () => {
        clearTimeout(timer)
        window.removeEventListener('click', clearHandler, { capture: true })
      }
    }

    // Auto mode
    let timer: number | null = null
    try {
      timer = window.setTimeout(() => {
        setJumpFlash(current => (current && current.seq === jumpFlash.seq ? null : current))
      }, selectionFlashDurationMs)
    } catch {
      timer = null
    }
    return () => {
      if (timer != null) {
        try {
          window.clearTimeout(timer)
        } catch {
          void 0
        }
      }
    }
  }, [jumpFlash, selectionFlashDurationMs, markdownSelectionFlashMode])

  // --- Scroll Sync Logic ---
  React.useEffect(() => {
    if (pendingScrollLine === null) return

    if (markdownLayoutMode === 'editor') {
      const handle = editorTextAreaRef.current
      if (!handle) return

      const run = () => {
        const top = handle.getTopForLineNumber(pendingScrollLine)
        handle.setScrollTop(top)
        setPendingScrollLine(null)
      }

      let raf1: number | null = null
      let raf2: number | null = null
      try {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          raf1 = window.requestAnimationFrame(() => {
            raf2 = window.requestAnimationFrame(() => run())
          })
        } else {
          const timer = window.setTimeout(() => run(), 0)
          return () => window.clearTimeout(timer)
        }
      } catch {
        run()
      }
      return () => {
        if (raf1 != null) cancelAnimationFrame(raf1)
        if (raf2 != null) cancelAnimationFrame(raf2)
      }
    } else {
      const run = () => {
        scrollToLineInViewer(viewerRef.current, pendingScrollLine)
        setPendingScrollLine(null)
      }

      let raf1: number | null = null
      let raf2: number | null = null
      try {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          raf1 = window.requestAnimationFrame(() => {
            raf2 = window.requestAnimationFrame(() => run())
          })
        } else {
          const timer = window.setTimeout(() => run(), 0)
          return () => window.clearTimeout(timer)
        }
      } catch {
        run()
      }
      return () => {
        if (raf1 != null) cancelAnimationFrame(raf1)
        if (raf2 != null) cancelAnimationFrame(raf2)
      }
    }
  }, [
    pendingScrollLine,
    editorRowStartByLine,
    lineHeightPx,
    editorPaddingTopPx,
    editorTextAreaRef,
    markdownLayoutMode,
    viewerRef,
  ])

  // --- Sidebar Logic ---
  React.useEffect(() => {
    try {
      const storedEditor = localStorage.getItem('markdownEditorSidebarOpen')
      const storedPreview = localStorage.getItem('markdownPreviewSidebarOpen')
      if (storedEditor !== null) {
        setShowSidebar(storedEditor === 'true')
      } else if (storedPreview !== null) {
        setShowSidebar(storedPreview === 'true')
      }
    } catch {
      void 0
    }
  }, [])

  const handleToggleSidebar = React.useCallback((show: boolean) => {
    setShowSidebar(show)
    try {
      localStorage.setItem('markdownEditorSidebarOpen', String(show))
      localStorage.setItem('markdownPreviewSidebarOpen', String(show))
    } catch {
      void 0
    }
  }, [])

  // --- Lexing Logic ---
  const tokens = useMarkdownPreviewTokens(markdownPreviewText || '', undefined, previewBasePath)

  const rootItems = React.useMemo(() => buildTocTree(tokens), [tokens])

  const getHeadingTokenId = React.useCallback((t: TokenWithLines): string => {
    if (t.type !== 'heading') return ''
    const h = t as TokenWithLines & TokensHeading
    const raw = typeof h.id === 'string' ? h.id.trim() : ''
    if (raw) return raw
    return slugify(String(h.text || ''))
  }, [])

  const handleToggleCollapse = React.useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleExpandAll = React.useCallback(() => {
    setCollapsedIds(new Set())
  }, [])

  const handleCollapseAll = React.useCallback(() => {
    const allIds = new Set<string>()
    tokens.forEach(t => {
      const id = getHeadingTokenId(t)
      if (id) allIds.add(id)
    })
    setCollapsedIds(allIds)
  }, [tokens, getHeadingTokenId])

  // --- Navigation & TOC Logic ---
  const handleTocSelect = React.useCallback(
    (id: string) => {
      const token = tokens.find(t => {
        return getHeadingTokenId(t) === id
      })

      if (token && token.startLine) {
        const handle = editorTextAreaRef.current
        if (handle) {
          handle.revealLine(token.startLine)
        }
      }

      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    },
    [tokens, editorTextAreaRef, getHeadingTokenId],
  )

  const handleTocReorder = React.useCallback(
    (parentId: string | null, fromIndex: number, toIndex: number) => {
      const newMarkdown = reorderMarkdownHeadings(
        markdownText,
        tokens,
        parentId,
        fromIndex,
        toIndex,
      )
      if (newMarkdown !== markdownText) {
        setMarkdownText(newMarkdown)
        setMarkdownDocument(markdownDocumentName, newMarkdown)
      }
    },
    [
      markdownText,
      tokens,
      markdownDocumentName,
      setMarkdownText,
      setMarkdownDocument,
    ],
  )

  const handleShowOnCanvas = React.useCallback(
    (startLine: number, endLine: number) => {
      const target = findSelectionTarget(
        graphData as GraphData | null,
        markdownDocumentName || '',
        startLine,
        endLine,
      )
      if (!target) return
      setSelectionSource('editor')
      if (target.kind === 'node') {
        selectNode(target.id)
      } else {
        selectEdge(target.id)
      }
    },
    [graphData, markdownDocumentName, selectEdge, selectNode, setSelectionSource],
  )

  const triggerJump = React.useCallback((line: number) => {
    jumpFlashSeqRef.current += 1
    setJumpFlash({ line, seq: jumpFlashSeqRef.current })
    setPendingScrollLine(line)
  }, [])

  // --- Slides / Mermaid Logic ---
  const { headMeta } = React.useMemo(
    () => splitSlides(markdownText || ''),
    [markdownText],
  )
  const mermaidFrontmatterConfig = React.useMemo(
    () => parseMermaidConfigFromFrontmatter(headMeta),
    [headMeta],
  )
  const frontmatterMermaidCode = React.useMemo(() => {
    const meta = headMeta as Record<string, unknown>
    const raw = String(meta.mermaid || '').trim()
    return raw
  }, [headMeta])
  const hasFrontmatterMermaid = !!frontmatterMermaidCode

  const handleClickFrontmatterMermaidHint = React.useCallback(() => {
    if (!frontmatterMermaidCode) return
    setMarkdownPreviewActiveMediaKey(null)
    setMarkdownPreviewMermaidFocus({
      code: frontmatterMermaidCode,
      frontmatterConfig:
        (mermaidFrontmatterConfig as unknown as Record<string, unknown> | null) ||
        null,
    })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(MAIN_PANEL_OPEN_EVENT, {
          detail: { tab: 'preview' as const },
        }),
      )
    }
  }, [
    frontmatterMermaidCode,
    mermaidFrontmatterConfig,
    setMarkdownPreviewActiveMediaKey,
    setMarkdownPreviewMermaidFocus,
  ])

  // --- Auto Position Logic ---
  React.useEffect(() => {
    if (selectionSource !== 'canvas' && selectionSource !== 'table') return
    if ((!selectedNodeId && !selectedEdgeId) || !graphData) return
    const id = selectedNodeId || selectedEdgeId
    if (!id) return

    const nodes = (graphData.nodes || []) as Array<{
      id: string
      type?: string
      metadata?: { lineStart?: number; documentPath?: string }
    }>
    const edges = (graphData.edges || []) as Array<{
      id: string
      type?: string
      metadata?: { lineStart?: number; documentPath?: string }
    }>

    const entity = selectedNodeId
      ? nodes.find(n => String(n.id) === selectedNodeId)
      : edges.find(e => String(e.id) === selectedEdgeId)

    if (!entity) return

    const docPath = entity.metadata?.documentPath
    const currentDoc = markdownDocumentName || ''
    if (docPath && docPath !== currentDoc) return

    let line = entity.metadata?.lineStart
    if (typeof line === 'number' && line > 0) {
      if (markdownLayoutMode !== 'editor') {
        setMarkdownLayoutMode('editor')
        setMarkdownPresentationMode(false)
      }

      if ((line === 1 || line < 5) && frontmatterMermaidCode && markdownText) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyEntity = entity as any
        const name = (
          anyEntity.name ||
          anyEntity.properties?.nodeName ||
          anyEntity.properties?.name ||
          anyEntity.properties?.label ||
          ''
        ) as string
        const searchTerm = name || id

        const fileLines = markdownText.split('\n')
        let mermaidStartLine = -1
        for (let i = 0; i < Math.min(fileLines.length, 100); i++) {
          const l = fileLines[i].trim()
          if (l === '---' && i > 0) break
          if (l.startsWith('mermaid:')) {
            mermaidStartLine = i + 1
            break
          }
        }

        if (mermaidStartLine > 0) {
          const codeLines = frontmatterMermaidCode.split('\n')
          let found = false
          for (let i = 0; i < codeLines.length; i++) {
            const codeLine = codeLines[i]
            const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const re = new RegExp(`\\b${escaped}\\b`)
            if (re.test(codeLine)) {
              line = mermaidStartLine + i + 1
              found = true
              break
            }
          }
          if (!found) {
            line = mermaidStartLine + 1
          }
        }
      }
      triggerJump(line)
    }
  }, [
    selectedNodeId,
    selectedEdgeId,
    graphData,
    markdownDocumentName,
    triggerJump,
    frontmatterMermaidCode,
    markdownText,
    markdownLayoutMode,
    setMarkdownLayoutMode,
    setMarkdownPresentationMode,
    selectionSource,
  ])

  return {
    showSidebar,
    handleToggleSidebar,
    collapsedIds,
    handleToggleCollapse,
    handleExpandAll,
    handleCollapseAll,
    tokens,
    rootItems,
    handleTocSelect,
    handleTocReorder,
    jumpFlash,
    triggerJump,
    handleShowOnCanvas,
    hasFrontmatterMermaid,
    handleClickFrontmatterMermaidHint,
    markdownSelectionFlashMode,
  }
}
