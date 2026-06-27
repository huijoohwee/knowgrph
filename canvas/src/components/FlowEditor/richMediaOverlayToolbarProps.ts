import type { NodeOverlayEditorActionsToolbarProps } from '@/components/FlowEditor/NodeOverlayEditorActionsToolbar'
import { buildNodeOverlayOpenExternalAction } from '@/components/FlowEditor/nodeOverlayOpenExternalAction'
import { WIDGET_ACTIONS_TOOLBAR_MAX_WIDTH_PX } from '@/components/FlowEditor/flowWidgetOverlayShared'
import type { RichMediaPanelOverlayState } from '@/lib/render/richMediaPanelState'
import {
  normalizeRichMediaPanelTab,
  resolveRichMediaAspectSelection,
  resolveToggledRichMediaAspectSize,
  type RichMediaPanelChange,
} from '@/lib/render/richMediaSsot'
import { RICH_MEDIA_PANEL_DEFAULT_HEIGHT_PX, RICH_MEDIA_PANEL_DEFAULT_WIDTH_PX } from '@/lib/render/richMediaPanelDefaults'

const RICH_MEDIA_OVERLAY_TOOLBAR_NAV_STYLE = { pointerEvents: 'auto' } as const

export type SharedRichMediaOverlayToolbarProps = Pick<
  NodeOverlayEditorActionsToolbarProps,
  | 'ariaLabel'
  | 'navClassName'
  | 'navStyle'
  | 'active'
  | 'iconSizeClass'
  | 'iconStrokeWidth'
  | 'enableHandlesDisabled'
  | 'convertToLoopDisabled'
  | 'duplicateDisabled'
  | 'actionVisibility'
  | 'maxWidthPx'
>

export function buildSharedRichMediaOverlayToolbarProps(args?: {
  navClassName?: string
}): SharedRichMediaOverlayToolbarProps {
  return {
    ariaLabel: 'Rich Media panel actions',
    navClassName: args?.navClassName || 'absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2',
    navStyle: RICH_MEDIA_OVERLAY_TOOLBAR_NAV_STYLE,
    active: true,
    iconSizeClass: 'h-3.5 w-3.5',
    iconStrokeWidth: 1.8,
    enableHandlesDisabled: true,
    convertToLoopDisabled: true,
    duplicateDisabled: false,
    actionVisibility: {
      run: false,
      updateKvEntry: false,
      enableHandles: false,
      convertToLoop: false,
      clearOutput: false,
      help: false,
    },
    maxWidthPx: WIDGET_ACTIONS_TOOLBAR_MAX_WIDTH_PX,
  }
}

export function buildSharedRichMediaOverlayControlProps(args: {
  properties: Record<string, unknown>
  panel?: RichMediaPanelOverlayState
  openUrl?: string
  onPatchProperties: (patch: Record<string, unknown>) => void
  onPanelChange: (change: RichMediaPanelChange) => void
}): Pick<NodeOverlayEditorActionsToolbarProps, 'richMediaMediaSelector' | 'richMediaAspectToggle' | 'richMediaTextModeToggle' | 'openExternalAction'> {
  const selectedMode = normalizeRichMediaPanelTab(args.properties.richMediaActiveTab)
  const aspectSelection = resolveRichMediaAspectSelection({
    width: args.properties['visual:width'],
    height: args.properties['visual:height'],
  })
  return {
    richMediaMediaSelector: {
      visible: true,
      selectedMode,
      onSelect: richMediaActiveTab => args.onPatchProperties({ richMediaActiveTab }),
    },
    richMediaAspectToggle: {
      visible: true,
      selected: aspectSelection,
      onToggle: () => {
        const next = resolveToggledRichMediaAspectSize({
          width: args.properties['visual:width'],
          height: args.properties['visual:height'],
          selected: aspectSelection,
          defaultWidthPx: RICH_MEDIA_PANEL_DEFAULT_WIDTH_PX,
          defaultHeightPx: RICH_MEDIA_PANEL_DEFAULT_HEIGHT_PX,
        })
        args.onPatchProperties({ 'visual:width': next.width, 'visual:height': next.height })
      },
    },
    richMediaTextModeToggle: args.panel?.activeTab === 'text' ? {
      visible: true,
      freezeConnectedOutput: args.panel.freezeConnectedOutput,
      onToggle: () => args.onPanelChange(args.panel!.freezeConnectedOutput
        ? { activeTab: 'text', freezeConnectedOutput: false }
        : { activeTab: 'text', freezeConnectedOutput: true, text: args.panel!.connectedText || args.panel!.text }),
    } : undefined,
    openExternalAction: buildNodeOverlayOpenExternalAction({ url: args.openUrl, label: 'Open source' }),
  }
}
