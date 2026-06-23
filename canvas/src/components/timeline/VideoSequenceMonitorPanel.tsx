import React from 'react'
import { Activity, AudioLines, CircleDot, Eye, SlidersHorizontal } from 'lucide-react'
import {
  VIDEO_SEQUENCE_TIMELINE_LANES,
  type VideoSequenceTimelineScope,
} from './videoSequenceTimeline'
import './VideoSequenceMonitorPanel.css'

const SCOPE_ICON_BY_ID: Record<VideoSequenceTimelineScope['id'], React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  'audio-mix': SlidersHorizontal,
  'audio-waveform': AudioLines,
  'chroma-vectorscope': CircleDot,
  histogram: Activity,
  'live-preview': Eye,
  'luma-waveform': Activity,
}

export function VideoSequenceMonitorPanel({
  activeLaneIds,
  currentLabel,
  scopes,
  sourceCount,
}: {
  activeLaneIds: ReadonlySet<string>
  currentLabel: string
  scopes: readonly VideoSequenceTimelineScope[]
  sourceCount: number
}) {
  return (
    <section className="timeline-video-sequence-monitor" aria-label="Video sequence live preview and scopes">
      <section className="timeline-video-sequence-monitor-header">
        <section className="timeline-video-sequence-monitor-title">
          <Eye className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden={true} />
          <span>Live preview</span>
        </section>
        <time className="timeline-video-sequence-monitor-time">{currentLabel}</time>
      </section>
      <section className="timeline-video-sequence-scope-grid" aria-label="Video sequence scopes">
        {scopes.map(scope => {
          const Icon = SCOPE_ICON_BY_ID[scope.id]
          return (
            <article key={scope.id} className="timeline-video-sequence-scope" data-kg-video-sequence-scope={scope.id}>
              <header className="timeline-video-sequence-scope-header">
                <Icon className="h-3 w-3" strokeWidth={1.8} aria-hidden={true} />
                <span>{scope.label}</span>
              </header>
              <section className="timeline-video-sequence-scope-bars" aria-label={`${scope.label} display`}>
                {scope.samples.map((sample, index) => (
                  <span
                    key={`${scope.id}:${index}`}
                    className="timeline-video-sequence-scope-bar"
                    style={{ '--kg-video-sequence-scope-bar': `${sample}%` } as React.CSSProperties}
                    aria-hidden="true"
                  />
                ))}
              </section>
              <meter min={0} max={100} value={scope.value}>
                {scope.value}%
              </meter>
            </article>
          )
        })}
      </section>
      <section className="timeline-video-sequence-slot-grid" aria-label="Video sequence slots">
        {VIDEO_SEQUENCE_TIMELINE_LANES.map(lane => (
          <article
            key={lane.id}
            className="timeline-video-sequence-slot"
            data-kg-video-sequence-slot={lane.id}
            data-kg-video-sequence-slot-active={activeLaneIds.has(lane.id) ? '1' : undefined}
          >
            <span>{lane.label}</span>
          </article>
        ))}
      </section>
      <section className="timeline-video-sequence-audio-sync" aria-label="Audio mixing, syncing, scrubbing, and waveform visualization">
        <AudioLines className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden={true} />
        <span>{sourceCount} source{sourceCount === 1 ? '' : 's'}</span>
        <span>Sync</span>
        <span>Scrub</span>
        <span>Mix</span>
      </section>
    </section>
  )
}
