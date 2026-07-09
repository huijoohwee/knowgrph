import React from 'react'

import type { StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { StoryboardCardInvocationChips } from '@/components/StoryboardWidgetCanvas/StoryboardCardInvocationChips'

const stopCardFooterPointerEvent = (event: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>): void => {
  try {
    event.stopPropagation()
  } catch {
    void 0
  }
}

const stopWheelEvent = (event: WheelEvent | React.WheelEvent<HTMLElement>): void => {
  try {
    event.preventDefault()
  } catch {
    void 0
  }
  try {
    event.stopPropagation()
  } catch {
    void 0
  }
  try {
    const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event
    ;(nativeEvent as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
  } catch {
    void 0
  }
}

export function handleStoryboardCardFooterWheelEvent(event: WheelEvent | React.WheelEvent<HTMLElement>, rail: HTMLElement): void {
  stopWheelEvent(event)
  const maxScrollLeft = Math.max(0, Number(rail.scrollWidth || 0) - Number(rail.clientWidth || 0))
  if (maxScrollLeft <= 0) return
  const deltaX = typeof event.deltaX === 'number' && Number.isFinite(event.deltaX) ? event.deltaX : 0
  const deltaY = typeof event.deltaY === 'number' && Number.isFinite(event.deltaY) ? event.deltaY : 0
  const delta = Math.abs(deltaX) > 0 ? deltaX : deltaY
  if (!Number.isFinite(delta) || Math.abs(delta) <= 0) return
  rail.scrollLeft = Math.max(0, Math.min(maxScrollLeft, rail.scrollLeft + delta))
}

export function StoryboardCardFooterScrollRail(props: { card: StoryboardCardModel }) {
  const { card } = props
  const footerRef = React.useRef<HTMLElement | null>(null)
  React.useEffect(() => {
    const rail = footerRef.current
    if (!rail) return
    const handleWheel = (event: WheelEvent) => handleStoryboardCardFooterWheelEvent(event, rail)
    rail.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    return () => rail.removeEventListener('wheel', handleWheel, { capture: true } as EventListenerOptions)
  }, [])
  const handleFooterWheelCapture = React.useCallback((event: React.WheelEvent<HTMLElement>) => {
    handleStoryboardCardFooterWheelEvent(event, event.currentTarget)
  }, [])
  return (
    <footer
      ref={footerRef}
      className="mt-auto flex min-w-0 max-w-full items-center gap-1 overflow-x-auto overflow-y-hidden overscroll-contain border-t pt-1 text-[8px] leading-3 text-[color:var(--kg-text-tertiary)] [scrollbar-gutter:stable]"
      data-kg-canvas-pointer-ignore="true"
      data-kg-canvas-wheel-ignore="true"
      data-kg-media-scroll-surface="1"
      data-kg-storyboard-card-footer-scroll="1"
      data-kg-storyboard-card-meta-row="1"
      onMouseDownCapture={stopCardFooterPointerEvent}
      onPointerDownCapture={stopCardFooterPointerEvent}
      onWheelCapture={handleFooterWheelCapture}
      style={{ borderColor: 'var(--kg-border)', touchAction: 'pan-x' }}
    >
      {card.indexLabel ? <span className="shrink-0">{card.indexLabel}</span> : null}
      <StoryboardCardInvocationChips tokens={card.invocationTokens} />
    </footer>
  )
}
