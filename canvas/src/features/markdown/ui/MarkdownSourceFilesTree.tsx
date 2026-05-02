import React from 'react'
import { UI_COPY } from '@/lib/config'
import type { VisibleMarkdownSourceFileTreeNode } from './markdownSourceFileTree'
import { MarkdownSourceFilesTreeRow, type MarkdownSourceFilesTreeRowProps } from './MarkdownSourceFilesTreeRow'

export function MarkdownSourceFilesTree(props: {
  visible: ReadonlyArray<VisibleMarkdownSourceFileTreeNode>
  buildRowProps: (node: VisibleMarkdownSourceFileTreeNode) => MarkdownSourceFilesTreeRowProps
}) {
  const { visible, buildRowProps } = props
  return (
    <nav aria-label="Source Files tree" className="min-h-0">
      <ul className="flex flex-col" role="tree" aria-label={UI_COPY.markdownPreviewSourceFilesLabel}>
        {visible.map(node => (
          <MarkdownSourceFilesTreeRow key={node.key} {...buildRowProps(node)} />
        ))}
      </ul>
    </nav>
  )
}
