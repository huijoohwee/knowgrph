import React from 'react'
import { Check, Braces } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import type { Action } from '@/features/panels/ui/ActionsRowModel'

function ActionsRowImpl({ actions, className }: { actions: Action[]; className?: string }) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  return (
    <div className={className || 'mb-2 flex items-center gap-2'}>
      {actions.map(a => {
        if (a.label === 'Format') {
          return (
            <IconButton
              key={a.label}
              title={a.label}
              onClick={() => void a.onClick()}
              disabled={a.disabled}
              className="App-toolbar__btn flex items-center justify-center"
              showTooltip
            >
              <Braces className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
            </IconButton>
          )
        }

        if (a.variant === 'primary' && a.label === 'Apply') {
          return (
            <IconButton
              key={a.label}
              title={a.label}
              onClick={() => void a.onClick()}
              disabled={a.disabled}
              className="App-toolbar__btn flex items-center justify-center text-blue-600"
              showTooltip
            >
              <Check className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
            </IconButton>
          )
        }

        return (
          <button
            key={a.label}
            data-kg-spotlight={a.spotlightId}
            type="button"
            onClick={() => void a.onClick()}
            disabled={a.disabled}
            className={`App-toolbar__btn text-xs ${a.variant === 'primary' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'} ${a.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {a.label}
          </button>
        )
      })}
    </div>
  )
}

const ActionsRow = React.memo(ActionsRowImpl)
export default ActionsRow
