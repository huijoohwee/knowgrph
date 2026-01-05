import React from 'react'
import { ChevronDown } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { OrchestratorView } from '@/features/panels/hooks/useOrchestratorBottomPanelState'
import { getIconSizeClass } from '@/lib/ui'

type BottomPanelOrchestratorToolbarProps = {
  orchestratorView: OrchestratorView
  setOrchestratorView: (next: OrchestratorView) => void
  areAllOrchestratorSectionsCollapsed: boolean
  setAllOrchestratorSectionsCollapsed: (next: boolean) => void
  toggleButtonClassName: (isActive: boolean) => string
}

export default function BottomPanelOrchestratorToolbar({
  orchestratorView,
  setOrchestratorView,
  areAllOrchestratorSectionsCollapsed,
  setAllOrchestratorSectionsCollapsed,
  toggleButtonClassName,
}: BottomPanelOrchestratorToolbarProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  return (
    <div className="px-3 py-2 border-t border-gray-200">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={toggleButtonClassName(orchestratorView === 'ui')}
            onClick={() => setOrchestratorView('ui')}
          >
            UI Editor
          </button>
          <button
            type="button"
            className={toggleButtonClassName(orchestratorView === 'text')}
            onClick={() => setOrchestratorView('text')}
          >
            Text Editor
          </button>
        </div>
        {orchestratorView === 'ui' && (
          <IconButton
            className="App-toolbar__btn flex items-center justify-center"
            title={areAllOrchestratorSectionsCollapsed ? 'Expand All' : 'Collapse All'}
            onClick={() => {
              const nextCollapsed = !areAllOrchestratorSectionsCollapsed
              setAllOrchestratorSectionsCollapsed(nextCollapsed)
            }}
            showTooltip
          >
            <ChevronDown
              className={`${iconSizeClass} text-gray-700 transition-transform ${
                areAllOrchestratorSectionsCollapsed ? '' : 'rotate-180'
              }`}
              strokeWidth={uiIconStrokeWidth}
              aria-hidden="true"
            />
          </IconButton>
        )}
      </div>
    </div>
  )
}
