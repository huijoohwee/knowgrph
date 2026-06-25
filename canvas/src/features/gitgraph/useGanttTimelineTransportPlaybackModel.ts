import { useTimelineTransportPlayback } from '@/components/timeline/timelineTransport'
import { useGanttTimelinePlaybackControls } from './useGanttTimelinePlaybackControls'

export type GanttTimelineTransportPlaybackModel = {
  handlePlaybackPointerDown: () => void
  handleTogglePlayback: () => void
}

export function useGanttTimelineTransportPlaybackModel(args: {
  disabled: boolean
  documentKey: string
  maxMinutes: number
  playbackRate: number
  playbackUnitsPerMs: number
  playing: boolean
  positionMinutes: number
  setTransportPlaying: (nextPlaying: boolean) => void
  onPositionChange: (position: number) => void
}): GanttTimelineTransportPlaybackModel {
  const playbackControls = useGanttTimelinePlaybackControls({
    documentKey: args.documentKey,
    playbackRate: args.playbackRate,
    playing: args.playing,
    positionMinutes: args.positionMinutes,
    setTransportPlaying: args.setTransportPlaying,
  })

  useTimelineTransportPlayback({
    active: !args.disabled,
    max: args.maxMinutes,
    onPlaybackEnd: playbackControls.handlePlaybackEnd,
    onPositionChange: args.onPositionChange,
    playbackRate: args.playbackRate,
    playing: args.playing,
    position: args.positionMinutes,
    unitsPerMs: args.playbackUnitsPerMs,
  })

  return {
    handlePlaybackPointerDown: playbackControls.handlePlaybackPointerDown,
    handleTogglePlayback: playbackControls.handleTogglePlayback,
  }
}
