import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import {
  resolveStreamingWorkspaceSelectionLockTarget,
  useMarkdownWorkspaceStreamingSelectionLock,
} from '@/lib/markdown-workspace-runtime/useMarkdownWorkspaceStreamingSelectionLock'

const tick = async (n = 1): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
}

export function testResolveStreamingWorkspaceSelectionLockTargetRequiresLiveText() {
  const streamingPath = '/chat-log/run/kgc-trace_run.md' as never
  if (resolveStreamingWorkspaceSelectionLockTarget({
    activePath: '/docs/other.md' as never,
    streamingPath,
    streamingText: '',
  }) !== null) {
    throw new Error('expected empty streaming text not to lock workspace selection')
  }
  if (resolveStreamingWorkspaceSelectionLockTarget({
    activePath: streamingPath,
    streamingPath,
    streamingText: 'live text',
  }) !== null) {
    throw new Error('expected already-active streaming file not to request a selection lock')
  }
  const target = resolveStreamingWorkspaceSelectionLockTarget({
    activePath: '/docs/other.md' as never,
    streamingPath,
    streamingText: 'live text',
  })
  if (target !== streamingPath) {
    throw new Error(`expected live streaming text to lock selection to streaming file, got ${JSON.stringify(target)}`)
  }
}

export async function testMarkdownWorkspaceStreamingSelectionLockRestoresLiveFileAfterSwitch() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  const container = dom.window.document.getElementById('root')
  if (!container) throw new Error('missing root container')
  const root = createRoot(container)
  const activeWrites: string[] = []
  const selectionWrites: string[] = []
  const streamingPath = '/chat-log/run/kgc-trace_run.md' as never

  function Harness() {
    useMarkdownWorkspaceStreamingSelectionLock({
      activePath: '/docs/other.md' as never,
      setActivePathSafe: path => { activeWrites.push(path) },
      setSelectionPathSafe: path => { selectionWrites.push(path) },
    })
    return <output data-testid="state" />
  }

  try {
    await act(async () => {
      useGraphStore.getState().setChatWorkspaceStreamingState({ path: streamingPath, text: 'live stream chunk' })
      await tick()
    })
    await act(async () => {
      root.render(<Harness />)
      await tick(3)
    })
    if (activeWrites[0] !== streamingPath || selectionWrites[0] !== streamingPath) {
      throw new Error(`expected live stream lock to restore selected file, got ${JSON.stringify({ activeWrites, selectionWrites })}`)
    }
  } finally {
    try {
      await act(async () => {
        useGraphStore.getState().setChatWorkspaceStreamingState(null)
        root.unmount()
        await tick(2)
      })
    } catch {
      void 0
    }
    restore()
  }
}
