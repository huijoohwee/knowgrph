import React from 'react'

export function useCollapsibleSectionGroup(visibleKeys: readonly string[]) {
  const [collapsedKeys, setCollapsedKeys] = React.useState<ReadonlySet<string>>(() => new Set())
  const allCollapsed = visibleKeys.length > 0 && visibleKeys.every(key => collapsedKeys.has(key))

  const expandAll = React.useCallback(() => {
    setCollapsedKeys(previous => previous.size === 0 ? previous : new Set<string>())
  }, [])

  const collapseAll = React.useCallback(() => {
    setCollapsedKeys(previous => {
      const next = new Set(visibleKeys)
      if (next.size === previous.size && visibleKeys.every(key => previous.has(key))) return previous
      return next
    })
  }, [visibleKeys])

  const setCollapsed = React.useCallback((key: string, collapsed: boolean) => {
    setCollapsedKeys(previous => {
      if (previous.has(key) === collapsed) return previous
      const next = new Set(previous)
      if (collapsed) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  return {
    allCollapsed,
    collapseAll,
    collapsedKeys,
    expandAll,
    setCollapsed,
    setCollapsedKeys,
  }
}
