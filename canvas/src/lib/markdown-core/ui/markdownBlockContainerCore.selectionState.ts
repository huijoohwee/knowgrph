import React from 'react'
import type { LiveSelectionSnapshot } from './markdownBlockContainerCore.interaction'

export const useMarkdownBlockContainerSelectionState = () => {
  const linkRangeRef = React.useRef<Range | null>(null)
  const lastNonCollapsedSelectionOffsetsRef = React.useRef<{ startOffset: number; endOffset: number } | null>(null)
  const lastNonCollapsedDomRangeRef = React.useRef<Range | null>(null)
  const liveSelectionSnapshotRef = React.useRef<LiveSelectionSnapshot | null>(null)

  return {
    linkRangeRef,
    lastNonCollapsedSelectionOffsetsRef,
    lastNonCollapsedDomRangeRef,
    liveSelectionSnapshotRef,
  }
}
