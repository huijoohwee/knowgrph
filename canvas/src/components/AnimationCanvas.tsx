import React from 'react'
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  buildAnimationTimelineModel,
  findAnimationTimelineBeatIndexAtPosition,
  formatAnimationTimelineTimestamp,
  type AnimationTimelineLaneId,
} from '@/components/AnimationCanvas/animationTimeline'

const ORDINAL_PLAYBACK_BEAT_MS = 1000
const HEADER_HEIGHT_PX = 88
const LANE_ROW_HEIGHT_PX = 112

const LANE_ACCENT_CLASS: Record<AnimationTimelineLaneId, string> = {
  clip: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100',
  overlay: 'border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100',
  audio: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
  scene: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
  node: 'border-slate-500/40 bg-slate-500/10 text-slate-100',
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export default function AnimationCanvas({
  active = true,
}: {
  active?: boolean
}) {
  const graphData = useActiveGraphRenderData(active)
  const markdownText = useGraphStore(s => s.markdownDocumentText || '')
  const timelineModel = React.useMemo(
    () =>
      buildAnimationTimelineModel({
        graphData,
        markdownText,
      }),
    [graphData, markdownText],
  )
  const [playbackPosition, setPlaybackPosition] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const [runtimeAutoScrollEnabled, setRuntimeAutoScrollEnabled] = React.useState(true)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (timelineModel.totalSpan <= 0) {
      setPlaybackPosition(0)
      setPlaying(false)
      return
    }
    setPlaybackPosition(current => clamp(current, 0, timelineModel.totalSpan))
  }, [timelineModel.totalSpan])

  React.useEffect(() => {
    if (!active || !playing || timelineModel.totalSpan <= 0) return
    let frameId = 0
    let startTimestamp = 0
    let startPosition = playbackPosition
    const unitsPerMs = timelineModel.usesAbsoluteTiming ? 1 : 1 / ORDINAL_PLAYBACK_BEAT_MS
    const tick = (timestamp: number) => {
      if (startTimestamp === 0) startTimestamp = timestamp
      const elapsedMs = timestamp - startTimestamp
      const nextPosition = clamp(startPosition + elapsedMs * unitsPerMs, 0, timelineModel.totalSpan)
      setPlaybackPosition(nextPosition)
      if (nextPosition >= timelineModel.totalSpan) {
        setPlaying(false)
        return
      }
      frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frameId)
      startTimestamp = 0
      startPosition = 0
    }
  }, [active, playbackPosition, playing, timelineModel.totalSpan, timelineModel.usesAbsoluteTiming])

  const activeBeatIndex = React.useMemo(
    () => findAnimationTimelineBeatIndexAtPosition(timelineModel, playbackPosition),
    [timelineModel, playbackPosition],
  )

  const beatWidths = React.useMemo(() => {
    if (timelineModel.beats.length === 0) return [] as number[]
    if (!timelineModel.usesAbsoluteTiming || !timelineModel.totalDurationMs) {
      return timelineModel.beats.map(() => 220)
    }
    const targetWidth = Math.max(960, timelineModel.beats.length * 220)
    return timelineModel.beats.map(beat => {
      const duration = Math.max(1, beat.durationMs ?? beat.displayEnd - beat.displayStart)
      const proportionalWidth = (duration / timelineModel.totalDurationMs) * targetWidth
      return Math.max(180, Math.round(proportionalWidth))
    })
  }, [timelineModel])

  const beatOffsets = React.useMemo(() => {
    let currentOffset = 0
    return beatWidths.map(width => {
      const offset = currentOffset
      currentOffset += width
      return offset
    })
  }, [beatWidths])

  const totalTimelineWidth = React.useMemo(() => beatWidths.reduce((sum, width) => sum + width, 0), [beatWidths])

  const playheadOffsetPx = React.useMemo(() => {
    if (timelineModel.beats.length === 0 || totalTimelineWidth <= 0) return 0
    const activeBeat = timelineModel.beats[activeBeatIndex] || timelineModel.beats[timelineModel.beats.length - 1]
    if (!activeBeat) return 0
    const beatStart = beatOffsets[activeBeatIndex] || 0
    const beatWidth = beatWidths[activeBeatIndex] || 0
    const beatSpan = Math.max(0.0001, activeBeat.displayEnd - activeBeat.displayStart)
    const progressWithinBeat = clamp((playbackPosition - activeBeat.displayStart) / beatSpan, 0, 1)
    return beatStart + beatWidth * progressWithinBeat
  }, [activeBeatIndex, beatOffsets, beatWidths, playbackPosition, timelineModel.beats])

  React.useEffect(() => {
    if (!runtimeAutoScrollEnabled) return
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    const targetScrollLeft = Math.max(0, playheadOffsetPx - scrollEl.clientWidth * 0.5)
    scrollEl.scrollTo({
      left: targetScrollLeft,
      behavior: playing ? 'smooth' : 'auto',
    })
  }, [playheadOffsetPx, playing, runtimeAutoScrollEnabled])

  const activeBeat = activeBeatIndex >= 0 ? timelineModel.beats[activeBeatIndex] : null

  const handleTogglePlayback = React.useCallback(() => {
    if (timelineModel.totalSpan <= 0) return
    if (playbackPosition >= timelineModel.totalSpan) {
      setPlaybackPosition(0)
    }
    setPlaying(current => !current)
  }, [playbackPosition, timelineModel.totalSpan])

  const handleReset = React.useCallback(() => {
    setPlaying(false)
    setPlaybackPosition(0)
  }, [])

  const handleStepBeat = React.useCallback(
    (direction: -1 | 1) => {
      if (timelineModel.beats.length === 0) return
      const nextIndex = clamp(activeBeatIndex + direction, 0, timelineModel.beats.length - 1)
      const nextBeat = timelineModel.beats[nextIndex]
      if (!nextBeat) return
      setPlaying(false)
      setPlaybackPosition(nextBeat.displayStart)
    },
    [activeBeatIndex, timelineModel.beats],
  )

  const positionLabel = timelineModel.usesAbsoluteTiming
    ? formatAnimationTimelineTimestamp(playbackPosition)
    : activeBeat
      ? `${activeBeat.label} (${activeBeat.beatRef})`
      : 'No beat'

  if (!timelineModel.beats.length) {
    return (
      <section className="w-full h-full bg-slate-950 text-slate-100">
        <div className="h-full w-full flex items-center justify-center p-8">
          <div className="max-w-xl rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">2D Renderer: Animation</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Add beat-linked nodes like <code>NODE_CLIP_01</code> / <code>NODE_OVERLAY_01</code> or provide
              <code> timeline.beats </code> in Markdown frontmatter to populate the native timeline surface.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              This renderer reads the current workspace graph and Markdown document directly. It does not ship fixture-only demo rows.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="w-full h-full bg-slate-950 text-slate-100 select-none">
      <div className="flex h-full min-h-0 flex-col">
        <header className="border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 hover:border-slate-600 hover:bg-slate-800"
              onClick={handleTogglePlayback}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{playing ? 'Pause' : 'Play'}</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-600 hover:bg-slate-800"
              onClick={() => handleStepBeat(-1)}
            >
              <SkipBack className="h-4 w-4" />
              <span>Prev Beat</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-600 hover:bg-slate-800"
              onClick={() => handleStepBeat(1)}
            >
              <SkipForward className="h-4 w-4" />
              <span>Next Beat</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-600 hover:bg-slate-800"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={runtimeAutoScrollEnabled}
              className={`inline-flex items-center gap-3 rounded-full border px-3 py-2 text-sm ${
                runtimeAutoScrollEnabled
                  ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-50'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
              onClick={() => setRuntimeAutoScrollEnabled(current => !current)}
            >
              <span
                aria-hidden="true"
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                  runtimeAutoScrollEnabled ? 'bg-cyan-400/70' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition ${
                    runtimeAutoScrollEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </span>
              <span>Enable Runtime Auto Scroll</span>
            </button>
            <div className="ml-auto flex items-center gap-3 text-sm text-slate-300">
              <span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1">{positionLabel}</span>
              {activeBeat ? (
                <span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1">
                  Active Beat: {activeBeat.beatRef}
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-3">
            <input
              aria-label="Animation timeline playhead"
              className="w-full accent-cyan-400"
              type="range"
              min={0}
              max={timelineModel.totalSpan || 0}
              step={timelineModel.usesAbsoluteTiming ? 10 : 0.01}
              value={playbackPosition}
              onChange={event => {
                setPlaying(false)
                setPlaybackPosition(Number(event.target.value || 0))
              }}
            />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="w-44 shrink-0 border-r border-slate-800 bg-slate-900/70">
            <div
              className="flex items-center border-b border-slate-800 px-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
              style={{ height: HEADER_HEIGHT_PX }}
            >
              Timeline Lanes
            </div>
            {timelineModel.lanes.map(lane => (
              <div
                key={lane.id}
                className="flex items-center border-b border-slate-800 px-4 text-sm font-medium text-slate-200"
                style={{ minHeight: LANE_ROW_HEIGHT_PX }}
              >
                {lane.label}
              </div>
            ))}
          </aside>
          <div ref={scrollRef} className="min-w-0 flex-1 overflow-auto bg-slate-950">
            <div className="relative" style={{ width: Math.max(totalTimelineWidth, 1) }}>
              <div
                className="pointer-events-none absolute z-20 w-px bg-cyan-300/90 shadow-[0_0_16px_rgba(34,211,238,0.45)]"
                style={{
                  left: playheadOffsetPx,
                  top: 0,
                  height: HEADER_HEIGHT_PX + timelineModel.lanes.length * LANE_ROW_HEIGHT_PX,
                }}
              />
              <div className="sticky top-0 z-10 flex border-b border-slate-800 bg-slate-950/95 backdrop-blur">
                {timelineModel.beats.map((beat, index) => {
                  const isActiveBeat = index === activeBeatIndex
                  return (
                    <button
                      key={beat.beatRef}
                      type="button"
                      className={`flex shrink-0 flex-col justify-center border-r border-slate-800 px-4 text-left transition ${
                        isActiveBeat ? 'bg-cyan-500/12' : 'bg-transparent hover:bg-slate-900/80'
                      }`}
                      style={{ width: beatWidths[index], height: HEADER_HEIGHT_PX }}
                      onClick={() => {
                        setPlaying(false)
                        setPlaybackPosition(beat.displayStart)
                      }}
                    >
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{beat.beatRef}</span>
                      <span className="mt-1 text-sm font-semibold text-slate-100">{beat.label}</span>
                      <span className="mt-2 text-xs text-slate-400">
                        {timelineModel.usesAbsoluteTiming
                          ? `${formatAnimationTimelineTimestamp(beat.startMs)} -> ${formatAnimationTimelineTimestamp(beat.endMs)}`
                          : `${beat.items.length} item${beat.items.length === 1 ? '' : 's'}`}
                      </span>
                    </button>
                  )
                })}
              </div>
              {timelineModel.lanes.map(lane => (
                <div key={lane.id} className="flex border-b border-slate-900/80">
                  {timelineModel.beats.map((beat, index) => {
                    const laneItems = beat.items.filter(item => item.laneId === lane.id)
                    const isActiveBeat = index === activeBeatIndex
                    return (
                      <div
                        key={`${lane.id}:${beat.beatRef}`}
                        className={`shrink-0 border-r border-slate-800 px-3 py-3 ${
                          isActiveBeat ? 'bg-slate-900/85' : 'bg-slate-950'
                        }`}
                        style={{ width: beatWidths[index], minHeight: LANE_ROW_HEIGHT_PX }}
                      >
                        {laneItems.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {laneItems.map(item => (
                              <article
                                key={item.id}
                                className={`rounded-xl border px-3 py-2 shadow-sm ${LANE_ACCENT_CLASS[item.laneId]}`}
                              >
                                <div className="truncate text-sm font-semibold">{item.title}</div>
                                <div className="mt-1 truncate text-xs opacity-80">{item.subtitle || item.kind}</div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <div className="flex h-full items-center text-xs text-slate-600">No {lane.label.toLowerCase()} item</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
