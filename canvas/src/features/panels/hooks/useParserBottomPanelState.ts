import { useCallback, useMemo } from 'react'
import { useParserWorkflowState } from '@/features/parsers/useParserWorkflowState'

type ParserSelectionProps = ReturnType<typeof useParserWorkflowState>['parserSelectionProps']
type ParserDataProps = ReturnType<typeof useParserWorkflowState>['parserDataProps']

export type ParserBottomPanelSectionId = 'selection' | 'data'

interface ParserBottomPanelSections {
  byId: Record<ParserBottomPanelSectionId, boolean>
  setters: Record<ParserBottomPanelSectionId, (next: boolean) => void>
}

export interface ParserBottomPanelState {
  parserSelectionProps: ParserSelectionProps
  parserDataProps: ParserDataProps
  sections: ParserBottomPanelSections
  areAllSectionsCollapsed: boolean
  setAllSectionsCollapsed: (next: boolean) => void
}

export function useParserBottomPanelState(): ParserBottomPanelState {
  const { parserSelectionProps, parserDataProps } = useParserWorkflowState()

  const sections: ParserBottomPanelSections = useMemo(
    () => ({
      byId: {
        selection: parserSelectionProps.parsersCollapsed,
        data: parserDataProps.inputCollapsed,
      },
      setters: {
        selection: parserSelectionProps.onParsersCollapsedChange,
        data: parserDataProps.onInputCollapsedChange,
      },
    }),
    [
      parserSelectionProps.parsersCollapsed,
      parserSelectionProps.onParsersCollapsedChange,
      parserDataProps.inputCollapsed,
      parserDataProps.onInputCollapsedChange,
    ],
  )

  const areAllSectionsCollapsed = useMemo(
    () => sections.byId.selection && sections.byId.data,
    [sections],
  )

  const setAllSectionsCollapsed = useCallback(
    (next: boolean) => {
      sections.setters.selection(next)
      sections.setters.data(next)
    },
    [sections],
  )

  return {
    parserSelectionProps,
    parserDataProps,
    sections,
    areAllSectionsCollapsed,
    setAllSectionsCollapsed,
  }
}
