import React from 'react'
import { LS_KEYS, getMarkdownCollapsedHeadingIdsStorageKey } from '@/lib/config'
import { lsBool, lsJson, lsSetBool, lsSetJson } from '@/lib/persistence'
import { parseStringArray } from '@/lib/persistence.parsers'
import { slugify } from 'grph-shared/markdown/slugify'
import { hashStringToHex } from '@/lib/hash/stringHash'

type HeadingTokenLike = {
  type?: unknown
  id?: unknown
  text?: unknown
}

export type UseMarkdownExplorerControlsArgs = {
  tokens: unknown[]
  storageScopeKey?: string
  showSidebar?: boolean
  onToggleSidebar?: (show: boolean) => void
  collapsedHeadingIds?: Set<string>
  onToggleCollapse?: (id: string) => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
}

export type MarkdownExplorerControls = {
  showSidebar: boolean
  collapsedHeadingIds: Set<string>
  allCollapsed: boolean | undefined
  onToggleSidebar: (show: boolean) => void
  onToggleCollapse: (id: string) => void
  onExpandAll: () => void
  onCollapseAll: () => void
}

export function useMarkdownExplorerControls(
  args: UseMarkdownExplorerControlsArgs,
): MarkdownExplorerControls {
  const storageKeyForCollapsed = React.useMemo(() => {
    const scope = String(args.storageScopeKey || '').trim()
    if (!scope) return LS_KEYS.markdownCollapsedHeadingIds
    const digest = hashStringToHex(scope).slice(0, 12)
    return getMarkdownCollapsedHeadingIdsStorageKey(digest)
  }, [args.storageScopeKey])

  const [localShowSidebar, setLocalShowSidebar] = React.useState<boolean>(() =>
    lsBool(LS_KEYS.markdownSidebarOpen, true),
  )
  const [localCollapsedIds, setLocalCollapsedIds] = React.useState<Set<string>>(
    () => new Set(lsJson<string[]>(storageKeyForCollapsed, [], parseStringArray)),
  )

  React.useEffect(() => {
    if (args.collapsedHeadingIds) return
    setLocalCollapsedIds(new Set(lsJson<string[]>(storageKeyForCollapsed, [], parseStringArray)))
  }, [args.collapsedHeadingIds, storageKeyForCollapsed])

  const effectiveShowSidebar = args.showSidebar ?? localShowSidebar
  const effectiveCollapsedIds = args.collapsedHeadingIds ?? localCollapsedIds

  const allHeadingIds = React.useMemo(() => {
    const out = new Set<string>()
    const list = Array.isArray(args.tokens) ? args.tokens : []
    for (const t of list) {
      const token = t as HeadingTokenLike
      if (token?.type !== 'heading') continue
      const idRaw = String(token.id || '').trim()
      const id = idRaw || slugify(String(token.text || ''))
      if (id) out.add(id)
    }
    return out
  }, [args.tokens])

  const allCollapsed = React.useMemo(() => {
    if (allHeadingIds.size === 0) return undefined
    for (const id of allHeadingIds) {
      if (!effectiveCollapsedIds.has(id)) return false
    }
    return true
  }, [allHeadingIds, effectiveCollapsedIds])

  const onToggleSidebar = React.useCallback(
    (show: boolean) => {
      if (args.onToggleSidebar) {
        args.onToggleSidebar(show)
        return
      }
      setLocalShowSidebar(show)
      lsSetBool(LS_KEYS.markdownSidebarOpen, show)
    },
    [args.onToggleSidebar],
  )

  const onToggleCollapse = React.useCallback(
    (id: string) => {
      if (args.onToggleCollapse) {
        args.onToggleCollapse(id)
        return
      }
      setLocalCollapsedIds(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        lsSetJson(storageKeyForCollapsed, Array.from(next))
        return next
      })
    },
    [args.onToggleCollapse, storageKeyForCollapsed],
  )

  const onExpandAll = React.useCallback(() => {
    if (args.onExpandAll) {
      args.onExpandAll()
      return
    }
    setLocalCollapsedIds(new Set())
    lsSetJson(storageKeyForCollapsed, [])
  }, [args.onExpandAll, storageKeyForCollapsed])

  const onCollapseAll = React.useCallback(() => {
    if (args.onCollapseAll) {
      args.onCollapseAll()
      return
    }
    setLocalCollapsedIds(allHeadingIds)
    lsSetJson(storageKeyForCollapsed, Array.from(allHeadingIds))
  }, [allHeadingIds, args.onCollapseAll, storageKeyForCollapsed])

  return {
    showSidebar: effectiveShowSidebar,
    collapsedHeadingIds: effectiveCollapsedIds,
    allCollapsed,
    onToggleSidebar,
    onToggleCollapse,
    onExpandAll,
    onCollapseAll,
  }
}
