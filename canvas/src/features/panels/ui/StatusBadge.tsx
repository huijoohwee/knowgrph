import React from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

interface StatusBadgeProps {
  label: string
  ok: boolean | null
  msg?: string
  details?: string
  below?: boolean
}

const StatusBadge = React.memo(function StatusBadge({ ok, msg, details, below }: StatusBadgeProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const uiIconPillClass = useGraphStore(s => s.uiIconPillClass)
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const classes = React.useMemo(() => {
    if (ok === true) return UI_THEME_TOKENS.status.success
    if (ok === false) return UI_THEME_TOKENS.status.error
    return UI_THEME_TOKENS.status.neutral
  }, [ok])
  return (
    <div>
      <div
        className={`${uiIconPillClass} inline-flex items-center justify-center gap-1 h-[var(--kg-status-pill-height,24px)] box-border px-2 text-xs min-w-[120px] ${classes}`}
      >
        {ok === true ? (
          <CheckCircle className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
        ) : ok === false ? (
          <XCircle className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
        ) : null}
        <span className="max-w-40 truncate">{ok == null ? (msg || 'Idle') : (msg || '')}</span>
        {!below && details ? <span className={`${UI_THEME_TOKENS.text.tertiary}`}>· {details}</span> : null}
      </div>
      {below && details ? (
        <div
          className={[
            'mt-1',
            UI_THEME_TOKENS.text.secondary,
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
