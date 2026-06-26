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

export type TimelineAnimationEasing = 'linear' | 'ease-in-out' | 'hold' | 'step'
export type TimelineAnimationLoopMode = 'once' | 'loop' | 'ping-pong'
export type TimelineAnimationModifier = 'stroke-trim' | 'follow-path'
export type TimelineAnimationProperty = 'position' | 'scale' | 'rotation' | 'opacity' | 'blur' | 'shadow' | 'corner-radius' | 'stroke' | 'fill'
export type TimelineAnimationLayerMode = 'animated-frame' | 'detached-continuous'
export type TimelineAnimationNestedMode = 'timeline-in-fbf' | 'fbf-in-timeline'
export type TimelineAnimationRenderPass = 'detached-continuous' | 'fbf-frame' | 'child-timeline' | 'parent-timeline'
export type TimelineVectorMorphShape = 'vector' | 'rectangle' | 'ellipse' | 'polygon' | 'star'
export type TimelineVectorBooleanOperation = 'union' | 'subtract' | 'intersect' | 'exclude'
export type TimelineTextAnimationScope = 'character' | 'segment' | 'node'
export type TimelineTextAnimationProperty = 'font-size' | 'color' | 'letter-spacing' | 'line-height'

export type TimelineAnimationKeyframe = {
  easing: TimelineAnimationEasing
  offset: number
  value: number
}

export type TimelineTextAnimationKeyframe = {
  color: string
  easing: TimelineAnimationEasing
  fontSize: number
  letterSpacing: number
  lineHeight: number
  offset: number
  rangeEnd: number
  rangeStart: number
  scope: TimelineTextAnimationScope
}

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
  easing: {
    curve: string
    mode: TimelineAnimationEasing
  }
  clip: {
    batchMoveEnabled: boolean
    draggable: boolean
    trimEnabled: boolean
  }
  frameByFrame: {
    activeFrame: number
    frameCount: number
    frameDurationMs: number
    frameRate: number
    onionSkinFrames: number
    timing: string
  }
  keyframes: TimelineAnimationKeyframe[]
  loopModes: TimelineAnimationLoopMode[]
  layerPanel: {
    contextMenu: 'unified'
    dragSort: boolean
    grouping: 'smart'
    inlineRenameKey: 'F2'
    layerModes: TimelineAnimationLayerMode[]
  }
  modifiers: TimelineAnimationModifier[]
  nested: {
    childTimelineFrame: number
    compositeOrder: string
    enabled: boolean
    fbfFrame: number
    fbfFrameDurationMs: number
    fbfFrameRate: number
    modes: TimelineAnimationNestedMode[]
    renderPasses: TimelineAnimationRenderPass[]
    timelineFrameDurationMs: number
    timelineFrameRate: number
  }
  progress: number
  svg: {
    dashArray: string
    dashOffset: number
    pathLength: number
  }
  targetTokens: string
  propertyTokens: string
  recording: {
    enabled: boolean
    playhead: number
  }
  text: {
    color: string
    fontSize: number
    keyframes: TimelineTextAnimationKeyframe[]
    letterSpacing: number
    lineHeight: number
    properties: TimelineTextAnimationProperty[]
    rangeEnd: number
    rangeStart: number
    scopes: TimelineTextAnimationScope[]
    tracking: number
  }
  vectorMorph: {
    amount: number
    booleanOperations: TimelineVectorBooleanOperation[]
    fromShape: TimelineVectorMorphShape
    interpolatedPath: string
    pathSample: string
    shapeFamilies: TimelineVectorMorphShape[]
    sourcePath: string
    targetShape: TimelineVectorMorphShape
    targetPath: string
  }
  workArea: {
    end: number
    start: number
  }
}

const TIMELINE_ANIMATION_PROPERTIES: readonly TimelineAnimationProperty[] = ['position', 'scale', 'rotation', 'opacity', 'blur', 'shadow', 'corner-radius', 'stroke', 'fill'] as const
const TIMELINE_ANIMATION_MODIFIERS: readonly TimelineAnimationModifier[] = ['stroke-trim', 'follow-path'] as const
const TIMELINE_ANIMATION_LOOP_MODES: readonly TimelineAnimationLoopMode[] = ['once', 'loop', 'ping-pong'] as const
const TIMELINE_ANIMATION_LAYER_MODES: readonly TimelineAnimationLayerMode[] = ['animated-frame', 'detached-continuous'] as const
const TIMELINE_ANIMATION_NESTED_MODES: readonly TimelineAnimationNestedMode[] = ['timeline-in-fbf', 'fbf-in-timeline'] as const
const TIMELINE_ANIMATION_RENDER_PASSES: readonly TimelineAnimationRenderPass[] = ['detached-continuous', 'fbf-frame', 'child-timeline', 'parent-timeline'] as const
const TIMELINE_VECTOR_MORPH_SHAPES: readonly TimelineVectorMorphShape[] = ['vector', 'rectangle', 'ellipse', 'polygon', 'star'] as const
const TIMELINE_VECTOR_BOOLEAN_OPERATIONS: readonly TimelineVectorBooleanOperation[] = ['union', 'subtract', 'intersect', 'exclude'] as const
const TIMELINE_TEXT_ANIMATION_SCOPES: readonly TimelineTextAnimationScope[] = ['character', 'segment', 'node'] as const
const TIMELINE_TEXT_ANIMATION_PROPERTIES: readonly TimelineTextAnimationProperty[] = ['font-size', 'color', 'letter-spacing', 'line-height'] as const

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

function buildTimelineAnimationKeyframes(progress: number): TimelineAnimationKeyframe[] {
  return [
    { easing: 'hold', offset: 0, value: 0 },
    { easing: 'ease-in-out', offset: Number(Math.max(0.08, progress * 0.5).toFixed(3)), value: Number((progress * 0.62).toFixed(3)) },
    { easing: 'linear', offset: 1, value: 1 },
  ]
}

function resolveTimelineAnimationEasingMode(active?: boolean): TimelineAnimationEasing {
  return active ? 'ease-in-out' : 'hold'
}

function buildTimelineTextKeyframes(progress: number): TimelineTextAnimationKeyframe[] {
  const mid = Number(Math.max(0.16, progress).toFixed(3))
  return [
    { color: '#e0f2fe', easing: 'hold', fontSize: 16, letterSpacing: 0, lineHeight: 1.2, offset: 0, rangeEnd: 20, rangeStart: 0, scope: 'character' },
    { color: '#fef3c7', easing: 'ease-in-out', fontSize: 18, letterSpacing: Number((0.02 + progress * 0.08).toFixed(3)), lineHeight: Number((1.22 + progress * 0.12).toFixed(3)), offset: mid, rangeEnd: Math.min(100, Math.max(24, Math.round(progress * 100))), rangeStart: 12, scope: 'segment' },
    { color: '#f8fafc', easing: 'linear', fontSize: 20, letterSpacing: 0.08, lineHeight: 1.36, offset: 1, rangeEnd: 100, rangeStart: 0, scope: 'node' },
  ]
}

type VectorPoint = readonly [number, number]

function interpolateVectorPoint(from: VectorPoint, to: VectorPoint, progress: number): VectorPoint {
  return [
    Number((from[0] + (to[0] - from[0]) * progress).toFixed(3)),
    Number((from[1] + (to[1] - from[1]) * progress).toFixed(3)),
  ]
}

function vectorPointsToSvgPath(points: readonly VectorPoint[]): string {
  const [first, ...rest] = points
  return first ? `M${first[0]} ${first[1]} ${rest.map(point => `L${point[0]} ${point[1]}`).join(' ')} Z` : ''
}

function buildTimelineVectorMorphPath(progress: number): {
  interpolatedPath: string
  sourcePath: string
  targetPath: string
} {
  const sourcePoints: readonly VectorPoint[] = [[10, 18], [90, 18], [90, 82], [10, 82], [10, 18], [90, 18], [90, 82], [10, 82]]
  const targetPoints: readonly VectorPoint[] = [[50, 8], [62, 35], [92, 38], [68, 57], [76, 88], [50, 70], [24, 88], [32, 57]]
  return {
    interpolatedPath: vectorPointsToSvgPath(sourcePoints.map((point, index) => interpolateVectorPoint(point, targetPoints[index] || point, progress))),
    sourcePath: vectorPointsToSvgPath(sourcePoints),
    targetPath: vectorPointsToSvgPath(targetPoints),
  }
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
  const easingMode = resolveTimelineAnimationEasingMode(args.active)
  const keyframes = buildTimelineAnimationKeyframes(progress)
  const textKeyframes = buildTimelineTextKeyframes(progress)
  const frameCount = Math.max(1, itemCount * 6)
  const activeFrame = Math.min(frameCount, Math.max(1, Math.round(progress * frameCount)))
  const frameRate = 12
  const frameDurationMs = Math.round(1000 / frameRate)
  const timelineFrameRate = 24
  const timelineFrameDurationMs = Math.round(1000 / timelineFrameRate)
  const childTimelineFrame = Math.min(Math.max(1, itemCount * 12), Math.max(1, Math.round(progress * Math.max(1, itemCount * 12))))
  const recordingEnabled = !!args.active && progress > 0
  const vectorMorphAmount = Number(easedProgress.toFixed(3))
  const textRangeEnd = Math.min(100, Math.max(1, Math.round(easedProgress * 100)))
  const workAreaEnd = Math.max(0.12, Math.min(1, itemCount ? itemCount / Math.max(itemCount, itemCount + 2) : 1))
  const propertyTokens = TIMELINE_ANIMATION_PROPERTIES.join(' ')
  const textScopeTokens = TIMELINE_TEXT_ANIMATION_SCOPES.join(' ')
  const textPropertyTokens = TIMELINE_TEXT_ANIMATION_PROPERTIES.join(' ')
  const modifierTokens = TIMELINE_ANIMATION_MODIFIERS.join(' ')
  const loopModeTokens = TIMELINE_ANIMATION_LOOP_MODES.join(' ')
  const layerModeTokens = TIMELINE_ANIMATION_LAYER_MODES.join(' ')
  const nestedModeTokens = TIMELINE_ANIMATION_NESTED_MODES.join(' ')
  const nestedRenderPassTokens = TIMELINE_ANIMATION_RENDER_PASSES.join(' ')
  const nestedCompositeOrder = TIMELINE_ANIMATION_RENDER_PASSES.join(' -> ')
  const vectorMorphShapeTokens = TIMELINE_VECTOR_MORPH_SHAPES.join(' ')
  const vectorMorphBooleanTokens = TIMELINE_VECTOR_BOOLEAN_OPERATIONS.join(' ')
  const vectorMorphPath = buildTimelineVectorMorphPath(vectorMorphAmount)

  return {
    attributes: {
      'data-kg-animation-engine': 'native',
      'data-kg-animation-easing': easingMode,
      'data-kg-animation-frame': activeFrame,
      'data-kg-animation-frame-rate': frameRate,
      'data-kg-animation-frame-timing': `${frameDurationMs}ms`,
      'data-kg-animation-frame-count': frameCount,
      'data-kg-animation-fbf-workflow': 'cel onion-skin scrub per-frame-timing',
      'data-kg-animation-inspired-by': 'motionkit',
      'data-kg-animation-reference': 'blender',
      'data-kg-animation-layer-panel': 'drag-sort unified-context-menu inline-rename-f2 smart-grouping',
      'data-kg-animation-layer-modes': layerModeTokens,
      'data-kg-animation-clip-settings': 'drag trim extend batch-move',
      'data-kg-animation-keyframe-count': keyframes.length,
      'data-kg-animation-loop-modes': loopModeTokens,
      'data-kg-animation-modifiers': modifierTokens,
      'data-kg-animation-nested': nestedModeTokens,
      'data-kg-animation-nested-composite': nestedCompositeOrder,
      'data-kg-animation-nested-fps': `timeline:${timelineFrameRate} fbf:${frameRate}`,
      'data-kg-animation-nested-render-passes': nestedRenderPassTokens,
      'data-kg-animation-onion-skin-frames': Math.min(2, Math.max(0, itemCount - 1)),
      'data-kg-animation-play-state': playState,
      'data-kg-animation-progress': progress,
      'data-kg-animation-properties': propertyTokens,
      'data-kg-animation-recording-mode': recordingEnabled ? 'playhead-auto-key' : 'idle',
      'data-kg-animation-snapping': 'frame playhead clip-boundary work-area',
      'data-kg-animation-surface': args.surface,
      'data-kg-animation-targets': TIMELINE_ANIMATION_TARGET_TOKEN,
      'data-kg-animation-text-range': `0-${textRangeEnd}`,
      'data-kg-animation-text-color': textKeyframes[1]?.color,
      'data-kg-animation-text-font-size': textKeyframes[1]?.fontSize,
      'data-kg-animation-text-keyframes': textKeyframes.length,
      'data-kg-animation-text-letter-spacing': textKeyframes[1]?.letterSpacing,
      'data-kg-animation-text-line-height': textKeyframes[1]?.lineHeight,
      'data-kg-animation-text-properties': textPropertyTokens,
      'data-kg-animation-text-scopes': textScopeTokens,
      'data-kg-animation-vector-morph': vectorMorphAmount,
      'data-kg-animation-vector-morph-boolean-ops': vectorMorphBooleanTokens,
      'data-kg-animation-vector-morph-from': 'rectangle',
      'data-kg-animation-vector-morph-interpolated-path': vectorMorphPath.interpolatedPath,
      'data-kg-animation-vector-morph-shapes': vectorMorphShapeTokens,
      'data-kg-animation-vector-morph-to': 'star',
      'data-kg-animation-work-area': `0-${workAreaEnd}`,
      style: {
        '--kg-motion-active-frame': activeFrame,
        '--kg-motion-eased': easedProgress,
        '--kg-motion-frame-count': frameCount,
        '--kg-motion-frame-duration': `${frameDurationMs}ms`,
        '--kg-motion-frame-rate': frameRate,
        '--kg-motion-fbf-frame-rate': frameRate,
        '--kg-motion-item-count': itemCount,
        '--kg-motion-path-progress': vectorMorphAmount,
        '--kg-motion-opacity': objectFrame.opacity,
        '--kg-motion-progress': progress,
        '--kg-motion-radius': `${Math.round(4 + easedProgress * 8)}px`,
        '--kg-motion-rotation': `${Number(((easedProgress - 0.5) * 6).toFixed(3))}deg`,
        '--kg-motion-scale': objectFrame.scale,
        '--kg-motion-shadow-alpha': Number((0.14 + easedProgress * 0.22).toFixed(3)),
        '--kg-motion-stroke-trim': `${Math.round(easedProgress * 100)}%`,
        '--kg-motion-text-range-end': `${textRangeEnd}%`,
        '--kg-motion-timeline-frame-duration': `${timelineFrameDurationMs}ms`,
        '--kg-motion-timeline-frame-rate': timelineFrameRate,
        '--kg-motion-translate-x': `${objectFrame.translateX}px`,
        '--kg-motion-vector-morph': vectorMorphAmount,
        '--kg-motion-work-area-end': `${workAreaEnd * 100}%`,
      } as React.CSSProperties,
    },
    easedProgress,
    easing: {
      curve: easingMode === 'ease-in-out' ? 'cubic-bezier(0.42,0,0.58,1)' : easingMode,
      mode: easingMode,
    },
    clip: {
      batchMoveEnabled: itemCount > 1,
      draggable: true,
      trimEnabled: true,
    },
    frameByFrame: {
      activeFrame,
      frameCount,
      frameDurationMs,
      frameRate,
      onionSkinFrames: Math.min(2, Math.max(0, itemCount - 1)),
      timing: `${frameDurationMs}ms`,
    },
    keyframes,
    layerPanel: {
      contextMenu: 'unified',
      dragSort: true,
      grouping: 'smart',
      inlineRenameKey: 'F2',
      layerModes: [...TIMELINE_ANIMATION_LAYER_MODES],
    },
    loopModes: [...TIMELINE_ANIMATION_LOOP_MODES],
    modifiers: [...TIMELINE_ANIMATION_MODIFIERS],
    nested: {
      childTimelineFrame,
      compositeOrder: nestedCompositeOrder,
      enabled: true,
      fbfFrame: activeFrame,
      fbfFrameDurationMs: frameDurationMs,
      fbfFrameRate: frameRate,
      modes: [...TIMELINE_ANIMATION_NESTED_MODES],
      renderPasses: [...TIMELINE_ANIMATION_RENDER_PASSES],
      timelineFrameDurationMs,
      timelineFrameRate,
    },
    objectFrame,
    progress,
    propertyTokens,
    recording: {
      enabled: recordingEnabled,
      playhead: progress,
    },
    svg,
    targetTokens: TIMELINE_ANIMATION_TARGET_TOKEN,
    text: {
      color: textKeyframes[1]?.color || '#f8fafc',
      fontSize: textKeyframes[1]?.fontSize || 16,
      keyframes: textKeyframes,
      letterSpacing: textKeyframes[1]?.letterSpacing || 0,
      lineHeight: textKeyframes[1]?.lineHeight || 1.2,
      properties: [...TIMELINE_TEXT_ANIMATION_PROPERTIES],
      rangeEnd: textRangeEnd,
      rangeStart: 0,
      scopes: [...TIMELINE_TEXT_ANIMATION_SCOPES],
      tracking: Number((easedProgress * 0.08).toFixed(3)),
    },
    vectorMorph: {
      amount: vectorMorphAmount,
      booleanOperations: [...TIMELINE_VECTOR_BOOLEAN_OPERATIONS],
      fromShape: 'rectangle',
      interpolatedPath: vectorMorphPath.interpolatedPath,
      pathSample: vectorMorphPath.interpolatedPath,
      shapeFamilies: [...TIMELINE_VECTOR_MORPH_SHAPES],
      sourcePath: vectorMorphPath.sourcePath,
      targetPath: vectorMorphPath.targetPath,
      targetShape: 'star',
    },
    workArea: {
      end: workAreaEnd,
      start: 0,
    },
  }
}
