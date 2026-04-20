import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'

export function testMarkdownExplorerStoreCanonicalizesKgcCompanionActivePath() {
  const previous = useMarkdownExplorerStore.getState().activePath
  try {
    useMarkdownExplorerStore.getState().setActivePath('/sandbox/chat-log/kgc-trace_20260420220645.md')
    const activePath = useMarkdownExplorerStore.getState().activePath
    if (activePath !== '/sandbox/chat-log/kgc_20260420220645.md') {
      throw new Error('Expected markdown explorer active path to canonicalize KGC trace files to the runnable KGC markdown path')
    }

    useMarkdownExplorerStore.getState().setActivePath('/sandbox/chat-log/kgc-output_20260420220645.png')
    const outputActivePath = useMarkdownExplorerStore.getState().activePath
    if (outputActivePath !== '/sandbox/chat-log/kgc_20260420220645.md') {
      throw new Error('Expected markdown explorer active path to canonicalize KGC output companions to the runnable KGC markdown path')
    }
  } finally {
    useMarkdownExplorerStore.getState().setActivePath(previous)
  }
}
