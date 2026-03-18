import React from 'react'
import { ArrowLeft, ArrowRight, EyeOff, Filter, Trash2, Copy, ArrowUp, ArrowDown, Columns2 } from 'lucide-react'

import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { DetailsMenu } from '@/components/ui/DetailsMenu'

export type ColumnHeaderMenuFilterOp = string

export type ColumnHeaderMenuProps = {
  ariaLabel: string
  closeMenu: () => void

  typeSummaryLabel: string
  typeValueLabel: string
  renderTypeMenu: (args: { closeMenu: () => void }) => React.ReactNode
  disableTypeChange?: boolean

  onHideInView?: () => void

  filter?: {
    ops: readonly { key: ColumnHeaderMenuFilterOp; label: string }[]
    defaultOp: ColumnHeaderMenuFilterOp
    defaultValue?: string
    onApply: (args: { op: ColumnHeaderMenuFilterOp; value: string }) => void
    isDisabled?: boolean
  }

  onSortAsc?: () => void
  onSortDesc?: () => void
  disableSort?: boolean

  onInsertLeft?: () => void
  onInsertRight?: () => void
  disableInsert?: boolean

  onMoveLeft?: () => void
  onMoveRight?: () => void
  disableMoveLeft?: boolean
  disableMoveRight?: boolean

  onDuplicate?: () => void
  disableDuplicate?: boolean

  onDelete?: () => void
  disableDelete?: boolean
}

const itemBtn = (disabled?: boolean): string => {
  return [
    'w-full flex items-center gap-2 px-2 py-2 rounded text-xs',
    disabled ? UI_THEME_TOKENS.text.tertiary : UI_THEME_TOKENS.button.hoverBg,
  ].join(' ')
}

const icon14 = ['w-4 h-4 shrink-0', UI_THEME_TOKENS.icon.color].join(' ')

export const ColumnHeaderMenu = React.memo(function ColumnHeaderMenu(props: ColumnHeaderMenuProps) {
  const [filterOp, setFilterOp] = React.useState(props.filter?.defaultOp || 'contains')
  const [filterValue, setFilterValue] = React.useState(props.filter?.defaultValue || '')
  const [isTypeOpen, setIsTypeOpen] = React.useState(false)
  const typeCloseTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (!props.filter) return
    setFilterOp(props.filter.defaultOp)
    setFilterValue(props.filter.defaultValue || '')
  }, [props.filter?.defaultOp, props.filter?.defaultValue])

  React.useEffect(() => {
    setIsTypeOpen(false)
  }, [props.ariaLabel])

  React.useEffect(() => {
    return () => {
      if (typeCloseTimerRef.current != null) {
        window.clearTimeout(typeCloseTimerRef.current)
        typeCloseTimerRef.current = null
      }
    }
  }, [])

  const openType = React.useCallback(() => {
    if (typeCloseTimerRef.current != null) {
      window.clearTimeout(typeCloseTimerRef.current)
      typeCloseTimerRef.current = null
    }
    setIsTypeOpen(true)
  }, [])

  const scheduleCloseType = React.useCallback(() => {
    if (typeCloseTimerRef.current != null) window.clearTimeout(typeCloseTimerRef.current)
    typeCloseTimerRef.current = window.setTimeout(() => {
      typeCloseTimerRef.current = null
      setIsTypeOpen(false)
    }, 160)
  }, [])

  return (
    <menu
      className={['rounded border shadow-sm p-1 w-[260px]', UI_THEME_TOKENS.panel.bg, UI_THEME_TOKENS.panel.border].join(' ')}
      aria-label={props.ariaLabel}
    >
      <li className="list-none">
        <details
          className="relative"
          open={isTypeOpen}
          onMouseEnter={openType}
          onMouseLeave={scheduleCloseType}
        >
          <summary
            className={[itemBtn(props.disableTypeChange), 'list-none'].join(' ')}
            aria-disabled={props.disableTypeChange}
            onClick={e => {
              e.preventDefault()
              if (isTypeOpen) scheduleCloseType()
              else openType()
            }}
          >
            <Columns2 className={icon14} aria-hidden="true" />
            <span className="flex-1 text-left">{props.typeSummaryLabel}</span>
            <span className={['truncate max-w-[120px]', UI_THEME_TOKENS.text.secondary].join(' ')}>{props.typeValueLabel}</span>
            <ArrowRight className={icon14} aria-hidden="true" />
          </summary>
          <div className="absolute left-full top-0 pl-1" onMouseEnter={openType} onMouseLeave={scheduleCloseType}>
            {props.renderTypeMenu({ closeMenu: props.closeMenu })}
          </div>
        </details>
      </li>

      <li className="list-none">
        <hr className={['my-1', UI_THEME_TOKENS.panel.border].join(' ')} />
      </li>

      <li className="list-none">
        <button
          type="button"
          className={itemBtn(!props.onHideInView)}
          disabled={!props.onHideInView}
          onClick={() => {
            props.onHideInView?.()
            props.closeMenu()
          }}
        >
          <EyeOff className={icon14} aria-hidden="true" />
          <span className="flex-1 text-left">Hide In View</span>
        </button>
      </li>

      <li className="list-none">
        <hr className={['my-1', UI_THEME_TOKENS.panel.border].join(' ')} />
      </li>

      {props.filter ? (
        <li className="list-none">
          <DetailsMenu
            ariaLabel="Filter"
            detailsClassName="relative"
            summaryClassName={itemBtn(Boolean(props.filter.isDisabled))}
            menuClassName="absolute left-0 mt-1"
            summary={
              <>
                <Filter className={icon14} aria-hidden="true" />
                <span className="flex-1 text-left">Filter</span>
                <ArrowRight className={icon14} aria-hidden="true" />
              </>
            }
            menu={({ close }) => (
              <section
                className={['rounded border shadow-sm p-2 w-[260px]', UI_THEME_TOKENS.panel.bg, UI_THEME_TOKENS.panel.border].join(' ')}
                aria-label="Filter editor"
              >
                <header className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    className={['inline-flex items-center justify-center w-8 h-8 rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(
                      ' ',
                    )}
                    aria-label="Back"
                    onClick={() => close()}
                  >
                    <ArrowLeft className={icon14} aria-hidden="true" />
                  </button>
                  <div className={['font-medium text-sm', UI_THEME_TOKENS.text.primary].join(' ')}>Filter</div>
                </header>

                <fieldset className="border-0 p-0 m-0 space-y-2">
                  <label className="flex items-center gap-2">
                    <span className={['text-xs w-12', UI_THEME_TOKENS.text.secondary].join(' ')}>Op</span>
                    <select
                      className={['h-7 px-2 rounded border flex-1', UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.bg].join(' ')}
                      value={filterOp}
                      onChange={e => setFilterOp(e.target.value)}
                      disabled={props.filter?.isDisabled}
                    >
                      {props.filter.ops.map(o => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className={['text-xs w-12', UI_THEME_TOKENS.text.secondary].join(' ')}>Value</span>
                    <input
                      className={['h-7 px-2 rounded border flex-1', UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.bg].join(' ')}
                      value={filterValue}
                      onChange={e => setFilterValue(e.target.value)}
                      disabled={props.filter?.isDisabled}
                    />
                  </label>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      className={['h-7 px-2 rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')}
                      onClick={() => close()}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={['h-7 px-2 rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')}
                      disabled={props.filter?.isDisabled}
                      onClick={() => {
                        if (props.filter?.isDisabled) return
                        props.filter.onApply({ op: filterOp, value: String(filterValue ?? '') })
                        props.closeMenu()
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </fieldset>
              </section>
            )}
          />
        </li>
      ) : (
        <li className="list-none">
          <button type="button" className={itemBtn(true)} disabled>
            <Filter className={icon14} aria-hidden="true" />
            <span className="flex-1 text-left">Filter</span>
          </button>
        </li>
      )}

      <li className="list-none">
        <button
          type="button"
          className={itemBtn(Boolean(props.disableSort || !props.onSortAsc))}
          disabled={Boolean(props.disableSort || !props.onSortAsc)}
          onClick={() => {
            props.onSortAsc?.()
            props.closeMenu()
          }}
        >
          <ArrowUp className={icon14} aria-hidden="true" />
          <span className="flex-1 text-left">Sort Ascending</span>
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={itemBtn(Boolean(props.disableSort || !props.onSortDesc))}
          disabled={Boolean(props.disableSort || !props.onSortDesc)}
          onClick={() => {
            props.onSortDesc?.()
            props.closeMenu()
          }}
        >
          <ArrowDown className={icon14} aria-hidden="true" />
          <span className="flex-1 text-left">Sort Descending</span>
        </button>
      </li>

      <li className="list-none">
        <hr className={['my-1', UI_THEME_TOKENS.panel.border].join(' ')} />
      </li>

      <li className="list-none">
        <button
          type="button"
          className={itemBtn(Boolean(props.disableInsert || !props.onInsertLeft))}
          disabled={Boolean(props.disableInsert || !props.onInsertLeft)}
          onClick={() => {
            props.onInsertLeft?.()
            props.closeMenu()
          }}
        >
          <ArrowLeft className={icon14} aria-hidden="true" />
          <span className="flex-1 text-left">Insert Left Column</span>
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={itemBtn(Boolean(props.disableInsert || !props.onInsertRight))}
          disabled={Boolean(props.disableInsert || !props.onInsertRight)}
          onClick={() => {
            props.onInsertRight?.()
            props.closeMenu()
          }}
        >
          <ArrowRight className={icon14} aria-hidden="true" />
          <span className="flex-1 text-left">Insert Right Column</span>
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={itemBtn(Boolean(props.disableMoveLeft || !props.onMoveLeft))}
          disabled={Boolean(props.disableMoveLeft || !props.onMoveLeft)}
          onClick={() => {
            props.onMoveLeft?.()
            props.closeMenu()
          }}
        >
          <ArrowLeft className={icon14} aria-hidden="true" />
          <span className="flex-1 text-left">Move Left</span>
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={itemBtn(Boolean(props.disableMoveRight || !props.onMoveRight))}
          disabled={Boolean(props.disableMoveRight || !props.onMoveRight)}
          onClick={() => {
            props.onMoveRight?.()
            props.closeMenu()
          }}
        >
          <ArrowRight className={icon14} aria-hidden="true" />
          <span className="flex-1 text-left">Move Right</span>
        </button>
      </li>

      <li className="list-none">
        <hr className={['my-1', UI_THEME_TOKENS.panel.border].join(' ')} />
      </li>

      <li className="list-none">
        <button
          type="button"
          className={itemBtn(Boolean(props.disableDuplicate || !props.onDuplicate))}
          disabled={Boolean(props.disableDuplicate || !props.onDuplicate)}
          onClick={() => {
            props.onDuplicate?.()
            props.closeMenu()
          }}
        >
          <Copy className={icon14} aria-hidden="true" />
          <span className="flex-1 text-left">Duplicate</span>
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={itemBtn(Boolean(props.disableDelete || !props.onDelete))}
          disabled={Boolean(props.disableDelete || !props.onDelete)}
          onClick={() => {
            props.onDelete?.()
            props.closeMenu()
          }}
        >
          <Trash2 className={icon14} aria-hidden="true" />
          <span className="flex-1 text-left">Delete</span>
        </button>
      </li>
    </menu>
  )
})
