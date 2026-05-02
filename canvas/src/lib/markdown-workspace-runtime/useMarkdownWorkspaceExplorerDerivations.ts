import React from 'react'
import type { WorkspaceBacklink, WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { computeBacklinks } from '@/features/markdown-explorer/backlinks'
import { useMarkdownPreviewTokens } from '@/features/markdown/ui/useMarkdownPreviewTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { reorderMarkdownHeadings } from '@/features/markdown/ui/markdownSectionUtils'
import { WORKSPACE_TOC_PARSE_MAX_CHARS } from './markdownWorkspaceRuntime.shared'

export type MarkdownWorkspaceExplorerDerivationsArgs = {
  active: boolean
  explorerOpen: boolean
  tocCollapsed: boolean
  backlinksCollapsed: boolean
  outlineText: string
  activeText: string
  activeDocumentKey: string
  activePath: WorkspacePath | null
  entries: WorkspaceEntry[]
  setActiveText: (text: string) => void
}

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number
  cancelIdleCallback?: (id: number) => void
}

function resolveTocCandidateText(args: {
  active: boolean
  explorerOpen: boolean
  tocCollapsed: boolean
  text: string
}): string {
  if (!args.active || !args.explorerOpen || args.tocCollapsed) return ''
  const text = String(args.text || '')
  if (!text.trim() || text.length > WORKSPACE_TOC_PARSE_MAX_CHARS) return ''
  if (!text.includes('#') && !/<h[1-6]\b/i.test(text)) return ''
  return text
}

export function useMarkdownWorkspaceExplorerDerivations(args: MarkdownWorkspaceExplorerDerivationsArgs): {
  tocTokens: TokenWithLines[]
  backlinks: WorkspaceBacklink[]
  onTocReorder: (parentId: string | null, fromIndex: number, toIndex: number) => void
} {
  const tocSourceText = React.useMemo(
    () =>
      resolveTocCandidateText({
        active: args.active,
        explorerOpen: args.explorerOpen,
        tocCollapsed: args.tocCollapsed,
        text: args.outlineText,
      }),
    [args.active, args.explorerOpen, args.outlineText, args.tocCollapsed],
  )
  const tocReorderSourceText = React.useMemo(
    () =>
      resolveTocCandidateText({
        active: args.active,
        explorerOpen: args.explorerOpen,
        tocCollapsed: args.tocCollapsed,
        text: args.activeText,
      }),
    [args.active, args.activeText, args.explorerOpen, args.tocCollapsed],
  )
  const tocTokens = useMarkdownPreviewTokens(tocSourceText, undefined, args.activeDocumentKey, false)
  const tocReorderTokens = useMarkdownPreviewTokens(tocReorderSourceText, undefined, args.activeDocumentKey, false)

  const onTocReorder = React.useCallback(
    (parentId: string | null, fromIndex: number, toIndex: number) => {
      try {
        if (!tocReorderSourceText) return
        const next = reorderMarkdownHeadings(args.activeText, tocReorderTokens, parentId, fromIndex, toIndex)
        if (next !== args.activeText) args.setActiveText(next)
      } catch {
        void 0
      }
    },
    [args.activeText, args.setActiveText, tocReorderSourceText, tocReorderTokens],
  )

  const [backlinks, setBacklinks] = React.useState<WorkspaceBacklink[]>([])
  const backlinksJobRef = React.useRef(0)
  React.useEffect(() => {
    if (!args.active || !args.explorerOpen || args.backlinksCollapsed || !args.activePath) {
      setBacklinks([])
      return
    }
    const jobId = ++backlinksJobRef.current
    const run = () => {
      if (backlinksJobRef.current !== jobId) return
      try {
        const next = computeBacklinks({ activePath: args.activePath as WorkspacePath, entries: args.entries })
        if (backlinksJobRef.current === jobId) setBacklinks(next)
      } catch {
        if (backlinksJobRef.current === jobId) setBacklinks([])
      }
    }
    const w = window as IdleWindow
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(run, { timeout: 700 })
      return () => {
        try {
          w.cancelIdleCallback?.(id)
        } catch {
          void 0
        }
      }
    }
    const t = window.setTimeout(run, 0)
    return () => window.clearTimeout(t)
  }, [args.active, args.activePath, args.backlinksCollapsed, args.entries, args.explorerOpen])

  return {
    tocTokens,
    backlinks,
    onTocReorder,
  }
}
