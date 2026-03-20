import React from 'react'
import { ChevronDown, ChevronRight, FileText, Folder, FolderPlus, GripVertical, MoreHorizontal, Plus, RefreshCcw, Search, Link2 } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { MarkdownExplorerSection } from '../MarkdownExplorerSection'
import { MarkdownFileTree } from '../MarkdownFileTree'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import type { WorkspaceBacklink } from '@/features/workspace-fs/types'
import { buildTocTree, type TocItem } from '@/features/markdown/ui/markdownSectionUtils'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { computeMarkdownTocReorder } from 'grph-shared/markdown/toc'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { CollapsibleToolbar } from '@/components/ui/CollapsibleToolbar'
import { MarkdownWorkspaceExplorerHeaderActions } from './MarkdownWorkspaceExplorerHeaderActions'

export type MarkdownWorkspaceExplorerProps = {
  uiPanelTextFontClass: string

  sidebarWidthPx: number
  sidebarWidthMinPx: number
  sidebarWidthMaxPx: number

  entries: WorkspaceEntry[]
  filteredEntries: WorkspaceEntry[]
  sourcesByPath: WorkspaceSourceIndex | null
  loading: boolean
  loadError: string
  expandedPaths: Set<string>
  toggleExpanded: (path: WorkspacePath) => void
  activePath: WorkspacePath | null
  onSelectFile: (path: WorkspacePath) => void
  onSelectFolder: (path: WorkspacePath) => void

  search: string
  setSearch: (next: string) => void

  sourceFilesCollapsed: boolean
  setSourceFilesCollapsed: (next: boolean) => void
  tocCollapsed: boolean
  setTocCollapsed: (next: boolean) => void
  backlinksCollapsed: boolean
  setBacklinksCollapsed: (next: boolean) => void

  tocTokens: TokenWithLines[]
  backlinks: WorkspaceBacklink[]
  onRevealLine: (line: number) => void
  onOpenBacklink: (args: { path: WorkspacePath; line: number }) => void

  onTocReorder: (parentId: string | null, fromIndex: number, toIndex: number) => void

  onCreateNewFile: () => void
  onCreateNewFolder: () => void
  onRefresh: () => void

  onSave?: () => void
  saveDisabled?: boolean
  onImportLocalFiles?: (files: FileList | null) => void
  onImportLocalFolder?: (files: FileList | null) => void
  onImportUrl?: (url: string) => void
  onImportWebsite?: (url: string) => void

  activeEntryName: string
  activeEntryKind: 'file' | 'folder' | ''
  canClearActiveSelection: boolean
  onClearActiveSelection: () => void
  canRefreshActiveFromSource: boolean
  onRefreshActiveFromSource: () => void
  canDeleteActive: boolean
  onDeleteActive: () => void

  renderSourceFileRight?: (args: { entry: WorkspaceEntry; isActive: boolean }) => React.ReactNode
}

function TocTreeItem(props: {
  item: TocItem
  depth: number
  hn: string
  isExpanded: boolean
  isActive: boolean
  onToggleExpanded: (id: string) => void
  onSelect: (id: string) => void
  onReorder: (sourceId: string, targetId: string, position: 'before' | 'after') => void
  uiPanelTextFontClass: string
  uiPanelKeyValueTextSizeClass: string
}) {
  const { item, depth, hn, isExpanded, isActive, onToggleExpanded, onSelect, onReorder, uiPanelTextFontClass, uiPanelKeyValueTextSizeClass } = props
  const [dragState, setDragState] = React.useState<'none' | 'top' | 'bottom'>('none')
  const [isDragging, setIsDragging] = React.useState(false)

  const hasChildren = item.children.length > 0
  const indent = Math.min(28, depth * 12)

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true)
    e.dataTransfer.setData('text/plain', item.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    setDragState('none')
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    if (e.clientY < midY) setDragState('top')
    else setDragState('bottom')
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setDragState('none')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const sourceId = e.dataTransfer.getData('text/plain')
    setDragState('none')
    if (!sourceId || sourceId === item.id) return
    onReorder(sourceId, item.id, dragState === 'bottom' ? 'after' : 'before')
  }

  return (
    <section
      className="group flex items-center relative"
      aria-label={hasChildren ? `Heading ${item.text}` : `Heading leaf ${item.text}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
        {dragState === 'top' ? (
          <span className={`absolute left-0 right-0 -top-1 h-2 ${UI_THEME_TOKENS.button.activeBg} border-t-2 ${UI_THEME_TOKENS.button.activeBorder} z-10 pointer-events-none`} />
        ) : null}
        {dragState === 'bottom' ? (
          <span className={`absolute left-0 right-0 -bottom-1 h-2 ${UI_THEME_TOKENS.button.activeBg} border-b-2 ${UI_THEME_TOKENS.button.activeBorder} z-10 pointer-events-none`} />
        ) : null}

        <button
          type="button"
          data-toc-id={item.id}
          className={`flex-1 min-w-0 flex items-center gap-1 rounded px-1 py-[2px] ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} ${uiPanelTextFontClass} ${isDragging ? 'opacity-50' : ''} ${isActive ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : ''}`}
          style={{ paddingLeft: 6 + indent }}
          onClick={() => {
            onSelect(item.id)
            if (hasChildren) onToggleExpanded(item.id)
          }}
          aria-label={`Heading ${item.text}`}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-3 h-3 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />
            )
          ) : (
            <span className="w-3 h-3 shrink-0" aria-hidden="true" />
          )}
          {hasChildren ? <Folder className="w-3 h-3 shrink-0" aria-hidden="true" /> : <FileText className="w-3 h-3 shrink-0" aria-hidden="true" />}
          <span className={`shrink-0 tabular-nums ${UI_THEME_TOKENS.text.secondary}`}>{hn}</span>
          <span className="truncate">{item.text}</span>
        </button>

        <button
          type="button"
          className={`opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing w-4 h-4 shrink-0 flex items-center justify-center rounded ${UI_THEME_TOKENS.text.tertiary} hover:text-gray-600 dark:hover:text-gray-400`}
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          aria-label="Reorder heading"
          title="Reorder heading"
        >
          <GripVertical className="w-3 h-3" aria-hidden="true" />
        </button>
    </section>
  )
}

export const MarkdownWorkspaceExplorer = React.memo(function MarkdownWorkspaceExplorer(props: MarkdownWorkspaceExplorerProps) {
  const {
    uiPanelTextFontClass,
    sidebarWidthPx,
    sidebarWidthMinPx,
    sidebarWidthMaxPx,
    entries,
    filteredEntries,
    sourcesByPath,
    loading,
    loadError,
    expandedPaths,
    toggleExpanded,
    activePath,
    onSelectFile,
    onSelectFolder,
    search,
    setSearch,
    sourceFilesCollapsed,
    setSourceFilesCollapsed,
    tocCollapsed,
    setTocCollapsed,
    backlinksCollapsed,
    setBacklinksCollapsed,
    tocTokens,
    backlinks,
    onRevealLine,
    onOpenBacklink,
    onTocReorder,
    onCreateNewFile,
    onCreateNewFolder,
    onRefresh,
    onSave,
    saveDisabled,
    onImportLocalFiles,
    onImportLocalFolder,
    onImportUrl,
    onImportWebsite,
    activeEntryName,
    activeEntryKind,
    canClearActiveSelection,
    onClearActiveSelection,
    canRefreshActiveFromSource,
    onRefreshActiveFromSource,
    canDeleteActive,
    onDeleteActive,
    renderSourceFileRight,
  } = props
  const panelTypography = usePanelTypography()

  const clearLabel = activeEntryKind === 'folder' ? 'Clear files' : 'Clear'

  const tocItems = React.useMemo(() => buildTocTree(tocTokens), [tocTokens])

  const tocParentById = React.useMemo(() => {
    const out = new Map<string, string | null>()
    const walk = (items: TocItem[], parentId: string | null) => {
      for (const item of items) {
        const id = String(item.id || '').trim()
        if (id) out.set(id, parentId)
        if (item.children.length) walk(item.children, id || parentId)
      }
    }
    walk(tocItems, null)
    return out
  }, [tocItems])
  const tocLineById = React.useMemo(() => {
    const out = new Map<string, number>()
    const walk = (items: TocItem[]) => {
      for (const item of items) {
        const id = String(item.id || '').trim()
        if (id) out.set(id, Math.max(1, Math.floor(item.startLine || 1)))
        if (item.children.length) walk(item.children)
      }
    }
    walk(tocItems)
    return out
  }, [tocItems])

  const [tocCollapsedIds, setTocCollapsedIds] = React.useState<Set<string>>(() => new Set())
  const [activeTocId, setActiveTocId] = React.useState<string>('')
  const tocNavRef = React.useRef<HTMLElement | null>(null)
  React.useEffect(() => {
    setTocCollapsedIds(new Set())
    setActiveTocId('')
  }, [activePath])

  const toggleTocExpanded = React.useCallback((id: string) => {
    setTocCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  React.useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ id?: unknown }>
      const id = typeof e.detail?.id === 'string' ? e.detail.id : ''
      if (!id) return
      setActiveTocId(id)
      setTocCollapsedIds(prev => {
        const next = new Set(prev)
        let cur: string | null | undefined = tocParentById.get(id)
        while (cur) {
          next.delete(cur)
          cur = tocParentById.get(cur)
        }
        return next
      })
      try {
        const nav = tocNavRef.current
        const el = nav ? nav.querySelector(`[data-toc-id="${CSS.escape(id)}"]`) : null
        if (el && el instanceof HTMLElement) {
          el.scrollIntoView({ block: 'center', inline: 'nearest' })
        }
      } catch {
        void 0
      }
    }
    window.addEventListener('kg:tocFocus', handler as EventListener)
    return () => window.removeEventListener('kg:tocFocus', handler as EventListener)
  }, [tocParentById])

  const handleTocReorderByIds = React.useCallback(
    (sourceId: string, targetId: string, position: 'before' | 'after') => {
      const move = computeMarkdownTocReorder({ root: tocItems, sourceId, targetId, position })
      if (!move) return
      onTocReorder(move.parentId, move.fromIndex, move.toIndex)
    },
    [onTocReorder, tocItems],
  )

  const tocHnById = React.useMemo(() => {
    const map = new Map<string, string>()
    const walk = (items: TocItem[], path: number[]) => {
      for (let i = 0; i < items.length; i += 1) {
        const it = items[i]!
        const nextPath = path.concat([i + 1])
        map.set(it.id, nextPath.join('.'))
        if (it.children && it.children.length > 0) walk(it.children, nextPath)
      }
    }
    walk(tocItems, [])
    return map
  }, [tocItems])

  const tocBaseDepth = React.useMemo(() => {
    let minDepth = Infinity
    const walk = (items: TocItem[]) => {
      for (const it of items) {
        const d = typeof it.depth === 'number' && Number.isFinite(it.depth) ? it.depth : 1
        minDepth = Math.min(minDepth, Math.max(1, Math.min(6, d)))
        if (it.children && it.children.length > 0) walk(it.children)
      }
    }
    walk(tocItems)
    return Number.isFinite(minDepth) ? minDepth : 1
  }, [tocItems])

  const renderTocNode = React.useCallback(
    (item: TocItem): React.ReactNode => {
      const isCollapsed = tocCollapsedIds.has(item.id)
      const isExpanded = !isCollapsed
      const hasChildren = item.children.length > 0
      const itemDepth = typeof item.depth === 'number' && Number.isFinite(item.depth) ? item.depth : 1
      const visualDepth = Math.max(0, Math.min(6, Math.max(1, itemDepth)) - tocBaseDepth)
      const hn = tocHnById.get(item.id) || ''
      return (
        <li key={item.id} className="list-none">
          <TocTreeItem
            item={item}
            depth={visualDepth}
            hn={hn}
            isExpanded={isExpanded}
            isActive={!!activeTocId && activeTocId === item.id}
            onToggleExpanded={toggleTocExpanded}
            onSelect={id => {
              setActiveTocId(id)
              const line = tocLineById.get(id)
              if (!line) return
              onRevealLine(line)
            }}
            onReorder={handleTocReorderByIds}
            uiPanelTextFontClass={uiPanelTextFontClass}
            uiPanelKeyValueTextSizeClass={panelTypography.textSizeClass}
          />
          {hasChildren && isExpanded ? (
            <ul className="list-none m-0 p-0">{item.children.map(child => renderTocNode(child))}</ul>
          ) : null}
        </li>
      )
    },
    [
      activeTocId,
      handleTocReorderByIds,
      onRevealLine,
      panelTypography.textSizeClass,
      tocCollapsedIds,
      tocLineById,
      tocBaseDepth,
      tocHnById,
      toggleTocExpanded,
      uiPanelTextFontClass,
    ],
  )

  const hasSelectionActions = canClearActiveSelection || canRefreshActiveFromSource || canDeleteActive
  const [selectionMenuOpen, setSelectionMenuOpen] = React.useState(false)
  const selectionMenuRootRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (hasSelectionActions) return
    setSelectionMenuOpen(false)
  }, [hasSelectionActions])

  React.useEffect(() => {
    if (!selectionMenuOpen) return
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setSelectionMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectionMenuOpen])

  React.useEffect(() => {
    if (!selectionMenuOpen) return
    const onDown = (ev: PointerEvent) => {
      const root = selectionMenuRootRef.current
      const target = ev.target as Node | null
      if (!root || !target) return
      if (root.contains(target)) return
      setSelectionMenuOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [selectionMenuOpen])

  return (
    <aside
      className={`h-full min-h-0 flex flex-col ${UI_THEME_TOKENS.panel.bg}`}
      style={{ width: Math.max(sidebarWidthMinPx, Math.min(sidebarWidthMaxPx, sidebarWidthPx)) }}
      aria-label="Markdown Explorer"
    >
      <header
        className={`kg-toolbar flex items-center justify-between gap-2 px-2 py-1 border-b ${UI_THEME_TOKENS.panel.border}`}
        aria-label="Explorer header"
      >
        <section className="min-w-0 flex-1 flex items-center gap-2" aria-label="Explorer title">
          <h2 className={`shrink-0 ${panelTypography.microLabelClass} font-semibold tracking-wide uppercase ${UI_THEME_TOKENS.text.secondary}`}>Explorer</h2>
        </section>
        <CollapsibleToolbar ariaLabel="Explorer actions" className="kg-toolbar flex items-center justify-end">
          <ul className="flex items-center gap-1 list-none m-0 p-0" aria-label="Explorer actions list">
            <MarkdownWorkspaceExplorerHeaderActions
              microLabelClass={panelTypography.microLabelClass}
              onSave={onSave}
              saveDisabled={saveDisabled}
              onImportLocalFiles={onImportLocalFiles}
              onImportLocalFolder={onImportLocalFolder}
              onImportUrl={onImportUrl}
              onImportWebsite={onImportWebsite}
            />
            {hasSelectionActions ? (
              <li className="list-none relative" ref={el => (selectionMenuRootRef.current = el)}>
                <button
                  type="button"
                  className={`kg-toolbar-btn shrink-0 inline-flex items-center justify-center rounded cursor-pointer ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                  aria-label={activeEntryName ? `Actions for ${activeEntryName}` : 'Selection actions'}
                  aria-haspopup="menu"
                  aria-expanded={selectionMenuOpen}
                  title="Selection actions"
                  onClick={() => setSelectionMenuOpen(v => !v)}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {selectionMenuOpen ? (
                  <section
                    className={`absolute right-0 mt-1 min-w-40 ${UI_THEME_TOKENS.panel.bg} border ${UI_THEME_TOKENS.panel.border} rounded shadow-md ${panelTypography.textSizeClass} ${UI_THEME_TOKENS.text.primary} p-1 z-50`}
                    role="menu"
                    aria-label="Selection actions menu"
                  >
                    <ul className="list-none m-0 p-0">
                      {canRefreshActiveFromSource ? (
                        <li className="list-none">
                          <button
                            type="button"
                            className={`w-full text-left rounded px-2 py-1 ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                            aria-label={activeEntryName ? `Refresh ${activeEntryName}` : 'Refresh from URL'}
                            role="menuitem"
                            onClick={() => {
                              setSelectionMenuOpen(false)
                              onRefreshActiveFromSource()
                            }}
                          >
                            Refresh from URL
                          </button>
                        </li>
                      ) : null}
                      {canClearActiveSelection ? (
                        <li className="list-none">
                          <button
                            type="button"
                            className={`w-full text-left rounded px-2 py-1 ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                            role="menuitem"
                            onClick={() => {
                              setSelectionMenuOpen(false)
                              onClearActiveSelection()
                            }}
                          >
                            {clearLabel}
                          </button>
                        </li>
                      ) : null}
                      {canDeleteActive ? (
                        <li className="list-none">
                          <button
                            type="button"
                            className={`w-full text-left rounded px-2 py-1 ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                            role="menuitem"
                            onClick={() => {
                              setSelectionMenuOpen(false)
                              onDeleteActive()
                            }}
                          >
                            Delete
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  </section>
                ) : null}
              </li>
            ) : null}
            <li className="list-none">
              <button
                type="button"
                className={`kg-toolbar-btn shrink-0 inline-flex items-center justify-center rounded ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={onCreateNewFile}
                aria-label="New file"
                title="New file"
              >
                <Plus className="w-4 h-4" />
              </button>
            </li>
            <li className="list-none">
              <button
                type="button"
                className={`kg-toolbar-btn shrink-0 inline-flex items-center justify-center rounded ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={onCreateNewFolder}
                aria-label="New folder"
                title="New folder"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </li>
            {canRefreshActiveFromSource ? (
              <li className="list-none">
                <button
                  type="button"
                  className={`kg-toolbar-btn shrink-0 inline-flex items-center justify-center rounded ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                  onClick={onRefreshActiveFromSource}
                  aria-label={activeEntryName ? `Refresh ${activeEntryName}` : 'Refresh from URL'}
                  title="Refresh from URL"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
              </li>
            ) : null}
            <li className="list-none">
              <button
                type="button"
                className={`kg-toolbar-btn shrink-0 inline-flex items-center justify-center rounded ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={onRefresh}
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </li>
          </ul>
        </CollapsibleToolbar>
      </header>

      <form className="px-2 py-1" role="search" aria-label="Search files">
        <label className="flex items-center gap-2">
          <Search className={`w-4 h-4 shrink-0 ${UI_THEME_TOKENS.text.secondary}`} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search"
            className={`w-full min-w-0 h-[var(--kg-control-height,28px)] px-2 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} ${panelTypography.panelTextClass}`}
          />
        </label>
      </form>

      <section className="flex-1 min-h-0 overflow-auto" aria-label="Explorer content">
        <MarkdownExplorerSection
          title="Source Files"
          collapsed={sourceFilesCollapsed}
          setCollapsed={setSourceFilesCollapsed}
          right={<span className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>{entries.filter(e => e.kind === 'file').length}</span>}
        >
          {loading ? (
            <p className={`px-2 py-1 ${panelTypography.textSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>Loading…</p>
          ) : loadError ? (
            <p className={`px-2 py-1 ${panelTypography.textSizeClass} ${UI_THEME_TOKENS.status.error}`}>Failed: {loadError}</p>
          ) : (
            <MarkdownFileTree
              entries={filteredEntries}
              expandedPaths={expandedPaths}
              toggleExpanded={toggleExpanded}
              activePath={activePath}
              onSelectFile={onSelectFile}
              onSelectFolder={onSelectFolder}
              sourcesByPath={sourcesByPath}
              renderFileRight={renderSourceFileRight}
            />
          )}
        </MarkdownExplorerSection>

        <MarkdownExplorerSection title="TOC" collapsed={tocCollapsed} setCollapsed={setTocCollapsed}>
          {tocItems.length === 0 ? (
            <p className={`px-2 py-1 ${panelTypography.textSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>No headings.</p>
          ) : (
            <nav
              ref={el => {
                tocNavRef.current = el
              }}
              className="min-h-0 overflow-auto"
              aria-label="Table of contents"
            >
              <ul className="list-none m-0 p-0">{tocItems.map(item => renderTocNode(item))}</ul>
            </nav>
          )}
        </MarkdownExplorerSection>

        <MarkdownExplorerSection title="Backlinks" collapsed={backlinksCollapsed} setCollapsed={setBacklinksCollapsed}>
          {activePath && backlinks.length === 0 ? (
            <p className={`px-2 py-1 ${panelTypography.textSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>No backlinks.</p>
          ) : (
            <ul className="space-y-1 list-none m-0 p-0" aria-label="Backlinks list">
              {backlinks.slice(0, 50).map((b, idx) => (
                <li key={`${b.fromPath}:${b.line}:${idx}`} className="list-none">
                  <button
                    type="button"
                    className={`w-full flex items-start gap-2 rounded px-2 py-1 ${panelTypography.textSizeClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                    onClick={() => onOpenBacklink({ path: b.fromPath, line: b.line })}
                    aria-label={`Backlink from ${b.fromPath}`}
                  >
                    <Link2 className="w-3 h-3 mt-[2px]" />
                    <span className="min-w-0">
                      <span className="block truncate">{b.fromPath}</span>
                      <span className={`block truncate ${UI_THEME_TOKENS.text.secondary}`}>L{b.line}: {b.lineText}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </MarkdownExplorerSection>
      </section>

    </aside>
  )
})
