import React from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  UI_RESPONSIVE_STATUS_BADGE_CLASSNAME,
  UI_RESPONSIVE_STATUS_BADGE_DETAIL_CLASSNAME,
  UI_RESPONSIVE_STATUS_BADGE_MESSAGE_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'

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
    <section className="min-w-0 max-w-full overflow-hidden">
      <section
        className={`${uiIconPillClass} ${UI_RESPONSIVE_STATUS_BADGE_CLASSNAME} inline-flex h-[var(--kg-status-pill-height,24px)] max-w-full items-center justify-center gap-1 overflow-hidden box-border px-2 text-xs ${classes}`}
      >
        {ok === true ? (
          <CheckCircle className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
        ) : ok === false ? (
          <XCircle className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
        ) : null}
        <span className={UI_RESPONSIVE_STATUS_BADGE_MESSAGE_CLASSNAME}>{ok == null ? (msg || 'Idle') : (msg || '')}</span>
        {!below && details ? (
          <span className={`${UI_RESPONSIVE_STATUS_BADGE_DETAIL_CLASSNAME} ${UI_THEME_TOKENS.text.tertiary}`}>
            · {details}
          </span>
        ) : null}
      </section>
      {below && details ? (
        <section
          className={[
            'mt-1',
            'min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap',
            UI_THEME_TOKENS.text.secondary,
            uiPanelMicroLabelTextSizeClass,
          ].join(' ')}
        >
          {details}
        </section>
      ) : null}
    </section>
  )
})

export default StatusBadge
