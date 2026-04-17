import React from 'react'
import { Compass, Hand, ListChecks, Lock, Unlock } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { ToolbarDropdownSelect } from '@/components/toolbar/ToolbarDropdownSelect'

type InteractionModeSelectProps = {
  iconSizeClass: string
  iconStrokeWidth: number
  ensureBaselineUnlocked?: () => boolean
}

type InteractionOption = {
  key: 'navigate' | 'lock' | 'multi' | 'canvasInteraction'
  label: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>
}

export function InteractionModeSelect({ iconSizeClass, iconStrokeWidth, ensureBaselineUnlocked }: InteractionModeSelectProps) {
  const {
    documentStructureBaselineLock,
    selectMode,
    infiniteCanvasInteractionMode,
    setDocumentStructureBaselineLock,
    setSelectMode,
    setInfiniteCanvasInteractionMode,
    setSelectionSource,
    selectNode,
    selectEdge,
    selectGroup,
  } = useGraphStore(
    useShallow(s => ({
      documentStructureBaselineLock: s.documentStructureBaselineLock === true,
      selectMode: s.schema?.behavior?.selectMode || 'single',
      infiniteCanvasInteractionMode: s.infiniteCanvasInteractionMode,
      setDocumentStructureBaselineLock: s.setDocumentStructureBaselineLock,
      setSelectMode: s.setSelectMode,
      setInfiniteCanvasInteractionMode: s.setInfiniteCanvasInteractionMode,
      setSelectionSource: s.setSelectionSource,
      selectNode: s.selectNode,
      selectEdge: s.selectEdge,
      selectGroup: s.selectGroup,
    })),
  )

  const options = React.useMemo(
    () =>
      [
        {
          key: 'navigate' as const,
          label: 'Navigate (clear selection)',
          Icon: Compass,
        },
        {
          key: 'lock' as const,
          label: documentStructureBaselineLock ? 'View Lock: ON' : 'View Lock: OFF',
          Icon: documentStructureBaselineLock ? Lock : Unlock,
        },
        {
          key: 'multi' as const,
          label: UI_LABELS.multiSelectMode,
          Icon: ListChecks,
        },
        {
          key: 'canvasInteraction' as const,
          label:
            infiniteCanvasInteractionMode === 'interactive'
              ? `${UI_LABELS.canvasInteractionMode}: ${UI_COPY.infiniteCanvasInteractionInteractiveLabel}`
              : `${UI_LABELS.canvasInteractionMode}: ${UI_COPY.infiniteCanvasInteractionStaticLabel}`,
          Icon: Hand,
        },
      ] satisfies InteractionOption[],
    [documentStructureBaselineLock, infiniteCanvasInteractionMode, selectMode],
  )

  const selectedOptionKey: InteractionOption['key'] = 'navigate'

  const apply = React.useCallback(
    (key: InteractionOption['key']) => {
      if (key === 'navigate') {
        if (selectMode !== 'single') setSelectMode('single')
        setSelectionSource('toolbar')
        selectNode(null)
        selectEdge(null)
        selectGroup(null)
        return
      }
      if (key === 'lock') {
        const currentLock = useGraphStore.getState().documentStructureBaselineLock === true
        setDocumentStructureBaselineLock(!currentLock)
        return
      }
      if (key === 'canvasInteraction') {
        if (ensureBaselineUnlocked && !ensureBaselineUnlocked()) return
        setInfiniteCanvasInteractionMode(infiniteCanvasInteractionMode === 'interactive' ? 'static' : 'interactive')
        return
      }
      setSelectMode(selectMode === 'multi' || selectMode === 'lasso' ? 'single' : 'multi')
    },
    [
      ensureBaselineUnlocked,
      infiniteCanvasInteractionMode,
      selectEdge,
      selectGroup,
      selectMode,
      selectNode,
      setDocumentStructureBaselineLock,
      setInfiniteCanvasInteractionMode,
      setSelectMode,
      setSelectionSource,
    ],
  )

  return (
    <ToolbarDropdownSelect
      value={selectedOptionKey}
      options={options.map(option => ({
        id: option.key,
        title: option.label,
        Icon: option.Icon,
        isActive:
          option.key === 'lock'
            ? documentStructureBaselineLock
            : option.key === 'multi'
              ? selectMode === 'multi' || selectMode === 'lasso'
              : option.key === 'canvasInteraction'
                ? infiniteCanvasInteractionMode === 'interactive'
                : false,
      }))}
      title={UI_LABELS.interactionMode}
      tooltipContent={UI_COPY.interactionModeTooltip}
      isButtonActive={
        documentStructureBaselineLock ||
        selectMode === 'multi' ||
        selectMode === 'lasso' ||
        infiniteCanvasInteractionMode === 'interactive'
      }
      onSelect={id => apply(id)}
      renderButtonContent={() => <Compass className={iconSizeClass} strokeWidth={iconStrokeWidth} />}
      renderOptionContent={option => (
        <>
          <option.Icon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
          <span className="truncate">{option.title}</span>
        </>
      )}
      menuWidthClass="w-72"
    />
  )
}
