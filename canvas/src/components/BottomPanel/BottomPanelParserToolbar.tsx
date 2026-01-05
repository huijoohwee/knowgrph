import React from 'react'
import { ChevronDown } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'

type BottomPanelParserToolbarProps = {
  parserUiEditorOpen: boolean
  setParserUiEditorOpen: (next: boolean) => void
  toggleButtonClassName: (isActive: boolean) => string
  parserMessage: string | null | undefined
  warningText: string | null | undefined
  hasSelectedSpec: boolean
  areAllParserSectionsCollapsed: boolean
  setAllParserSectionsCollapsed: (next: boolean) => void
}

export default function BottomPanelParserToolbar({
  parserUiEditorOpen,
  setParserUiEditorOpen,
  toggleButtonClassName,
  parserMessage,
  warningText,
  hasSelectedSpec,
  areAllParserSectionsCollapsed,
  setAllParserSectionsCollapsed,
}: BottomPanelParserToolbarProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  return (
    <div className="px-3 py-2 border-t border-gray-200">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={toggleButtonClassName(parserUiEditorOpen)}
            onClick={() => setParserUiEditorOpen(true)}
          >
            UI Editor
          </button>
          <button
            type="button"
            className={toggleButtonClassName(!parserUiEditorOpen)}
            onClick={() => setParserUiEditorOpen(false)}
          >
            Text Editor
          </button>
        </div>
        {parserUiEditorOpen && (
          <IconButton
            className="App-toolbar__btn flex items-center justify-center"
            title={areAllParserSectionsCollapsed ? 'Expand All' : 'Collapse All'}
            onClick={() => {
              const nextCollapsed = !areAllParserSectionsCollapsed
              setAllParserSectionsCollapsed(nextCollapsed)
            }}
            showTooltip
          >
            <ChevronDown
              className={`${iconSizeClass} text-gray-700 transition-transform ${
                areAllParserSectionsCollapsed ? '' : 'rotate-180'
              }`}
              aria-hidden="true"
            />
          </IconButton>
        )}
      </div>
      <div className="mt-2">
        {!hasSelectedSpec && parserMessage && (
          <div className="text-xs mb-2 px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800">
            {parserMessage}
          </div>
        )}
        {warningText && <div className="text-xs text-amber-700">{warningText}</div>}
      </div>
    </div>
  )
}
