import React from 'react'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { MarkdownWorkspaceToolbar } from '../../MarkdownWorkspaceToolbar'
import { resolveMarkdownWorkspacePaneVisibility, type MarkdownWorkspacePaneAvailability, type MarkdownWorkspacePaneVisibility } from '../types'

export function MarkdownWorkspaceLayout(props: {
  toolbarProps: React.ComponentProps<typeof MarkdownWorkspaceToolbar>
  layoutMode: MarkdownWorkspaceLayoutMode
  renderMarkdownEditor: () => React.ReactNode
  renderJsonEditor: () => React.ReactNode
  binaryPane?: React.ReactNode
  binaryPaneVisible?: boolean
  splitPaneVisibility: MarkdownWorkspacePaneVisibility
  paneAvailability?: MarkdownWorkspacePaneAvailability
  forceMarkdownEditorInEditorMode?: boolean
  viewer: React.ReactNode
  htmlViewer?: React.ReactNode
  presentation: React.ReactNode
  slidesGallery: React.ReactNode
}) {
  const paneVisibility = resolveMarkdownWorkspacePaneVisibility({
    layoutMode: props.layoutMode,
    splitPaneVisibility: props.splitPaneVisibility,
    paneAvailability: props.paneAvailability,
    forceMarkdownEditorInEditorMode: props.forceMarkdownEditorInEditorMode,
  })
  const binaryPaneVisible = props.binaryPaneVisible === true
  const paneClassName = 'kg-markdown-workspace-pane flex-1 min-w-0 min-h-0 flex flex-col'
  const paneDividerClassName = 'kg-markdown-workspace-pane-divider w-px self-stretch bg-[color:var(--kg-border)] border-0'
  const splitPanes = [
    binaryPaneVisible ? (
      <section key="bin" className={paneClassName} aria-label="Binary Model">
        {props.binaryPane}
      </section>
    ) : null,
    paneVisibility.json ? (
      <section key="json" className={paneClassName} aria-label="JSON Editor">
        {props.renderJsonEditor()}
      </section>
    ) : null,
    paneVisibility.markdown ? (
      <section key="markdown" className={paneClassName} aria-label="Markdown Editor">
        {props.renderMarkdownEditor()}
      </section>
    ) : null,
    paneVisibility.viewer ? (
      <section key="viewer" className={paneClassName} aria-label="Viewer">
        {props.viewer}
      </section>
    ) : null,
    paneVisibility.html && props.htmlViewer ? (
      <section key="html" className={paneClassName} aria-label="HTML Viewer">
        {props.htmlViewer}
      </section>
    ) : null,
  ].filter(Boolean) as React.ReactElement[]
  const effectiveSplitPanes = splitPanes.length > 0
    ? splitPanes
    : [
        <section key="viewer-fallback" className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Viewer">
          {props.viewer}
        </section>,
      ]

  return (
    <main className="kg-markdown-workspace-main flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Markdown Editor and Viewer">
      <MarkdownWorkspaceToolbar {...props.toolbarProps} />

      {props.layoutMode === 'editor' ? (
        <section className="kg-markdown-workspace-editor-panes flex-1 min-w-0 min-h-0 flex" aria-label="Monaco editors">
          {effectiveSplitPanes.map((pane, index) => (
            <React.Fragment key={pane.key || `pane-${index}`}>
              {index > 0 ? <hr className={paneDividerClassName} aria-hidden="true" /> : null}
              {pane}
            </React.Fragment>
          ))}
        </section>
      ) : props.layoutMode === 'viewer' ? (
        props.viewer
      ) : props.layoutMode === 'presentation' ? (
        <section className="flex-1 min-h-0 flex kg-workspace-surface-shell" aria-label="Presentation view">
          {props.presentation}
        </section>
      ) : props.layoutMode === 'slides-gallery' ? (
        props.slidesGallery
      ) : (
        <section className="kg-markdown-workspace-split-panes flex-1 min-w-0 min-h-0 flex kg-workspace-surface-shell" aria-label="Split view">
          {effectiveSplitPanes.map((pane, index) => (
            <React.Fragment key={pane.key || `pane-${index}`}>
              {index > 0 ? <hr className={`${paneDividerClassName} kg-workspace-split-divider`} aria-hidden="true" /> : null}
              {pane}
            </React.Fragment>
          ))}
        </section>
      )}
    </main>
  )
}
