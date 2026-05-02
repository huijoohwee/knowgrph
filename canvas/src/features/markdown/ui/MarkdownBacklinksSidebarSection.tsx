import React from 'react'
import { UI_COPY } from '@/lib/config'
import { MarkdownSidebarSection } from './MarkdownSidebarSection'
import { MarkdownBacklinksPanel } from './MarkdownBacklinksPanel'

export function MarkdownBacklinksSidebarSection(props: {
  uiPanelTextFontClass: string
  uiPanelMicroLabelTextSizeClass?: string
  uiPanelKeyValueTextSizeClass?: string
  activeDocumentKey: string | null
  sourceFiles?: Array<{ id: string; name: string; text?: string | null; active?: boolean }>
  onSourceFileSelect?: (id: string) => void
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const {
    uiPanelTextFontClass,
    uiPanelMicroLabelTextSizeClass,
    uiPanelKeyValueTextSizeClass,
    activeDocumentKey,
    sourceFiles,
    onSourceFileSelect,
    collapsed,
    onToggleCollapsed,
  } = props

  return (
    <MarkdownSidebarSection
      ariaLabel="Backlinks"
      title={UI_COPY.markdownExplorerBacklinksLabel || 'Backlinks'}
      uiPanelTextFontClass={uiPanelTextFontClass}
      uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
      uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
    >
      <MarkdownBacklinksPanel
        uiPanelTextFontClass={uiPanelTextFontClass}
        activeDocumentKey={activeDocumentKey}
        sourceFiles={sourceFiles}
        onSourceFileSelect={onSourceFileSelect}
      />
    </MarkdownSidebarSection>
  )
}
