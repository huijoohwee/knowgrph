import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { formatDateDraftFromCellValue, normalizeDateDraftToValue } from '@/features/graph-table/ui/fast-grid/dateCellValue'

function addMonths(d: Date, delta: number): Date {
  const next = new Date(d.getTime())
  next.setMonth(next.getMonth() + delta)
  return next
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function startOfWeekSunday(d: Date): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  next.setDate(next.getDate() - next.getDay())
  return next
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function ymd(d: Date): string {
  const yyyy = String(d.getFullYear()).padStart(4, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export type DateCellEditorState = {
  rowId: string
  columnId: string
  initialValue: unknown
  rect: { x: number; y: number; w: number; h: number }
}

export function DateCellEditor(props: {
  state: DateCellEditorState
  onCommit: (value: string | null) => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const commitLockRef = useRef(false)
  const [draft, setDraft] = useState(() => formatDateDraftFromCellValue(props.state.initialValue))
  const [invalid, setInvalid] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const monthAnchor = useMemo(() => {
    const initialDraft = formatDateDraftFromCellValue(props.state.initialValue)
    const normalized = normalizeDateDraftToValue(initialDraft)
    if (!normalized.ok || !normalized.value) return startOfMonth(new Date())
    const ms = Date.parse(normalized.value)
    if (!Number.isFinite(ms)) return startOfMonth(new Date())
    return startOfMonth(new Date(ms))
  }, [props.state.initialValue])

  const selectedYmd = useMemo(() => {
    const res = normalizeDateDraftToValue(draft)
    if (!res.ok) return null
    return res.value
  }, [draft])

  const [activeMonth, setActiveMonth] = useState<Date>(monthAnchor)

  useEffect(() => {
    setDraft(formatDateDraftFromCellValue(props.state.initialValue))
    setInvalid(false)
    setPickerOpen(false)
    setActiveMonth(monthAnchor)
    commitLockRef.current = false
  }, [monthAnchor, props.state.columnId, props.state.initialValue, props.state.rowId])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    try {
      el.focus()
      el.select()
    } catch {
      void 0
    }
  }, [props.state.columnId, props.state.rowId])

  const commitIfValid = () => {
    if (commitLockRef.current) return
    const res = normalizeDateDraftToValue(draft)
    if (!res.ok) {
      setInvalid(true)
      return
    }
    commitLockRef.current = true
    props.onCommit(res.value)
  }

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const monthLabel = useMemo(() => {
    try {
      return activeMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })
    } catch {
      return `${activeMonth.getFullYear()}-${String(activeMonth.getMonth() + 1).padStart(2, '0')}`
    }
  }, [activeMonth])

  const dayGrid = useMemo(() => {
    const start = startOfWeekSunday(startOfMonth(activeMonth))
    const weeks: Date[][] = []
    const cursor = new Date(start.getTime())
    for (let w = 0; w < 6; w += 1) {
      const row: Date[] = []
      for (let d = 0; d < 7; d += 1) {
        row.push(new Date(cursor.getTime()))
        cursor.setDate(cursor.getDate() + 1)
      }
      weeks.push(row)
    }
    return weeks
  }, [activeMonth])

  return (
    <section
      aria-label="Date cell editor"
      className="absolute z-20"
      style={{
        left: Math.round(props.state.rect.x),
        top: Math.round(props.state.rect.y),
        width: Math.round(props.state.rect.w),
        height: Math.round(props.state.rect.h),
      }}
    >
      <section className="relative h-full w-full" aria-label="Date input wrapper">
        <input
          ref={inputRef}
          value={draft}
          onChange={e => {
            setDraft(e.target.value)
            setInvalid(false)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitIfValid()
              return
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              props.onCancel()
              return
            }
            if (e.key === 'ArrowDown' && e.altKey) {
              e.preventDefault()
              setPickerOpen(v => !v)
              return
            }
          }}
          onBlur={() => {
            if (pickerOpen) return
            commitIfValid()
          }}
          className={`h-full w-full pr-14 pl-2 rounded border ${invalid ? 'border-red-400 dark:border-red-500' : UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
          aria-invalid={invalid}
          aria-label={`Edit ${props.state.columnId}`}
          inputMode="numeric"
          placeholder="YYYY-MM-DD"
        />

        <section className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1" aria-label="Date actions">
          {draft.trim() ? (
            <button
              type="button"
              className={`h-7 w-7 rounded border flex items-center justify-center ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.button.hoverBg}`}
              aria-label="Clear date"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                if (commitLockRef.current) return
                setDraft('')
                setInvalid(false)
                commitLockRef.current = true
                props.onCommit(null)
              }}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            className={`h-7 w-7 rounded border flex items-center justify-center ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.button.hoverBg}`}
            aria-label={pickerOpen ? 'Close date picker' : 'Open date picker'}
            onMouseDown={e => e.preventDefault()}
            onClick={() => setPickerOpen(v => !v)}
          >
            <Calendar className="h-4 w-4" />
          </button>
        </section>
      </section>

      {invalid ? (
        <section className={`mt-1 text-[10px] ${UI_THEME_TOKENS.text.tertiary}`} aria-label="Invalid date message">
          Invalid date
        </section>
      ) : null}

      {pickerOpen ? (
        <section
          role="dialog"
          aria-label="Date picker"
          className={`absolute left-0 mt-1 rounded border shadow-lg ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`}
          style={{ width: 260 }}
          onPointerDown={e => {
            e.preventDefault()
          }}
        >
          <header className={`px-2 py-2 border-b flex items-center justify-between ${UI_THEME_TOKENS.panel.divider}`} aria-label="Picker header">
            <button
              type="button"
              className={`h-7 w-7 rounded border flex items-center justify-center ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.button.hoverBg}`}
              aria-label="Previous month"
              onClick={() => setActiveMonth(m => addMonths(m, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <section className={`text-xs font-semibold ${UI_THEME_TOKENS.text.primary}`} aria-label="Active month">
              {monthLabel}
            </section>
            <button
              type="button"
              className={`h-7 w-7 rounded border flex items-center justify-center ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.button.hoverBg}`}
              aria-label="Next month"
              onClick={() => setActiveMonth(m => addMonths(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </header>

          <table className="w-full" aria-label="Calendar grid">
            <thead>
              <tr>
                {weekdays.map(d => (
                  <th key={d} className={`py-1 text-[10px] font-semibold ${UI_THEME_TOKENS.text.tertiary}`} scope="col">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dayGrid.map((week, wi) => (
                <tr key={String(wi)}>
                  {week.map(day => {
                    const inMonth = day.getMonth() === activeMonth.getMonth()
                    const today = isSameDay(day, new Date())
                    const selected = selectedYmd ? ymd(day) === selectedYmd : false
                    const baseText = inMonth ? UI_THEME_TOKENS.text.primary : UI_THEME_TOKENS.text.tertiary
                    const bg = selected
                      ? 'bg-blue-600 text-white'
                      : today
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : ''
                    return (
                      <td key={day.toISOString()} className="p-0" aria-label={ymd(day)}>
                        <button
                          type="button"
                          className={`w-full py-1 text-xs rounded ${bg} ${selected ? '' : baseText} ${UI_THEME_TOKENS.button.hoverBg}`}
                          onClick={() => {
                            if (commitLockRef.current) return
                            const next = ymd(day)
                            setDraft(next)
                            setInvalid(false)
                            commitLockRef.current = true
                            props.onCommit(next)
                          }}
                        >
                          {day.getDate()}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </section>
  )
}
