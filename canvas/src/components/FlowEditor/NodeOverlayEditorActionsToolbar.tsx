import React from 'react'

import IconButton from '@/components/IconButton'
import { emitSidePanelOpen } from '@/features/canvas/utils'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { cn } from '@/lib/utils'
import { Copy, Eraser, GitMerge, HelpCircle, PanelRightOpen, Share2, Trash2 } from 'lucide-react'

export const NodeOverlayEditorActionsToolbar = React.memo(function NodeOverlayEditorActionsToolbar(args: {
  visible: boolean
  iconSizeClass: string
  iconStrokeWidth: number
  active: boolean
  enableHandlesDisabled: boolean
  convertToLoopDisabled: boolean
  onDuplicate: () => void
  onClearOutput: () => void
  onHelp: () => void
  onRemove: () => void
  onEnableHandlesForAllInputs: () => void
  onConvertToLoopNode: () => void
}) {
  const {
    visible,
    iconSizeClass,
    iconStrokeWidth,
    active,
    enableHandlesDisabled,
    convertToLoopDisabled,
    onDuplicate,
    onClearOutput,
    onHelp,
    onRemove,
    onEnableHandlesForAllInputs,
    onConvertToLoopNode,
  } = args

  if (!visible) return null

  return (
    <nav
      className="Island App-toolbar App-toolbar--compact w-fit"
      aria-label={UI_LABELS.flowNodeQuickEditorActions}
      onPointerDownCapture={e => {
        try {
          e.stopPropagation()
        } catch {
          void 0
        }
      }}
    >
      <IconButton
        title={UI_LABELS.openInSidepane}
        tooltipContent={UI_COPY.flowNodeQuickEditorOpenInSidepane}
        showTooltip
        onClick={() => emitSidePanelOpen({ tab: 'node', open: true })}
        className="App-toolbar__btn"
        disabled={!active}
      >
        <PanelRightOpen className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
      </IconButton>

      <IconButton
        title={UI_LABELS.enableHandlesForAllInputs}
        tooltipContent={UI_COPY.flowNodeQuickEditorEnableHandles}
        showTooltip
        onClick={onEnableHandlesForAllInputs}
        className="App-toolbar__btn"
        disabled={!active || enableHandlesDisabled}
      >
        <Share2 className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
      </IconButton>

      <IconButton
        title={UI_LABELS.convertToLoopNode}
        tooltipContent={UI_COPY.flowNodeQuickEditorConvertToLoop}
        showTooltip
        onClick={onConvertToLoopNode}
        className="App-toolbar__btn"
        disabled={!active || convertToLoopDisabled}
      >
        <GitMerge className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
      </IconButton>

      <IconButton
        title={UI_LABELS.duplicate}
        tooltipContent={UI_COPY.flowNodeQuickEditorDuplicate}
        showTooltip
        onClick={onDuplicate}
        className="App-toolbar__btn"
        disabled={!active}
      >
        <Copy className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
      </IconButton>

      <IconButton
        title={UI_LABELS.clearOutput}
        tooltipContent={UI_COPY.flowNodeQuickEditorClearOutput}
        showTooltip
        onClick={onClearOutput}
        className="App-toolbar__btn"
        disabled={!active}
      >
        <Eraser className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
      </IconButton>

      <IconButton
        title={UI_LABELS.help}
        tooltipContent={UI_COPY.flowNodeQuickEditorHelp}
        showTooltip
        onClick={onHelp}
        className="App-toolbar__btn"
        disabled={!active}
      >
        <HelpCircle className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
      </IconButton>

      <IconButton
        title={UI_LABELS.removeNode}
        tooltipContent={UI_COPY.flowNodeQuickEditorRemoveNode}
        showTooltip
        onClick={onRemove}
        className={cn('App-toolbar__btn', 'text-red-700 dark:text-red-400')}
        disabled={!active}
      >
        <Trash2 className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
      </IconButton>
    </nav>
  )
})
