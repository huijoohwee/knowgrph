import type { WorkspacePath } from './types'
import { normalizeWorkspacePath } from './path'

export const WORKSPACE_FS_CHANGED_EVENT = 'kg:workspace-fs:changed'

export type WorkspaceFsChangedDetail = {
  op?: 'createFile' | 'createFolder' | 'writeFileText' | 'deleteEntry' | 'batch'
  path?: WorkspacePath
}

let workspaceFsChangedBatchDepth = 0
let pendingWorkspaceFsChangedDetail: WorkspaceFsChangedDetail | null = null

export async function runWorkspaceFsChangedBatch<T>(fn: () => Promise<T> | T): Promise<T> {
  workspaceFsChangedBatchDepth += 1
  try {
    return await fn()
  } finally {
    workspaceFsChangedBatchDepth = Math.max(0, workspaceFsChangedBatchDepth - 1)
    if (workspaceFsChangedBatchDepth === 0 && pendingWorkspaceFsChangedDetail) {
      const pending = pendingWorkspaceFsChangedDetail
      pendingWorkspaceFsChangedDetail = null
      notifyWorkspaceFsChanged({ op: 'batch', path: pending.path })
    }
  }
}

export function notifyWorkspaceFsChanged(detail?: WorkspaceFsChangedDetail): void {
  try {
    if (typeof window === 'undefined') return

    if (workspaceFsChangedBatchDepth > 0) {
      const normalizedPath = detail?.path ? normalizeWorkspacePath(detail.path) : undefined
      pendingWorkspaceFsChangedDetail = {
        ...(detail?.op ? { op: detail.op } : {}),
        ...(normalizedPath ? { path: normalizedPath } : {}),
      }
      return
    }

    const normalizedPath = detail?.path ? normalizeWorkspacePath(detail.path) : undefined
    const eventCtor = (window as unknown as { CustomEvent?: typeof CustomEvent }).CustomEvent ||
      (globalThis as unknown as { CustomEvent?: typeof CustomEvent }).CustomEvent
    if (!eventCtor) return
    window.dispatchEvent(
      new eventCtor(WORKSPACE_FS_CHANGED_EVENT, {
        detail: {
          op: detail?.op,
          ...(normalizedPath ? { path: normalizedPath } : {}),
        } satisfies WorkspaceFsChangedDetail,
      }),
    )
  } catch {
    void 0
  }
}

export function subscribeWorkspaceFsChanged(fn: (detail: WorkspaceFsChangedDetail) => void): () => void {
  try {
    if (typeof window === 'undefined') return () => void 0
    const handler = (ev: Event) => {
      const detailRaw = (ev as CustomEvent).detail
      const detail = detailRaw && typeof detailRaw === 'object' && !Array.isArray(detailRaw) ? (detailRaw as WorkspaceFsChangedDetail) : {}
      fn(detail)
    }
    window.addEventListener(WORKSPACE_FS_CHANGED_EVENT, handler as EventListener)
    return () => {
      try {
        window.removeEventListener(WORKSPACE_FS_CHANGED_EVENT, handler as EventListener)
      } catch {
        void 0
      }
    }
  } catch {
    return () => void 0
  }
}
