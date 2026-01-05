import React from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'

interface StatusBadgeProps {
  label: string
  ok: boolean | null
  msg?: string
  details?: string
  below?: boolean
}

const StatusBadge = React.memo(function StatusBadge({ ok, msg, details, below }: StatusBadgeProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconPillClass = useGraphStore(s => s.uiIconPillClass)
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const classes = React.useMemo(() => {
    if (ok === true) return 'text-green-700 border-green-200 bg-green-50'
    if (ok === false) return 'text-red-700 border-red-200 bg-red-50'
    return 'text-gray-600 border-gray-300 bg-gray-100'
  }, [ok])
  return (
    <div>
      <div
        className={`${uiIconPillClass} inline-flex items-center justify-center gap-1 text-xs min-w-[120px] ${classes}`}
      >
        {ok === true ? (
          <CheckCircle className={iconSizeClass} aria-hidden="true" />
        ) : ok === false ? (
          <XCircle className={iconSizeClass} aria-hidden="true" />
        ) : null}
        <span className="max-w-40 truncate">{ok == null ? (msg || 'Idle') : (msg || '')}</span>
        {!below && details ? <span className="text-gray-500">· {details}</span> : null}
      </div>
      {below && details ? (
        <div
          className={[
            'mt-1 text-gray-600',
            uiPanelMicroLabelTextSizeClass,
          ].join(' ')}
        >
          {details}
        </div>
      ) : null}
    </div>
  )
})

export default StatusBadge
