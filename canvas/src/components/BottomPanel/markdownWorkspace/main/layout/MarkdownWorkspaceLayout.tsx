import React from 'react'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { MarkdownWorkspaceToolbar } from '../../../MarkdownWorkspaceToolbar'
import type { MarkdownWorkspacePaneVisibility } from '../types'

export function MarkdownWorkspaceLayout(props: {
  toolbarProps: React.ComponentProps<typeof MarkdownWorkspaceToolbar>
  layoutMode: MarkdownWorkspaceLayoutMode
  renderMarkdownEditor: () => React.ReactNode
  renderJsonEditor: () => React.ReactNode
  splitPaneVisibility: MarkdownWorkspacePaneVisibility
  viewer: React.ReactNode
  presentation: React.ReactNode
  slidesGallery: React.ReactNode
}) {
  const editorMarkdownPaneVisible = props.layoutMode === 'editor' ? true : props.splitPaneVisibility.markdown
  const splitPanes = [
    props.splitPaneVisibility.json ? (
      <section key="json" className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="JSON Editor">
        {props.renderJsonEditor()}
      </section>
    ) : null,
    props.splitPaneVisibility.markdown ? (
      <section key="markdown" className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Markdown Editor">
        {props.renderMarkdownEditor()}
      </section>
    ) : null,
    props.splitPaneVisibility.viewer ? (
      <section key="viewer" className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Viewer">
        {props.viewer}
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
    <main className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Markdown Editor and Viewer">
      <MarkdownWorkspaceToolbar {...props.toolbarProps} />

      {props.layoutMode === 'editor' ? (
        <section className="flex-1 min-h-0 flex" aria-label="Monaco editors">
          {props.splitPaneVisibility.json ? (
            <section className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="JSON Editor">
              {props.renderJsonEditor()}
            </section>
          ) : null}
          {props.splitPaneVisibility.json && editorMarkdownPaneVisible ? <hr className="w-px self-stretch bg-[color:var(--kg-border)] border-0" aria-hidden="true" /> : null}
          {editorMarkdownPaneVisible ? (
            <section className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Markdown Editor">
              {props.renderMarkdownEditor()}
            </section>
          ) : null}
        </section>
      ) : props.layoutMode === 'viewer' ? (
        props.viewer
      ) : props.layoutMode === 'presentation' ? (
        props.presentation
      ) : props.layoutMode === 'slides-gallery' ? (
        props.slidesGallery
      ) : (
        <section className="flex-1 min-h-0 flex" aria-label="Split view">
          {effectiveSplitPanes.map((pane, index) => (
            <React.Fragment key={pane.key || `pane-${index}`}>
              {index > 0 ? <hr className="w-px self-stretch bg-[color:var(--kg-border)] border-0" aria-hidden="true" /> : null}
              {pane}
            </React.Fragment>
          ))}
        </section>
      )}
    </main>
  )
}
