import React from 'react'
import { Binary, Calendar, Code, MapPin, SquareCheck, Type } from 'lucide-react'

import type { GraphRecordColumnKind } from '@/lib/graph-record-db'
import { TypeMenu } from '@/components/ui/TypeMenu'

const GRAPH_DATA_TABLE_COLUMN_KIND_OPTIONS = [
  { key: 'text', label: 'Text', icon: Type },
  { key: 'number', label: 'Number', icon: Binary },
  { key: 'boolean', label: 'Checkbox', icon: SquareCheck },
  { key: 'date', label: 'Date', icon: Calendar },
  { key: 'geodata', label: 'Geodata', icon: MapPin },
  { key: 'json', label: 'JSON', icon: Code },
] as const satisfies readonly { key: GraphRecordColumnKind; label: string; icon: React.ComponentType<{ className?: string }> }[]

export function labelForGraphRecordColumnKind(kind: GraphRecordColumnKind): string {
  const found = GRAPH_DATA_TABLE_COLUMN_KIND_OPTIONS.find(o => o.key === kind)
  return found ? found.label : String(kind)
}


export function GraphDataTableColumnKindMenu(props: {
  ariaLabel: string
  value: GraphRecordColumnKind
  onSelect: (next: GraphRecordColumnKind) => void
  className?: string
  close?: () => void
  disabled?: boolean
}) {
  return (
    <TypeMenu
      ariaLabel={props.ariaLabel}
      value={props.value}
      options={GRAPH_DATA_TABLE_COLUMN_KIND_OPTIONS}
      className={props.className}
      close={props.close}
      isDisabled={() => Boolean(props.disabled)}
      onSelect={props.onSelect}
    />
  )
}
