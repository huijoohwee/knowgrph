import React from 'react'

import IconButton from '@/components/IconButton'
import { emitSidePanelOpen } from '@/features/canvas/utils'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { cn } from '@/lib/utils'
import { Copy, Eraser, GitMerge, HelpCircle, PanelRightOpen, Play, Share2, Trash2 } from 'lucide-react'

export const NodeOverlayEditorActionsToolbar = React.memo(function NodeOverlayEditorActionsToolbar(args: {
  visible: boolean
  iconSizeClass: string
  iconStrokeWidth: number
  active: boolean
  enableHandlesDisabled: boolean
  convertToLoopDisabled: boolean
  duplicateDisabled: boolean
  onRun: () => void
  onDuplicate: () => void
  onClearOutput: () => void
  onHelp: () => void
  onRemove: () => void
  onEnableHandlesForAllInputs: () => void
  onConvertToLoopNode: () => void
  onUpdateKvEntry?: () => void
}) {
  const {
    visible,
    iconSizeClass,
    iconStrokeWidth,
    active,
    enableHandlesDisabled,
    convertToLoopDisabled,
    duplicateDisabled,
    onRun,
    onDuplicate,
    onClearOutput,
    onHelp,
    onRemove,
    onEnableHandlesForAllInputs,
    onConvertToLoopNode,
    onUpdateKvEntry,
  } = args

  if (!visible) return null
  return (
    <nav
      className="Island App-toolbar App-toolbar--compact pointer-events-auto w-fit shadow-lg"
      aria-label={UI_LABELS.flowWidgetActions}
      onPointerDownCapture={e => {
        try {
          e.stopPropagation()
        } catch {
          void 0
        }
      }}
    >
      <IconButton
        title={UI_COPY.flowWidgetRun}
        tooltipContent={UI_COPY.flowWidgetRun}
        showTooltip
        onClick={onRun}
        className="App-toolbar__btn"
      >
        <Play className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
      </IconButton>

      <IconButton
        title={UI_LABELS.applyToNode}
        tooltipContent="Update KV entry"
        showTooltip
        onClick={onUpdateKvEntry || (() => {
          if (typeof window === 'undefined') return
          window.dispatchEvent(new CustomEvent(MAIN_PANEL_OPEN_EVENT, {
            detail: {
              tab: 'workflowManager' as const,
              workflowManagerTab: 'mapping' as const,
            },
          }))
        })}
        className="App-toolbar__btn"
      >
        <PanelRightOpen className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
      </IconButton>

      <IconButton
        title={UI_LABELS.openInSidepane}
        tooltipContent={UI_COPY.flowWidgetOpenInSidepane}
        showTooltip
        onClick={() => emitSidePanelOpen({ tab: 'node', open: true })}
        className="App-toolbar__btn"
      >
        <PanelRightOpen className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
      </IconButton>

      {!enableHandlesDisabled ? (
        <IconButton
          title={UI_LABELS.enableHandlesForAllInputs}
          tooltipContent={UI_COPY.flowWidgetEnableHandles}
          showTooltip
          onClick={onEnableHandlesForAllInputs}
          className="App-toolbar__btn"
        >
          <Share2 className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
        </IconButton>
      ) : null}

      {!convertToLoopDisabled ? (
        <IconButton
          title={UI_LABELS.convertToLoopNode}
          tooltipContent={UI_COPY.flowWidgetConvertToLoop}
          showTooltip
          onClick={onConvertToLoopNode}
          className="App-toolbar__btn"
        >
          <GitMerge className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
        </IconButton>
      ) : null}

      {!duplicateDisabled ? (
        <IconButton
          title={UI_LABELS.duplicate}
          tooltipContent={UI_COPY.flowWidgetDuplicate}
          showTooltip
          onClick={onDuplicate}
          className="App-toolbar__btn"
        >
          <Copy className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
        </IconButton>
      ) : null}

      <IconButton
        title={UI_LABELS.clearOutput}
        tooltipContent={UI_COPY.flowWidgetClearOutput}
        showTooltip
        onClick={onClearOutput}
        className="App-toolbar__btn"
      >
        <Eraser className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
      </IconButton>

      <IconButton
        title={UI_LABELS.help}
        tooltipContent={UI_COPY.flowWidgetHelp}
        showTooltip
        onClick={onHelp}
        className="App-toolbar__btn"
      >
        <HelpCircle className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
      </IconButton>

      <IconButton
        title={UI_LABELS.removeNode}
        tooltipContent={UI_COPY.flowWidgetRemoveNode}
        showTooltip
        onClick={onRemove}
        className={cn('App-toolbar__btn', 'text-red-700 dark:text-red-400')}
      >
        <Trash2 className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
      </IconButton>
    </nav>
  )
})
