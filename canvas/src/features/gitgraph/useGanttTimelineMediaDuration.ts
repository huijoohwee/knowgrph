import React from 'react'
import type { VideoSequenceExportPlan } from '@/components/timeline/videoSequenceExport'
import { resolveTimelinePlanDurationSeconds } from '@/components/timeline/timelinePlanSync'

export function useGanttTimelineMediaDuration(exportPlan: VideoSequenceExportPlan | null): number {
  const [mediaDurationSeconds, setMediaDurationSeconds] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    setMediaDurationSeconds(0)
    if (!exportPlan) return () => {
      cancelled = true
    }
    void resolveTimelinePlanDurationSeconds(exportPlan).then(durationSeconds => {
      if (cancelled) return
      setMediaDurationSeconds(Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0)
    })
    return () => {
      cancelled = true
    }
  }, [exportPlan])

  return mediaDurationSeconds
}
