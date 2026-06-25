import React from 'react'
import { type TimelineTransportPlaybackRate } from '@/components/timeline/timelineTransport'

export type GanttTimelineTransportShellModel = {
  ariaLabel: string
  chromeClassName: string
  currentLabel: string
  disabled: boolean
  max: number
  min: number
  playbackRate: TimelineTransportPlaybackRate
  playing: boolean
  rootProps: React.HTMLAttributes<HTMLElement>
  shellClassName: string
  showInlineProgress: boolean
  showRange: boolean
  step: number
  onPlaybackPointerDown?: () => void
  onTogglePlayback: () => void
  onValueChange: (value: number) => void
  onPlaybackRateChange: (rate: TimelineTransportPlaybackRate) => void
}

export function useGanttTimelineTransportShellModel(args: {
  currentLabel: string
  disabled: boolean
  maxMinutes: number
  playbackRate: TimelineTransportPlaybackRate
  playing: boolean
  onPlaybackPointerDown?: () => void
  onTogglePlayback: () => void
  onValueChange: (value: number) => void
  onPlaybackRateChange: (rate: TimelineTransportPlaybackRate) => void
}): GanttTimelineTransportShellModel {
  return React.useMemo(() => ({
    ariaLabel: 'Scrub Gantt-timeline position',
    chromeClassName: 'timeline-transport-chrome--mermaid-gantt p-2',
    currentLabel: args.currentLabel,
    disabled: args.disabled,
    max: Math.max(1, args.maxMinutes),
    min: 0,
    onPlaybackPointerDown: args.onPlaybackPointerDown,
    onPlaybackRateChange: args.onPlaybackRateChange,
    onTogglePlayback: args.onTogglePlayback,
    onValueChange: args.onValueChange,
    playbackRate: args.playbackRate,
    playing: args.playing,
    rootProps: {
      'aria-label': 'Gantt-Timeline transport',
      'data-kg-gantt-timeline-transport': 'bottomPanel',
      'data-kg-video-sequence-timeline': 'source-backed',
    } as React.HTMLAttributes<HTMLElement>,
    shellClassName: 'timeline-transport-shell--video-sequence',
    showInlineProgress: false,
    showRange: false,
    step: 1,
  }), [
    args.currentLabel,
    args.disabled,
    args.maxMinutes,
    args.onPlaybackPointerDown,
    args.onPlaybackRateChange,
    args.onTogglePlayback,
    args.onValueChange,
    args.playbackRate,
    args.playing,
  ])
}
