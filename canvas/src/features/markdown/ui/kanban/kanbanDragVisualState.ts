import type React from 'react'
import { UI_COLOR_PRIMARY_BLUE_INDICATOR } from '@/features/toolbar/ui/toolbarStyles'

export const getKanbanCardDragVisualState = (args: {
  hasActiveDrag: boolean
  isDragging: boolean
  isDropTarget: boolean
  isCommitFlash?: boolean
}): { className: string; style?: React.CSSProperties } => {
  if (args.isDragging) {
    return {
      className: 'scale-[1.01] -rotate-[1deg] opacity-95 z-20 cursor-grabbing',
      style: {
        borderColor: UI_COLOR_PRIMARY_BLUE_INDICATOR,
        boxShadow: `0 18px 38px rgba(15, 23, 42, 0.18), 0 0 0 1px ${UI_COLOR_PRIMARY_BLUE_INDICATOR}`,
      },
    }
  }
  if (args.isDropTarget) {
    return {
      className: 'translate-y-0',
      style: {
        borderColor: UI_COLOR_PRIMARY_BLUE_INDICATOR,
        boxShadow: `0 10px 24px rgba(15, 23, 42, 0.12), 0 0 0 1px ${UI_COLOR_PRIMARY_BLUE_INDICATOR}`,
      },
    }
  }
  if (args.isCommitFlash) {
    return {
      className: 'translate-y-0',
      style: {
        borderColor: UI_COLOR_PRIMARY_BLUE_INDICATOR,
        boxShadow: `0 0 0 1px ${UI_COLOR_PRIMARY_BLUE_INDICATOR}, 0 0 0 6px ${UI_COLOR_PRIMARY_BLUE_INDICATOR}22`,
      },
    }
  }
  if (args.hasActiveDrag) {
    return {
      className: 'opacity-85 saturate-[0.92]',
    }
  }
  return { className: '' }
}

export const getKanbanLaneDragVisualState = (args: {
  hasActiveDrag: boolean
  isDragOver: boolean
  isSourceLane: boolean
  isCommitFlash?: boolean
}): { className: string; style?: React.CSSProperties } => {
  if (args.isDragOver) {
    return {
      className: 'shadow-md',
      style: {
        borderColor: UI_COLOR_PRIMARY_BLUE_INDICATOR,
        boxShadow: `0 0 0 1px ${UI_COLOR_PRIMARY_BLUE_INDICATOR}, 0 14px 30px rgba(15, 23, 42, 0.10)`,
      },
    }
  }
  if (args.isCommitFlash) {
    return {
      className: 'shadow-md',
      style: {
        borderColor: UI_COLOR_PRIMARY_BLUE_INDICATOR,
        boxShadow: `0 0 0 1px ${UI_COLOR_PRIMARY_BLUE_INDICATOR}, 0 0 0 8px ${UI_COLOR_PRIMARY_BLUE_INDICATOR}1f`,
      },
    }
  }
  if (args.isSourceLane) {
    return {
      className: 'shadow-sm opacity-95',
      style: {
        boxShadow: `0 0 0 1px ${UI_COLOR_PRIMARY_BLUE_INDICATOR}66 inset`,
      },
    }
  }
  if (args.hasActiveDrag) {
    return {
      className: 'opacity-90',
    }
  }
  return { className: '', style: undefined }
}
