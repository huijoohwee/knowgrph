import React from 'react'
import { TOC_FOCUS_EVENT } from '@/features/markdown/ui/tocFocusEvents'

export function expandMarkdownTocAncestors(args: {
  collapsedIds: ReadonlySet<string>
  parentById: ReadonlyMap<string, string | null>
  itemId: string
}): Set<string> {
  const next = new Set(args.collapsedIds)
  let current: string | null | undefined = args.parentById.get(args.itemId)
  while (current) {
    next.delete(current)
    current = args.parentById.get(current)
  }
  return next
}

export function useMarkdownTocFocusState(args: {
  resetKey: string | null
  tocCollapsed: boolean
  itemCount: number
  parentById: ReadonlyMap<string, string | null>
  navRef: React.RefObject<HTMLElement | null>
}) {
  const { resetKey, tocCollapsed, itemCount, parentById, navRef } = args
  const [collapsedIds, setCollapsedIds] = React.useState<Set<string>>(() => new Set())
  const [activeItemId, setActiveItemId] = React.useState<string>('')

  React.useEffect(() => {
    setCollapsedIds(new Set())
    setActiveItemId('')
  }, [resetKey])

  const toggleExpanded = React.useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  React.useEffect(() => {
    if (tocCollapsed || itemCount === 0) return
    const handler = (event: Event) => {
      const nextId = typeof (event as CustomEvent<{ id?: unknown }>).detail?.id === 'string'
        ? ((event as CustomEvent<{ id?: unknown }>).detail.id as string)
        : ''
      if (!nextId) return
      setActiveItemId(nextId)
      setCollapsedIds(prev => expandMarkdownTocAncestors({ collapsedIds: prev, parentById, itemId: nextId }))
      try {
        const nav = navRef.current
        const element = nav ? nav.querySelector(`[data-toc-id="${CSS.escape(nextId)}"]`) : null
        if (element && element instanceof HTMLElement) {
          element.scrollIntoView({ block: 'center', inline: 'nearest' })
        }
      } catch {
        void 0
      }
    }
    window.addEventListener(TOC_FOCUS_EVENT, handler as EventListener)
    return () => window.removeEventListener(TOC_FOCUS_EVENT, handler as EventListener)
  }, [itemCount, navRef, parentById, tocCollapsed])

  return {
    activeItemId,
    collapsedIds,
    setActiveItemId,
    toggleExpanded,
  }
}
