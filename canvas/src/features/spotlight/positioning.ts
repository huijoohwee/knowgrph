import type { CSSProperties } from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'

type Point = { top: number; left: number } | null

function clampToViewport(top: number, left: number, margin: number) {
  if (typeof window === 'undefined') {
    return { top, left }
  }
  const maxTop = window.innerHeight - margin
  const maxLeft = window.innerWidth - margin
  return {
    top: Math.min(Math.max(top, margin), maxTop),
    left: Math.min(Math.max(left, margin), maxLeft),
  }
}

function getSpotlightPositioning() {
  const { spotlightMargin, spotlightNearTopThreshold } = useGraphStore.getState()
  const margin = typeof spotlightMargin === 'number' && spotlightMargin >= 0 ? spotlightMargin : 8
  const nearTopThreshold =
    typeof spotlightNearTopThreshold === 'number' && spotlightNearTopThreshold >= 0 ? spotlightNearTopThreshold : 96
  return { margin, nearTopThreshold }
}

export function getSpotlightCardStyle(anchor: Point, dragPos: Point, minimized: boolean): CSSProperties {
  const { margin, nearTopThreshold } = getSpotlightPositioning()
  if (minimized) {
    return {
      position: 'absolute',
      top: 64,
      right: 16,
    }
  }
  if (dragPos) {
    const clamped = clampToViewport(dragPos.top, dragPos.left, margin)
    return {
      position: 'absolute',
      top: clamped.top,
      left: clamped.left,
      transform: 'translate(-50%, -50%)',
    }
  }
  if (anchor) {
    const aboveTop = anchor.top - 12
    const clampedAbove = clampToViewport(aboveTop, anchor.left, margin)
    const nearTop = clampedAbove.top < nearTopThreshold
    if (nearTop) {
      const below = clampToViewport(anchor.top + 12, anchor.left, margin)
      return {
        position: 'absolute',
        top: below.top,
        left: below.left,
        transform: 'translate(-50%, 0)',
      }
    }
    return {
      position: 'absolute',
      top: clampedAbove.top,
      left: clampedAbove.left,
      transform: 'translate(-50%, -100%)',
    }
  }
  return {
    position: 'absolute',
    top: 64,
    right: 16,
  }
}
