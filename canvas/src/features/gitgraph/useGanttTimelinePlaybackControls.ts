import React from 'react'
import { dispatchTimelineTransportPlaybackRequest } from '@/components/timeline/videoSequenceTimeline'
import { useGraphStore } from '@/hooks/useGraphStore'

const PLAYBACK_END_EPSILON = 0.001

export function resolveGanttTimelinePlaybackStartPosition(args: {
  playing: boolean
  positionMinutes: number
  maxMinutes: number
}): number {
  if (args.playing) return args.positionMinutes
  if (args.maxMinutes <= 0) return 0
  return args.positionMinutes >= args.maxMinutes - PLAYBACK_END_EPSILON ? 0 : args.positionMinutes
}

export function resolveGanttTimelineTransportRenderTimeMs(args: {
  playbackUnitsPerMs: number
  positionMinutes: number
}): number {
  const position = Number.isFinite(args.positionMinutes) ? Math.max(0, args.positionMinutes) : 0
  const unitsPerMs = Number(args.playbackUnitsPerMs)
  if (!Number.isFinite(unitsPerMs) || unitsPerMs <= 0) return position * 1000
  return position / unitsPerMs
}

export function useGanttTimelinePlaybackControls(args: {
  documentKey: string
  maxMinutes: number
  playbackRate: number
  playbackUnitsPerMs: number
  playing: boolean
  positionMinutes: number
  setTransportPlaybackPosition: (position: number) => void
  setTransportPlaying: (nextPlaying: boolean) => void
}) {
  const readCurrentTransportPlaybackState = React.useCallback(() => {
    const state = useGraphStore.getState()
    const storeDocumentKey = String(state.timelineTransportDocumentKey || '').trim()
    const storeOwnsDocument = storeDocumentKey === args.documentKey
    const storePosition = Number(state.timelineTransportPosition)
    return {
      playing: storeOwnsDocument ? state.timelineTransportPlaying === true : args.playing,
      positionMinutes: storeOwnsDocument && Number.isFinite(storePosition)
        ? Math.max(0, storePosition)
        : args.positionMinutes,
    }
  }, [args.documentKey, args.playing, args.positionMinutes])

  const requestTimelineTransportPlayback = React.useCallback((nextPlaying: boolean, positionMinutes = args.positionMinutes) => {
    dispatchTimelineTransportPlaybackRequest({
      documentKey: args.documentKey,
      playbackRate: args.playbackRate,
      playing: nextPlaying,
      position: positionMinutes,
      timeMs: resolveGanttTimelineTransportRenderTimeMs({
        playbackUnitsPerMs: args.playbackUnitsPerMs,
        positionMinutes,
      }),
    })
  }, [args.documentKey, args.playbackRate, args.playbackUnitsPerMs, args.positionMinutes])

  const handleTogglePlayback = React.useCallback(() => {
    const current = readCurrentTransportPlaybackState()
    const nextPlaying = !current.playing
    const nextPosition = resolveGanttTimelinePlaybackStartPosition({
      maxMinutes: args.maxMinutes,
      playing: current.playing,
      positionMinutes: current.positionMinutes,
    })
    if (nextPlaying && nextPosition !== current.positionMinutes) {
      args.setTransportPlaybackPosition(nextPosition)
    }
    args.setTransportPlaying(nextPlaying)
    requestTimelineTransportPlayback(nextPlaying, nextPosition)
  }, [
    args.maxMinutes,
    readCurrentTransportPlaybackState,
    args.setTransportPlaybackPosition,
    args.setTransportPlaying,
    requestTimelineTransportPlayback,
  ])

  const handlePlaybackEnd = React.useCallback(() => {
    args.setTransportPlaying(false)
  }, [args.setTransportPlaying])

  return {
    handlePlaybackEnd,
    handleTogglePlayback,
    requestTimelineTransportPlayback,
  }
}
