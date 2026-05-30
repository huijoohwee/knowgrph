import React from 'react'

export const TIMELINE_TRANSPORT_PLAYBACK_RATES = [0.5, 1, 1.5, 2] as const

export type TimelineTransportPlaybackRate = (typeof TIMELINE_TRANSPORT_PLAYBACK_RATES)[number]

export function clampTimelineTransportValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function resolveTimelineTransportPlaybackRate(
  value: unknown,
  fallback: TimelineTransportPlaybackRate,
): TimelineTransportPlaybackRate {
  const parsed = Number(value)
  return TIMELINE_TRANSPORT_PLAYBACK_RATES.includes(parsed as TimelineTransportPlaybackRate)
    ? (parsed as TimelineTransportPlaybackRate)
    : fallback
}

export function resolveTimelineTransportUnitsPerMs(args: {
  usesAbsoluteTiming: boolean
  ordinalUnitMs: number
}): number {
  if (args.usesAbsoluteTiming) return 1
  const safeUnitMs = Number.isFinite(args.ordinalUnitMs) && args.ordinalUnitMs > 0 ? args.ordinalUnitMs : 1000
  return 1 / safeUnitMs
}

export function useTimelineTransportPlayback(args: {
  active: boolean
  playing: boolean
  position: number
  max: number
  playbackRate: number
  unitsPerMs: number
  onPositionChange: (position: number) => void
  onPlaybackEnd: () => void
}) {
  const stateRef = React.useRef({
    position: args.position,
    max: args.max,
    playbackRate: args.playbackRate,
    unitsPerMs: args.unitsPerMs,
    onPositionChange: args.onPositionChange,
    onPlaybackEnd: args.onPlaybackEnd,
  })

  React.useEffect(() => {
    stateRef.current = {
      position: args.position,
      max: args.max,
      playbackRate: args.playbackRate,
      unitsPerMs: args.unitsPerMs,
      onPositionChange: args.onPositionChange,
      onPlaybackEnd: args.onPlaybackEnd,
    }
  }, [args.max, args.onPlaybackEnd, args.onPositionChange, args.playbackRate, args.position, args.unitsPerMs])

  React.useEffect(() => {
    if (!args.active || !args.playing || args.max <= 0 || args.unitsPerMs <= 0) return
    if (typeof window === 'undefined') return
    let frameId = 0
    let previousTimestamp = 0
    const tick = (timestamp: number) => {
      const current = stateRef.current
      if (previousTimestamp === 0) previousTimestamp = timestamp
      const elapsedMs = Math.max(0, timestamp - previousTimestamp)
      previousTimestamp = timestamp
      const nextPosition = clampTimelineTransportValue(
        current.position + elapsedMs * current.unitsPerMs * current.playbackRate,
        0,
        current.max,
      )
      stateRef.current.position = nextPosition
      current.onPositionChange(nextPosition)
      if (nextPosition >= current.max) {
        current.onPlaybackEnd()
        return
      }
      frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [args.active, args.max, args.playing, args.unitsPerMs])
}
