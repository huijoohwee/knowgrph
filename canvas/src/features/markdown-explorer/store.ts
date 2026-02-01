import { create } from 'zustand'
import type { WorkspacePath } from '@/features/workspace-fs/types'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'

type MarkdownExplorerState = {
  activePath: WorkspacePath | null
  requestedRevealLine: number | null
  lastCanvasSyncSig: string | null
  setActivePath: (path: WorkspacePath | null) => void
  requestRevealLine: (line: number | null) => void
  setLastCanvasSyncSig: (sig: string | null) => void
}

export const useMarkdownExplorerStore = create<MarkdownExplorerState>(set => ({
  activePath: null,
  requestedRevealLine: null,
  lastCanvasSyncSig: null,
  setActivePath: (path: WorkspacePath | null) =>
    set({ activePath: path ? normalizeWorkspacePath(path) : null }),
  requestRevealLine: (line: number | null) =>
    set({ requestedRevealLine: typeof line === 'number' && Number.isFinite(line) ? Math.max(1, Math.floor(line)) : null }),
  setLastCanvasSyncSig: (sig: string | null) => set({ lastCanvasSyncSig: sig ? String(sig) : null }),
}))
