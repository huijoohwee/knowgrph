import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { TimelineTransportControls } from '@/components/timeline/TimelineTransportControls'
import {
  clampTimelineTransportValue,
  useTimelineTransportPlayback,
  type TimelineTransportPlaybackRate,
} from '@/components/timeline/timelineTransport'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  buildMermaidGanttTimelineModel,
  buildMermaidGanttTimelineTicks,
  formatMermaidGanttTimelineOffset,
  resolveMermaidGanttTimelineRowKeyAtPosition,
} from '@/lib/mermaid/mermaidGanttBarInteraction'

export function GanttTimelineTransportPanel({
  code,
  compact,
}: {
  code: string
  compact: boolean
}) {
  const [positionMinutes, setPositionMinutes] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const [playbackRate, setPlaybackRate] = React.useState<TimelineTransportPlaybackRate>(1)
  const { selectedRowKey, setMermaidDiagramSelectedRowKey } = useGraphStore(
    useShallow(state => ({
      selectedRowKey: state.mermaidDiagramSelectedRowKeyByKind.gantt || '',
      setMermaidDiagramSelectedRowKey: state.setMermaidDiagramSelectedRowKey,
    })),
  )
  const timelineModel = React.useMemo(() => buildMermaidGanttTimelineModel(code), [code])
  const ticks = React.useMemo(() => buildMermaidGanttTimelineTicks(timelineModel), [timelineModel])
  const maxMinutes = Math.max(0, timelineModel.durationMinutes)
  const disabled = !code || maxMinutes <= 0
  const currentLabel = `${formatMermaidGanttTimelineOffset(positionMinutes)} / ${formatMermaidGanttTimelineOffset(maxMinutes)}`

  React.useEffect(() => {
    if (maxMinutes <= 0) {
      setPlaying(false)
      setPositionMinutes(0)
      return
    }
    setPositionMinutes(value => clampTimelineTransportValue(value, 0, maxMinutes))
  }, [maxMinutes])

  React.useEffect(() => {
    if (!selectedRowKey || playing) return
    const selectedSpan = timelineModel.taskSpans.find(span => span.rowKey === selectedRowKey)
    if (!selectedSpan) return
    setPositionMinutes(clampTimelineTransportValue(selectedSpan.startMinutes, 0, maxMinutes))
  }, [maxMinutes, playing, selectedRowKey, timelineModel.taskSpans])

  const handlePositionChange = React.useCallback((value: number) => {
    const nextPosition = clampTimelineTransportValue(value, 0, maxMinutes)
    setPositionMinutes(nextPosition)
    const rowKey = resolveMermaidGanttTimelineRowKeyAtPosition(timelineModel, nextPosition)
    if (rowKey && rowKey !== selectedRowKey) {
      setMermaidDiagramSelectedRowKey('gantt', rowKey)
    }
  }, [maxMinutes, selectedRowKey, setMermaidDiagramSelectedRowKey, timelineModel])

  const handlePlaybackEnd = React.useCallback(() => {
    setPlaying(false)
  }, [])

  useTimelineTransportPlayback({
    active: !disabled,
    playing,
    position: positionMinutes,
    max: maxMinutes,
    playbackRate,
    unitsPerMs: 1 / 1000,
    onPositionChange: handlePositionChange,
    onPlaybackEnd: handlePlaybackEnd,
  })

  return (
    <section
      className="flex h-full min-h-0 flex-col gap-2 p-2"
      aria-label="Gantt-Timeline transport"
      data-kg-gantt-timeline-transport="bottomPanel"
    >
      <header className="flex min-w-0 items-center justify-between gap-2 px-1">
        <section className="min-w-0">
          <section className="truncate text-xs font-semibold text-[var(--kg-text-primary)]">Gantt-Timeline</section>
          <section className="truncate text-[11px] text-[var(--kg-text-secondary)]">{timelineModel.taskSpans.length} timeline rows</section>
        </section>
      </header>
      <TimelineTransportControls
        ariaLabel="Scrub Gantt-timeline position"
        currentLabel={currentLabel}
        disabled={disabled}
        max={Math.max(1, maxMinutes)}
        min={0}
        playbackRate={playbackRate}
        playing={playing}
        step={1}
        value={clampTimelineTransportValue(positionMinutes, 0, Math.max(1, maxMinutes))}
        onPlaybackRateChange={setPlaybackRate}
        onTogglePlayback={() => setPlaying(value => !value)}
        onValueChange={handlePositionChange}
      />
      <section
        className={[
          'relative border-t border-[var(--kg-border)] text-[10px] text-[var(--kg-text-tertiary)]',
          compact ? 'h-6' : 'h-8',
        ].join(' ')}
        data-kg-gantt-timeline-ruler="bottomPanel"
      >
        {ticks.map(tick => (
          <span
            key={`${tick.minutes}:${tick.label}`}
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1 whitespace-nowrap font-mono"
            style={{ left: `${tick.percent}%` }}
            data-kg-gantt-timeline-tick="1"
          >
            <span className="h-2 border-l border-[var(--kg-border-strong)]" />
            <span>{tick.label}</span>
          </span>
        ))}
      </section>
    </section>
  )
}
