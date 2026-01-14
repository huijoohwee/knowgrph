import React from 'react'
import { MarkdownTableOfContents } from '@/features/markdown/ui/MarkdownTableOfContents'
import { PanelLeftClose, PanelLeftOpen, ChevronDown } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_COPY } from '@/lib/config'
import type { TokenWithLines } from './markdownPreviewLex'

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

export function MarkdownPanelLayout(props: MarkdownPanelLayoutProps) {
  const {
    children,
    tokens,
    uiPanelTextFontClass,
    uiPanelKeyValueTextSizeClass,
    uiPanelMicroLabelTextSizeClass,
    showSidebar,
    setShowSidebar,
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
  const allCollapsed = propsAllCollapsed ?? localAllCollapsed

  const handleToggleAll = () => {
    if (allCollapsed) {
      if (onExpandAll) onExpandAll()
      else setLocalAllCollapsed(false)
    } else {
      if (onCollapseAll) onCollapseAll()
      else setLocalAllCollapsed(true)
    }
  }

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
              <button
                onClick={handleToggleAll}
                className={`p-1 ${UI_THEME_TOKENS.button.hoverBg} rounded transition-colors`}
                title={allCollapsed ? 'Expand All' : 'Collapse All'}
              >
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${allCollapsed ? '-rotate-90' : ''} ${UI_THEME_TOKENS.text.secondary}`}
                />
              </button>
              <button
                onClick={() => setShowSidebar(false)}
                className={`p-1 ${UI_THEME_TOKENS.button.hoverBg} rounded transition-colors`}
                title="Close Sidebar"
              >
                <PanelLeftClose size={14} className={UI_THEME_TOKENS.text.secondary} />
              </button>
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
        {!showSidebar && (
          <div className="absolute top-2 left-2 z-10">
            <button
              onClick={() => setShowSidebar(true)}
              className={`p-1.5 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.panel.border} border rounded-md shadow-sm ${UI_THEME_TOKENS.button.hoverBg} transition-colors`}
              title="Open Sidebar"
            >
              <PanelLeftOpen size={16} className={UI_THEME_TOKENS.text.secondary} />
            </button>
          </div>
        )}
        {children}
      </main>
    </section>
  )
}
