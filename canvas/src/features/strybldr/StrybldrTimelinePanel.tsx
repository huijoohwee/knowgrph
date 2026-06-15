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
import { TimelineTransportChrome } from '@/components/timeline/TimelineTransportControls'
import {
  TIMELINE_TRANSPORT_PLAYBACK_RATES,
  clampTimelineTransportValue,
  resolveTimelineTransportPlayheadPercent,
  splitTimelineTransportCurrentTotalLabel,
  type TimelineTransportPlaybackRate,
  useTimelineTransportPlayback,
} from '@/components/timeline/timelineTransport'

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
  const positionLabel = formatStoryboardTimelinePositionLabel(activeIndex, timelineItems.length)
  const { currentLabel, totalLabel } = React.useMemo(
    () => splitTimelineTransportCurrentTotalLabel(positionLabel),
    [positionLabel],
  )
  const playheadPercent = resolveTimelineTransportPlayheadPercent(position, Math.max(1, maxPosition))

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
    <TimelineTransportChrome
      ariaLabel="Strybldr storyboard timeline"
      chromeClassName="h-full min-h-0 p-1"
      currentLabel={currentLabel}
      disabled={timelineItems.length <= 1}
      max={maxPosition}
      playbackRate={playbackRate}
      playbackRates={TIMELINE_TRANSPORT_PLAYBACK_RATES}
      playing={playing}
      rootProps={{
        'aria-label': 'Strybldr timeline',
        'data-kg-strybldr-timeline-panel': '1',
        'data-kg-timeline-transport-playhead-percent': String(Math.round(playheadPercent)),
      } as React.HTMLAttributes<HTMLElement>}
      step={1}
      subtitleLabel={activeItem ? `${activeItem.laneLabel}: ${activeItem.title}` : 'No active card'}
      titleLabel="Strybldr timeline"
      totalLabel={totalLabel}
      value={position}
      onPlaybackRateChange={setPlaybackRate}
      onTogglePlayback={handleTogglePlayback}
      onValueChange={handleTimelineValueChange}
    />
  )
}
