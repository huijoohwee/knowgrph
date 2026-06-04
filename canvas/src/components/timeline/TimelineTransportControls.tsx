import React from 'react'
import { ChevronDown, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TIMELINE_TRANSPORT_PLAYBACK_RATES,
  resolveTimelineTransportPlaybackRate,
  type TimelineTransportPlaybackRate,
} from './timelineTransport'
import './TimelineTransportControls.css'

export type TimelineTransportControlsProps = {
  ariaLabel: string
  currentLabel: string
  disabled?: boolean
  max: number
  min?: number
  playbackRate: TimelineTransportPlaybackRate
  playbackRates?: readonly TimelineTransportPlaybackRate[]
  playing: boolean
  rangeClassName?: string
  shellClassName?: string
  step: number
  value: number
  onPlaybackRateChange: (rate: TimelineTransportPlaybackRate) => void
  onTogglePlayback: () => void
  onValueChange: (value: number) => void
}

export function TimelineTransportControls(props: TimelineTransportControlsProps) {
  const {
    ariaLabel,
    currentLabel,
    disabled = false,
    max,
    min = 0,
    playbackRate,
    playbackRates = TIMELINE_TRANSPORT_PLAYBACK_RATES,
    playing,
    rangeClassName,
    shellClassName,
    step,
    value,
    onPlaybackRateChange,
    onTogglePlayback,
    onValueChange,
  } = props
  return (
    <section className={cn('timeline-transport-shell', shellClassName)} data-kg-timeline-transport="shared">
      <section className="timeline-player">
        <button
          type="button"
          className="play-control"
          aria-label={playing ? 'Pause playback' : 'Start playback'}
          title={playing ? 'Pause (Space)' : 'Play (Space)'}
          disabled={disabled}
          onClick={onTogglePlayback}
        >
          {playing ? <Pause className="h-4 w-4" strokeWidth={2} aria-hidden={true} /> : <Play className="h-4 w-4" strokeWidth={2} aria-hidden={true} />}
        </button>
        <section className="time">{currentLabel}</section>
        <section className="rate-control">
          <label className="sr-only" htmlFor="timeline-transport-playback-rate">
            Playback rate
          </label>
          <section className="ant-select ant-select-sm ant-select-single ant-select-show-arrow" style={{ width: 90 }}>
            <select
              id="timeline-transport-playback-rate"
              className="ant-select-selection-native"
              value={String(playbackRate)}
              disabled={disabled}
              onChange={event => {
                onPlaybackRateChange(resolveTimelineTransportPlaybackRate(event.target.value, playbackRate))
              }}
            >
              {playbackRates.map(rate => (
                <option key={rate} value={String(rate)}>
                  {rate.toFixed(1)}x
                </option>
              ))}
            </select>
            <section className="ant-select-selector">
              <span className="ant-select-selection-item" title={`${playbackRate.toFixed(1)}x`}>
                {playbackRate.toFixed(1)}x
              </span>
            </section>
            <span className="ant-select-arrow" unselectable="on" aria-hidden="true">
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
          </section>
        </section>
      </section>
      <section className={cn('timeline-player-range', rangeClassName)}>
        <input
          aria-label={ariaLabel}
          className="timeline-player-range-input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={event => onValueChange(Number(event.target.value || 0))}
        />
      </section>
    </section>
  )
}
