import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMermaidGanttDocument } from '@/features/gitgraph/useMermaidGanttDocument'
import { useGraphStore } from '@/hooks/useGraphStore'
import { CANVAS_INTERACTIVE_CLASS, CANVAS_SURFACE_CLASS } from '@/lib/canvas/surface'
import { InteractiveMermaidDiagram } from '@/lib/diagram/InteractiveMermaidDiagram'
import {
  buildMermaidInteractiveSelectionRows,
  findMermaidDiagramRowForRowKey,
  readMermaidDirectSelectionLabels,
} from '@/lib/mermaid/mermaidDiagramSelection'
import { resolveDiagramRowKey } from '@/lib/diagram/diagramRowSelection'
import {
  buildMermaidGanttTimelineModel,
  MERMAID_GANTT_BAR_MIN_INTERACTION_HEIGHT_PX,
  MERMAID_GANTT_BAR_MIN_INTERACTION_WIDTH_PX,
  MermaidGanttBarDragMode,
  replaceFirstMermaidGanttFrontmatterCode,
  resolveMermaidGanttBarDragCommitted,
  resolveMermaidGanttBarDragPreview,
  resolveMermaidGanttTimelineDragEffectiveDelta,
  shouldExposeMermaidGanttBarInteraction,
  updateMermaidGanttCodeRowTiming,
} from '@/lib/mermaid/mermaidGanttBarInteraction'

type MermaidGanttCanvasProps = {
  active?: boolean
}

type GanttInteractionRect = {
  left: number
  top: number
  width: number
  height: number
}

type GanttBarDragState = {
  mode: MermaidGanttBarDragMode
  pointerId: number
  originClientX: number
  originRect: GanttInteractionRect
  markdownDocumentName: string | null
  markdownText: string
  rowLineIndex: number | null
}

function escapeCssAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function readElementClientRect(element: Element): DOMRect | null {
  if (!(element instanceof Element)) return null
  const rect = element.getBoundingClientRect()
  if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return null
  if (rect.width <= 0 || rect.height <= 0) return null
  return rect
}

function resolveGanttInteractionRect(root: HTMLElement | null, rowKey: string): GanttInteractionRect | null {
  if (!root || !rowKey) return null
  const escapedRowKey = escapeCssAttributeValue(rowKey)
  const candidates = Array.from(root.querySelectorAll(`[data-kg-mermaid-row-key="${escapedRowKey}"]`))
  const svgRects = candidates.filter(element => element.tagName.toLowerCase() === 'rect')
  const isVerticalMilestoneRow = /(^|[:,\s])vert([,\s]|$)/i.test(rowKey)
  const preferredSvgRects = isVerticalMilestoneRow
    ? svgRects.filter(element => String(element.getAttribute('class') || '').includes('vert'))
    : svgRects.filter(element => !String(element.getAttribute('class') || '').includes('vert'))
  const targetElements = preferredSvgRects.length > 0
    ? preferredSvgRects
    : svgRects.length > 0
      ? svgRects
      : candidates.filter(element => element.getAttribute('data-kg-mermaid-row-target') === '1')
  const rects = targetElements
    .map(readElementClientRect)
    .filter((rect): rect is DOMRect => !!rect)
  if (!rects.length) return null
  const ranked = rects
    .map(rect => ({ rect, area: rect.width * rect.height }))
    .sort((a, b) => b.area - a.area)
  const bestRect = ranked[0]?.rect
  if (!bestRect) return null
  const rootRect = root.getBoundingClientRect()
  const left = Math.max(0, bestRect.left - rootRect.left)
  const top = Math.max(0, bestRect.top - rootRect.top)
  return {
    left,
    top,
    width: Math.max(MERMAID_GANTT_BAR_MIN_INTERACTION_WIDTH_PX, Math.min(bestRect.width, rootRect.width - left)),
    height: Math.max(MERMAID_GANTT_BAR_MIN_INTERACTION_HEIGHT_PX, bestRect.height),
  }
}

function readGanttClockMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function readGanttMinutesPerPixel(root: HTMLElement | null): number | null {
  const labels = Array.from(root?.querySelectorAll('svg text') || [])
    .map(element => {
      const text = String(element.textContent || '').trim()
      const minutes = readGanttClockMinutes(text)
      if (minutes == null) return null
      const rect = element.getBoundingClientRect()
      return { minutes, x: rect.left + rect.width / 2 }
    })
    .filter((entry): entry is { minutes: number; x: number } => !!entry)
    .sort((a, b) => a.x - b.x)
  for (let index = 1; index < labels.length; index += 1) {
    const previous = labels[index - 1]
    const current = labels[index]
    if (!previous || !current) continue
    const deltaX = current.x - previous.x
    const deltaMinutes = current.minutes - previous.minutes
    if (deltaX > 8 && deltaMinutes > 0) return deltaMinutes / deltaX
  }
  return null
}

export default function MermaidGanttCanvas({ active = true }: MermaidGanttCanvasProps) {
  const rootRef = React.useRef<HTMLElement | null>(null)
  const autoOpenedFloatingPanelRef = React.useRef(false)
  const [interactionRect, setInteractionRect] = React.useState<GanttInteractionRect | null>(null)
  const [dragState, setDragState] = React.useState<GanttBarDragState | null>(null)
  const [dragPreview, setDragPreview] = React.useState<GanttInteractionRect | null>(null)
  const { code, ganttModel, themeMode } = useMermaidGanttDocument()
  const {
    floatingPanelOpen,
    markdownDocumentName,
    markdownText,
    selectedRowKey,
    setFloatingPanelOpen,
    setFloatingPanelView,
    setMarkdownDocument,
    setMermaidDiagramSelectedRowKey,
  } = useGraphStore(
    useShallow(state => ({
      floatingPanelOpen: state.floatingPanelOpen === true,
      markdownDocumentName: state.markdownDocumentName,
      markdownText: state.markdownDocumentText || '',
      selectedRowKey: state.mermaidDiagramSelectedRowKeyByKind.gantt || '',
      setFloatingPanelOpen: state.setFloatingPanelOpen,
      setFloatingPanelView: state.setFloatingPanelView,
      setMarkdownDocument: state.setMarkdownDocument,
      setMermaidDiagramSelectedRowKey: state.setMermaidDiagramSelectedRowKey,
    })),
  )
  const selectedRow = React.useMemo(
    () => findMermaidDiagramRowForRowKey(ganttModel.rows, selectedRowKey),
    [ganttModel.rows, selectedRowKey],
  )
  const selectedLabels = React.useMemo(() => readMermaidDirectSelectionLabels(selectedRow), [selectedRow])
  const selectionRows = React.useMemo(() => buildMermaidInteractiveSelectionRows(ganttModel.rows), [ganttModel.rows])
  const selectedLineIndex = typeof selectedRow?.lineIndex === 'number' ? selectedRow.lineIndex : null
  const showSelectedBarInteraction = shouldExposeMermaidGanttBarInteraction(selectedRow)

  const handleSelectedRowKeyChange = React.useCallback((rowKey: string | null) => {
    const nextRowKey = String(rowKey || '').trim()
    if (nextRowKey) {
      setFloatingPanelView('gantt')
      setFloatingPanelOpen(true)
    }
    setMermaidDiagramSelectedRowKey('gantt', nextRowKey || null)
  }, [setFloatingPanelOpen, setFloatingPanelView, setMermaidDiagramSelectedRowKey])

  React.useEffect(() => {
    if (!selectedRowKey) return
    if (ganttModel.rows.some((row, index) => resolveDiagramRowKey(row, index) === selectedRowKey)) return
    setMermaidDiagramSelectedRowKey('gantt', null)
  }, [ganttModel.rows, selectedRowKey, setMermaidDiagramSelectedRowKey])

  React.useEffect(() => {
    if (!active || !code || autoOpenedFloatingPanelRef.current) return
    autoOpenedFloatingPanelRef.current = true
    if (floatingPanelOpen) return
    setFloatingPanelView('gantt')
    setFloatingPanelOpen(true)
  }, [active, code, floatingPanelOpen, setFloatingPanelOpen, setFloatingPanelView])

  React.useEffect(() => {
    if (!showSelectedBarInteraction || !selectedRowKey) {
      setInteractionRect(null)
      return
    }
    let animationFrameId = 0
    const refreshRect = () => setInteractionRect(resolveGanttInteractionRect(rootRef.current, selectedRowKey))
    animationFrameId = window.requestAnimationFrame(refreshRect)
    window.addEventListener('resize', refreshRect)
    return () => {
      window.cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', refreshRect)
    }
  }, [selectedRowKey, showSelectedBarInteraction])

  React.useEffect(() => {
    if (!dragState) return
    let maxMovedPx = 0
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) return
      const preview = resolveMermaidGanttBarDragPreview({
        mode: dragState.mode,
        originClientX: dragState.originClientX,
        clientX: event.clientX,
      })
      maxMovedPx = Math.max(maxMovedPx, Math.abs(preview.deltaPx))
      setDragPreview({
        left: Math.max(0, dragState.originRect.left + preview.offsetPx),
        top: dragState.originRect.top,
        width: Math.max(MERMAID_GANTT_BAR_MIN_INTERACTION_WIDTH_PX, dragState.originRect.width + preview.widthDeltaPx),
        height: dragState.originRect.height,
      })
    }
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) return
      const preview = resolveMermaidGanttBarDragPreview({
        mode: dragState.mode,
        originClientX: dragState.originClientX,
        clientX: event.clientX,
      })
      const committed = resolveMermaidGanttBarDragCommitted(preview.deltaPx)
      setDragState(null)
      setDragPreview(null)
      if (!committed || !resolveMermaidGanttBarDragCommitted(maxMovedPx)) return
      if (dragState.markdownDocumentName !== markdownDocumentName || dragState.markdownText !== markdownText) {
        setInteractionRect(resolveGanttInteractionRect(rootRef.current, selectedRowKey))
        return
      }
      const minutesPerPixel = readGanttMinutesPerPixel(rootRef.current)
      const deltaMinutes = minutesPerPixel == null ? 0 : Math.round(preview.deltaPx * minutesPerPixel)
      const timelineModel = buildMermaidGanttTimelineModel(code)
      const timelineSpan = timelineModel.taskSpans.find(span => span.lineIndex === dragState.rowLineIndex)
      const effectiveDeltaMinutes = timelineSpan
        ? resolveMermaidGanttTimelineDragEffectiveDelta({
          deltaMinutes,
          maxMinutes: timelineModel.durationMinutes,
          mode: dragState.mode,
          span: timelineSpan,
        })
        : deltaMinutes
      if (effectiveDeltaMinutes === 0) {
        setInteractionRect(resolveGanttInteractionRect(rootRef.current, selectedRowKey))
        return
      }
      const nextCode = dragState.rowLineIndex == null ? null : updateMermaidGanttCodeRowTiming({
        code,
        rowLineIndex: dragState.rowLineIndex,
        mode: dragState.mode,
        deltaMinutes: effectiveDeltaMinutes,
      })
      const nextMarkdownText = nextCode ? replaceFirstMermaidGanttFrontmatterCode(markdownText, nextCode) : null
      if (nextMarkdownText && nextMarkdownText !== markdownText) {
        setMarkdownDocument(markdownDocumentName, nextMarkdownText, { applyViewPreset: false })
        const nextLine = nextCode?.split('\n')[dragState.rowLineIndex ?? -1]?.trim()
        if (nextLine) setMermaidDiagramSelectedRowKey('gantt', `${dragState.rowLineIndex}:task:${nextLine}`)
      } else {
        setInteractionRect(resolveGanttInteractionRect(rootRef.current, selectedRowKey))
      }
    }
    const onPointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) return
      setDragState(null)
      setDragPreview(null)
      setInteractionRect(resolveGanttInteractionRect(rootRef.current, selectedRowKey))
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    window.addEventListener('pointercancel', onPointerCancel, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [code, dragState, markdownDocumentName, markdownText, selectedRowKey, setMarkdownDocument, setMermaidDiagramSelectedRowKey])

  const handleBarPointerStart = React.useCallback((event: React.PointerEvent<HTMLElement>, mode: MermaidGanttBarDragMode) => {
    if (!interactionRect) return
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    setDragPreview(interactionRect)
    setDragState({
      mode,
      pointerId: event.pointerId,
      originClientX: event.clientX,
      originRect: interactionRect,
      markdownDocumentName,
      markdownText,
      rowLineIndex: selectedLineIndex,
    })
  }, [interactionRect, markdownDocumentName, markdownText, selectedLineIndex])

  const stopGanttHandleClick = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const activeInteractionRect = dragPreview || interactionRect
  const interactionStyle = activeInteractionRect ? ({
    left: `${activeInteractionRect.left}px`,
    top: `${activeInteractionRect.top}px`,
    width: `${activeInteractionRect.width}px`,
    height: `${activeInteractionRect.height}px`,
  } satisfies React.CSSProperties) : undefined

  return (
    <section
      ref={rootRef}
      className={`${CANVAS_SURFACE_CLASS} ${CANVAS_INTERACTIVE_CLASS} relative bg-[var(--kg-canvas-bg)] p-3 text-[var(--kg-text-primary)]`}
      aria-label="Mermaid Gantt-timeline canvas"
      data-kg-gantt-canvas="1"
      data-kg-gantt-interactive="1"
      data-kg-gantt-selected-row={selectedRowKey || undefined}
      data-kg-gantt-selected-line={selectedLineIndex ?? undefined}
      data-kg-gantt-bar-dragging={dragState ? '1' : undefined}
    >
      {code ? (
        <InteractiveMermaidDiagram
          code={code}
          rootThemeMode={themeMode}
          selectedLabels={selectedLabels}
          selectionRows={selectionRows}
          selectedRowKey={selectedRowKey}
          dimUnselected={!!selectedLabels.length}
          rendererId="gantt"
          svgSurfaceKey="mermaid:gantt:canvas"
          svgFitMode="wideTimeline"
          onSelectedRowKeyChange={handleSelectedRowKeyChange}
        />
      ) : (
        <section className="flex h-full w-full items-center justify-center px-6 text-sm text-[var(--kg-text-secondary)]">
          No Gantt-Timeline Mermaid frontmatter.
        </section>
      )}
      {showSelectedBarInteraction && activeInteractionRect && interactionStyle ? (
        <section
          aria-label="Selected Gantt row drag handles"
          className="pointer-events-auto absolute z-20 rounded border border-[var(--kg-accent)] bg-[var(--kg-accent-muted)]/20 shadow-[0_0_0_1px_rgba(56,189,248,0.18)]"
          data-kg-canvas-pointer-ignore="true"
          data-kg-gantt-bar-interaction-overlay="1"
          data-kg-gantt-bar-row-key={selectedRowKey || undefined}
          data-kg-gantt-bar-dragging={dragState ? '1' : undefined}
          style={interactionStyle}
        >
          <button
            type="button"
            aria-label="Resize Gantt row start"
            className="absolute -left-1 top-0 h-full w-2 cursor-ew-resize rounded-sm border border-[var(--kg-accent)] bg-[var(--kg-canvas-bg)]"
            data-kg-canvas-pointer-ignore="true"
            data-kg-gantt-bar-drag-mode="resize-start"
            onClick={stopGanttHandleClick}
            onPointerDown={event => handleBarPointerStart(event, 'resize-start')}
          />
          <button
            type="button"
            aria-label="Move Gantt row"
            className="absolute inset-y-0 left-2 right-2 cursor-grab rounded-sm"
            data-kg-canvas-pointer-ignore="true"
            data-kg-gantt-bar-drag-mode="move"
            onClick={stopGanttHandleClick}
            onPointerDown={event => handleBarPointerStart(event, 'move')}
          />
          <button
            type="button"
            aria-label="Resize Gantt row end"
            className="absolute -right-1 top-0 h-full w-2 cursor-ew-resize rounded-sm border border-[var(--kg-accent)] bg-[var(--kg-canvas-bg)]"
            data-kg-canvas-pointer-ignore="true"
            data-kg-gantt-bar-drag-mode="resize-end"
            onClick={stopGanttHandleClick}
            onPointerDown={event => handleBarPointerStart(event, 'resize-end')}
          />
        </section>
      ) : null}
    </section>
  )
}
