import React from 'react'
import { dispatchTimelineTransportPlaybackRequest } from '@/components/timeline/videoSequenceTimeline'

export function useGanttTimelinePlaybackControls(args: {
  documentKey: string
  playbackRate: number
  playing: boolean
  positionMinutes: number
  setTransportPlaying: (nextPlaying: boolean) => void
}) {
  const requestTimelineTransportPlayback = React.useCallback((nextPlaying: boolean) => {
    dispatchTimelineTransportPlaybackRequest({
      documentKey: args.documentKey,
      playbackRate: args.playbackRate,
      playing: nextPlaying,
      position: args.positionMinutes,
    })
  }, [args.documentKey, args.playbackRate, args.positionMinutes])

  const handlePlaybackPointerDown = React.useCallback(() => {
    requestTimelineTransportPlayback(!args.playing)
  }, [args.playing, requestTimelineTransportPlayback])

  const handleTogglePlayback = React.useCallback(() => {
    const nextPlaying = !args.playing
    args.setTransportPlaying(nextPlaying)
    requestTimelineTransportPlayback(nextPlaying)
  }, [args.playing, args.setTransportPlaying, requestTimelineTransportPlayback])

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
