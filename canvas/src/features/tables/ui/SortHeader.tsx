import React from 'react'

export default function SortHeader({ label, active, dir }: { label: string; active: boolean; dir: 'asc' | 'desc' | null }) {
  return <span className="inline-flex items-center gap-1">{label}{active ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
}

