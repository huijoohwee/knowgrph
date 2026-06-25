import type React from 'react'

export type TimelineAnimationSurface =
  | 'bottom-timeline'
  | 'floating-media'
  | 'floating-timeline'
  | 'media-canvas'

export type TimelineAnimationTarget =
  | 'canvas-2d'
  | 'css-property'
  | 'dom-attribute'
  | 'html'
  | 'js-object'
  | 'svg-attribute'
  | 'webgl-three'

export type TimelineAnimationAttributes = React.HTMLAttributes<HTMLElement> & {
  [key: `data-${string}`]: string | number | undefined
}

export type TimelineAnimationState = {
  attributes: TimelineAnimationAttributes
  easedProgress: number
  objectFrame: {
    opacity: number
    scale: number
    translateX: number
  }
  progress: number
  svg: {
    dashArray: string
    dashOffset: number
    pathLength: number
  }
  targetTokens: string
}

const TIMELINE_ANIMATION_TARGETS: readonly TimelineAnimationTarget[] = [
  'css-property',
  'svg-attribute',
  'dom-attribute',
  'js-object',
  'html',
  'canvas-2d',
  'webgl-three',
] as const

const TIMELINE_ANIMATION_TARGET_TOKEN = TIMELINE_ANIMATION_TARGETS.join(' ')

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

export function easeTimelineAnimationProgress(value: number): number {
  const t = clamp01(value)
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

export function buildTimelineAnimationState(args: {
  active?: boolean
  itemCount?: number
  progress?: number
  surface: TimelineAnimationSurface
}): TimelineAnimationState {
  const progress = clamp01(args.progress ?? 0)
  const easedProgress = easeTimelineAnimationProgress(progress)
  const itemCount = Math.max(0, Math.round(Number.isFinite(args.itemCount || 0) ? args.itemCount || 0 : 0))
  const playState = args.active ? 'active' : 'idle'
  const objectFrame = {
    opacity: Number((0.72 + easedProgress * 0.28).toFixed(3)),
    scale: Number((0.985 + easedProgress * 0.015).toFixed(4)),
    translateX: Number(((easedProgress - 0.5) * 8).toFixed(3)),
  }
  const svg = {
    dashArray: `${Math.max(4, Math.round(8 + easedProgress * 18))} ${Math.max(4, Math.round(18 - easedProgress * 8))}`,
    dashOffset: Number(((1 - easedProgress) * 100).toFixed(3)),
    pathLength: 100,
  }

  return {
    attributes: {
      'data-kg-animation-engine': 'native',
      'data-kg-animation-inspired-by': 'animejs-v4',
      'data-kg-animation-play-state': playState,
      'data-kg-animation-progress': progress,
      'data-kg-animation-surface': args.surface,
      'data-kg-animation-targets': TIMELINE_ANIMATION_TARGET_TOKEN,
      style: {
        '--kg-motion-eased': easedProgress,
        '--kg-motion-item-count': itemCount,
        '--kg-motion-opacity': objectFrame.opacity,
        '--kg-motion-progress': progress,
        '--kg-motion-scale': objectFrame.scale,
        '--kg-motion-translate-x': `${objectFrame.translateX}px`,
      } as React.CSSProperties,
    },
    easedProgress,
    objectFrame,
    progress,
    svg,
    targetTokens: TIMELINE_ANIMATION_TARGET_TOKEN,
  }
}
