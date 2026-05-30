import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { MarkdownExplorerSection } from './MarkdownExplorerSection'
import { MarkdownFileTree } from './MarkdownFileTree'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { loadWorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import type { WorkspaceBacklink } from '@/features/workspace-fs/types'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import { uiToolbarRowScrollJustifyBetweenClassName } from '@/features/toolbar/ui/toolbarStyles'
import { MarkdownWorkspaceBacklinksList } from './MarkdownWorkspaceBacklinksList'
import { MarkdownWorkspaceTocList } from './MarkdownWorkspaceTocList'
import { MarkdownWorkspaceExplorerHeaderActions } from './MarkdownWorkspaceExplorerHeaderActions'
import { MarkdownWorkspaceSourceFilesList } from './MarkdownWorkspaceSourceFilesList'
import { MarkdownWorkspaceTocTree } from './MarkdownWorkspaceTocTree'
import { useMarkdownTocModelState } from '@/features/markdown/ui/useMarkdownTocModelState'

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

  onCreateNewFile: (parentPath?: WorkspacePath) => void
  onRefresh: () => void

  canRefreshActiveFromSource: boolean
  onRefreshActiveFromSource: () => void
  onRevealInFinder: (path: WorkspacePath) => void
  onClearFile: (path: WorkspacePath) => void
  onRenameEntry: (path: WorkspacePath, nextName: string) => void
  onDeleteEntry: (path: WorkspacePath) => void

  renderSourceFileRight?: (args: { entry: WorkspaceEntry; isActive: boolean }) => React.ReactNode
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
    onRefresh,
    canRefreshActiveFromSource,
    onRefreshActiveFromSource,
    onRevealInFinder,
    onClearFile,
    onRenameEntry,
    onDeleteEntry,
    renderSourceFileRight,
  } = props
  const panelTypography = usePanelTypography()

  const canRefreshActivePathFromSource = React.useCallback(() => {
    const path = activePath
    if (!path) return false
    const source = sourcesByPath?.[path] || loadWorkspaceSourceIndex()[path]
    return !!(source && source.kind === 'url' && String(source.url || '').trim())
  }, [activePath, sourcesByPath])

  const handleRefresh = React.useCallback(() => {
    if (canRefreshActiveFromSource || canRefreshActivePathFromSource()) {
      onRefreshActiveFromSource()
      return
    }
    onRefresh()
  }, [canRefreshActiveFromSource, canRefreshActivePathFromSource, onRefresh, onRefreshActiveFromSource])
  const sourceFileCount = React.useMemo(() => entries.reduce((count, e) => (e.kind === 'file' ? count + 1 : count), 0), [entries])
  const {
    activeItemId: activeTocId,
    baseDepth: tocBaseDepth,
    collapsedIds: tocCollapsedIds,
    headingNumberById: tocHnById,
    items: tocItems,
    onNavRefChange,
    onReorderByIds: handleTocReorderByIds,
    onSelectItem: handleTocSelect,
    toggleExpanded: toggleTocExpanded,
  } = useMarkdownTocModelState({
    resetKey: activePath,
    tocCollapsed,
    tokens: tocTokens,
    onRevealLine,
    onReorder: onTocReorder,
  })

  return (
    <aside
      className={`kg-markdown-workspace-explorer h-full min-h-0 flex flex-col ${UI_THEME_TOKENS.panel.bg}`}
      style={{ width: Math.max(sidebarWidthMinPx, Math.min(sidebarWidthMaxPx, sidebarWidthPx)) }}
      aria-label="Markdown Explorer"
    >
      <header
        className={`kg-toolbar ${uiToolbarRowScrollJustifyBetweenClassName} min-h-[calc(var(--kg-control-height,28px)+0.5rem+2px)] gap-2 px-2 py-0 border-b ${UI_THEME_TOKENS.panel.border}`}
        aria-label="Explorer header"
      >
        <section className="min-w-0 max-w-full flex-1 flex items-center gap-2 overflow-hidden" aria-label="Explorer title">
          <h2 className={`${panelTypography.microLabelClass} font-semibold tracking-wide uppercase ${UI_THEME_TOKENS.text.secondary} ${UI_TEXT_TRUNCATE}`}>Explorer</h2>
        </section>
        <MarkdownWorkspaceExplorerHeaderActions
          panelTextClass={panelTypography.panelTextClass}
          onRefresh={handleRefresh}
          search={search}
          setSearch={setSearch}
        />
      </header>

      <section className="flex-1 min-h-0 overflow-auto" aria-label="Explorer content">
        <MarkdownExplorerSection
          title="Source Files"
          collapsed={sourceFilesCollapsed}
          setCollapsed={setSourceFilesCollapsed}
          right={<span className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>{sourceFileCount}</span>}
        >
          <MarkdownWorkspaceSourceFilesList
            loading={loading}
            loadError={loadError}
            textSizeClass={panelTypography.textSizeClass}
            entries={filteredEntries}
            expandedPaths={expandedPaths}
            activePath={activePath}
            toggleExpanded={toggleExpanded}
            onSelectFile={onSelectFile}
            onSelectFolder={onSelectFolder}
            sourcesByPath={sourcesByPath}
            onCreateNewFile={onCreateNewFile}
            onRevealInFinder={onRevealInFinder}
            onClearFile={onClearFile}
            onRenameEntry={onRenameEntry}
            onDeleteEntry={onDeleteEntry}
            renderFileRight={renderSourceFileRight}
          />
        </MarkdownExplorerSection>

        <MarkdownExplorerSection title="TOC" collapsed={tocCollapsed} setCollapsed={setTocCollapsed}>
          <MarkdownWorkspaceTocList
            items={tocItems}
            panelTextClass={panelTypography.panelTextClass}
            onNavRefChange={onNavRefChange}
          >
            <MarkdownWorkspaceTocTree
              items={tocItems}
              collapsedIds={tocCollapsedIds}
              activeItemId={activeTocId}
              headingNumbersById={tocHnById}
              baseDepth={tocBaseDepth}
              onToggleExpanded={toggleTocExpanded}
              onSelect={handleTocSelect}
              onReorder={handleTocReorderByIds}
              uiPanelTextFontClass={uiPanelTextFontClass}
              uiPanelKeyValueTextSizeClass={panelTypography.textSizeClass}
            />
          </MarkdownWorkspaceTocList>
        </MarkdownExplorerSection>

        <MarkdownExplorerSection title="Backlinks" collapsed={backlinksCollapsed} setCollapsed={setBacklinksCollapsed}>
          <MarkdownWorkspaceBacklinksList
            activePath={activePath}
            backlinks={backlinks}
            textSizeClass={panelTypography.textSizeClass}
            panelTextClass={panelTypography.panelTextClass}
            onOpenBacklink={onOpenBacklink}
          />
        </MarkdownExplorerSection>
      </section>

    </aside>
  )
})
