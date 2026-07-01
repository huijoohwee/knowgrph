import type { NodeOverlayEditorActionsToolbarProps } from '@/components/FlowEditor/NodeOverlayEditorActionsToolbar'
import { buildNodeOverlayOpenExternalAction } from '@/components/FlowEditor/nodeOverlayOpenExternalAction'
import { buildNodeOverlayBubbleToolbarPresentation } from '@/components/FlowEditor/nodeOverlayBubbleToolbarPresentation'
import type { RichMediaPanelOverlayState } from '@/lib/render/richMediaPanelState'
import {
  normalizeRichMediaPanelTab,
  resolveRichMediaAspectSelection,
  resolveToggledRichMediaAspectSize,
  type RichMediaPanelChange,
} from '@/lib/render/richMediaSsot'
import { RICH_MEDIA_PANEL_DEFAULT_HEIGHT_PX, RICH_MEDIA_PANEL_DEFAULT_WIDTH_PX } from '@/lib/render/richMediaPanelDefaults'

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
  return buildNodeOverlayBubbleToolbarPresentation({
    ariaLabel: 'Rich Media panel actions',
    navClassName: args?.navClassName,
    placement: 'flow-rich-media-right-middle',
    active: true,
    enableHandlesDisabled: true,
    convertToLoopDisabled: true,
    duplicateDisabled: false,
  })
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
