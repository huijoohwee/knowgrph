import React from 'react'
import { MarkdownTableOfContents } from '@/features/markdown/ui/MarkdownTableOfContents'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_COPY } from '@/lib/config'
import type { TokenWithLines } from './markdownPreviewLex'
import { slugify } from 'grph-shared/markdown/slugify'
import { LS_KEYS } from '@/lib/config'
import { lsInt, lsSetInt } from '@/lib/persistence'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import {
  MarkdownSourceFilesPanel,
  type MarkdownSourceFilesPanelIntegration,
  type MarkdownSourceFileListItem,
} from './MarkdownSourceFilesPanel'
import { MarkdownSidebarFrame } from './MarkdownSidebarFrame'
import { buildMarkdownSidebarTitleClassName } from './markdownSidebarText'
import { MarkdownBacklinksPanel } from './MarkdownBacklinksPanel'
import IconButton from '@/components/IconButton'
import { FilePlus, FolderOpen, FolderPlus, RefreshCw } from 'lucide-react'
import { MarkdownSidebarSection } from './MarkdownSidebarSection'

export type MarkdownPanelLayoutProps = {
  children: React.ReactNode
  tokens?: TokenWithLines[]
  uiPanelTextFontClass: string
  uiPanelKeyValueTextSizeClass?: string
  uiPanelMicroLabelTextSizeClass?: string
  showSidebar: boolean
  onTocSelect?: (id: string) => void
  onTocDoubleClick?: (id: string) => void
  onTocReorder?: (parentId: string | null, fromIndex: number, toIndex: number) => void
  sidebarContent?: React.ReactNode
  sidebarAppendContent?: React.ReactNode
  className?: string
  sidebarPosition?: 'left' | 'right'
  collapsedIds?: Set<string>
  onToggleCollapse?: (id: string) => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
  allCollapsed?: boolean
  hideSidebarHeader?: boolean
  sourceFiles?: Array<{ id: string; name: string; text?: string | null; active?: boolean }>
  onSourceFileSelect?: (id: string) => void
  sourceFilesPanelIntegration?: MarkdownSourceFilesPanelIntegration
}

export type MarkdownViewerWidthMode = 'standard' | 'wide'

export function MarkdownPanelLayout(props: MarkdownPanelLayoutProps) {
  const {
    children,
    tokens,
    uiPanelTextFontClass,
    uiPanelKeyValueTextSizeClass,
    uiPanelMicroLabelTextSizeClass,
    showSidebar,
    onTocSelect,
    onTocDoubleClick,
    onTocReorder,
    sidebarContent,
    sidebarAppendContent,
    className,
    sidebarPosition = 'left',
    collapsedIds,
    onToggleCollapse,
    onExpandAll,
    onCollapseAll,
    allCollapsed: propsAllCollapsed,
    hideSidebarHeader,
    sourceFiles,
    onSourceFileSelect,
    sourceFilesPanelIntegration,
  } = props

  const derivedAllCollapsed = React.useMemo(() => {
    if (!onExpandAll && !onCollapseAll) return undefined
    if (!tokens || !collapsedIds) return undefined

    const allHeadingIds = new Set<string>()
    tokens.forEach(t => {
      if (t.type !== 'heading') return
      const rawId = typeof t.id === 'string' ? t.id.trim() : ''
      const id = rawId || slugify(String(t.text || ''))
      if (id) allHeadingIds.add(id)
    })

    if (allHeadingIds.size === 0) return false
    for (const id of allHeadingIds) {
      if (!collapsedIds.has(id)) return false
    }
    return true
  }, [collapsedIds, onCollapseAll, onExpandAll, tokens])

  const allCollapsed = propsAllCollapsed ?? derivedAllCollapsed ?? false

  const sidebarBorderClass = sidebarPosition === 'right' ? 'border-l' : 'border-r'
  const sourceFilesList: MarkdownSourceFileListItem[] | undefined = React.useMemo(() => {
    const list = Array.isArray(sourceFiles) ? sourceFiles : []
    return list.map(f => ({ id: String(f.id || ''), name: String(f.name || ''), active: !!f.active }))
  }, [sourceFiles])

  const activeSourceFileKey = React.useMemo(() => {
    const list = Array.isArray(sourceFiles) ? sourceFiles : []
    const active = list.find(f => f.active)
    if (active?.name) return String(active.name)
    return list.length === 1 ? String(list[0]?.name || '') : ''
  }, [sourceFiles])

  const [sidebarWidthPx, setSidebarWidthPx] = React.useState(() => {
    const fallback = 256
    try {
      const n = lsInt(LS_KEYS.markdownSidebarWidthPx, fallback)
      if (!Number.isFinite(n)) return fallback
      return Math.max(160, Math.min(560, Math.floor(n)))
    } catch {
      return fallback
    }
  })

  const handleSidebarResizePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (!showSidebar) return
      if (e.button !== 0) return

      const startWidth = Math.max(160, Math.min(560, Math.floor(sidebarWidthPx)))
      const startX = e.clientX
      let raf = 0
      let pendingWidth = startWidth
      let lastWidth = startWidth
      const rafFn = (cb: FrameRequestCallback) => {
        if (typeof window !== 'undefined' && window.requestAnimationFrame) {
          return window.requestAnimationFrame(cb)
        }
        return setTimeout(() => cb(Date.now()), 0) as unknown as number
      }
      const cancelRafFn = (id: number) => {
        if (typeof window !== 'undefined' && window.cancelAnimationFrame) {
          window.cancelAnimationFrame(id)
          return
        }
        clearTimeout(id)
      }
      startPointerDrag({
        ev: e.nativeEvent,
        cursor: 'col-resize',
        shouldStart: ev => {
          if (ev.button !== undefined && ev.button !== 0) return false
          return true
        },
        onMove: mv => {
          const delta = mv.clientX - startX
          const signedDelta = sidebarPosition === 'right' ? -delta : delta
          const next = Math.max(160, Math.min(560, Math.floor(startWidth + signedDelta)))
          pendingWidth = next
          if (raf) return
          raf = rafFn(() => {
            raf = 0
            lastWidth = pendingWidth
            setSidebarWidthPx(prev => (prev === pendingWidth ? prev : pendingWidth))
          })
        },
        onEnd: () => {
          if (raf) {
            cancelRafFn(raf)
            raf = 0
          }
          lastWidth = pendingWidth
          setSidebarWidthPx(prev => (prev === pendingWidth ? prev : pendingWidth))
          try {
            lsSetInt(LS_KEYS.markdownSidebarWidthPx, lastWidth, { min: 160, max: 560 })
          } catch {
            void 0
          }
        },
        onCancel: () => {
          if (raf) {
            cancelRafFn(raf)
            raf = 0
          }
          lastWidth = pendingWidth
          setSidebarWidthPx(prev => (prev === pendingWidth ? prev : pendingWidth))
        },
      })
    },
    [showSidebar, sidebarPosition, sidebarWidthPx],
  )
  const sidebarFrameTitleClassName = buildMarkdownSidebarTitleClassName({
    uiPanelTextFontClass,
    uiPanelMicroLabelTextSizeClass,
    uiPanelKeyValueTextSizeClass,
    textColorClassName: UI_THEME_TOKENS.text.tertiary,
  })

  const [sourceFilesSectionCollapsed, setSourceFilesSectionCollapsed] = usePersistedBoolean(
    LS_KEYS.markdownExplorerSourceFilesCollapsed,
    false,
  )
  const [outlineSectionCollapsed, setOutlineSectionCollapsed] = usePersistedBoolean(
    LS_KEYS.markdownExplorerOutlineCollapsed,
    false,
  )
  const [backlinksSectionCollapsed, setBacklinksSectionCollapsed] = usePersistedBoolean(
    LS_KEYS.markdownExplorerBacklinksCollapsed,
    false,
  )

  const renderAside = (
    <MarkdownSidebarFrame
      ariaLabel="Markdown sidebar"
      className={`relative z-10 flex-shrink-0 flex flex-col h-full ${sidebarBorderClass} ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} transition-all duration-300 ${
        showSidebar ? '' : 'w-0 overflow-hidden'
      }`}
      style={showSidebar ? { width: `${Math.max(160, Math.min(560, sidebarWidthPx))}px` } : undefined}
      hideHeader={hideSidebarHeader}
      title={UI_COPY.markdownExplorerLabel || 'Explorer'}
      titleClassName={sidebarFrameTitleClassName}
      headerRight={null}
    >
      {sidebarContent ? (
        sidebarContent
      ) : (
        <section className="flex-1 flex flex-col min-h-0 overflow-hidden" aria-label="Markdown panel sidebar">
          <nav className="flex-1 overflow-auto" aria-label="Explorer">
            {sourceFilesPanelIntegration ? (
              <MarkdownSidebarSection
                ariaLabel={UI_COPY.markdownPreviewSourceFilesLabel}
                title={sourceFilesPanelIntegration.folderName || UI_COPY.markdownPreviewSourceFilesLabel}
                uiPanelTextFontClass={uiPanelTextFontClass}
                uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
                uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
                collapsed={sourceFilesSectionCollapsed}
                onToggleCollapsed={() => setSourceFilesSectionCollapsed(!sourceFilesSectionCollapsed)}
                menuAriaLabel="Source files actions"
                menuItems={
                  <>
                    <li className="list-none">
                      <IconButton
                        title="Open folder"
                        tooltipContent="Open folder"
                        showTooltip
                        onClick={() => void sourceFilesPanelIntegration.onOpenFolder()}
                      >
                        <FolderOpen className={sourceFilesPanelIntegration.iconClassName} strokeWidth={1.5} aria-hidden="true" />
                      </IconButton>
                    </li>
                    {sourceFilesPanelIntegration.onRefreshFiles ? (
                      <li className="list-none">
                        <IconButton
                          title="Refresh"
                          tooltipContent="Refresh"
                          showTooltip
                          onClick={() => void sourceFilesPanelIntegration.onRefreshFiles?.()}
                        >
                          <RefreshCw className={sourceFilesPanelIntegration.iconClassName} strokeWidth={1.5} aria-hidden="true" />
                        </IconButton>
                      </li>
                    ) : null}
                    {sourceFilesPanelIntegration.onCreateFolder ? (
                      <li className="list-none">
                        <IconButton
                          title="New folder"
                          tooltipContent="New folder"
                          showTooltip
                          disabled={!sourceFilesPanelIntegration.canWrite}
                          onClick={() => void sourceFilesPanelIntegration.onCreateFolder?.(null)}
                        >
                          <FolderPlus className={sourceFilesPanelIntegration.iconClassName} strokeWidth={1.5} aria-hidden="true" />
                        </IconButton>
                      </li>
                    ) : null}
                    {sourceFilesPanelIntegration.onCreateFile ? (
                      <li className="list-none">
                        <IconButton
                          title="New file"
                          tooltipContent="New file"
                          showTooltip
                          disabled={!sourceFilesPanelIntegration.canWrite}
                          onClick={() => sourceFilesPanelIntegration.onCreateFile?.(null)}
                        >
                          <FilePlus className={sourceFilesPanelIntegration.iconClassName} strokeWidth={1.5} aria-hidden="true" />
                        </IconButton>
                      </li>
                    ) : null}
                  </>
                }
              >
                <section
                  className={[
                    'px-2 py-1 border-t',
                    UI_THEME_TOKENS.panel.divider,
                    UI_THEME_TOKENS.text.tertiary,
                    uiPanelTextFontClass,
                    'text-[10px] flex items-center justify-between gap-2',
                  ].join(' ')}
                  aria-label="Source files status"
                >
                  <span className="truncate overflow-hidden whitespace-nowrap">
                    {sourceFilesPanelIntegration.folderName
                      ? sourceFilesPanelIntegration.canWrite
                        ? 'Writable'
                        : 'Read-only'
                      : 'No folder open'}
                  </span>
                  {sourceFilesPanelIntegration.accessMode ? (
                    <span className="truncate overflow-hidden whitespace-nowrap">{sourceFilesPanelIntegration.accessMode}</span>
                  ) : null}
                </section>
                <MarkdownSourceFilesPanel
                  uiPanelTextFontClass={uiPanelTextFontClass}
                  sourceFiles={sourceFilesList}
                  onSourceFileSelect={onSourceFileSelect}
                  integration={sourceFilesPanelIntegration}
                />
              </MarkdownSidebarSection>
            ) : null}

            {tokens ? (
              <MarkdownSidebarSection
                ariaLabel="Outline"
                title={UI_COPY.markdownExplorerOutlineLabel || 'Outline'}
                uiPanelTextFontClass={uiPanelTextFontClass}
                uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
                uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
                collapsed={outlineSectionCollapsed}
                onToggleCollapsed={() => setOutlineSectionCollapsed(!outlineSectionCollapsed)}
              >
                <MarkdownTableOfContents
                  tokens={tokens}
                  onSelect={onTocSelect}
                  onDoubleClick={onTocDoubleClick}
                  onReorder={onTocReorder}
                  uiPanelTextFontClass={uiPanelTextFontClass}
                  uiPanelKeyValueTextSizeClass={'text-sm'}
                  className="flex-1"
                  indentBasePx={6}
                  allCollapsed={allCollapsed}
                  collapsedIds={collapsedIds}
                  onToggleCollapse={onToggleCollapse}
                />
              </MarkdownSidebarSection>
            ) : null}

            {Array.isArray(sourceFiles) && sourceFiles.length > 0 ? (
              <MarkdownSidebarSection
                ariaLabel="Backlinks"
                title={UI_COPY.markdownExplorerBacklinksLabel || 'Backlinks'}
                uiPanelTextFontClass={uiPanelTextFontClass}
                uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
                uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
                collapsed={backlinksSectionCollapsed}
                onToggleCollapsed={() => setBacklinksSectionCollapsed(!backlinksSectionCollapsed)}
              >
                <MarkdownBacklinksPanel
                  uiPanelTextFontClass={uiPanelTextFontClass}
                  activeDocumentKey={activeSourceFileKey || null}
                  sourceFiles={sourceFiles}
                  onSourceFileSelect={onSourceFileSelect}
                />
              </MarkdownSidebarSection>
            ) : null}

            {sidebarAppendContent}
          </nav>
        </section>
      )}
    </MarkdownSidebarFrame>
  )

  return (
    <section className={`flex flex-1 min-h-0 relative h-full ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary} ${className || ''}`}>
      {sidebarPosition === 'left' ? renderAside : null}
      {sidebarPosition === 'left' && showSidebar ? (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          tabIndex={0}
          onPointerDown={handleSidebarResizePointerDown}
          className={`group relative z-20 flex-shrink-0 self-stretch cursor-col-resize bg-transparent select-none pointer-events-auto touch-none flex items-center border-r ${UI_THEME_TOKENS.panel.border}`}
          style={{ width: '16px' }}
        >
          <span className={`pointer-events-none mx-auto w-px h-20 rounded-full ${UI_THEME_TOKENS.panel.divider} transition-colors ${UI_THEME_TOKENS.button.hoverBg}`} />
        </span>
      ) : null}
      <main className="relative z-0 flex-1 flex flex-col min-w-0 overflow-hidden">{children}</main>
      {sidebarPosition === 'right' && showSidebar ? (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          tabIndex={0}
          onPointerDown={handleSidebarResizePointerDown}
          className={`group relative z-20 flex-shrink-0 self-stretch cursor-col-resize bg-transparent select-none pointer-events-auto touch-none flex items-center border-l ${UI_THEME_TOKENS.panel.border}`}
          style={{ width: '16px' }}
        >
          <span className={`pointer-events-none mx-auto w-px h-20 rounded-full ${UI_THEME_TOKENS.panel.divider} transition-colors ${UI_THEME_TOKENS.button.hoverBg}`} />
        </span>
      ) : null}
      {sidebarPosition === 'right' ? renderAside : null}
    </section>
  )
}
