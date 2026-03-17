import React from 'react'
import { CheckCircle2, Circle } from 'lucide-react'

const colorClasses = [
  'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/60 dark:text-slate-100 dark:border-slate-700',
  'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-800',
  'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-800',
  'bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-900/30 dark:text-sky-100 dark:border-sky-800',
  'bg-purple-100 text-purple-900 border-purple-200 dark:bg-purple-900/30 dark:text-purple-100 dark:border-purple-800',
  'bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-900/30 dark:text-rose-100 dark:border-rose-800',
] as const

const fixedChipClasses: Record<string, string> = {
  todo: colorClasses[0],
  doing: colorClasses[3],
  done: colorClasses[2],
  '1': colorClasses[1],
  '2': colorClasses[4],
  '3': colorClasses[5],
}

const hashPick = (key: string): string => {
  const s = String(key || '').trim().toLowerCase()
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return colorClasses[h % colorClasses.length] || colorClasses[0]
}

export const resolveDataViewChipClass = (value: string): string => {
  const key = String(value || '').trim().toLowerCase()
  if (!key) return colorClasses[0]
  return fixedChipClasses[key] || hashPick(key)
}

export const DataViewTagChip = React.memo(function DataViewTagChip(props: { value: string }) {
  const v = String(props.value || '').trim()
  if (!v) return null
  return (
    <span className={['inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-medium', resolveDataViewChipClass(v)].join(' ')}>
      {v}
    </span>
  )
})

export const DataViewStatusChip = React.memo(function DataViewStatusChip(props: { value: string; checked?: boolean }) {
  const v = String(props.value || '').trim()
  if (!v) return null
  return (
    <span className={['inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-medium', resolveDataViewChipClass(v)].join(' ')}>
      {props.checked ? <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> : <Circle className="w-3 h-3" aria-hidden="true" />}
      {v}
    </span>
  )
})
