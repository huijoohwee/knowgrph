import { RotateCcw } from 'lucide-react'
import { VideoSequenceClipEditPanel } from '@/components/timeline/VideoSequenceClipEditPanel'
import { type GanttTimelineTransportChromeModel } from './useGanttTimelineTransportChromeModel'

export type GanttTimelineTransportContextControlsProps = {
  model: GanttTimelineTransportChromeModel['contextControls']
}

export function GanttTimelineTransportContextControls(args: GanttTimelineTransportContextControlsProps) {
  return (
    <section className="timeline-transport-context-stack" aria-label="Video sequence timeline context">
      <VideoSequenceClipEditPanel
        disabled={args.model.clipEdit.disabled}
        maxMinutes={args.model.clipEdit.maxMinutes}
        mediaDurationSeconds={args.model.clipEdit.mediaDurationSeconds}
        playheadMinutes={args.model.clipEdit.playheadMinutes}
        selectedSpan={args.model.clipEdit.selectedSpan}
        onAction={args.model.clipEdit.onAction}
      />
      <section className="timeline-transport-export-sessions" aria-label="Recent edited media exports">
        {args.model.exportSessions.items.length ? args.model.exportSessions.items.map(session => (
          <div
            key={session.runId}
            className="timeline-transport-export-session"
            data-kg-video-sequence-export-session-mode={session.styleMode}
            data-kg-video-sequence-export-session={session.status}
            data-kg-video-sequence-export-session-tone={session.styleTone}
          >
            <span className="timeline-transport-export-session-detail">{session.detailLabel}</span>
            <span className="timeline-transport-export-session-message">{session.message}</span>
            <button
              type="button"
              aria-label={session.retryButtonLabel}
              title={session.retryButtonTitle}
              disabled={!session.retryable}
              data-kg-video-sequence-export-session-retry={session.retryState}
              onClick={session.onRetry}
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
            </button>
          </div>
        )) : (
          <div className="timeline-transport-export-session timeline-transport-export-session--empty">
            {args.model.exportSessions.emptyLabel}
          </div>
        )}
      </section>
    </section>
  )
}
