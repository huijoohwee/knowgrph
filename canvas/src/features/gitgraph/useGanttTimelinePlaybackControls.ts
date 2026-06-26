import React from 'react'
import { dispatchTimelineTransportPlaybackRequest } from '@/components/timeline/videoSequenceTimeline'

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

export function useGanttTimelinePlaybackControls(args: {
  documentKey: string
  maxMinutes: number
  playbackRate: number
  playing: boolean
  positionMinutes: number
  setTransportPlaybackPosition: (position: number) => void
  setTransportPlaying: (nextPlaying: boolean) => void
}) {
  const requestTimelineTransportPlayback = React.useCallback((nextPlaying: boolean, positionMinutes = args.positionMinutes) => {
    dispatchTimelineTransportPlaybackRequest({
      documentKey: args.documentKey,
      playbackRate: args.playbackRate,
      playing: nextPlaying,
      position: positionMinutes,
    })
  }, [args.documentKey, args.playbackRate, args.positionMinutes])

  const handlePlaybackPointerDown = React.useCallback(() => {
    const nextPlaying = !args.playing
    const nextPosition = resolveGanttTimelinePlaybackStartPosition({
      maxMinutes: args.maxMinutes,
      playing: args.playing,
      positionMinutes: args.positionMinutes,
    })
    if (nextPlaying && nextPosition !== args.positionMinutes) {
      args.setTransportPlaybackPosition(nextPosition)
    }
    requestTimelineTransportPlayback(nextPlaying, nextPosition)
  }, [args.maxMinutes, args.playing, args.positionMinutes, args.setTransportPlaybackPosition, requestTimelineTransportPlayback])

  const handleTogglePlayback = React.useCallback(() => {
    const nextPlaying = !args.playing
    const nextPosition = resolveGanttTimelinePlaybackStartPosition({
      maxMinutes: args.maxMinutes,
      playing: args.playing,
      positionMinutes: args.positionMinutes,
    })
    if (nextPlaying && nextPosition !== args.positionMinutes) {
      args.setTransportPlaybackPosition(nextPosition)
    }
    args.setTransportPlaying(nextPlaying)
    requestTimelineTransportPlayback(nextPlaying, nextPosition)
  }, [
    args.maxMinutes,
    args.playing,
    args.positionMinutes,
    args.setTransportPlaybackPosition,
    args.setTransportPlaying,
    requestTimelineTransportPlayback,
  ])

  const handlePlaybackEnd = React.useCallback(() => {
    args.setTransportPlaying(false)
  }, [args.setTransportPlaying])

  return {
    handlePlaybackEnd,
    handlePlaybackPointerDown,
    handleTogglePlayback,
    requestTimelineTransportPlayback,
  }
}
