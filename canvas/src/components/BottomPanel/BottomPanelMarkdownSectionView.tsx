import React from 'react'
import MarkdownPreview, {
  type MarkdownPreviewPresentationApi,
  type MarkdownPreviewPresentationSlideState,
} from '@/features/markdown/ui/MarkdownPreview'
import { reorderSlidesInMarkdown, splitSlides } from '@/features/markdown/ui/markdownPreviewSlides'
import { parseMermaidConfigFromFrontmatter } from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import { emitMarkdownPanelMetric } from '@/features/metrics/uiMetrics'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import type { JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'
import type { MarkdownLayoutMode } from './BottomPanelMarkdownSection'
import type { MarkdownSelectionInfo } from './BottomPanelMarkdownSectionModel'
import { HeaderStatusRow, ViewerHeaderRow } from './BottomPanelMarkdownHeaders'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { scrollToLineInEditor, scrollToLineInViewer } from './markdownScrollUtils'
import { buildMarkdownTokensKey, lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { MarkdownPanelLayout } from '@/features/markdown/ui/MarkdownPanelLayout'
import { slugify } from '@/features/parsers/markdownJsonLd'
import { reorderMarkdownHeadings, buildTocTree, findParent, type TocItem } from '@/features/markdown/ui/markdownSectionUtils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { MarkdownSelectionToolbar, type MarkdownSelectionToolbarState } from '@/features/markdown/ui/MarkdownSelectionToolbar'
import { findSelectionTarget } from '@/features/markdown/ui/markdownPreviewSelection'
import type { GraphData } from '@/lib/graph/types'

// Constants matching Slides Gallery styles
const UI_COLOR_PRIMARY_BLUE_INDICATOR = '#2563EB' // blue-600
const UI_COLOR_PRIMARY_BLUE_BG = 'bg-blue-50'

type GutterRowProps = {
  line: number
  top: number
  height: number
  bgColor?: string | null
  uiPanelMonospaceTextClass: string
  transitionClass?: string
  headingId?: string
  isCollapsed: boolean
  onToggleCollapse: (id: string) => void
  onReorder: (parentId: string | null, fromIndex: number, toIndex: number) => void
  rootItems: TocItem[]
}

function GutterRow({
  line,
  top,
  height,
  bgColor,
  uiPanelMonospaceTextClass,
  transitionClass,
  headingId,
  isCollapsed,
  onToggleCollapse,
  onReorder,
  rootItems,
}: GutterRowProps) {
  const [dragState, setDragState] = React.useState<'none' | 'top' | 'bottom'>('none')
  const [isDragging, setIsDragging] = React.useState(false)

  const handleDragStart = (e: React.DragEvent) => {
    if (!headingId) return
    setIsDragging(true)
    e.dataTransfer.setData('text/plain', headingId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    setDragState('none')
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!headingId) return
    e.dataTransfer.dropEffect = 'move'
    
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    if (e.clientY < midY) {
      setDragState('top')
    } else {
      setDragState('bottom')
    }
  }

  const handleDragLeave = () => {
    setDragState('none')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragState('none')
    if (!headingId) return

    const sourceId = e.dataTransfer.getData('text/plain')
    if (sourceId === headingId) return

    const sourceInfo = findParent(rootItems, sourceId)
    const targetInfo = findParent(rootItems, headingId)

    if (sourceInfo && targetInfo) {
      const sameParent = (sourceInfo.parent?.id === targetInfo.parent?.id)
      
      if (sameParent) {
        let targetIndex = targetInfo.index
        if (dragState === 'bottom') {
           targetIndex += 1
        }
        
        if (sourceInfo.index < targetIndex) {
           targetIndex -= 1
        }
        
        onReorder(sourceInfo.parent?.id ?? null, sourceInfo.index, targetIndex)
      }
    }
  }

  return (
    <div
      className={[
        'absolute left-0 right-0 pr-2 text-right select-none flex items-center justify-end gap-1',
        uiPanelMonospaceTextClass,
        transitionClass || '',
        headingId ? 'cursor-grab active:cursor-grabbing' : '',
        isDragging ? `${UI_COLOR_PRIMARY_BLUE_BG} opacity-50` : '',
        dragState !== 'none' ? `${UI_COLOR_PRIMARY_BLUE_BG}` : '',
      ].join(' ')}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        lineHeight: `${height}px`,
        backgroundColor: bgColor || undefined,
        pointerEvents: 'auto', // Ensure clickable/draggable even if container has pointer-events issues
      }}
      draggable={!!headingId}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragState === 'top' && (
        <div
          className="absolute left-0 right-0 -top-1 h-2 bg-blue-50 border-t-2 z-20 pointer-events-none"
          style={{ borderTopColor: UI_COLOR_PRIMARY_BLUE_INDICATOR }}
        >
          <div
            className="absolute left-0 -top-1 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent"
            style={{ borderBottomColor: UI_COLOR_PRIMARY_BLUE_INDICATOR }}
          />
        </div>
      )}
      {dragState === 'bottom' && (
        <div
          className="absolute left-0 right-0 -bottom-1 h-2 bg-blue-50 border-b-2 z-20 pointer-events-none"
          style={{ borderBottomColor: UI_COLOR_PRIMARY_BLUE_INDICATOR }}
        >
          <div
            className="absolute left-0 -bottom-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent"
            style={{ borderTopColor: UI_COLOR_PRIMARY_BLUE_INDICATOR }}
          />
        </div>
      )}

      {headingId ? (
        <>
          <div className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-0.5 text-gray-400 hover:text-gray-600 absolute left-0">
             {/* Grip handle could go here, but space is tight. We make the whole row draggable. */}
          </div>
          <button
            type="button"
            className={[
              'w-3 h-3 flex items-center justify-center flex-shrink-0 p-0 border-0 bg-transparent',
              `hover:bg-gray-200 dark:hover:bg-gray-700 rounded cursor-pointer ${UI_THEME_TOKENS.text.secondary}`,
              'relative z-20',
            ].join(' ')}
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse(headingId)
            }}
            onMouseDown={e => e.stopPropagation()} // Prevent drag start when clicking button
            aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
          >
            {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
          </button>
        </>
      ) : (
        <div className="w-3 h-3 flex-shrink-0" />
      )}
      <div className="min-w-[1.5em] text-right">
        {line}
      </div>
    </div>
  )
}

type JsonMarkdownMode = JsonToMarkdownMode

type BottomPanelMarkdownSectionViewProps = {
  autoOpenHighlight: boolean
  uiPanelKeyValueTextSizeClass: string
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  isJsonBacked: boolean
  jsonModeEnabled: boolean
  jsonMarkdownMode: JsonMarkdownMode
  setJsonMarkdownMode: (mode: JsonMarkdownMode) => void
  jsonMarkdownSuggestedMode: JsonMarkdownMode
  status: { ok: boolean | null; msg: string; details?: string }
  applyStatus: { ok: boolean | null; msg: string } | null
  isMarkdownLargeSummary: boolean
  markdownPresentationMode: boolean
  markdownLayoutMode: MarkdownLayoutMode
  setMarkdownLayoutMode: (mode: MarkdownLayoutMode) => void
  iconSizeClass: string
  uiIconStrokeWidth: number
  markdownWordWrap: boolean
  editorGutterWidthCh: number
  editorContentHeightPx: number
  editorTextAreaRef: React.RefObject<HTMLTextAreaElement>
  gutterLayerRef: React.RefObject<HTMLDivElement>
  visibleLineNumbers: number[]
  selectionHighlightEnabled: boolean
  highlightedLineRange: { start: number; end: number } | null
  editorRowStartByLine: Record<number, number>
  visibleLineRange: { startLine: number; endLine: number }
  flashSelectionId: string | null
  selectionInfo: MarkdownSelectionInfo | null
  editorPaddingTopPx: number
  lineHeightPx: number
  markdownText: string
  setMarkdownText: (next: string) => void
  setMarkdownDocument: (name: string | null, text: string) => void
  markdownDocumentName: string | null
  markdownPreviewText: string
  previewBasePath: string
  viewerRef: React.RefObject<HTMLDivElement>
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void
  presentationApiRef: React.RefObject<MarkdownPreviewPresentationApi | null>
  presentationSlideState: MarkdownPreviewPresentationSlideState | null
  setPresentationSlideState: (next: MarkdownPreviewPresentationSlideState | null) => void
  handleViewerScroll: (event: React.UIEvent<HTMLElement>) => void
  setMarkdownPresentationMode: (next: boolean) => void
  isMarkdownPreviewTruncated: boolean
  handleApplyMarkdown: () => void | Promise<void>
  onFullscreenToggleRequested: () => void
  onShowInGraphDataTable?: (line: number) => void
  onShowInSlidesGallery?: (line: number) => void
}

export function BottomPanelMarkdownSectionView(
  props: BottomPanelMarkdownSectionViewProps,
) {
  const {
    autoOpenHighlight,
    uiPanelKeyValueTextSizeClass,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    isJsonBacked,
    jsonModeEnabled,
    jsonMarkdownMode,
    setJsonMarkdownMode,
    jsonMarkdownSuggestedMode,
    status,
    applyStatus,
    isMarkdownLargeSummary,
    markdownPresentationMode,
    markdownLayoutMode,
    setMarkdownLayoutMode,
    iconSizeClass,
    uiIconStrokeWidth,
    markdownWordWrap,
    editorGutterWidthCh,
    editorContentHeightPx,
    editorTextAreaRef,
    gutterLayerRef,
    visibleLineNumbers,
    selectionHighlightEnabled,
    highlightedLineRange,
    editorRowStartByLine,
    visibleLineRange,
    flashSelectionId,
    selectionInfo,
    editorPaddingTopPx,
    lineHeightPx,
    markdownText,
    setMarkdownText,
    setMarkdownDocument,
    markdownDocumentName,
    markdownPreviewText,
    previewBasePath,
    viewerRef,
    markdownTextHighlight,
    setMarkdownTextHighlight,
    presentationApiRef,
    presentationSlideState,
    setPresentationSlideState,
    handleViewerScroll,
    setMarkdownPresentationMode,
    isMarkdownPreviewTruncated,
    handleApplyMarkdown,
    onShowInGraphDataTable,
    onShowInSlidesGallery,
  } = props

  const [showSidebar, setShowSidebar] = React.useState(true)
  const [collapsedIds, setCollapsedIds] = React.useState<Set<string>>(new Set())
  const [pendingScrollLine, setPendingScrollLine] = React.useState<number | null>(null)
  const jumpFlashSeqRef = React.useRef(0)
  const [jumpFlash, setJumpFlash] = React.useState<{ line: number; seq: number } | null>(null)
  const selectionFlashDurationMs = useGraphStore(s => s.selectionFlashDurationMs || 500)
  const selectionFlashOpacity = useGraphStore(s => s.selectionFlashOpacity || 0.18)
  const setMarkdownPreviewMermaidFocus = useGraphStore(s => s.setMarkdownPreviewMermaidFocus)
  const setMarkdownPreviewActiveMediaKey = useGraphStore(s => s.setMarkdownPreviewActiveMediaKey)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const graphData = useGraphStore(s => s.graphData)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)
  const markdownTokens = useGraphStore(s => s.markdownTokens)
  const markdownTokensPath = useGraphStore(s => s.markdownTokensPath)
  const markdownTokensKey = useGraphStore(s => s.markdownTokensKey)
  const markdownDocumentText = useGraphStore(s => s.markdownDocumentText)
  const setMarkdownTokens = useGraphStore(s => s.setMarkdownTokens)
  const flashAlpha = Math.max(0, Math.min(1, selectionFlashOpacity * 1.7))
  const flashBgColor = `rgba(249,115,22,${flashAlpha})`

  const [selectionToolbar, setSelectionToolbar] = React.useState<MarkdownSelectionToolbarState | null>(null)

  const closeSelectionToolbar = React.useCallback(() => {
    setSelectionToolbar(null)
  }, [])

  React.useEffect(() => {
    if (!selectionToolbar) return
    const handler = () => closeSelectionToolbar()
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [selectionToolbar, closeSelectionToolbar])

  const handleEditorContextMenu = React.useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const val = ta.value
    
    let text = val.substring(start, end)
    if (start === end) {
        text = ''
    }

    const before = val.substring(0, start)
    const selectedText = text
    const startLine = before.split('\n').length
    const endLine = startLine + (selectedText ? (selectedText.split('\n').length - 1) : 0)
    
    const rect = ta.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    e.preventDefault()
    setSelectionToolbar({
        x,
        y,
        startLine,
        endLine,
        text
    })
  }, [])

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
    if (!selectedNodeId || !graphData) return
    const nodes = (graphData.nodes || []) as Array<{
      id: string
      type?: string
      metadata?: { lineStart?: number; documentPath?: string }
    }>
    const node = nodes.find(n => String(n.id) === selectedNodeId)
    if (!node) return
    const type = String(node.type || '')
    if (type !== 'MermaidNode') return
    
    // Check if it belongs to current document
    const docPath = node.metadata?.documentPath
    const currentDoc = markdownDocumentName || ''
    if (docPath && docPath !== currentDoc) return

    let line = node.metadata?.lineStart
    if (typeof line === 'number' && line > 0) {
      if ((line === 1 || line < 5) && frontmatterMermaidCode && markdownText) {
         const id = selectedNodeId
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const nodeAny = node as any
         const nodeName = (nodeAny.name || nodeAny.properties?.nodeName || nodeAny.properties?.name || nodeAny.properties?.label || '') as string
         const searchTerm = nodeName || id
         
         const fileLines = markdownText.split('\n')
         let mermaidStartLine = -1
         // Look for mermaid key in frontmatter (first 100 lines max)
         for(let i=0; i<Math.min(fileLines.length, 100); i++) {
            const l = fileLines[i].trim()
            if (l === '---' && i > 0) break // End of frontmatter
            if (l.startsWith('mermaid:')) {
               mermaidStartLine = i + 1
               break
            }
         }
         
         if (mermaidStartLine > 0) {
            const codeLines = frontmatterMermaidCode.split('\n')
            for(let i=0; i<codeLines.length; i++) {
               const codeLine = codeLines[i]
               // Simple strict word match for ID or Name
               const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
               const re = new RegExp(`\\b${escaped}\\b`)
               if (re.test(codeLine)) {
                  // Offset by 1 because mermaid block content usually starts on next line after key
                  // But if it's inline like "mermaid: graph TD...", then it's same line.
                  // Usually it's block style with pipe.
                  line = mermaidStartLine + i + 1
                  break
               }
            }
         }
      }
      triggerJump(line)
    }
  }, [selectedNodeId, graphData, markdownDocumentName, triggerJump, frontmatterMermaidCode, markdownText])

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
      const ta = editorTextAreaRef.current
      if (!ta) return

      const run = () => {
        scrollToLineInEditor(
          ta,
          pendingScrollLine,
          editorRowStartByLine,
          lineHeightPx,
          editorPaddingTopPx,
        )
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

  const currentTokensKey = React.useMemo(
    () => buildMarkdownTokensKey(markdownPreviewText || ''),
    [markdownPreviewText],
  )

  const tokens = React.useMemo(() => {
    if (markdownTokens && markdownTokensKey === currentTokensKey && markdownDocumentText === markdownPreviewText) {
      return markdownTokens
    }
    const { tokens } = lexMarkdown(markdownPreviewText || '')
    return tokens
  }, [markdownPreviewText, markdownTokens, markdownTokensKey, currentTokensKey, markdownDocumentText])

  React.useEffect(() => {
    if (!tokens) return
    if (markdownDocumentText !== markdownPreviewText) return
    if (tokens !== markdownTokens || markdownTokensKey !== currentTokensKey || markdownTokensPath !== previewBasePath) {
      setMarkdownTokens(tokens, previewBasePath, currentTokensKey)
    }
  }, [tokens, markdownTokens, markdownTokensPath, markdownTokensKey, currentTokensKey, markdownDocumentText, markdownPreviewText, previewBasePath, setMarkdownTokens])

  const rootItems = React.useMemo(() => buildTocTree(tokens), [tokens])

  const headingLines = React.useMemo(() => {
    const map = new Map<number, string>()
    tokens.forEach(t => {
      if (t.type === 'heading') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const h = t as any
        const id = h.id || slugify(h.text || '')
        // Use startLine from token (1-based)
        if (h.startLine && id) {
          map.set(h.startLine, id)
        }
      }
    })
    return map
  }, [tokens])

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
      // Find the token to get the line number
      const token = tokens.find(t => {
        if (t.type !== 'heading') return false
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const h = t as any
        const tid = h.id || slugify(h.text || '')
        return tid === id
      })

      if (token && token.startLine) {
        // Scroll Editor
        scrollToLineInEditor(
          editorTextAreaRef.current,
          token.startLine,
          editorRowStartByLine,
          lineHeightPx,
          editorPaddingTopPx,
        )

        // Ensure editor is scrolled if in editor mode
        if (markdownLayoutMode === 'editor') {
             scrollToLineInEditor(
               editorTextAreaRef.current,
               token.startLine,
               editorRowStartByLine,
               lineHeightPx,
               editorPaddingTopPx
             )
        }
      }
      
      // Also scroll viewer element into view if possible
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    },
    [tokens, markdownLayoutMode, editorTextAreaRef, editorRowStartByLine, lineHeightPx, editorPaddingTopPx],
  )

  const handleTocDoubleClick = React.useCallback(
    (id: string) => {
      const token = tokens.find(t => {
        if (t.type !== 'heading') return false
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const h = t as any
        const tid = h.id || slugify(h.text || '')
        return tid === id
      })

      if (token && token.startLine) {
        setMarkdownLayoutMode('editor')
        setMarkdownPresentationMode(false)
        triggerJump(token.startLine)
      }
    },
    [tokens, setMarkdownLayoutMode, setMarkdownPresentationMode, triggerJump],
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

  const handleEditorDoubleClick = React.useCallback(
    () => {
       // Default behavior: Select word (native). 
       // We removed the legacy behavior of switching to viewer on double click.
    },
    []
  )

  const handleSlidesReordered = React.useCallback(
    (nextOrder: number[]) => {
      const source = markdownText || ''
      if (!source.trim()) return
      const next = reorderSlidesInMarkdown(source, nextOrder)
      if (next === source) return
      setMarkdownText(next)
      setMarkdownDocument(markdownDocumentName, next)
      emitMarkdownPanelMetric('markdownSlidesReordered', {
        slideCount: nextOrder.length,
        documentName: markdownDocumentName || null,
      })
    },
    [markdownDocumentName, markdownText, setMarkdownDocument, setMarkdownText],
  )

  const isEditing = !markdownPresentationMode && markdownLayoutMode === 'editor'

  return (
    <section className="h-full min-h-0 flex flex-col">
      <article
        className={[
          `flex-1 min-h-0 flex flex-col border rounded overflow-hidden transition-colors duration-300 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.panel.border}`,
          autoOpenHighlight ? 'border-blue-400 ring-1 ring-blue-200' : '',
        ].join(' ')}
      >
        <header
          className={[
            `px-2 py-1 border-b flex items-center justify-between gap-2 ${UI_THEME_TOKENS.panel.divider} ${UI_THEME_TOKENS.text.secondary}`,
            uiPanelKeyValueTextSizeClass,
            uiPanelTextFontClass,
          ].join(' ')}
        >
          <HeaderStatusRow
            uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
            jsonBackedBadgeTooltip={UI_COPY.bottomPanelMarkdownJsonBackedPreviewBadgeTooltip}
            jsonBackedBadgeLabel={UI_COPY.bottomPanelMarkdownJsonBackedPreviewBadgeLabel}
            isJsonBacked={isJsonBacked}
            jsonModeEnabled={jsonModeEnabled}
            jsonMarkdownMode={jsonMarkdownMode}
            setJsonMarkdownMode={setJsonMarkdownMode}
            jsonMarkdownSuggestedMode={jsonMarkdownSuggestedMode}
            status={status}
            applyStatus={applyStatus}
            isMarkdownLargeSummary={isMarkdownLargeSummary}
            jsonModeLabel={UI_COPY.bottomPanelJsonMarkdownModeLabel}
            jsonModeAutoLabel={UI_COPY.bottomPanelJsonMarkdownModeAutoLabel}
            jsonModeTableLabel={UI_COPY.bottomPanelJsonMarkdownModeTableLabel}
            jsonModeKeyValueLabel={UI_COPY.bottomPanelJsonMarkdownModeKeyValueLabel}
            jsonModeHierarchicalLabel={UI_COPY.bottomPanelJsonMarkdownModeHierarchicalLabel}
            jsonModeSuggestedPrefix={UI_COPY.bottomPanelJsonMarkdownModeSuggestedPrefix}
            statusLabel={UI_LABELS.markdown}
            largeSummaryHelperText={UI_COPY.markdownLargeSummaryHelperText}
            hasFrontmatterMermaid={hasFrontmatterMermaid}
            onClickFrontmatterHint={handleClickFrontmatterMermaidHint}
          />
          <ViewerHeaderRow
            uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
            uiPanelTextFontClass={uiPanelTextFontClass}
            viewerTitle={UI_COPY.bottomPanelMarkdownViewerTitle}
            editorTitle={UI_COPY.bottomPanelMarkdownEditorTitle}
            markdownPresentationMode={markdownPresentationMode}
            iconSizeClass={iconSizeClass}
            uiIconStrokeWidth={uiIconStrokeWidth}
            markdownTextHighlight={markdownTextHighlight}
            setMarkdownTextHighlight={setMarkdownTextHighlight}
            setMarkdownPresentationMode={setMarkdownPresentationMode}
            presentationApiRef={presentationApiRef}
            presentationSlideState={presentationSlideState}
            markdownPreviewPrevButtonLabel={UI_COPY.markdownPreviewPrevButtonLabel}
            markdownPreviewNextButtonLabel={UI_COPY.markdownPreviewNextButtonLabel}
            textHighlightToggleTitle={UI_COPY.bottomPanelMarkdownTextHighlightToggleTitle}
            textHighlightOnTooltip={UI_COPY.bottomPanelMarkdownTextHighlightOnTooltip}
            textHighlightOffTooltip={UI_COPY.bottomPanelMarkdownTextHighlightOffTooltip}
            applyButtonLabel={UI_COPY.bottomPanelMarkdownApplyButtonLabel}
            applyButtonTitle={UI_COPY.bottomPanelMarkdownApplyButtonTitle}
            onApplyMarkdown={() => {
              void handleApplyMarkdown()
            }}
            presentationModeToggleTitle={UI_COPY.bottomPanelMarkdownPresentationModeToggleTitle}
            presentationModeOnTooltip={UI_COPY.bottomPanelMarkdownPresentationModeOnTooltip}
            presentationModeOffTooltip={UI_COPY.bottomPanelMarkdownPresentationModeOffTooltip}
            fullscreenToggleTitle={UI_COPY.bottomPanelMarkdownFullscreenToggleTitle}
            fullscreenOnTooltip={UI_COPY.bottomPanelMarkdownFullscreenOnTooltip}
            fullscreenOffTooltip={UI_COPY.bottomPanelMarkdownFullscreenOffTooltip}
            editToggleTitle={UI_COPY.bottomPanelMarkdownEditToggleTitle}
            editOnTooltip={UI_COPY.bottomPanelMarkdownEditOnTooltip}
            editOffTooltip={UI_COPY.bottomPanelMarkdownEditOffTooltip}
            isEditing={isEditing}
            onFullscreenToggleRequested={props.onFullscreenToggleRequested}
            onToggleEdit={() => {
              const nextIsEditing = !isEditing
              setMarkdownLayoutMode(nextIsEditing ? 'editor' : 'viewer')
              if (nextIsEditing) {
                // When toggling to editor, try to sync scroll to current viewer position
                // We can use the start line of the visible range
                const targetLine =
                  markdownPresentationMode && presentationSlideState?.activeSlideLine
                    ? presentationSlideState.activeSlideLine
                    : visibleLineRange.startLine

                if (targetLine > 0) {
                  triggerJump(targetLine)
                } else {
                   handleViewerScroll({
                    currentTarget: viewerRef.current as unknown as HTMLElement,
                  } as React.UIEvent<HTMLElement>)
                }
              } else {
                const ta = editorTextAreaRef.current
                if (ta) {
                  const run = () => {
                    try {
                      ta.dispatchEvent(new Event('scroll', { bubbles: true }))
                    } catch {
                      void 0
                    }
                  }
                  try {
                    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
                      window.requestAnimationFrame(() => run())
                    } else {
                      setTimeout(() => run(), 0)
                    }
                  } catch {
                    run()
                  }
                }
              }
            }}
          />
        </header>

              <MarkdownPanelLayout
                tokens={tokens}
                uiPanelTextFontClass={uiPanelTextFontClass}
                showSidebar={showSidebar}
                setShowSidebar={handleToggleSidebar}
                onTocSelect={handleTocSelect}
                className={`flex-1 ${isEditing ? '' : 'hidden'}`}
                collapsedIds={collapsedIds}
                onToggleCollapse={handleToggleCollapse}
                onExpandAll={handleExpandAll}
                onCollapseAll={handleCollapseAll}
                onTocReorder={handleTocReorder}
              >
                <div className="flex flex-1 min-h-0 relative h-full">
                  <aside
                    className={`shrink-0 border-r ${UI_THEME_TOKENS.panel.divider} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.tertiary} relative overflow-hidden`}
                    style={{ width: `${editorGutterWidthCh}ch` }}
                    onWheel={e => {
                      const ta = editorTextAreaRef.current
                      if (!ta) return
                      if (!e.deltaY) return
                      e.preventDefault()
                      ta.scrollTop = ta.scrollTop + e.deltaY
                    }}
                    aria-label="Line numbers"
                  >
                    <div
                      ref={gutterLayerRef}
                      className="absolute left-0 right-0 top-0"
                      style={{
                        height: `${editorContentHeightPx}px`,
                        transform: 'translateY(0px)',
                        willChange: 'transform',
                      }}
                    >
                      {visibleLineNumbers.map(line => {
                        const isHighlighted =
                          selectionHighlightEnabled &&
                          highlightedLineRange != null &&
                          line >= highlightedLineRange.start &&
                          line <= highlightedLineRange.end
                        const startRow =
                          editorRowStartByLine[visibleLineRange.startLine] ??
                          visibleLineRange.startLine
                        const row = editorRowStartByLine[line] ?? line
                        const isJumpFlash = !!jumpFlash && jumpFlash.line === line
                        const useFlash =
                          !!flashSelectionId &&
                          !!selectionInfo &&
                          flashSelectionId === selectionInfo.id &&
                          isHighlighted
                        const baseBg =
                          isHighlighted && selectionInfo?.highlightBackgroundColor
                            ? selectionInfo.highlightBackgroundColor
                            : null
                        const bgColor = isJumpFlash || useFlash ? flashBgColor : baseBg
                        const headingId = headingLines.get(line)
                        const isCollapsed = headingId ? collapsedIds.has(headingId) : false

                        return (
                          <GutterRow
                            key={line}
                            line={line}
                            top={editorPaddingTopPx + (row - startRow) * lineHeightPx}
                            height={lineHeightPx}
                            bgColor={bgColor}
                            uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
                            transitionClass="transition-colors duration-1000"
                            headingId={headingId}
                            isCollapsed={isCollapsed}
                            onToggleCollapse={handleToggleCollapse}
                            onReorder={handleTocReorder}
                            rootItems={rootItems}
                          />
                        )
                      })}
                    </div>
                  </aside>
                  <textarea
                    ref={editorTextAreaRef}
                    value={markdownText}
                    onDoubleClick={handleEditorDoubleClick}
                    onContextMenu={handleEditorContextMenu}
                    onChange={e => {
                      const next = e.target.value
                      setMarkdownText(next)
                      setMarkdownDocument(markdownDocumentName, next)
                    }}
                    className={[
                      `w-full h-full px-2 py-2 border-0 rounded-none resize-none bg-transparent outline-none ${UI_THEME_TOKENS.text.primary}`,
                      'overflow-auto',
                      markdownWordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
                      uiPanelMonospaceTextClass,
                    ].join(' ')}
                    style={{ lineHeight: `${lineHeightPx}px` }}
                    wrap={markdownWordWrap ? 'soft' : 'off'}
                  />
                  {selectionToolbar && (
                    <MarkdownSelectionToolbar
                      toolbar={selectionToolbar}
                      onClose={closeSelectionToolbar}
                      onShowOnCanvas={handleShowOnCanvas}
                      onShowInViewer={(line) => {
                        setMarkdownLayoutMode('viewer')
                        setMarkdownPresentationMode(false)
                        triggerJump(line)
                      }}
                      onShowInEditor={(line) => {
                        triggerJump(line)
                      }}
                      onShowInPresentation={() => {
                        setMarkdownPresentationMode(true)
                      }}
                      onShowInSlidesGallery={onShowInSlidesGallery || (() => {})}
                      onShowInGraphDataTable={onShowInGraphDataTable || (() => {})}
                      currentView="editor"
                    />
                  )}
                </div>
              </MarkdownPanelLayout>
            <section
              className={[
                'flex-1 min-h-0 flex flex-col',
                !isEditing ? '' : 'hidden',
              ].join(' ')}
            >
              {isMarkdownPreviewTruncated && (
                <div
                  className={[
                    uiPanelKeyValueTextSizeClass,
                    `px-2 py-1 border-b ${UI_THEME_TOKENS.panel.divider} ${UI_THEME_TOKENS.panel.headerBg} text-[10px] ${UI_THEME_TOKENS.text.tertiary}`,
                  ].join(' ')}
                >
                  {UI_COPY.markdownPreviewTruncatedHelperText}
                </div>
              )}
              <MarkdownPreview
                ref={viewerRef}
                markdownText={markdownPreviewText}
                activeDocumentPath={previewBasePath}
                highlightedLineRange={
                  jumpFlash
                    ? { start: jumpFlash.line, end: jumpFlash.line }
                    : selectionHighlightEnabled
                      ? highlightedLineRange
                      : null
                }
                markdownWordWrap={markdownWordWrap}
                markdownPresentationMode={markdownPresentationMode}
                markdownTextHighlight={selectionHighlightEnabled || !!jumpFlash}
                alwaysOnHighlightMode={markdownTextHighlight}
                selectionKind={jumpFlash ? null : (selectionInfo?.kind ?? null)}
                highlightBackgroundColor={jumpFlash ? flashBgColor : (selectionInfo?.highlightBackgroundColor ?? null)}
                highlightUnderlineColor={jumpFlash ? null : (selectionInfo?.highlightUnderlineColor ?? null)}
                presentationApiRef={presentationApiRef}
                onPresentationSlideStateChange={setPresentationSlideState}
                onSlidesReordered={handleSlidesReordered}
                uiPanelTextFontClass={uiPanelTextFontClass}
                uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
                previewScrollable
                onScroll={markdownPresentationMode ? undefined : handleViewerScroll}
                onPreviewClick={(line: number) => {
                  setMarkdownLayoutMode('editor')
                  setMarkdownPresentationMode(false)
                  triggerJump(line)
                }}
                tokens={tokens}
                showSidebar={showSidebar}
                onToggleSidebar={handleToggleSidebar}
                collapsedIds={collapsedIds}
                onToggleCollapse={handleToggleCollapse}
                onExpandAll={handleExpandAll}
                onCollapseAll={handleCollapseAll}
                onTocSelect={handleTocSelect}
                onTocDoubleClick={handleTocDoubleClick}
                onTocReorder={handleTocReorder}
                frontmatterMermaidCode={frontmatterMermaidCode}
                onShowInViewer={(line) => {
                  setMarkdownLayoutMode('viewer')
                  setMarkdownPresentationMode(false)
                  triggerJump(line)
                }}
                onShowInEditor={(line) => {
                  setMarkdownLayoutMode('editor')
                  setMarkdownPresentationMode(false)
                  triggerJump(line)
                }}
                onShowInPresentation={(line) => {
                  setMarkdownPresentationMode(true)
                  triggerJump(line)
                }}
                onShowInSlidesGallery={(line) => {
                  setMarkdownPresentationMode(true)
                  // TODO: Enable thumbnail sidebar if possible, or assume it's part of presentation
                  triggerJump(line)
                  if (onShowInSlidesGallery) onShowInSlidesGallery(line)
                }}
                onShowInGraphDataTable={(line) => {
                  if (onShowInGraphDataTable) onShowInGraphDataTable(line)
                }}
              />
            </section>
      </article>
    </section>
  )
}
