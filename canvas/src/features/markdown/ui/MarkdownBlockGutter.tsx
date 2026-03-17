import React from 'react'
import { GripVertical, Plus } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export const MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS = 'pl-[44px]'
export const MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS = 'pr-2'

const LINE_BLOCK_TRANSFER_TYPE = 'application/x-kg-md-lineblock'

export function useMarkdownLineBlockDnD(args: {
  enabled: boolean
  targetStartLine: number
  targetEndLine: number
  onReorder: (
    source: { startLine: number; endLine: number },
    target: { startLine: number; endLine: number },
    position: 'before' | 'after',
  ) => void
}) {
  const { enabled, targetStartLine, targetEndLine, onReorder } = args

  const [dragState, setDragState] = React.useState<'none' | 'top' | 'bottom'>('none')
  const [isDragging, setIsDragging] = React.useState(false)

  const handleDragStart = React.useCallback(
    (e: React.DragEvent) => {
      if (!enabled) return
      setIsDragging(true)
      try {
        e.dataTransfer.setData(
          LINE_BLOCK_TRANSFER_TYPE,
          JSON.stringify({ startLine: targetStartLine, endLine: targetEndLine }),
        )
      } catch {
        void 0
      }
      e.dataTransfer.effectAllowed = 'move'
    },
    [enabled, targetEndLine, targetStartLine],
  )

  const handleDragEnd = React.useCallback(() => {
    setIsDragging(false)
    setDragState('none')
  }, [])

  const handleDragOver = React.useCallback(
    (e: React.DragEvent) => {
      if (!enabled) return
      if (!e.dataTransfer.types.includes(LINE_BLOCK_TRANSFER_TYPE)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const rect = e.currentTarget.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      setDragState(e.clientY < midY ? 'top' : 'bottom')
    },
    [enabled],
  )

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setDragState('none')
  }, [])

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      if (!enabled) return
      e.preventDefault()
      e.stopPropagation()
      const raw = e.dataTransfer.getData(LINE_BLOCK_TRANSFER_TYPE)
      setDragState('none')
      if (!raw) return
      let parsed: { startLine?: number; endLine?: number } | null = null
      try {
        parsed = JSON.parse(raw)
      } catch {
        parsed = null
      }
      if (!parsed || !parsed.startLine) return
      const position = dragState === 'bottom' ? 'after' : 'before'
      onReorder(
        { startLine: Number(parsed.startLine), endLine: Number(parsed.endLine || parsed.startLine) },
        { startLine: targetStartLine, endLine: targetEndLine },
        position,
      )
    },
    [dragState, enabled, onReorder, targetEndLine, targetStartLine],
  )

  return {
    dragState,
    isDragging,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}

export function MarkdownBlockGutterControls(props: {
  canInsertLine: boolean
  onInsertLine: () => void
  canReorder: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  iconSizeClass: string
  iconStrokeWidth: number
  labelReorder: string
  labelInsert: string
}) {
  const {
    canInsertLine,
    onInsertLine,
    canReorder,
    onDragStart,
    onDragEnd,
    iconSizeClass,
    iconStrokeWidth,
    labelReorder,
    labelInsert,
  } = props

  if (!canInsertLine && !canReorder) return null

  return (
    <span
      className={`absolute left-2 inset-y-0 opacity-0 group-hover:opacity-100 transition-opacity ${UI_THEME_TOKENS.text.tertiary} flex items-center gap-0.5`}
    >
      {canInsertLine && (
        <button
          type="button"
          className="w-4 h-4 flex items-center justify-center rounded cursor-pointer hover:text-gray-600 dark:hover:text-gray-400"
          aria-label={labelInsert}
          title={labelInsert}
          onClick={(e: React.MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            onInsertLine()
          }}
        >
          <Plus className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden="true" />
        </button>
      )}
      {canReorder && (
        <button
          type="button"
          className="w-4 h-4 flex items-center justify-center cursor-grab active:cursor-grabbing hover:text-gray-600 dark:hover:text-gray-400"
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          aria-label={labelReorder}
          title={labelReorder}
        >
          <GripVertical className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden="true" />
        </button>
      )}
    </span>
  )
}

export function MarkdownBlockDropMarkers(props: {
  dragState: 'none' | 'top' | 'bottom'
  withArrow?: boolean
}) {
  const { dragState, withArrow } = props
  if (dragState === 'none') return null
  if (dragState === 'top') {
    return (
      <span
        className={`absolute left-0 right-0 -top-1 h-2 ${UI_THEME_TOKENS.button.activeBg} border-t-2 ${UI_THEME_TOKENS.button.activeBorder} z-10 pointer-events-none`}
      >
        {withArrow ? (
          <span
            className={`absolute left-0 -top-1 w-0 h-0 border-l-4 border-r-4 border-b-4 ${UI_THEME_TOKENS.button.activeBorder} border-l-transparent border-r-transparent`}
          />
        ) : null}
      </span>
    )
  }
  return (
    <span
      className={`absolute left-0 right-0 -bottom-1 h-2 ${UI_THEME_TOKENS.button.activeBg} border-b-2 ${UI_THEME_TOKENS.button.activeBorder} z-10 pointer-events-none`}
    >
      {withArrow ? (
        <span
          className={`absolute left-0 -bottom-1 w-0 h-0 border-l-4 border-r-4 border-t-4 ${UI_THEME_TOKENS.button.activeBorder} border-l-transparent border-r-transparent`}
        />
      ) : null}
    </span>
  )
}

