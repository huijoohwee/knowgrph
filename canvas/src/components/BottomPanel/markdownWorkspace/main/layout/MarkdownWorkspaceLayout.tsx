import React from 'react'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { MarkdownWorkspaceToolbar } from '../../../MarkdownWorkspaceToolbar'

export function MarkdownWorkspaceLayout(props: {
  toolbarProps: React.ComponentProps<typeof MarkdownWorkspaceToolbar>
  layoutMode: MarkdownWorkspaceLayoutMode
  renderEditor: () => React.ReactNode
  viewer: React.ReactNode
  presentation: React.ReactNode
  slidesGallery: React.ReactNode
}) {
  return (
    <main className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Markdown Editor and Viewer">
      <MarkdownWorkspaceToolbar {...props.toolbarProps} />

      {props.layoutMode === 'editor' ? (
        props.renderEditor()
      ) : props.layoutMode === 'viewer' ? (
        props.viewer
      ) : props.layoutMode === 'presentation' ? (
        props.presentation
      ) : props.layoutMode === 'slides-gallery' ? (
        props.slidesGallery
      ) : (
        <section className="flex-1 min-h-0 flex" aria-label="Split view">
          <section className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Editor">
            {props.renderEditor()}
          </section>
          <hr className="w-px self-stretch bg-[color:var(--kg-border)] border-0" aria-hidden="true" />
          <section className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Viewer">
            {props.viewer}
          </section>
        </section>
      )}
    </main>
  )
}

