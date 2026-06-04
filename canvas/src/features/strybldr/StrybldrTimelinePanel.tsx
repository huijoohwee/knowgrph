import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import {
  buildStoryboardTimelineItems,
  formatStoryboardTimelinePositionLabel,
  resolveStoryboardTimelineIndex,
} from '@/components/StoryboardCanvas/storyboardTimeline'
import { TimelineTransportControls } from '@/components/timeline/TimelineTransportControls'
import {
  TIMELINE_TRANSPORT_PLAYBACK_RATES,
  clampTimelineTransportValue,
  type TimelineTransportPlaybackRate,
  useTimelineTransportPlayback,
} from '@/components/timeline/timelineTransport'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

const STRYBLDR_TIMELINE_UNIT_MS = 1000

export function StrybldrTimelinePanel({ active = true }: { active?: boolean }) {
  const graphData = useActiveGraphRenderData(active)
  const { graphRevision, selectedNodeId, selectNode } = useGraphStore(
    useShallow(s => ({
      graphRevision: s.graphDataRevision || 0,
      selectedNodeId: String(s.selectedNodeId || '').trim(),
      selectNode: s.selectNode,
    })),
  )
  const board = React.useMemo(() => buildStoryboardBoardModel({ graphData, graphRevision }), [graphData, graphRevision])
  const timelineItems = React.useMemo(() => buildStoryboardTimelineItems(board), [board])
  const [position, setPosition] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const [playbackRate, setPlaybackRate] = React.useState<TimelineTransportPlaybackRate>(1)
  const maxPosition = Math.max(0, timelineItems.length - 1)
  const activeIndex = resolveStoryboardTimelineIndex(position, timelineItems.length)
  const activeItem = activeIndex >= 0 ? timelineItems[activeIndex] || null : null
  const currentLabel = formatStoryboardTimelinePositionLabel(activeIndex, timelineItems.length)

  React.useEffect(() => {
    setPosition(current => clampTimelineTransportValue(current, 0, maxPosition))
    if (timelineItems.length <= 1) setPlaying(false)
  }, [board.semanticKey, maxPosition, timelineItems.length])

  React.useEffect(() => {
    if (!selectedNodeId) return
    const selectedIndex = timelineItems.findIndex(item => item.id === selectedNodeId)
    if (selectedIndex < 0) return
    setPosition(current => (Math.abs(current - selectedIndex) < 0.001 ? current : selectedIndex))
  }, [selectedNodeId, timelineItems])

  React.useEffect(() => {
    if (!activeItem || selectedNodeId === activeItem.id) return
    selectNode(activeItem.id)
  }, [activeItem, selectNode, selectedNodeId])

  useTimelineTransportPlayback({
    active,
    playing,
    position,
    max: maxPosition,
    playbackRate,
    unitsPerMs: 1 / STRYBLDR_TIMELINE_UNIT_MS,
    onPositionChange: setPosition,
    onPlaybackEnd: () => setPlaying(false),
  })

  const handleTogglePlayback = React.useCallback(() => {
    if (timelineItems.length <= 1) return
    if (position >= maxPosition) setPosition(0)
    setPlaying(current => !current)
  }, [maxPosition, position, timelineItems.length])

  const handleTimelineValueChange = React.useCallback(
    (nextValue: number) => {
      const nextPosition = clampTimelineTransportValue(Math.round(nextValue), 0, maxPosition)
      setPlaying(false)
      setPosition(nextPosition)
      const nextItem = timelineItems[resolveStoryboardTimelineIndex(nextPosition, timelineItems.length)] || null
      if (nextItem) selectNode(nextItem.id)
    },
    [maxPosition, selectNode, timelineItems],
  )

  if (timelineItems.length === 0) return null

  return (
    <section
      className="flex h-full min-h-0 w-full flex-col gap-2 p-1"
      aria-label="Strybldr timeline"
      data-kg-strybldr-timeline-panel="1"
    >
      <section className="flex min-w-0 items-center justify-between gap-3 px-1">
        <section className={cn('min-w-0 truncate text-xs font-semibold', UI_THEME_TOKENS.text.primary)}>
          Strybldr timeline
        </section>
        <section className={cn('min-w-0 truncate text-[11px]', UI_THEME_TOKENS.text.secondary)} title={activeItem?.title || ''}>
          {activeItem ? `${activeItem.laneLabel}: ${activeItem.title}` : 'No active card'}
        </section>
      </section>
      <TimelineTransportControls
        ariaLabel="Strybldr storyboard timeline"
        currentLabel={currentLabel}
        disabled={timelineItems.length <= 1}
        max={maxPosition}
        playbackRate={playbackRate}
        playbackRates={TIMELINE_TRANSPORT_PLAYBACK_RATES}
        playing={playing}
        rangeClassName="mt-2"
        step={1}
        value={position}
        onPlaybackRateChange={setPlaybackRate}
        onTogglePlayback={handleTogglePlayback}
        onValueChange={handleTimelineValueChange}
      />
    </section>
  )
}
