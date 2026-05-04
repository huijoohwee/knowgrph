import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { useCanvasMarkdownSync } from '@/features/markdown-workspace/useCanvasMarkdownSync'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testCanvasSelectionDoesNotAutoOpenWorkspaceWhenInactive() {
  const bootstrap = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const store = useGraphStore.getState()
    store.resetAll()
    store.setWorkspaceViewMode('canvas')
    store.setGraphData({
      type: 'Graph',
      context: 'test',
      nodes: [
        {
          id: 'n1',
          type: 'Node',
          label: 'Hello',
          properties: {},
          metadata: { documentPath: 'foo.md', lineStart: 2, lineEnd: 4 },
        },
      ],
      edges: [],
    } as never)
    store.setSelectionSource('canvas')
    store.selectNode('n1')

    const container = bootstrap.dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const entries: WorkspaceEntry[] = [
      { kind: 'file', path: '/foo.md', parentPath: '/', name: 'foo.md', updatedAtMs: Date.now(), text: 'hi' },
    ]

    const calls = { reveal: 0, setActive: 0 }

    function Harness(props: { active: boolean }) {
      const [activePath, setActivePath] = React.useState<WorkspacePath | null>(null)
      const [, setExpandedPaths] = React.useState<Set<string>>(() => new Set())

      useCanvasMarkdownSync({
        active: props.active,
        entries,
        activePath,
        setActivePathSafe: path => {
          calls.setActive += 1
          setActivePath(path)
        },
        setExpandedPaths,
        revealLineInEditor: () => {
          calls.reveal += 1
        },
        setStatusError: () => {},
      })

      return null
    }

    const root = createRoot(container)

    await act(async () => {
      root.render(<Harness active={false} />)
    })
    await tick()

    if (calls.reveal !== 0 || calls.setActive !== 0) {
      throw new Error(`expected no sync calls when inactive, got reveal=${calls.reveal} setActive=${calls.setActive}`)
    }

    await act(async () => {
      root.render(<Harness active={true} />)
    })
    await tick()

    if (calls.reveal <= 0 || calls.setActive <= 0) {
      throw new Error(`expected sync calls when active, got reveal=${calls.reveal} setActive=${calls.setActive}`)
    }

    await act(async () => {
      root.unmount()
    })
    await tick()
  } finally {
    try {
      useGraphStore.getState().setWorkspaceViewMode('canvas')
    } catch {
      void 0
    }
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    bootstrap.restore()
  }
}
