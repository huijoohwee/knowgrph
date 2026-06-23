import React from 'react'
import { ChevronsLeft, ChevronsRight, MoveHorizontal, Scissors, StepBack, StepForward } from 'lucide-react'
import { formatVideoSequenceTimelineSecondsOffset } from './videoSequenceTimeline'
import './VideoSequenceClipEditPanel.css'

export type VideoSequenceClipEditAction =
  | 'nudge-back'
  | 'nudge-forward'
  | 'trim-start-back'
  | 'trim-start-forward'
  | 'trim-end-back'
  | 'trim-end-forward'
  | 'snap-to-playhead'
  | 'split-at-playhead'

export type VideoSequenceClipEditSpan = {
  durationMinutes: number
  endMinutes: number
  label: string
  startMinutes: number
}

type VideoSequenceClipEditButton = {
  action: VideoSequenceClipEditAction
  disabled: boolean
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  label: string
  title: string
}

function formatClipEditTime(minutes: number, mediaDurationSeconds: number, maxMinutes: number): string {
  if (mediaDurationSeconds > 0 && maxMinutes > 0) {
    return formatVideoSequenceTimelineSecondsOffset((minutes / maxMinutes) * mediaDurationSeconds)
  }
  return `${Math.max(0, Math.round(minutes))}m`
}

export function VideoSequenceClipEditPanel({
  disabled,
  maxMinutes,
  mediaDurationSeconds,
  playheadMinutes,
  selectedSpan,
  onAction,
}: {
  disabled: boolean
  maxMinutes: number
  mediaDurationSeconds: number
  playheadMinutes: number
  selectedSpan: VideoSequenceClipEditSpan | null
  onAction: (action: VideoSequenceClipEditAction) => void
}) {
  const hasSelection = Boolean(selectedSpan)
  const durationMinutes = selectedSpan?.durationMinutes || 0
  const playheadInsideSelection = Boolean(
    selectedSpan &&
      playheadMinutes > selectedSpan.startMinutes &&
      playheadMinutes < selectedSpan.endMinutes,
  )
  const roundedPlayheadDelta = selectedSpan ? Math.round(playheadMinutes - selectedSpan.startMinutes) : 0
  const controlsDisabled = disabled || !selectedSpan
  const buttons: readonly VideoSequenceClipEditButton[] = [
    {
      action: 'nudge-back',
      disabled: controlsDisabled || (selectedSpan?.startMinutes || 0) <= 0,
      icon: ChevronsLeft,
      label: '-1',
      title: 'Move selected clip left by one tick',
    },
    {
      action: 'nudge-forward',
      disabled: controlsDisabled,
      icon: ChevronsRight,
      label: '+1',
      title: 'Move selected clip right by one tick',
    },
    {
      action: 'trim-start-back',
      disabled: controlsDisabled || (selectedSpan?.startMinutes || 0) <= 0,
      icon: StepBack,
      label: 'In -1',
      title: 'Extend selected clip start left by one tick',
    },
    {
      action: 'trim-start-forward',
      disabled: controlsDisabled || durationMinutes <= 1,
      icon: StepForward,
      label: 'In +1',
      title: 'Trim selected clip start right by one tick',
    },
    {
      action: 'trim-end-back',
      disabled: controlsDisabled || durationMinutes <= 1,
      icon: StepBack,
      label: 'Out -1',
      title: 'Trim selected clip end left by one tick',
    },
    {
      action: 'trim-end-forward',
      disabled: controlsDisabled,
      icon: StepForward,
      label: 'Out +1',
      title: 'Extend selected clip end right by one tick',
    },
    {
      action: 'snap-to-playhead',
      disabled: controlsDisabled || roundedPlayheadDelta === 0,
      icon: MoveHorizontal,
      label: 'Snap',
      title: 'Move selected clip start to the playhead',
    },
    {
      action: 'split-at-playhead',
      disabled: controlsDisabled || !playheadInsideSelection,
      icon: Scissors,
      label: 'Split',
      title: 'Split selected clip group at the playhead',
    },
  ]

  return (
    <section
      className="timeline-video-sequence-clip-edit"
      aria-label="Selected clip edit controls"
      data-kg-video-sequence-clip-edit-surface="transport"
    >
      <section className="timeline-video-sequence-clip-edit-meta" aria-label="Selected clip timing">
        <section className="timeline-video-sequence-clip-edit-title" aria-label="Selected clip">
          <MoveHorizontal className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden={true} />
          <span>{selectedSpan?.label || 'Select clip'}</span>
        </section>
        <section className="timeline-video-sequence-clip-edit-timecode">
          {hasSelection ? (
            <>
              <time>{formatClipEditTime(selectedSpan.startMinutes, mediaDurationSeconds, maxMinutes)}</time>
              <span aria-hidden="true">/</span>
              <time>{formatClipEditTime(selectedSpan.endMinutes, mediaDurationSeconds, maxMinutes)}</time>
              <span aria-hidden="true">/</span>
              <time>{formatClipEditTime(selectedSpan.durationMinutes, mediaDurationSeconds, maxMinutes)}</time>
            </>
          ) : (
            <span>No clip selected</span>
          )}
        </section>
      </section>
      <nav className="timeline-video-sequence-clip-edit-actions" aria-label="Clip nudge, trim, split, and snap tools">
        {buttons.map(button => {
          const Icon = button.icon
          return (
            <button
              key={button.action}
              type="button"
              aria-label={button.title}
              title={button.title}
              disabled={button.disabled}
              data-kg-video-sequence-clip-edit={button.action}
              onClick={() => onAction(button.action)}
            >
              <Icon className="h-3 w-3" strokeWidth={2} aria-hidden={true} />
              <span>{button.label}</span>
            </button>
          )
        })}
      </nav>
    </section>
  )
}
