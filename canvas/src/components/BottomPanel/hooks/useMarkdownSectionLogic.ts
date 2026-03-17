import React from 'react'
import { splitSlides } from '@/features/markdown/ui/markdownPreviewSlides'
import { parseMermaidConfigFromFrontmatter } from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import { useMarkdownPreviewTokens } from '@/features/markdown/ui/useMarkdownPreviewTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { slugify } from 'grph-shared/markdown/slugify'
import { reorderMarkdownHeadings } from '@/features/markdown/ui/markdownSectionUtils'
import { insertMarkdownLineAfter, replaceMarkdownLineRange } from 'grph-shared/markdown/lineEditing'
import { splitMarkdownLines } from '@/lib/markdown'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { findSelectionTarget } from '@/features/markdown/ui/markdownPreviewSelection'
import type { GraphData } from '@/lib/graph/types'
import { scrollToLineInViewer } from '../markdownScrollUtils'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import type { MarkdownLayoutMode } from '../BottomPanelMarkdownSection'
import { useMarkdownExplorerControls } from '@/features/markdown/ui/useMarkdownExplorerControls'

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
  providedTokens?: TokenWithLines[]
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
    providedTokens,
  } = props

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
    if (selectionSource !== 'canvas') return

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
    let timer: ReturnType<typeof setTimeout> | null = null
    try {
      timer = setTimeout(() => {
        setJumpFlash(current => (current && current.seq === jumpFlash.seq ? null : current))
      }, selectionFlashDurationMs)
    } catch {
      timer = null
    }
    return () => {
      if (timer != null) {
        try {
          clearTimeout(timer)
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
        handle.revealLine(pendingScrollLine)
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
          const timer = setTimeout(() => run(), 0)
          return () => clearTimeout(timer)
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
          const timer = setTimeout(() => run(), 0)
          return () => clearTimeout(timer)
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
  }, [pendingScrollLine, editorTextAreaRef, markdownLayoutMode, viewerRef])

  const tokens = useMarkdownPreviewTokens(
    markdownPreviewText || '',
    providedTokens,
    previewBasePath,
    markdownDocumentText === markdownPreviewText,
  )
  const explorerControls = useMarkdownExplorerControls({ tokens })

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
      }
    },
    [markdownText, tokens, setMarkdownText],
  )

  const handleInsertLineAfter = React.useCallback(
    (afterLine: number) => {
      const next = insertMarkdownLineAfter({ markdownText, afterLine })
      if (next !== markdownText) {
        setMarkdownText(next)
      }
    },
    [markdownText, setMarkdownText],
  )

  const handleReorderLineBlock = React.useCallback(
    (
      source: { startLine: number; endLine: number },
      target: { startLine: number; endLine: number },
      position: 'before' | 'after',
    ) => {
      const sourceStart = Math.max(1, Math.floor(source.startLine || 0))
      const sourceEnd = Math.max(sourceStart, Math.floor(source.endLine || sourceStart))
      const targetStart = Math.max(1, Math.floor(target.startLine || 0))
      const targetEnd = Math.max(targetStart, Math.floor(target.endLine || targetStart))
      if (sourceStart === targetStart && sourceEnd === targetEnd) return

      const lines = splitMarkdownLines(markdownText || '')
      const srcStartIdx = sourceStart - 1
      const srcEndIdx = Math.min(lines.length, sourceEnd)
      const tgtStartIdx = targetStart - 1
      const tgtEndIdx = Math.min(lines.length, targetEnd)
      if (srcStartIdx < 0 || srcStartIdx >= lines.length) return
      if (srcEndIdx <= srcStartIdx) return

      if (tgtStartIdx >= srcStartIdx && tgtStartIdx < srcEndIdx) return

      const chunk = lines.slice(srcStartIdx, srcEndIdx)
      const remaining = [...lines]
      const chunkLen = srcEndIdx - srcStartIdx
      remaining.splice(srcStartIdx, chunkLen)

      let insertAt = position === 'before' ? tgtStartIdx : tgtEndIdx
      if (srcStartIdx < tgtStartIdx) insertAt -= chunkLen
      insertAt = Math.max(0, Math.min(remaining.length, insertAt))
      remaining.splice(insertAt, 0, ...chunk)

      const next = remaining.join('\n')
      if (next !== markdownText) {
        setMarkdownText(next)
      }
    },
    [markdownText, setMarkdownText],
  )

  const handleReplaceLineRange = React.useCallback(
    (args: { startLine: number; endLine: number; replacementLines: string[] }) => {
      const startLine = Math.max(1, Math.floor(args.startLine || 1))
      const endLine = Math.max(startLine, Math.floor(args.endLine || startLine))
      const replacementLines = Array.isArray(args.replacementLines) ? args.replacementLines : []
      const next = replaceMarkdownLineRange({
        markdownText,
        startLine,
        endLine,
        replacementLines,
      })
      if (next !== markdownText) {
        setMarkdownText(next)
      }
    },
    [markdownText, setMarkdownText],
  )

  return {
    handleShowOnCanvas,
    triggerJump,
    jumpFlash,
    tokens,
    showSidebar: explorerControls.showSidebar,
    handleToggleSidebar: explorerControls.onToggleSidebar,
    collapsedIds: explorerControls.collapsedHeadingIds,
    handleToggleCollapse: explorerControls.onToggleCollapse,
    handleExpandAll: explorerControls.onExpandAll,
    handleCollapseAll: explorerControls.onCollapseAll,
    allCollapsed: explorerControls.allCollapsed,
    handleTocSelect,
    handleTocReorder,
    handleInsertLineAfter,
    handleReorderLineBlock,
    handleReplaceLineRange,
    handleClickFrontmatterMermaidHint,
    hasFrontmatterMermaid,
  }
}
