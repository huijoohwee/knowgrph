import React from 'react'
import { UI_COPY } from '@/lib/config'
import type { TokenWithLines } from './markdownPreviewLex'
import { MarkdownSidebarSection } from './MarkdownSidebarSection'
import { MarkdownTableOfContents } from './MarkdownTableOfContents'

export function MarkdownOutlineSidebarSection(props: {
  tokens: TokenWithLines[]
  uiPanelTextFontClass: string
  uiPanelMicroLabelTextSizeClass?: string
  uiPanelKeyValueTextSizeClass?: string
  onTocSelect?: (id: string) => void
  onTocDoubleClick?: (id: string) => void
  onTocReorder?: (parentId: string | null, fromIndex: number, toIndex: number) => void
  allCollapsed?: boolean
  collapsedIds?: Set<string>
  onToggleCollapse?: (id: string) => void
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const {
    tokens,
    uiPanelTextFontClass,
    uiPanelMicroLabelTextSizeClass,
    uiPanelKeyValueTextSizeClass,
    onTocSelect,
    onTocDoubleClick,
    onTocReorder,
    allCollapsed,
    collapsedIds,
    onToggleCollapse,
    collapsed,
    onToggleCollapsed,
  } = props

  return (
    <MarkdownSidebarSection
      ariaLabel="Outline"
      title={UI_COPY.markdownExplorerOutlineLabel || 'Outline'}
      uiPanelTextFontClass={uiPanelTextFontClass}
      uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
      uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
    >
      <MarkdownTableOfContents
        tokens={tokens}
        onSelect={onTocSelect}
        onDoubleClick={onTocDoubleClick}
        onReorder={onTocReorder}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelKeyValueTextSizeClass="text-sm"
        className="flex-1"
        indentBasePx={6}
        allCollapsed={allCollapsed}
        collapsedIds={collapsedIds}
        onToggleCollapse={onToggleCollapse}
      />
    </MarkdownSidebarSection>
  )
}
