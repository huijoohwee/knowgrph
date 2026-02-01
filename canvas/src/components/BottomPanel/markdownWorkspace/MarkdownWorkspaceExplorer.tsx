import React from 'react'
import { FolderPlus, MoreHorizontal, Plus, RefreshCcw, Search, Link2 } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { MarkdownExplorerSection } from '../MarkdownExplorerSection'
import { MarkdownFileTree } from '../MarkdownFileTree'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import type { WorkspaceOutlineItem, WorkspaceBacklink } from '@/features/workspace-fs/types'

export type MarkdownWorkspaceExplorerProps = {
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

  search: string
  setSearch: (next: string) => void

  sourceFilesCollapsed: boolean
  setSourceFilesCollapsed: (next: boolean) => void
  tocCollapsed: boolean
  setTocCollapsed: (next: boolean) => void
  backlinksCollapsed: boolean
  setBacklinksCollapsed: (next: boolean) => void

  outline: WorkspaceOutlineItem[]
  backlinks: WorkspaceBacklink[]
  onRevealLine: (line: number) => void
  onOpenBacklink: (args: { path: WorkspacePath; line: number }) => void

  onCreateNewFile: () => void
  onCreateNewFolder: () => void
  onRefresh: () => void

  statusLabel: string

  activeEntryName: string
  activeEntryKind: 'file' | 'folder' | ''
  canClearActiveSelection: boolean
  onClearActiveSelection: () => void
  canRefreshActiveFromSource: boolean
  onRefreshActiveFromSource: () => void
  canDeleteActive: boolean
  onDeleteActive: () => void
}

export const MarkdownWorkspaceExplorer = React.memo(function MarkdownWorkspaceExplorer(props: MarkdownWorkspaceExplorerProps) {
  const {
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
    search,
    setSearch,
    sourceFilesCollapsed,
    setSourceFilesCollapsed,
    tocCollapsed,
    setTocCollapsed,
    backlinksCollapsed,
    setBacklinksCollapsed,
    outline,
    backlinks,
    onRevealLine,
    onOpenBacklink,
    onCreateNewFile,
    onCreateNewFolder,
    onRefresh,
    statusLabel,
    activeEntryName,
    activeEntryKind,
    canClearActiveSelection,
    onClearActiveSelection,
    canRefreshActiveFromSource,
    onRefreshActiveFromSource,
    canDeleteActive,
    onDeleteActive,
  } = props

  const closeNearestDetails = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      const details = e.currentTarget.closest('details')
      if (details) details.removeAttribute('open')
    } catch {
      void 0
    }
  }, [])

  const clearLabel = activeEntryKind === 'folder' ? 'Clear files' : 'Clear'

  return (
    <aside
      className="h-full min-h-0 flex flex-col bg-zinc-50"
      style={{ width: Math.max(sidebarWidthMinPx, Math.min(sidebarWidthMaxPx, sidebarWidthPx)) }}
      aria-label="Markdown Explorer"
    >
      <header className="flex items-center justify-between gap-2 px-2 py-1 border-b border-zinc-200/70" aria-label="Explorer header">
        <section className="min-w-0 flex-1 flex items-center gap-2" aria-label="Explorer title">
          <h2 className={`shrink-0 text-[11px] font-semibold tracking-wide uppercase ${UI_THEME_TOKENS.text.secondary}`}>Explorer</h2>
          {statusLabel ? (
            <output className={`min-w-0 text-[11px] ${UI_THEME_TOKENS.text.secondary} truncate`} aria-label="Workspace status">
              {statusLabel}
            </output>
          ) : null}
        </section>
        <menu className="flex items-center gap-1 list-none m-0 p-0" aria-label="Explorer actions">
          {canClearActiveSelection || canRefreshActiveFromSource || canDeleteActive ? (
            <li className="list-none relative">
              <details className="relative">
                <summary
                  className={`h-6 w-6 shrink-0 inline-flex items-center justify-center rounded cursor-pointer ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                  aria-label={activeEntryName ? `Actions for ${activeEntryName}` : 'Selection actions'}
                  title="Selection actions"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </summary>
                <menu
                  className={`absolute right-0 mt-1 min-w-40 bg-white border border-zinc-200/70 rounded shadow-md text-xs ${UI_THEME_TOKENS.text.primary} list-none m-0 p-1`}
                  aria-label="Selection actions menu"
                >
                  {canRefreshActiveFromSource ? (
                    <li className="list-none">
                      <button
                        type="button"
                        className={`w-full text-left rounded px-2 py-1 ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                        aria-label={activeEntryName ? `Refresh ${activeEntryName}` : 'Refresh from URL'}
                        onClick={e => {
                          closeNearestDetails(e)
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
                        onClick={e => {
                          closeNearestDetails(e)
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
                        onClick={e => {
                          closeNearestDetails(e)
                          onDeleteActive()
                        }}
                      >
                        Delete
                      </button>
                    </li>
                  ) : null}
                </menu>
              </details>
            </li>
          ) : null}
          <li className="list-none">
            <button
              type="button"
              className={`h-6 w-6 shrink-0 inline-flex items-center justify-center rounded ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
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
              className={`h-6 w-6 shrink-0 inline-flex items-center justify-center rounded ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={onCreateNewFolder}
              aria-label="New folder"
              title="New folder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={`h-6 w-6 shrink-0 inline-flex items-center justify-center rounded ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={onRefresh}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
          </li>
        </menu>
      </header>

      <form className="px-2 py-1" role="search" aria-label="Search files">
        <label className="flex items-center gap-2">
          <Search className="w-4 h-4 shrink-0 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search"
            className={`w-full min-w-0 h-[var(--kg-control-height,28px)] px-2 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`}
          />
        </label>
      </form>

      <section className="flex-1 min-h-0 overflow-auto" aria-label="Explorer content">
        <MarkdownExplorerSection
          title="Source Files"
          collapsed={sourceFilesCollapsed}
          setCollapsed={setSourceFilesCollapsed}
          right={<span className={`text-[10px] ${UI_THEME_TOKENS.text.secondary}`}>{entries.filter(e => e.kind === 'file').length}</span>}
        >
          {loading ? (
            <p className={`px-2 py-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>Loading…</p>
          ) : loadError ? (
            <p className={`px-2 py-1 text-xs ${UI_THEME_TOKENS.status.error}`}>Failed: {loadError}</p>
          ) : (
            <MarkdownFileTree
              entries={filteredEntries}
              expandedPaths={expandedPaths}
              toggleExpanded={toggleExpanded}
              activePath={activePath}
              onSelectFile={onSelectFile}
              sourcesByPath={sourcesByPath}
            />
          )}
        </MarkdownExplorerSection>

        <MarkdownExplorerSection title="TOC" collapsed={tocCollapsed} setCollapsed={setTocCollapsed}>
          {outline.length === 0 ? (
            <p className={`px-2 py-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>No headings.</p>
          ) : (
            <nav className="max-h-64 overflow-auto" aria-label="Table of contents">
              <ul className="list-none m-0 p-0">
                {outline.map(item => (
                  <li key={item.id} className="list-none">
                    <button
                      type="button"
                      className={`w-full text-left rounded px-2 py-[2px] text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                      style={{ paddingLeft: 6 + Math.min(20, (item.level - 1) * 10) }}
                      onClick={() => onRevealLine(item.line)}
                      aria-label={`Heading ${item.text}`}
                    >
                      <span className="truncate">{item.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </MarkdownExplorerSection>

        <MarkdownExplorerSection title="Backlinks" collapsed={backlinksCollapsed} setCollapsed={setBacklinksCollapsed}>
          {activePath && backlinks.length === 0 ? (
            <p className={`px-2 py-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>No backlinks.</p>
          ) : (
            <ul className="space-y-1 list-none m-0 p-0" aria-label="Backlinks list">
              {backlinks.slice(0, 50).map((b, idx) => (
                <li key={`${b.fromPath}:${b.line}:${idx}`} className="list-none">
                  <button
                    type="button"
                    className={`w-full flex items-start gap-2 rounded px-2 py-1 text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
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
