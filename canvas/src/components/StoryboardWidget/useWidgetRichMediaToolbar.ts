import React from 'react'

import { useRichMediaWidgetPreview } from '@/components/StoryboardWidget/useRichMediaWidgetPreview'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config.storyboard-widget'
import type { GraphNode } from '@/lib/graph/types'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/storyboardWidget/flowDataflow'
import { RICH_MEDIA_OVERLAY_ACTION_VISIBILITY } from '@/components/StoryboardWidget/richMediaOverlayToolbarProps'

export function useWidgetRichMediaToolbar(args: {
  node: GraphNode
  nodeById?: ReadonlyMap<string, GraphNode>
  minimized: boolean
  hideFields: boolean
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
  onPatchProperties: (patch: Record<string, unknown>) => void
  onToggleHideFields: () => void
}) {
  const {
    node,
    nodeById,
    minimized,
    hideFields,
    connectedValuesBySchemaPath,
    onPatchProperties,
    onToggleHideFields,
  } = args
  const isRichMediaPanelWidget = String(node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
  const showRichMediaPanelBody = isRichMediaPanelWidget && !hideFields && !minimized
  const richMediaWidgetPreview = useRichMediaWidgetPreview({
    enabled: showRichMediaPanelBody,
    node,
    nodeById,
    onPatchProperties,
    connectedValuesBySchemaPath,
  })
  const richMediaPanelToolbarProps = React.useMemo(() => {
    if (!isRichMediaPanelWidget) return {}
    return {
      actionVisibility: RICH_MEDIA_OVERLAY_ACTION_VISIBILITY,
      richMediaViewToggle: {
        visible: true,
        isKtvRows: hideFields,
        onToggle: onToggleHideFields,
      },
    }
  }, [
    hideFields,
    isRichMediaPanelWidget,
    onToggleHideFields,
  ])

  return {
    isRichMediaPanelWidget,
    richMediaWidgetPreview,
    richMediaPanelToolbarProps,
  }
}
