import { RotateCcw } from 'lucide-react'
import { type GanttTimelineTransportChromeModel } from './useGanttTimelineTransportChromeModel'

export type GanttTimelineTransportContextControlsProps = {
  model: GanttTimelineTransportChromeModel['contextControls']
}

export function GanttTimelineTransportContextControls(args: GanttTimelineTransportContextControlsProps) {
  if (!args.model.exportSessions.items.length) return null

  return (
    <section className="timeline-transport-context-stack" aria-label="Video sequence timeline context">
      <section className="timeline-transport-export-sessions" aria-label="Recent edited media exports">
        {args.model.exportSessions.items.map(session => (
          <article
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
          </article>
        ))}
      </section>
    </section>
  )
}
