import React from 'react'
import type { MarkdownDataViewColumnType } from './markdownDataViewColumnType'
import { MARKDOWN_DATA_VIEW_COLUMN_TYPE_OPTIONS, isColumnTypeEditable } from './markdownDataViewColumnType'
import { iconByColumnType } from './markdownDataViewColumnTypeMenuIcons'
import { TypeMenu } from '@/components/ui/TypeMenu'

export function MarkdownDataViewColumnTypeMenu(props: {
  ariaLabel: string
  value: MarkdownDataViewColumnType
  onSelect: (next: MarkdownDataViewColumnType) => void
  className?: string
  disabled?: boolean
  close?: () => void
}) {
  return (
    <TypeMenu
      ariaLabel={props.ariaLabel}
      value={props.value}
      options={MARKDOWN_DATA_VIEW_COLUMN_TYPE_OPTIONS.map(o => ({
        key: o.key,
        label: o.label,
        icon: iconByColumnType[o.key],
      }))}
      className={props.className}
      close={props.close}
      isDisabled={(key) => Boolean(props.disabled) || !isColumnTypeEditable(key)}
      onSelect={props.onSelect}
    />
  )
}
