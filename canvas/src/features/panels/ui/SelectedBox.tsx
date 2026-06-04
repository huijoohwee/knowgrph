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
    <section
      className={`mb-2 rounded border px-2 py-1 text-xs ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.primary} ${className || ''}`}
    >
      <section><span className="font-semibold">Selected:</span> {displayName}{(idText || '').trim() ? ` (${idText})` : ''}</section>
      {typeof countsText === 'string' && countsText.trim() && (
        <section className="mt-1">{countsText}</section>
      )}
      {lines.map((ln, idx) => (
        <section key={idx}>{ln}</section>
      ))}
      {statusOk === true && (
        <section className="mt-1 inline-flex items-center text-green-600"><CheckCircle className={`${iconSizeClass} mr-1`} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />{statusMsg || 'Success'}</section>
      )}
      {statusOk === false && (
        <section className="mt-1 inline-flex items-center text-red-600"><XCircle className={`${iconSizeClass} mr-1`} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />{failText}</section>
      )}
    </section>
  )
}

const SelectedBox = React.memo(SelectedBoxImpl)
export default SelectedBox
