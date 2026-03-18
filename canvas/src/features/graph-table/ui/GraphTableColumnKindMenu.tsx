import React from 'react'
import { Binary, Calendar, Code, SquareCheck, Type } from 'lucide-react'

import type { GraphColumnKind } from '@/features/graph-table-db/graphTableDb'
import { TypeMenu } from '@/components/ui/TypeMenu'

const GRAPH_TABLE_COLUMN_KIND_OPTIONS = [
  { key: 'text', label: 'Text', icon: Type },
  { key: 'number', label: 'Number', icon: Binary },
  { key: 'boolean', label: 'Checkbox', icon: SquareCheck },
  { key: 'date', label: 'Date', icon: Calendar },
  { key: 'json', label: 'JSON', icon: Code },
] as const satisfies readonly { key: GraphColumnKind; label: string; icon: React.ComponentType<{ className?: string }> }[]

export function labelForGraphColumnKind(kind: GraphColumnKind): string {
  const found = GRAPH_TABLE_COLUMN_KIND_OPTIONS.find(o => o.key === kind)
  return found ? found.label : String(kind)
}


export function GraphTableColumnKindMenu(props: {
  ariaLabel: string
  value: GraphColumnKind
  onSelect: (next: GraphColumnKind) => void
  className?: string
  close?: () => void
  disabled?: boolean
}) {
  return (
    <TypeMenu
      ariaLabel={props.ariaLabel}
      value={props.value}
      options={GRAPH_TABLE_COLUMN_KIND_OPTIONS}
      className={props.className}
      close={props.close}
      isDisabled={() => Boolean(props.disabled)}
      onSelect={props.onSelect}
    />
  )
}
