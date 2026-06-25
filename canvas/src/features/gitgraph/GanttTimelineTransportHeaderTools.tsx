import { Download, FileAudio, LocateFixed, Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { TimelineVideoSequenceToolButton } from '@/components/timeline/VideoSequenceTimelineRuler'
import { type GanttTimelineTransportChromeModel } from './useGanttTimelineTransportChromeModel'

export type GanttTimelineTransportHeaderToolsProps = {
  model: GanttTimelineTransportChromeModel['headerTools']
}

function renderActionIcon(icon: GanttTimelineTransportChromeModel['headerTools']['actionButtons'][number]['icon']) {
  if (icon === 'audio') return <FileAudio className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
  if (icon === 'retry') return <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
  if (icon === 'zoom-out') return <ZoomOut className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
  if (icon === 'zoom-in') return <ZoomIn className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
  if (icon === 'fit') return <Maximize2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
  if (icon === 'center') return <LocateFixed className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
  return <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
}

export function GanttTimelineTransportHeaderTools(args: GanttTimelineTransportHeaderToolsProps) {
  return (
    <section className="timeline-transport-header-tools" aria-label="Timeline tools">
      <nav className="timeline-video-sequence-tool-strip" aria-label="Video sequence editing tools">
        {args.model.toolButtons.map(tool => (
          <TimelineVideoSequenceToolButton
            key={tool.id}
            id={tool.id}
            label={tool.label}
            title={tool.title}
            active={tool.active}
            disabled={tool.disabled}
            onClick={tool.onClick}
          />
        ))}
      </nav>
      <section className="timeline-transport-chrome-actions" aria-label="Gantt timeline tools">
        {args.model.actionButtons.map(button => (
          <button
            key={button.key}
            type="button"
            aria-label={button.ariaLabel}
            title={button.title}
            disabled={button.disabled}
            data-kg-video-sequence-export={button.dataValue}
            onClick={button.onClick}
          >
            {renderActionIcon(button.icon)}
          </button>
        ))}
      </section>
    </section>
  )
}
