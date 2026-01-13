import React from 'react'
import type {
  GraphDataTableListItem,
  GraphDataTableRowDensity,
} from '@/features/graph-data-table/graphDataTable'

export type VisibleRowRange = {
  visibleStartRow: number
  visibleEndRow: number
  totalRows: number
  visibleRowCount: number
  totalGroups: number
  totalAggregates: number
}

type GraphDataTableWindowingOptions = {
  listItems: GraphDataTableListItem[]
  rowDensity: GraphDataTableRowDensity
  enableVirtualTables: boolean
  virtualMinRows: number
  overscanRows: number
  overscanMultiplier: number
  debugLogRanges: boolean
  onVisibleRangeChange?: (range: VisibleRowRange) => void
  scrollContainerRef: React.RefObject<HTMLDivElement>
}

type GraphDataTableWindowingResult = {
  handleScroll: (event: React.UIEvent<HTMLDivElement>) => void
  startIndex: number
  endIndex: number
  topSpacerHeight: number
  bottomSpacerHeight: number
  estimatedRowHeight: number
  itemOffsets: number[]
  dataRowIndexByItemIndex: number[]
}

const COMPACT_ROW_HEIGHT_PX = 32

export function useGraphDataTableWindowing(options: GraphDataTableWindowingOptions): GraphDataTableWindowingResult {
  const {
    listItems,
    rowDensity,
    enableVirtualTables,
    virtualMinRows,
    overscanRows,
    overscanMultiplier,
    debugLogRanges,
    onVisibleRangeChange,
    scrollContainerRef,
  } = options

  const [measuredRowHeight, setMeasuredRowHeight] = React.useState<number | null>(null)
  const [scrollTop, setScrollTop] = React.useState(0)
  const [viewportHeight, setViewportHeight] = React.useState(0)
  const lastVisibleRangeRef = React.useRef<VisibleRowRange | null>(null)
  const onVisibleRangeChangeRef = React.useRef<GraphDataTableWindowingOptions['onVisibleRangeChange']>()
  const scrollContainerEl = scrollContainerRef.current

  const handleScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const next = event.currentTarget.scrollTop
    setScrollTop(prev => (next === prev ? prev : next))
  }, [])

  const defaultRowHeight = COMPACT_ROW_HEIGHT_PX
  const estimatedRowHeight = measuredRowHeight ?? defaultRowHeight

  const itemCount = listItems.length

  const itemOffsets = React.useMemo(() => {
    if (!enableVirtualTables || itemCount <= virtualMinRows) {
      return []
    }
    const offsets: number[] = []
    let offset = 0
    for (let index = 0; index < itemCount; index += 1) {
      offsets.push(offset)
      offset += estimatedRowHeight
    }
    return offsets
  }, [enableVirtualTables, estimatedRowHeight, virtualMinRows, itemCount])

  const dataRowIndexByItemIndex = React.useMemo(() => {
    const indices: number[] = []
    let current = 0
    for (let index = 0; index < listItems.length; index += 1) {
      const item = listItems[index]
      if (item.kind === 'row') {
        current += 1
        indices[index] = current
      } else {
        indices[index] = 0
      }
    }
    return indices
  }, [listItems])

  const findFirstIndexAtOrAfter = React.useCallback(
    (target: number) => {
      let low = 0
      let high = itemOffsets.length
      while (low < high) {
        const mid = (low + high) >>> 1
        if (itemOffsets[mid] < target) {
          low = mid + 1
        } else {
          high = mid
        }
      }
      return low
    },
    [itemOffsets],
  )

  const windowState = React.useMemo(() => {
    const totalContentHeight = itemCount * estimatedRowHeight
    const shouldWindow = enableVirtualTables && viewportHeight > 0 && itemCount > virtualMinRows

    if (!shouldWindow) {
      return {
        windowingEnabled: false as const,
        startIndex: 0,
        endIndex: itemCount - 1,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
        totalContentHeight,
      }
    }

    const approximateVisibleRows =
      viewportHeight > 0 ? viewportHeight / Math.max(1, estimatedRowHeight) : 0
    const dynamicOverscanRows = Math.max(
      Math.max(0, overscanRows),
      approximateVisibleRows > 0
        ? Math.ceil(approximateVisibleRows * overscanMultiplier)
        : 0,
    )
    const overscan = estimatedRowHeight * dynamicOverscanRows
    const startOffset = Math.max(scrollTop - overscan, 0)
    const endOffset = Math.min(scrollTop + viewportHeight + overscan, totalContentHeight)
    const start = findFirstIndexAtOrAfter(startOffset)
    const end = Math.max(start, findFirstIndexAtOrAfter(endOffset) - 1)

    let clampedStartIndex = Math.min(start, itemCount - 1)
    let clampedEndIndex = Math.min(end, itemCount - 1)

    const nearBottomThreshold = estimatedRowHeight * 2
    const isNearBottom = totalContentHeight - (scrollTop + viewportHeight) <= nearBottomThreshold
    if (isNearBottom) {
      const maxVisibleItems = Math.max(
        1,
        Math.ceil((viewportHeight + overscan * 2) / Math.max(1, estimatedRowHeight)),
      )
      clampedEndIndex = itemCount - 1
      clampedStartIndex = Math.max(0, itemCount - maxVisibleItems)
    }

    const topSpacerHeight =
      clampedStartIndex > 0 ? itemOffsets[clampedStartIndex] ?? 0 : 0
    const lastItemOffset =
      itemCount > 0 ? itemOffsets[itemCount - 1] ?? 0 : 0
    const bottomOffsetBase =
      clampedEndIndex >= 0 && clampedEndIndex < itemCount
        ? (itemOffsets[clampedEndIndex] ?? 0) + estimatedRowHeight
        : lastItemOffset + estimatedRowHeight
    const bottomSpacerHeight = Math.max(0, totalContentHeight - bottomOffsetBase)

    return {
      windowingEnabled: true as const,
      startIndex: clampedStartIndex,
      endIndex: clampedEndIndex,
      topSpacerHeight,
      bottomSpacerHeight,
      totalContentHeight,
    }
  }, [
    enableVirtualTables,
    estimatedRowHeight,
    findFirstIndexAtOrAfter,
    itemCount,
    itemOffsets,
    overscanRows,
    overscanMultiplier,
    scrollTop,
    virtualMinRows,
    viewportHeight,
  ])

  const { windowingEnabled, startIndex, endIndex, topSpacerHeight, bottomSpacerHeight } =
    windowState

  React.useEffect(() => {
    if (!debugLogRanges) return
    if (typeof window === 'undefined') return
    if (!windowingEnabled) return
  }, [debugLogRanges, endIndex, listItems.length, startIndex, windowingEnabled])

  const totalRows = React.useMemo(() => {
    let max = 0
    for (let index = 0; index < dataRowIndexByItemIndex.length; index += 1) {
      const value = dataRowIndexByItemIndex[index]
      if (value > max) max = value
    }
    return max
  }, [dataRowIndexByItemIndex])

  const visibleRowRange = React.useMemo<VisibleRowRange>(() => {
    if (totalRows === 0) {
      return {
        visibleStartRow: 0,
        visibleEndRow: 0,
        totalRows: 0,
        visibleRowCount: 0,
        totalGroups: 0,
        totalAggregates: 0,
      }
    }

    let totalGroups = 0
    let totalAggregates = 0
    for (let index = 0; index < listItems.length; index += 1) {
      const item = listItems[index]
      if (item.kind === 'group') totalGroups += 1
      else if (item.kind === 'aggregate') totalAggregates += 1
    }

    if (!windowingEnabled) {
      const visibleRowCount = totalRows
      return {
        visibleStartRow: 1,
        visibleEndRow: totalRows,
        totalRows,
        visibleRowCount,
        totalGroups,
        totalAggregates,
      }
    }

    let visibleStartRow = 0
    let visibleEndRow = 0

    for (let index = startIndex; index <= endIndex; index += 1) {
      const rowIndex = dataRowIndexByItemIndex[index]
      if (rowIndex === 0) continue
      if (visibleStartRow === 0 || rowIndex < visibleStartRow) visibleStartRow = rowIndex
      if (rowIndex > visibleEndRow) visibleEndRow = rowIndex
    }

    if (visibleStartRow === 0 || visibleEndRow === 0) {
      const visibleRowCount = totalRows
      return {
        visibleStartRow: 1,
        visibleEndRow: totalRows,
        totalRows,
        visibleRowCount,
        totalGroups,
        totalAggregates,
      }
    }

    const visibleRowCount = visibleEndRow - visibleStartRow + 1

    return {
      visibleStartRow,
      visibleEndRow,
      totalRows,
      visibleRowCount,
      totalGroups,
      totalAggregates,
    }
  }, [dataRowIndexByItemIndex, endIndex, listItems, startIndex, totalRows, windowingEnabled])

  React.useEffect(() => {
    onVisibleRangeChangeRef.current = onVisibleRangeChange
  }, [onVisibleRangeChange])

  React.useEffect(() => {
    const callback = onVisibleRangeChangeRef.current
    if (!callback) return
    const last = lastVisibleRangeRef.current
    if (
      last &&
      last.visibleStartRow === visibleRowRange.visibleStartRow &&
      last.visibleEndRow === visibleRowRange.visibleEndRow &&
      last.totalRows === visibleRowRange.totalRows &&
      last.visibleRowCount === visibleRowRange.visibleRowCount &&
      last.totalGroups === visibleRowRange.totalGroups &&
      last.totalAggregates === visibleRowRange.totalAggregates
    ) {
      return
    }
    lastVisibleRangeRef.current = visibleRowRange
    callback(visibleRowRange)
  }, [visibleRowRange])

  React.useEffect(() => {
    setMeasuredRowHeight(null)
  }, [rowDensity])

  React.useEffect(() => {
    if (measuredRowHeight != null) return
    const container = scrollContainerEl
    if (!container) return
    const row = container.querySelector<HTMLTableRowElement>('tbody tr[data-row-index]')
    if (!row) return
    const rect = row.getBoundingClientRect()
    if (rect.height > 0) setMeasuredRowHeight(rect.height)
  }, [listItems.length, measuredRowHeight, scrollContainerEl])

  React.useEffect(() => {
    const container = scrollContainerEl
    if (!container) return

    const initialHeight = container.clientHeight
    setViewportHeight(prev => (prev === initialHeight ? prev : initialHeight))
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === container) {
          const nextHeight = Math.round(entry.contentRect.height)
          setViewportHeight(prev => (prev === nextHeight ? prev : nextHeight))
        }
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [scrollContainerEl])

  return {
    handleScroll,
    startIndex,
    endIndex,
    topSpacerHeight,
    bottomSpacerHeight,
    estimatedRowHeight,
    itemOffsets,
    dataRowIndexByItemIndex,
  }
}
