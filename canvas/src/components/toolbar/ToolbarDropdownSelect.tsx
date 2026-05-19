import React from 'react'
import IconButton from '@/components/IconButton'
import { DropdownPanel } from '@/lib/ui/overlay'
import { emitToolbarDropdownOpen, subscribeToolbarDropdownOpen } from '@/components/toolbar/dropdownOpenEvents'
import { uiPrimaryChipActiveClassName, uiPrimaryIconActiveClassName, uiPrimaryIconInactiveClassName } from '@/features/toolbar/ui/toolbarStyles'
import { UI_RESPONSIVE_TOUCH_MENU_ROW_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type ToolbarDropdownOptionBase = {
  id: string
  title: string
  children?: readonly ToolbarDropdownOptionBase[]
  isActive?: boolean
  dividerBefore?: boolean
  disabled?: boolean
  disabledReason?: string
  enableHint?: string
}

type ToolbarDropdownSelectProps<T extends ToolbarDropdownOptionBase> = {
  value: T['id']
  options: readonly T[]
  title: string
  tooltipContent?: string
  showTooltip?: boolean
  disabled?: boolean
  isButtonActive?: boolean
  menuWidthClass?: string
  onSelect: (id: T['id']) => void
  onTriggerClick?: () => boolean
  renderButtonContent: (activeOption: T) => React.ReactNode
  renderOptionContent?: (option: T) => React.ReactNode
  renderMenuAppend?: () => React.ReactNode
  onSelectComplete?: (id: T['id']) => void
}

export function ToolbarDropdownSelect<T extends ToolbarDropdownOptionBase>({
  value,
  options,
  title,
  tooltipContent,
  showTooltip = true,
  disabled,
  isButtonActive,
  menuWidthClass = 'w-72',
  onSelect,
  onTriggerClick,
  renderButtonContent,
  renderOptionContent,
  renderMenuAppend,
  onSelectComplete,
}: ToolbarDropdownSelectProps<T>) {
  const [open, setOpen] = React.useState(false)
  const [openSubmenuId, setOpenSubmenuId] = React.useState<string | null>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const optionButtonRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const dropdownIdRef = React.useRef(`toolbar-dropdown-${Math.random().toString(36).slice(2)}`)
  const activeOption = React.useMemo(() => options.find(option => option.id === value) || options[0], [options, value])
  const enabledOptions = React.useMemo(() => options.filter(option => option.disabled !== true), [options])
  const focusOptionAtIndex = React.useCallback((index: number) => {
    const optionEl = optionButtonRefs.current[index]
    if (!optionEl) return
    try {
      optionEl.focus({ preventScroll: true })
    } catch {
      optionEl.focus()
    }
  }, [])
  const closeMenuNow = React.useCallback(() => {
    setOpen(false)
    setOpenSubmenuId(null)
  }, [])
  React.useEffect(() => {
    return subscribeToolbarDropdownOpen(detail => {
      if (detail.sourceId === dropdownIdRef.current) return
      setOpen(false)
      setOpenSubmenuId(null)
    })
  }, [])
  React.useEffect(() => {
    if (!open) {
      optionButtonRefs.current = []
      return
    }
    const preferredIndex = Math.max(0, options.findIndex(option => option.id === value && option.disabled !== true))
    const rafId = requestAnimationFrame(() => {
      focusOptionAtIndex(preferredIndex)
    })
    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [focusOptionAtIndex, open, options, value])
  if (!activeOption) return null

  return (
    <>
      <IconButton
        ref={buttonRef}
        className={`App-toolbar__btn ${open || isButtonActive ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName}`}
        title={title}
        ariaLabel={title}
        suppressTitleAttribute={!showTooltip}
        tooltipContent={tooltipContent}
        disabled={disabled}
        onClick={() => {
          if (onTriggerClick?.() === true) {
            closeMenuNow()
            return
          }
          const next = !open
          if (next) {
            emitToolbarDropdownOpen(dropdownIdRef.current)
          } else {
            setOpenSubmenuId(null)
          }
          setOpen(next)
        }}
        showTooltip={showTooltip}
      >
        {renderButtonContent(activeOption)}
      </IconButton>
      {open ? (
        <DropdownPanel
          anchorRef={buttonRef}
          open={open}
          onClose={() => {
            setOpen(false)
            setOpenSubmenuId(null)
          }}
          align="bottom-center"
        >
          <menu
            className={`kg-toolbar-dropdown-menu p-1 flex flex-col gap-1 ${menuWidthClass} list-none m-0 ${UI_THEME_TOKENS.panel.bg} border ${UI_THEME_TOKENS.panel.border} rounded shadow-md`}
            onKeyDown={e => {
              if (!enabledOptions.length) return
              const currentIndex = optionButtonRefs.current.findIndex(option => option === document.activeElement)
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % enabledOptions.length : 0
                focusOptionAtIndex(nextIndex)
                return
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                const nextIndex = currentIndex >= 0 ? (currentIndex - 1 + enabledOptions.length) % enabledOptions.length : enabledOptions.length - 1
                focusOptionAtIndex(nextIndex)
                return
              }
              if (e.key === 'Home') {
                e.preventDefault()
                focusOptionAtIndex(0)
                return
              }
              if (e.key === 'End') {
                e.preventDefault()
                focusOptionAtIndex(enabledOptions.length - 1)
              }
            }}
          >
            {enabledOptions.map((option, index) => {
              const isActive = option.isActive === undefined ? option.id === value : option.isActive
              return (
                <React.Fragment key={option.id}>
                  {option.dividerBefore ? (
                    <li className="list-none px-1 py-0.5" aria-hidden="true">
                      <hr className={`border-t ${UI_THEME_TOKENS.panel.border}`} />
                    </li>
                  ) : null}
                  <li
                    className="list-none relative"
                    onMouseEnter={() => {
                      if (option.children && option.children.length > 0) setOpenSubmenuId(option.id)
                      else setOpenSubmenuId(null)
                    }}
                  >
                    <button
                      ref={el => {
                        optionButtonRefs.current[index] = el
                      }}
                      type="button"
                      className={`${UI_RESPONSIVE_TOUCH_MENU_ROW_CLASSNAME} gap-2 rounded px-2 py-1 text-sm ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.button.hoverBg} disabled:opacity-50 disabled:cursor-not-allowed ${isActive ? uiPrimaryChipActiveClassName : ''}`}
                      disabled={option.disabled}
                      onClick={() => {
                        if (option.disabled) return
                        if (option.children && option.children.length > 0) {
                          setOpenSubmenuId(option.id)
                          return
                        }
                        closeMenuNow()
                        onSelect(option.id)
                        onSelectComplete?.(option.id)
                      }}
                      title={
                        option.disabled && (option.disabledReason || option.enableHint)
                          ? `${option.title}\n${option.disabledReason || ''}${option.enableHint ? `\n${option.enableHint}` : ''}`
                          : option.title
                      }
                    >
                      {renderOptionContent ? (
                        renderOptionContent(option)
                      ) : (
                        <span className="truncate">{option.title}</span>
                      )}
                      {option.disabled && (option.disabledReason || option.enableHint) ? (
                        <span className="ml-auto min-w-0 max-w-[45%] truncate text-[10px] text-amber-500/90 text-right">
                          {option.disabledReason || option.enableHint}
                        </span>
                      ) : option.children && option.children.length > 0 ? (
                        <span className="ml-auto shrink-0 text-xs opacity-70">▸</span>
                      ) : null}
                    </button>
                    {option.disabled && option.enableHint ? (
                      <div className="px-2 py-0.5 text-[10px] opacity-75">{option.enableHint}</div>
                    ) : null}
                    {option.children && option.children.length > 0 && openSubmenuId === option.id ? (
                      <menu
                        className={`kg-toolbar-dropdown-submenu absolute left-full top-0 ml-1 p-1 flex flex-col gap-1 w-72 list-none m-0 ${UI_THEME_TOKENS.panel.bg} border ${UI_THEME_TOKENS.panel.border} rounded shadow-md z-50`}
                      >
                        {option.children.map(childRaw => {
                          const child = childRaw as T
                          const isChildActive = child.isActive === undefined ? child.id === value : child.isActive
                          return (
                            <li key={child.id} className="list-none">
                              <button
                                type="button"
                                className={`${UI_RESPONSIVE_TOUCH_MENU_ROW_CLASSNAME} gap-2 rounded px-2 py-1 text-sm ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.button.hoverBg} disabled:opacity-50 disabled:cursor-not-allowed ${isChildActive ? uiPrimaryChipActiveClassName : ''}`}
                                disabled={child.disabled}
                                onClick={() => {
                                  if (child.disabled) return
                                  closeMenuNow()
                                  onSelect(child.id)
                                }}
                                title={
                                  child.disabled && (child.disabledReason || child.enableHint)
                                    ? `${child.title}\n${child.disabledReason || ''}${child.enableHint ? `\n${child.enableHint}` : ''}`
                                    : child.title
                                }
                              >
                                {renderOptionContent ? (
                                  renderOptionContent(child)
                                ) : (
                                  <span className="truncate">{child.title}</span>
                                )}
                              </button>
                            </li>
                          )
                        })}
                      </menu>
                    ) : null}
                  </li>
                </React.Fragment>
              )
            })}
            {renderMenuAppend ? renderMenuAppend() : null}
          </menu>
        </DropdownPanel>
      ) : null}
    </>
  )
}
