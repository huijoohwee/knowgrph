import React from 'react'
import { MarkdownTableOfContents } from '@/features/markdown/ui/MarkdownTableOfContents'
import { ChevronDown } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_COPY } from '@/lib/config'
import type { TokenWithLines } from './markdownPreviewLex'
import { slugify } from '@/features/parsers/markdownJsonLd'
import { useGraphStore } from '@/hooks/useGraphStore'
import IconButton from '@/components/IconButton'
import { getIconSizeClass } from '@/lib/ui'

export type MarkdownPanelLayoutProps = {
  children: React.ReactNode
  tokens?: TokenWithLines[]
  uiPanelTextFontClass: string
  uiPanelKeyValueTextSizeClass?: string
  uiPanelMicroLabelTextSizeClass?: string
  showSidebar: boolean
  setShowSidebar: (show: boolean) => void
  onTocSelect?: (id: string) => void
  onTocDoubleClick?: (id: string) => void
  onTocReorder?: (parentId: string | null, fromIndex: number, toIndex: number) => void
  className?: string
  sidebarWidth?: string
  collapsedIds?: Set<string>
  onToggleCollapse?: (id: string) => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
  allCollapsed?: boolean
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
    className,
    sidebarWidth = 'w-64',
    collapsedIds,
    onToggleCollapse,
    onExpandAll,
    onCollapseAll,
    allCollapsed: propsAllCollapsed,
  } = props

  const [localAllCollapsed, setLocalAllCollapsed] = React.useState(false)
  const hasHeadings = React.useMemo(() => {
    if (!tokens || tokens.length === 0) return false
    for (const t of tokens) {
      if (t.type === 'heading') return true
    }
    return false
  }, [tokens])

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

  const allCollapsed = propsAllCollapsed ?? derivedAllCollapsed ?? localAllCollapsed

  const handleToggleAll = () => {
    if (allCollapsed) {
      if (onExpandAll) onExpandAll()
      else setLocalAllCollapsed(false)
    } else {
      if (onCollapseAll) onCollapseAll()
      else setLocalAllCollapsed(true)
    }
  }

  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  return (
    <section className={`flex flex-1 min-h-0 relative h-full ${className || ''}`}>
      <aside
        className={`flex-shrink-0 flex flex-col h-full border-r ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} transition-all duration-300 ${
          showSidebar ? sidebarWidth : 'w-0 overflow-hidden'
        }`}
      >
          <header className={`flex items-center justify-between p-2 border-b ${UI_THEME_TOKENS.panel.border}`}>
            <h2
              className={[
                uiPanelTextFontClass,
                uiPanelMicroLabelTextSizeClass || uiPanelKeyValueTextSizeClass || 'text-xs',
                'font-semibold',
                UI_THEME_TOKENS.text.tertiary,
                'uppercase truncate',
              ].join(' ')}
            >
              {UI_COPY.markdownPreviewContentsLabel}
            </h2>
            <div className="flex items-center gap-1">
              {hasHeadings && (onExpandAll || onCollapseAll) && (
                <IconButton
                  className="App-toolbar__btn flex items-center justify-center"
                  title={allCollapsed ? 'Expand All' : 'Collapse All'}
                  onClick={handleToggleAll}
                  showTooltip
                >
                  <ChevronDown
                    className={`${iconSizeClass} transition-transform ${allCollapsed ? '' : 'rotate-180'}`}
                    strokeWidth={uiIconStrokeWidth}
                  />
                </IconButton>
              )}
            </div>
          </header>
          {tokens && (
            <nav className="flex-1 overflow-auto" aria-label="Table of Contents">
              <MarkdownTableOfContents
                tokens={tokens}
                onSelect={onTocSelect}
                onDoubleClick={onTocDoubleClick}
                onReorder={onTocReorder}
                uiPanelTextFontClass={uiPanelTextFontClass}
                uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
                className="flex-1"
                allCollapsed={allCollapsed}
                collapsedIds={collapsedIds}
                onToggleCollapse={onToggleCollapse}
              />
            </nav>
          )}
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative">
        {children}
      </main>
    </section>
  )
}
