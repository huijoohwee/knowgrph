import React from 'react'
import type { Action } from '@/features/panels/ui/ActionsRowModel'

function ActionsRowImpl({ actions, className }: { actions: Action[]; className?: string }) {
  return (
    <div className={className || "mb-2 flex items-center gap-2"}>
      {actions.map(a => (
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
      ))}
    </div>
  )
}

const ActionsRow = React.memo(ActionsRowImpl)
export default ActionsRow
