import React from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

interface SelectedBoxProps {
  name: string
  idText?: string
  lines?: Array<React.ReactNode>
  statusOk?: boolean | null
  statusMsg?: string
  countsText?: string
  className?: string
}

function SelectedBoxImpl({ name, idText, lines = [], statusOk, statusMsg, countsText, className }: SelectedBoxProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const displayName = (name || '').trim() ? name : 'None'
  const failText = `Fail${(statusMsg || '').trim() ? ` — ${statusMsg}` : ''}`
  return (
    <div
      className={`mb-2 rounded border px-2 py-1 text-xs ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.primary} ${className || ''}`}
    >
      <div><span className="font-semibold">Selected:</span> {displayName}{(idText || '').trim() ? ` (${idText})` : ''}</div>
      {typeof countsText === 'string' && countsText.trim() && (
        <div className="mt-1">{countsText}</div>
      )}
      {lines.map((ln, idx) => (
        <div key={idx}>{ln}</div>
      ))}
      {statusOk === true && (
        <div className="mt-1 inline-flex items-center text-green-600"><CheckCircle className={`${iconSizeClass} mr-1`} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />{statusMsg || 'Success'}</div>
      )}
      {statusOk === false && (
        <div className="mt-1 inline-flex items-center text-red-600"><XCircle className={`${iconSizeClass} mr-1`} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />{failText}</div>
      )}
    </div>
  )
}

const SelectedBox = React.memo(SelectedBoxImpl)
export default SelectedBox
