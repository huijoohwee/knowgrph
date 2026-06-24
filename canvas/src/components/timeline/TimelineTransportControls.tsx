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
  contextControls?: React.ReactNode
  currentLabel: string
  disabled?: boolean
  max: number
  min?: number
  playbackRate: TimelineTransportPlaybackRate
  playbackRates?: readonly TimelineTransportPlaybackRate[]
  playing: boolean
  rangeClassName?: string
  shellClassName?: string
  showInlineProgress?: boolean
  showRange?: boolean
  step: number
  totalLabel?: string
  value: number
  onPlaybackRateChange: (rate: TimelineTransportPlaybackRate) => void
  onPlaybackPointerDown?: () => void
  onTogglePlayback: () => void
  onValueChange: (value: number) => void
}

export type TimelineTransportChromeProps = TimelineTransportControlsProps & {
  chromeClassName?: string
  headerAside?: React.ReactNode
  rootProps?: Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'className'>
  ruler?: React.ReactNode
  rulerClassName?: string
  rulerProps?: Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'className'>
  subtitleLabel?: React.ReactNode
  titleLabel?: React.ReactNode
}

export function TimelineTransportControls(props: TimelineTransportControlsProps) {
  const {
    ariaLabel,
    contextControls,
    currentLabel,
    disabled = false,
    max,
    min = 0,
    playbackRate,
    playbackRates = TIMELINE_TRANSPORT_PLAYBACK_RATES,
    playing,
    rangeClassName,
    shellClassName,
    showInlineProgress = true,
    showRange = true,
    step,
    totalLabel,
    value,
    onPlaybackRateChange,
    onPlaybackPointerDown,
    onTogglePlayback,
    onValueChange,
  } = props
  const playbackRateSelectId = React.useId()
  const progressPercent = React.useMemo(() => {
    const span = Math.max(0, max - min)
    if (span <= 0) return 0
    const clampedValue = Math.min(max, Math.max(min, value))
    return ((clampedValue - min) / span) * 100
  }, [max, min, value])
  return (
    <section
      className={cn('timeline-transport-shell', shellClassName)}
      data-kg-timeline-transport="shared"
      style={{ '--kg-timeline-progress': `${progressPercent}%` } as React.CSSProperties}
    >
      <section className="timeline-player">
        <button
          type="button"
          className="play-control"
          aria-label={playing ? 'Pause playback' : 'Start playback'}
          title={playing ? 'Pause (Space)' : 'Play (Space)'}
          disabled={disabled}
          onPointerDown={onPlaybackPointerDown}
          onClick={onTogglePlayback}
        >
          {playing ? <Pause className="h-4 w-4" strokeWidth={2} aria-hidden={true} /> : <Play className="h-4 w-4" strokeWidth={2} aria-hidden={true} />}
        </button>
        <section className="time timeline-timecode" aria-live="polite">
          <time className="timeline-timecode-current">{currentLabel}</time>
          {totalLabel ? (
            <>
              <span className="timeline-timecode-divider" aria-hidden="true">
                /
              </span>
              <time className="timeline-timecode-total">{totalLabel}</time>
            </>
          ) : null}
        </section>
        {!showRange && showInlineProgress ? (
          <progress
            aria-label="Timeline playback progress"
            className="timeline-player-progress"
            data-kg-timeline-player-progress="inline"
            max={100}
            value={progressPercent}
          />
        ) : null}
        <section className="rate-control">
          <label className="sr-only" htmlFor={playbackRateSelectId}>
            Playback rate
          </label>
          <section className="timeline-rate-select ant-select ant-select-sm ant-select-single ant-select-show-arrow">
            <select
              id={playbackRateSelectId}
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
        {contextControls ? (
          <section className="timeline-player-context" aria-label="Timeline contextual controls">
            {contextControls}
          </section>
        ) : null}
      </section>
      {showRange ? (
        <section className={cn('timeline-player-range', rangeClassName)}>
          <section className="timeline-player-range-rail" aria-hidden="true"></section>
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
      ) : null}
    </section>
  )
}

export function TimelineTransportChrome(props: TimelineTransportChromeProps) {
  const {
    chromeClassName,
    headerAside,
    rootProps,
    ruler,
    rulerClassName,
    rulerProps,
    subtitleLabel,
    titleLabel,
    ...transportProps
  } = props
  const rootClassName = cn('timeline-transport-chrome', chromeClassName)
  const rulerRootClassName = cn('timeline-transport-ruler', rulerClassName)
  return (
    <section
      {...rootProps}
      className={rootClassName}
      data-kg-timeline-transport-chrome="shared"
    >
      {titleLabel || subtitleLabel || headerAside ? (
        <header className="timeline-transport-chrome-header">
          <section className="timeline-transport-chrome-title-block">
            {titleLabel ? <section className="timeline-transport-chrome-title">{titleLabel}</section> : null}
            {subtitleLabel ? <section className="timeline-transport-chrome-subtitle">{subtitleLabel}</section> : null}
          </section>
          {headerAside ? <section className="timeline-transport-chrome-header-aside">{headerAside}</section> : null}
        </header>
      ) : null}
      <TimelineTransportControls {...transportProps} />
      {ruler ? (
        <section className="timeline-transport-ruler-layout" data-kg-timeline-transport-ruler-layout="shared">
          <section
            {...rulerProps}
            className={rulerRootClassName}
          >
            {ruler}
          </section>
        </section>
      ) : null}
    </section>
  )
}
