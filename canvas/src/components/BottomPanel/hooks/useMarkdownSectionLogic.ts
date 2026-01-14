import React from 'react'
import { splitSlides } from '@/features/markdown/ui/markdownPreviewSlides'
import { parseMermaidConfigFromFrontmatter } from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import { useMarkdownPreviewTokens } from '@/features/markdown/ui/useMarkdownPreviewTokens'
import { slugify } from '@/features/parsers/markdownJsonLd'
import { reorderMarkdownHeadings } from '@/features/markdown/ui/markdownSectionUtils'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { findSelectionTarget } from '@/features/markdown/ui/markdownPreviewSelection'
import type { GraphData } from '@/lib/graph/types'
import { scrollToLineInViewer } from '../markdownScrollUtils'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import type { MarkdownLayoutMode } from '../BottomPanelMarkdownSection'

type UseMarkdownSectionLogicProps = {
  markdownText: string
  markdownDocumentName: string | null
  markdownPreviewText: string
  previewBasePath: string
  markdownLayoutMode: MarkdownLayoutMode
  setMarkdownLayoutMode: (mode: MarkdownLayoutMode) => void
  setMarkdownPresentationMode: (next: boolean) => void
  editorTextAreaRef: React.RefObject<MonacoTextEditorHandle | null>
  viewerRef: React.RefObject<HTMLDivElement>
  selectNode: (id: string) => void
  selectEdge: (id: string) => void
  setSelectionSource: (source: 'editor' | 'canvas' | 'table') => void
  setMarkdownText: (next: string) => void
  setMarkdownDocument: (name: string | null, text: string) => void
  editorRowStartByLine: Record<number, number>
  lineHeightPx: number
  editorPaddingTopPx: number
}

export function useMarkdownSectionLogic(props: UseMarkdownSectionLogicProps) {
  const {
    markdownText,
    markdownDocumentName,
    markdownPreviewText,
    previewBasePath,
    markdownLayoutMode,
    setMarkdownLayoutMode,
    setMarkdownPresentationMode,
    editorTextAreaRef,
    viewerRef,
    selectNode,
    selectEdge,
    setSelectionSource,
    setMarkdownText,
    setMarkdownDocument,
    editorRowStartByLine,
    lineHeightPx,
    editorPaddingTopPx,
  } = props

  const [showSidebar, setShowSidebar] = React.useState(true)
  const [collapsedIds, setCollapsedIds] = React.useState<Set<string>>(new Set())
  const [pendingScrollLine, setPendingScrollLine] = React.useState<number | null>(null)
  const jumpFlashSeqRef = React.useRef(0)
  const [jumpFlash, setJumpFlash] = React.useState<{ line: number; seq: number } | null>(null)
  
  const selectionFlashDurationMs = useGraphStore(s => s.selectionFlashDurationMs || 500)
  const setMarkdownPreviewMermaidFocus = useGraphStore(s => s.setMarkdownPreviewMermaidFocus)
  const setMarkdownPreviewActiveMediaKey = useGraphStore(s => s.setMarkdownPreviewActiveMediaKey)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const graphData = useGraphStore(s => s.graphData)
  const selectionSource = useGraphStore(s => s.selectionSource)
  const markdownDocumentText = useGraphStore(s => s.markdownDocumentText)

  const handleShowOnCanvas = React.useCallback(
    (startLine: number, endLine: number) => {
      const target = findSelectionTarget(graphData as GraphData | null, markdownDocumentName || '', startLine, endLine)
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

  const { headMeta } = React.useMemo(() => splitSlides(markdownText || ''), [markdownText])
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

  React.useEffect(() => {
    // Only auto-position if selection comes from canvas or table
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
    
    // Check if it belongs to current document
    const docPath = entity.metadata?.documentPath
    const currentDoc = markdownDocumentName || ''
    if (docPath && docPath !== currentDoc) return

    let line = entity.metadata?.lineStart
    if (typeof line === 'number' && line > 0) {
      // Auto-switch to editor mode if needed
      if (markdownLayoutMode !== 'editor') {
        setMarkdownLayoutMode('editor')
        setMarkdownPresentationMode(false)
      }

      if ((line === 1 || line < 5) && frontmatterMermaidCode && markdownText) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyEntity = entity as any
        const name = (anyEntity.name || anyEntity.properties?.nodeName || anyEntity.properties?.name || anyEntity.properties?.label || '') as string
        const searchTerm = name || id

        const fileLines = markdownText.split('\n')
        let mermaidStartLine = -1
        // Look for mermaid key in frontmatter (first 100 lines max)
        for (let i = 0; i < Math.min(fileLines.length, 100); i++) {
          const l = fileLines[i].trim()
          if (l === '---' && i > 0) break // End of frontmatter
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
            // Simple strict word match for ID or Name
            const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const re = new RegExp(`\\b${escaped}\\b`)
            if (re.test(codeLine)) {
              // Offset by 1 because mermaid block content usually starts on next line after key
              line = mermaidStartLine + i + 1
              found = true
              break
            }
          }
          // If specific line not found, default to start of mermaid block
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

  const handleClickFrontmatterMermaidHint = React.useCallback(() => {
    if (!frontmatterMermaidCode) return
    try {
      setMarkdownPreviewActiveMediaKey(null)
    } catch {
      void 0
    }
    try {
      setMarkdownPreviewMermaidFocus({
        code: frontmatterMermaidCode,
        frontmatterConfig: (mermaidFrontmatterConfig as unknown as Record<string, unknown> | null) || null,
      })
    } catch {
      void 0
    }
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'preview' as const } }),
        )
      }
    } catch {
      void 0
    }
  }, [
    frontmatterMermaidCode,
    mermaidFrontmatterConfig,
    setMarkdownPreviewActiveMediaKey,
    setMarkdownPreviewMermaidFocus,
  ])

  React.useEffect(() => {
    if (!jumpFlash) return
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
  }, [jumpFlash, selectionFlashDurationMs])

  React.useEffect(() => {
    if (pendingScrollLine === null) return

    if (markdownLayoutMode === 'editor') {
      const handle = editorTextAreaRef.current
      if (!handle) return

      const run = () => {
        // Use handle method directly
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
        if (raf1 != null) {
          try {
            window.cancelAnimationFrame(raf1)
          } catch {
            void 0
          }
        }
        if (raf2 != null) {
          try {
            window.cancelAnimationFrame(raf2)
          } catch {
            void 0
          }
        }
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
        if (raf1 != null) {
          try {
            window.cancelAnimationFrame(raf1)
          } catch {
            void 0
          }
        }
        if (raf2 != null) {
          try {
            window.cancelAnimationFrame(raf2)
          } catch {
            void 0
          }
        }
      }
    }
  }, [pendingScrollLine, editorRowStartByLine, lineHeightPx, editorPaddingTopPx, editorTextAreaRef, markdownLayoutMode, viewerRef])

  React.useEffect(() => {
    try {
      const storedEditor = localStorage.getItem('markdownEditorSidebarOpen')
      const storedPreview = localStorage.getItem('markdownPreviewSidebarOpen')
      // Prefer editor setting, then preview, then default true
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

  const tokens = useMarkdownPreviewTokens(
    markdownPreviewText || '',
    undefined,
    previewBasePath,
    markdownDocumentText === markdownPreviewText,
  )

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
      if (t.type === 'heading') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const h = t as any
        const id = h.id || slugify(h.text || '')
        if (id) allIds.add(id)
      }
    })
    setCollapsedIds(allIds)
  }, [tokens])

  const handleTocSelect = React.useCallback(
    (id: string) => {
      const token = tokens.find(t => {
        if (t.type !== 'heading') return false
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const h = t as any
        const tid = h.id || slugify(h.text || '')
        return tid === id
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
    [tokens, editorTextAreaRef],
  )

  const handleTocReorder = React.useCallback(
    (parentId: string | null, fromIndex: number, toIndex: number) => {
      const newMarkdown = reorderMarkdownHeadings(markdownText, tokens, parentId, fromIndex, toIndex)
      if (newMarkdown !== markdownText) {
        setMarkdownText(newMarkdown)
        setMarkdownDocument(markdownDocumentName, newMarkdown)
      }
    },
    [markdownText, tokens, markdownDocumentName, setMarkdownText, setMarkdownDocument],
  )

  return {
    handleShowOnCanvas,
    triggerJump,
    jumpFlash,
    tokens,
    showSidebar,
    handleToggleSidebar,
    collapsedIds,
    handleToggleCollapse,
    handleExpandAll,
    handleCollapseAll,
    handleTocSelect,
    handleTocReorder,
    handleClickFrontmatterMermaidHint,
    hasFrontmatterMermaid,
  }
}
