import type { ReactNode } from 'react'
import {
  KTV_KEY_ICON_SLIDER_INPUT_GRID_CLASS_NAME,
  KTV_KEY_ICON_VALUE_GRID_CLASS_NAME,
  KTV_KEY_TYPE_VALUE_GRID_CLASS_NAME,
  KTV_KEY_VALUE_GRID_CLASS_NAME,
  KTV_ROW_LABEL_CELL_CLASS_NAME,
  KTV_ROW_VALUE_CELL_CLASS_NAME,
  KTV_VALUE_CELL_ROW_SCROLL_CLASS_NAME,
  KTV_VALUE_ROW_SCROLL_CLASS_NAME,
} from '../ui/keyTypeValueRows.js'
import { UI_THEME_TOKENS } from '../ui/themeTokens.js'

export type KeyTypeValueStaticRowLayout =
  | 'keyTypeValue'
  | 'keyValue'
  | 'keyIconValue'
  | 'keyIconSliderInput'

export interface KeyTypeValueStaticRowProps {
  keyNode: ReactNode
  typeNode?: ReactNode
  valueNode: ReactNode
  align?: 'center' | 'start'
  layout?: KeyTypeValueStaticRowLayout
  textSizeClassName: string
  fontClassName: string
  densityClassName: string
  activeClassName?: string
  onClick?: () => void
  className?: string
  id?: string
  dataKgAnchor?: string
}

export interface RightAlignedValueCellProps {
  children: ReactNode
  className?: string
}

export interface SimpleKeyValueRowProps {
  label: ReactNode
  children: ReactNode
  align?: 'center' | 'start'
  className?: string
  textSizeClassName: string
  fontClassName: string
  densityClassName: string
  activeClassName?: string
  onClick?: () => void
}

function buildRootClassName({
  gridClassName,
  align,
  textSizeClassName,
  fontClassName,
  densityClassName,
  activeClassName,
  onClick,
  className,
}: {
  gridClassName: string
  align: 'center' | 'start'
  textSizeClassName: string
  fontClassName: string
  densityClassName: string
  activeClassName?: string
  onClick?: () => void
  className?: string
}) {
  const alignClassName = align === 'start' ? 'items-start' : 'items-center'
  const cursorClassName = onClick ? 'cursor-pointer' : ''
  return [
    `grid w-full ${gridClassName}`,
    'gap-x-2 gap-y-0 rounded',
    activeClassName || '',
    textSizeClassName,
    fontClassName,
    densityClassName,
    alignClassName,
    cursorClassName,
    className || '',
  ]
    .filter(Boolean)
    .join(' ')
}

export function KeyTypeValueStaticRow({
  keyNode,
  typeNode,
  valueNode,
  align = 'center',
  layout = 'keyTypeValue',
  textSizeClassName,
  fontClassName,
  densityClassName,
  activeClassName,
  onClick,
  className,
  id,
  dataKgAnchor,
}: KeyTypeValueStaticRowProps) {
  if (layout === 'keyIconSliderInput') {
    return (
      <dl
        className={buildRootClassName({
          gridClassName: KTV_KEY_ICON_SLIDER_INPUT_GRID_CLASS_NAME,
          align,
          textSizeClassName,
          fontClassName,
          densityClassName,
          activeClassName,
          onClick,
          className,
        })}
        onClick={onClick}
      >
        <dt className={`${KTV_ROW_LABEL_CELL_CLASS_NAME} items-center gap-1 ${UI_THEME_TOKENS.text.primary}`}>
          {keyNode}
        </dt>
        <dd className={`flex min-w-0 items-center justify-center ${UI_THEME_TOKENS.text.tertiary}`} />
        <dd className={`${KTV_ROW_LABEL_CELL_CLASS_NAME} items-center gap-2 ${UI_THEME_TOKENS.text.secondary}`}>
          {typeNode}
        </dd>
        <dd className={`${KTV_ROW_VALUE_CELL_CLASS_NAME} ${KTV_VALUE_CELL_ROW_SCROLL_CLASS_NAME} items-stretch`}>
          {valueNode}
        </dd>
      </dl>
    )
  }

  if (layout === 'keyIconValue') {
    return (
      <dl
        className={buildRootClassName({
          gridClassName: KTV_KEY_ICON_VALUE_GRID_CLASS_NAME,
          align,
          textSizeClassName,
          fontClassName,
          densityClassName,
          activeClassName,
          onClick,
          className,
        })}
        onClick={onClick}
      >
        <dt className={`${KTV_ROW_LABEL_CELL_CLASS_NAME} items-center gap-1 ${UI_THEME_TOKENS.text.primary}`}>
          {keyNode}
        </dt>
        <dd className={`flex min-w-0 items-center justify-center ${UI_THEME_TOKENS.text.tertiary}`}>
          {typeNode}
        </dd>
        <dd className={`${KTV_ROW_VALUE_CELL_CLASS_NAME} ${KTV_VALUE_CELL_ROW_SCROLL_CLASS_NAME} items-center`}>
          {valueNode}
        </dd>
      </dl>
    )
  }

  if (layout === 'keyValue') {
    return (
      <dl
        className={buildRootClassName({
          gridClassName: KTV_KEY_VALUE_GRID_CLASS_NAME,
          align,
          textSizeClassName,
          fontClassName,
          densityClassName,
          activeClassName,
          onClick,
          className,
        })}
        onClick={onClick}
      >
        <dt className={`${KTV_ROW_LABEL_CELL_CLASS_NAME} items-center gap-1 ${UI_THEME_TOKENS.text.primary}`}>
          {keyNode}
        </dt>
        <dd className={`${KTV_ROW_VALUE_CELL_CLASS_NAME} ${KTV_VALUE_ROW_SCROLL_CLASS_NAME} items-center`}>
          {valueNode}
        </dd>
      </dl>
    )
  }

  return (
    <dl
      id={id}
      data-kg-anchor={dataKgAnchor}
      className={buildRootClassName({
        gridClassName: KTV_KEY_TYPE_VALUE_GRID_CLASS_NAME,
        align,
        textSizeClassName,
        fontClassName,
        densityClassName,
        activeClassName,
        onClick,
        className,
      })}
      onClick={onClick}
    >
      <dt className={`${KTV_ROW_LABEL_CELL_CLASS_NAME} items-center gap-1 ${UI_THEME_TOKENS.text.primary}`}>
        {keyNode}
      </dt>
      <dd className={`${KTV_ROW_LABEL_CELL_CLASS_NAME} items-center justify-start sm:justify-end ${UI_THEME_TOKENS.text.secondary}`}>
        {typeNode}
      </dd>
      <dd className={`${KTV_ROW_VALUE_CELL_CLASS_NAME} ${KTV_VALUE_ROW_SCROLL_CLASS_NAME} items-center`}>
        {valueNode}
      </dd>
    </dl>
  )
}

export function RightAlignedValueCell({ children, className }: RightAlignedValueCellProps) {
  const rootClassName = [KTV_VALUE_ROW_SCROLL_CLASS_NAME, className || '']
    .filter(Boolean)
    .join(' ')
  return <section className={rootClassName}>{children}</section>
}

export function SimpleKeyValueRow({
  label,
  children,
  align,
  className,
  textSizeClassName,
  fontClassName,
  densityClassName,
  activeClassName,
  onClick,
}: SimpleKeyValueRowProps) {
  return (
    <KeyTypeValueStaticRow
      keyNode={label}
      valueNode={children}
      align={align}
      layout="keyValue"
      className={className}
      textSizeClassName={textSizeClassName}
      fontClassName={fontClassName}
      densityClassName={densityClassName}
      activeClassName={activeClassName}
      onClick={onClick}
    />
  )
}
