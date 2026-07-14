import React from 'react'
import type { UploadedMediaPanelItem } from '@/lib/storage/uploadedMediaPanelItems'

type NavigationDirection = -1 | 1
type TouchPoint = { x: number; y: number }

const MINIMUM_HORIZONTAL_SWIPE_PX = 48
const HORIZONTAL_SWIPE_DOMINANCE_RATIO = 1.25

export function useMediaCatalogPreviewNavigation(args: {
  item: UploadedMediaPanelItem
  items: readonly UploadedMediaPanelItem[]
  onNavigate: (item: UploadedMediaPanelItem) => void
}) {
  const { item, items, onNavigate } = args
  const touchStartRef = React.useRef<TouchPoint | null>(null)
  const navigableItems = React.useMemo(
    () => items.filter(candidate => candidate.kind === 'image' || candidate.kind === 'video'),
    [items],
  )
  const activeIndex = navigableItems.findIndex(candidate => candidate.id === item.id)
  const canNavigate = activeIndex >= 0 && navigableItems.length > 1
  const navigate = React.useCallback((direction: NavigationDirection) => {
    if (!canNavigate) return
    const nextIndex = (activeIndex + direction + navigableItems.length) % navigableItems.length
    const nextItem = navigableItems[nextIndex]
    if (nextItem) onNavigate(nextItem)
  }, [activeIndex, canNavigate, navigableItems, onNavigate])

  React.useEffect(() => {
    if (!canNavigate) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? -1
        : event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : 0
      if (!direction) return
      event.preventDefault()
      event.stopPropagation()
      navigate(direction)
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [canNavigate, navigate])

  const onTouchStart = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0]
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }, [])
  const onTouchEnd = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    const end = event.changedTouches[0]
    if (!start || !end) return
    const deltaX = end.clientX - start.x
    const deltaY = end.clientY - start.y
    if (Math.abs(deltaX) < MINIMUM_HORIZONTAL_SWIPE_PX) return
    if (Math.abs(deltaX) < Math.abs(deltaY) * HORIZONTAL_SWIPE_DOMINANCE_RATIO) return
    navigate(deltaX < 0 ? 1 : -1)
  }, [navigate])
  const onTouchCancel = React.useCallback(() => {
    touchStartRef.current = null
  }, [])

  return {
    activeIndex,
    canNavigate,
    count: navigableItems.length,
    navigate,
    touchHandlers: { onTouchStart, onTouchEnd, onTouchCancel },
  }
}
