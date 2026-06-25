import { TimelineTransportChrome } from '@/components/timeline/TimelineTransportControls'
import { type GanttTimelineTransportChromeModel } from './useGanttTimelineTransportChromeModel'
import { type GanttTimelineTransportRulerModel } from './useGanttTimelineTransportRulerModel'
import { type GanttTimelineTransportShellModel } from './useGanttTimelineTransportShellModel'
import { GanttTimelineTransportContextControls } from './GanttTimelineTransportContextControls'
import { GanttTimelineTransportHeaderTools } from './GanttTimelineTransportHeaderTools'
import { GanttTimelineTransportRuler } from './GanttTimelineTransportRuler'

export type GanttTimelineTransportShellProps = {
  chromeModel: GanttTimelineTransportChromeModel
  rulerModel: GanttTimelineTransportRulerModel
  shellModel: GanttTimelineTransportShellModel
}

export function GanttTimelineTransportShell(args: GanttTimelineTransportShellProps) {
  const contextDetailsLabel = `Timeline context: ${args.rulerModel.chrome.subtitleLabel}. ${args.chromeModel.contextControls.clipEdit.detailsLabel}`
  const contextControls = args.chromeModel.contextControls.exportSessions.items.length
    ? <GanttTimelineTransportContextControls model={args.chromeModel.contextControls} />
    : null

  return (
    <TimelineTransportChrome
      ariaLabel={args.shellModel.ariaLabel}
      chromeClassName={args.shellModel.chromeClassName}
      contextDetailsLabel={contextDetailsLabel}
      contextLabel={args.rulerModel.chrome.subtitleLabel}
      currentLabel={args.shellModel.currentLabel}
      contextControls={contextControls}
      disabled={args.shellModel.disabled}
      max={args.shellModel.max}
      min={args.shellModel.min}
      playbackRate={args.shellModel.playbackRate}
      playing={args.shellModel.playing}
      shellClassName={args.shellModel.shellClassName}
      rootProps={args.shellModel.rootProps}
      headerAside={<GanttTimelineTransportHeaderTools model={args.chromeModel.headerTools} />}
      ruler={<GanttTimelineTransportRuler model={args.rulerModel.ruler} />}
      rulerClassName={args.rulerModel.chrome.rulerClassName}
      rulerProps={args.rulerModel.chrome.rulerProps}
      step={args.shellModel.step}
      showInlineProgress={args.shellModel.showInlineProgress}
      showRange={args.shellModel.showRange}
      totalLabel={args.rulerModel.chrome.totalLabel}
      value={args.rulerModel.chrome.value}
      onPlaybackPointerDown={args.shellModel.onPlaybackPointerDown}
      onPlaybackRateChange={args.shellModel.onPlaybackRateChange}
      onTogglePlayback={args.shellModel.onTogglePlayback}
      onValueChange={args.shellModel.onValueChange}
    />
  )
}
