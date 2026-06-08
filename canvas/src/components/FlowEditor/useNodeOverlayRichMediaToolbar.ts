import React from 'react'

import { useRichMediaWidgetPreview } from '@/components/FlowEditor/useRichMediaWidgetPreview'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config.flow-editor'
import {
  normalizeRichMediaPanelTab,
  resolveRichMediaAspectSelection,
  resolveToggledRichMediaAspectSize,
  type RichMediaPanelAspectSelection,
  type RichMediaPanelTab,
} from '@/lib/render/richMediaSsot'

import {
  RICH_MEDIA_ASPECT_DEFAULT_HEIGHT,
  RICH_MEDIA_ASPECT_DEFAULT_WIDTH,
  RICH_MEDIA_ASPECT_MIN_HEIGHT,
  RICH_MEDIA_ASPECT_MIN_WIDTH,
} from '@/components/FlowEditor/flowWidgetOverlayShared'
import type { GraphNode } from '@/lib/graph/types'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'

export function useNodeOverlayRichMediaToolbar(args: {
  node: GraphNode
  minimized: boolean
  hideFields: boolean
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
  onPatchProperties: (patch: Record<string, unknown>) => void
  onToggleHideFields: () => void
}) {
  const {
    node,
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
    onPatchProperties,
    connectedValuesBySchemaPath,
  })
  const {
    richMediaPanelState,
    richMediaSelectedTab,
    richMediaOpenUrl,
    handleRichMediaPanelChange,
  } = richMediaWidgetPreview
  const richMediaSelectedMode = React.useMemo<RichMediaPanelTab>(() => {
    if (!isRichMediaPanelWidget) return 'auto'
    return normalizeRichMediaPanelTab((node.properties || {}).richMediaActiveTab)
  }, [isRichMediaPanelWidget, node.properties])
  const handleSelectRichMediaMode = React.useCallback((nextMode: RichMediaPanelTab) => {
    if (!isRichMediaPanelWidget) return
    onPatchProperties({
      richMediaActiveTab: nextMode,
    })
  }, [isRichMediaPanelWidget, onPatchProperties])
  const richMediaAspectSelection = React.useMemo<RichMediaPanelAspectSelection | null>(() => {
    if (!isRichMediaPanelWidget) return null
    const props = (node.properties || {}) as Record<string, unknown>
    return resolveRichMediaAspectSelection({
      width: props['visual:width'],
      height: props['visual:height'],
    })
  }, [isRichMediaPanelWidget, node.properties])
  const handleToggleRichMediaAspect = React.useCallback(() => {
    if (!isRichMediaPanelWidget) return
    const props = (node.properties || {}) as Record<string, unknown>
    const next = resolveToggledRichMediaAspectSize({
      width: props['visual:width'],
      height: props['visual:height'],
      selected: richMediaAspectSelection,
      minWidthPx: RICH_MEDIA_ASPECT_MIN_WIDTH,
      minHeightPx: RICH_MEDIA_ASPECT_MIN_HEIGHT,
      defaultWidthPx: RICH_MEDIA_ASPECT_DEFAULT_WIDTH,
      defaultHeightPx: RICH_MEDIA_ASPECT_DEFAULT_HEIGHT,
    })
    onPatchProperties({
      'visual:width': next.width,
      'visual:height': next.height,
    })
  }, [isRichMediaPanelWidget, node.properties, onPatchProperties, richMediaAspectSelection])
  const richMediaPanelToolbarProps = React.useMemo(() => {
    if (!isRichMediaPanelWidget) return {}
    return {
      richMediaViewToggle: {
        visible: true,
        isKtvRows: hideFields,
        onToggle: onToggleHideFields,
      },
      richMediaMediaSelector: {
        visible: true,
        selectedMode: richMediaSelectedMode,
        onSelect: handleSelectRichMediaMode,
      },
      richMediaAspectToggle: {
        visible: true,
        selected: richMediaAspectSelection,
        onToggle: handleToggleRichMediaAspect,
      },
      richMediaTextModeToggle: richMediaSelectedTab === 'text' && richMediaPanelState ? {
        visible: true,
        freezeConnectedOutput: richMediaPanelState.freezeConnectedOutput,
        onToggle: () => {
          if (!richMediaPanelState) return
          if (richMediaPanelState.freezeConnectedOutput) {
            handleRichMediaPanelChange({ activeTab: 'text', freezeConnectedOutput: false })
            return
          }
          const base = richMediaPanelState.connectedText || richMediaPanelState.text
          handleRichMediaPanelChange({ activeTab: 'text', freezeConnectedOutput: true, text: base })
        },
      } : undefined,
      openExternalAction: richMediaOpenUrl ? {
        visible: true,
        label: 'Open source',
        onOpen: () => {
          try {
            window.open(richMediaOpenUrl, '_blank', 'noopener,noreferrer')
          } catch {
            void 0
          }
        },
      } : undefined,
    }
  }, [
    handleRichMediaPanelChange,
    handleSelectRichMediaMode,
    handleToggleRichMediaAspect,
    hideFields,
    isRichMediaPanelWidget,
    onToggleHideFields,
    richMediaAspectSelection,
    richMediaOpenUrl,
    richMediaPanelState,
    richMediaSelectedMode,
    richMediaSelectedTab,
  ])

  return {
    isRichMediaPanelWidget,
    richMediaWidgetPreview,
    richMediaPanelToolbarProps,
  }
}
