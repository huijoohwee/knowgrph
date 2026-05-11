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

export function testMarkdownExplorerStoreSkipsIdempotentActivePathSet() {
  const previousActive = useMarkdownExplorerStore.getState().activePath
  const previousLastSet = useMarkdownExplorerStore.getState().lastSetActivePath
  const target = '/docs/knowgrph-video-demo.md' as const
  try {
    useMarkdownExplorerStore.getState().setActivePath(target)
    const firstSet = useMarkdownExplorerStore.getState().lastSetActivePath
    if (!firstSet || firstSet.path !== target) {
      throw new Error('Expected markdown explorer store to stamp lastSetActivePath when setting a new active path')
    }
    useMarkdownExplorerStore.getState().setActivePath(target)
    const secondSet = useMarkdownExplorerStore.getState().lastSetActivePath
    if (!secondSet || secondSet.atMs !== firstSet.atMs) {
      throw new Error('Expected markdown explorer store to skip idempotent active-path set updates and avoid redundant churn')
    }
  } finally {
    useMarkdownExplorerStore.getState().setActivePath(previousActive)
    if (previousActive == null && previousLastSet == null) {
      useMarkdownExplorerStore.setState({ lastSetActivePath: null })
    }
  }
}
