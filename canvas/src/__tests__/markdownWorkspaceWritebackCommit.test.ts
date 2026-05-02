import { commitMarkdownWorkspaceWriteback } from '@/lib/markdown-workspace-runtime/markdownWorkspaceWritebackCommit'

export function testMarkdownWorkspaceWritebackCommitCentralizesWorkspaceAndEditorRefresh() {
  const calls: string[] = []
  const lastLoadedRef = { current: null as { path: string; text: string } | null }

  commitMarkdownWorkspaceWriteback({
    path: '/docs/demo.md' as never,
    text: '# Demo',
    lastLoadedRef: lastLoadedRef as never,
    patchWorkspaceEntryInlineText: (path, text) => {
      calls.push(`patch:${String(path)}:${String(text)}`)
    },
    setActiveTextProgrammatic: (text) => {
      calls.push(`editor:${String(text)}`)
    },
  })

  if (!lastLoadedRef.current) {
    throw new Error('expected writeback commit helper to refresh lastLoadedRef')
  }
  if (lastLoadedRef.current.path !== '/docs/demo.md' || lastLoadedRef.current.text !== '# Demo') {
    throw new Error(`expected writeback commit helper to persist the active path/text pair, got ${JSON.stringify(lastLoadedRef.current)}`)
  }
  if (calls.join('|') !== 'patch:/docs/demo.md:# Demo|editor:# Demo') {
    throw new Error(`expected writeback commit helper to patch workspace text before refreshing the editor, got ${calls.join('|')}`)
  }
}
