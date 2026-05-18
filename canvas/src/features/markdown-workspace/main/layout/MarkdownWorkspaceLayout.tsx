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
  viewer: React.ReactNode
  presentation: React.ReactNode
  slidesGallery: React.ReactNode
}) {
  const paneVisibility = resolveMarkdownWorkspacePaneVisibility({
    layoutMode: props.layoutMode,
    splitPaneVisibility: props.splitPaneVisibility,
    paneAvailability: props.paneAvailability,
  })
  const binaryPaneVisible = props.binaryPaneVisible === true
  const splitPanes = [
    binaryPaneVisible ? (
      <section key="bin" className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Binary Model">
        {props.binaryPane}
      </section>
    ) : null,
    paneVisibility.json ? (
      <section key="json" className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="JSON Editor">
        {props.renderJsonEditor()}
      </section>
    ) : null,
    paneVisibility.markdown ? (
      <section key="markdown" className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Markdown Editor">
        {props.renderMarkdownEditor()}
      </section>
    ) : null,
    paneVisibility.viewer ? (
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
          {binaryPaneVisible ? (
            <section className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Binary Model">
              {props.binaryPane}
            </section>
          ) : null}
          {binaryPaneVisible && paneVisibility.json ? <hr className="w-px self-stretch bg-[color:var(--kg-border)] border-0" aria-hidden="true" /> : null}
          {paneVisibility.json ? (
            <section className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="JSON Editor">
              {props.renderJsonEditor()}
            </section>
          ) : null}
          {paneVisibility.json && paneVisibility.markdown ? <hr className="w-px self-stretch bg-[color:var(--kg-border)] border-0" aria-hidden="true" /> : null}
          {paneVisibility.markdown ? (
            <section className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Markdown Editor">
              {props.renderMarkdownEditor()}
            </section>
          ) : null}
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
        <section className="flex-1 min-h-0 flex kg-workspace-surface-shell" aria-label="Split view">
          {effectiveSplitPanes.map((pane, index) => (
            <React.Fragment key={pane.key || `pane-${index}`}>
              {index > 0 ? <hr className="w-px self-stretch bg-[color:var(--kg-border)] border-0 kg-workspace-split-divider" aria-hidden="true" /> : null}
              {pane}
            </React.Fragment>
          ))}
        </section>
      )}
    </main>
  )
}
