import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import {
  notifyWorkspaceFsChanged,
  runWorkspaceFsChangedBatch,
  subscribeWorkspaceFsChanged,
  type WorkspaceFsChangedDetail,
} from '@/features/workspace-fs/workspaceFsEvents'

export async function testWorkspaceFsChangedBatchCoalescesNotifications() {
  const { restore } = initJsdomHarness()
  try {
    const received: WorkspaceFsChangedDetail[] = []
    const unsubscribe = subscribeWorkspaceFsChanged(detail => {
      received.push(detail)
    })

    notifyWorkspaceFsChanged({ op: 'createFile', path: '/a.md' })
    if (received.length !== 1) throw new Error(`expected 1 event, got ${received.length}`)
    received.length = 0

    await runWorkspaceFsChangedBatch(async () => {
      notifyWorkspaceFsChanged({ op: 'createFile', path: '/b.md' })
      notifyWorkspaceFsChanged({ op: 'writeFileText', path: '/b.md' })
      await runWorkspaceFsChangedBatch(async () => {
        notifyWorkspaceFsChanged({ op: 'createFolder', path: '/x' })
      })
    })

    if (received.length !== 1) throw new Error(`expected 1 batched event, got ${received.length}`)
    if (received[0]?.op !== 'batch') throw new Error(`expected op=batch, got ${String(received[0]?.op || '')}`)

    unsubscribe()
  } finally {
    restore()
  }
}

