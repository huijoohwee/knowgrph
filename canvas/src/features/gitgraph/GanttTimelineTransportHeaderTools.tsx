import { ChevronsLeft, ChevronsRight, Download, FileAudio, Link2, LocateFixed, Maximize2, MoreHorizontal, MoveHorizontal, RotateCcw, Scissors, StepBack, StepForward, Unlink2, ZoomIn, ZoomOut } from 'lucide-react'
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

function renderClipActionIcon(icon: GanttTimelineTransportChromeModel['headerTools']['clipActionButtons'][number]['icon']) {
  if (icon === 'split') return <Scissors className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
  if (icon === 'nudge-back') return <ChevronsLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
  if (icon === 'nudge-forward') return <ChevronsRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
  if (icon === 'trim-start-back' || icon === 'trim-end-back') return <StepBack className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
  if (icon === 'trim-start-forward' || icon === 'trim-end-forward') return <StepForward className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
  return <MoveHorizontal className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
}

export function GanttTimelineTransportHeaderTools(args: GanttTimelineTransportHeaderToolsProps) {
  return (
    <section className="timeline-transport-header-tools" aria-label="Timeline tools">
      <nav className="timeline-video-sequence-tool-strip" aria-label="Video sequence editing tools">
        <details className="timeline-tool-menu timeline-tool-menu--clip">
          <summary aria-label="Clip nudge and trim tools" title="Clip nudge and trim tools">
            <MoveHorizontal className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
          </summary>
          <section className="timeline-tool-menu-panel" aria-label="Clip nudge and trim tools">
            {args.model.clipActionButtons.map(button => (
              <button
                key={button.key}
                type="button"
                aria-label={button.ariaLabel}
                title={button.title}
                disabled={button.disabled}
                data-kg-video-sequence-clip-edit={button.action}
                onClick={button.onClick}
              >
                {renderClipActionIcon(button.icon)}
              </button>
            ))}
          </section>
        </details>
        <button
          type="button"
          aria-label={args.model.syncModeButton.ariaLabel}
          title={args.model.syncModeButton.title}
          disabled={args.model.syncModeButton.disabled}
          data-kg-video-sequence-tool="timing-sync"
          data-kg-video-sequence-timing-sync={args.model.syncModeButton.mode}
          data-kg-video-sequence-tool-active={args.model.syncModeButton.active ? '1' : undefined}
          onClick={args.model.syncModeButton.onClick}
        >
          {args.model.syncModeButton.mode === 'grouped'
            ? <Link2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
            : <Unlink2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />}
        </button>
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
      <details className="timeline-tool-menu timeline-tool-menu--utilities">
        <summary aria-label="Timeline utility tools" title="Timeline utility tools">
          <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
        </summary>
        <nav className="timeline-transport-chrome-actions timeline-tool-menu-panel" aria-label="Gantt timeline tools">
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
        </nav>
      </details>
    </section>
  )
}
