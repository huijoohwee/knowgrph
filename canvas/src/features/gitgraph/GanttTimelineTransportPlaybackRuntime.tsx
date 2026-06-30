import { useGanttTimelineTransportPlaybackModel } from './useGanttTimelineTransportPlaybackModel'
import { useGanttTimelineTransportSession } from './useGanttTimelineTransportSession'
import { useMermaidGanttDocument } from './useMermaidGanttDocument'

export function GanttTimelineTransportPlaybackRuntime({
  active = true,
}: {
  active?: boolean
}) {
  const { code } = useMermaidGanttDocument()
  if (!active || !code) return null
  return <GanttTimelineTransportPlaybackRuntimeController code={code} />
}

function GanttTimelineTransportPlaybackRuntimeController({
  code,
}: {
  code: string
}) {
  const transportSession = useGanttTimelineTransportSession({ code })
  useGanttTimelineTransportPlaybackModel({
    clockActive: true,
    disabled: transportSession.disabled,
    documentKey: transportSession.documentKey,
    maxMinutes: transportSession.maxMinutes,
    onPositionChange: transportSession.setTransportPlaybackPosition,
    playbackRate: transportSession.playbackRate,
    playbackUnitsPerMs: transportSession.playbackUnitsPerMs,
    playing: transportSession.playing,
    positionMinutes: transportSession.positionMinutes,
    setTransportPlaying: transportSession.setTransportPlaying,
  })
  return null
}
