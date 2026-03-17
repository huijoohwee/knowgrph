import React from 'react'
import { MarkdownWorkspace } from './markdownWorkspace/MarkdownWorkspace'

export type MarkdownLayoutMode = 'split' | 'editor' | 'viewer' | 'presentation' | 'slides-gallery'

export function BottomPanelMarkdownSection() {
  return <MarkdownWorkspace />
}
