import type { MermaidGanttTimelineTick } from '@/lib/mermaid/mermaidGanttBarInteraction'

export type VideoSequenceTimelineRulerTicksProps = {
  displayTicks: readonly MermaidGanttTimelineTick[]
}

function formatVideoSequenceTimeAxisLabel(label: string): string {
  const match = String(label || '').trim().match(/^(\d+):(\d{2})$/)
  if (!match) return label
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

function resolveVideoSequenceTickDateTime(tick: MermaidGanttTimelineTick): string {
  const match = String(tick.label || '').trim().match(/^(\d+):(\d{2})$/)
  if (match) return `PT${Math.max(0, Number(match[1]) * 60 + Number(match[2]))}S`
  return `PT${Math.max(0, Math.round(tick.minutes * 60))}S`
}

function resolveVideoSequenceTickMajor(tick: MermaidGanttTimelineTick): boolean {
  const match = String(tick.label || '').trim().match(/^(\d+):(\d{2})$/)
  if (/^\d+f$/i.test(String(tick.label || '').trim())) return true
  if (!match) return tick.percent <= 0 || tick.percent >= 100
  const seconds = Math.max(0, Number(match[1]) * 60 + Number(match[2]))
  return seconds % 10 === 0 || tick.percent <= 0 || tick.percent >= 100
}

export function VideoSequenceTimelineRulerTicks({ displayTicks }: VideoSequenceTimelineRulerTicksProps) {
  return (
    <>
      {displayTicks.map(tick => (
        <span
          key={`${tick.minutes}:${tick.label}`}
          className="timeline-transport-ruler-tick"
          style={{ left: `clamp(14px, ${tick.percent}%, calc(100% - 14px))` }}
          data-kg-gantt-timeline-tick="1"
          data-kg-video-sequence-major-tick={resolveVideoSequenceTickMajor(tick) ? '1' : undefined}
        >
          <span className="timeline-transport-ruler-tick-line" aria-hidden="true" />
          <time className="timeline-transport-ruler-tick-label" dateTime={resolveVideoSequenceTickDateTime(tick)}>
            {formatVideoSequenceTimeAxisLabel(tick.label)}
          </time>
        </span>
      ))}
    </>
  )
}
