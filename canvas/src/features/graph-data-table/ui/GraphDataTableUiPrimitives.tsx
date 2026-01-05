import React from 'react'
import { ChevronDown } from 'lucide-react'
import { DropdownPanel } from '@/lib/ui/overlay'

export interface FilterComboboxOption<T extends string> {
  value: T
  label: string
}

export interface FilterComboboxProps<T extends string> {
  value: T
  options: ReadonlyArray<FilterComboboxOption<T>>
  onChange: (value: T) => void
  className: string
}

export function FilterCombobox<T extends string>({ value, options, onChange, className }: FilterComboboxProps<T>) {
  const [isOpen, setIsOpen] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement | null>(null)

  const selectedLabel = React.useMemo(
    () => options.find(option => option.value === value)?.label ?? '',
    [options, value],
  )

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className}
        onClick={() => setIsOpen(open => !open)}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="size-4 shrink-0 text-gray-500" />
      </button>
      {isOpen && (
        <DropdownPanel
          anchorRef={buttonRef}
          open={isOpen}
          onClose={() => setIsOpen(false)}
          align="bottom-left"
        >
          <div className="z-50 w-40 rounded-md border border-gray-200 bg-white p-1 text-xs text-gray-900 shadow-md">
            {options.map(option => (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 hover:bg-gray-50"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
              >
                <span className="truncate">{option.label}</span>
              </button>
            ))}
          </div>
        </DropdownPanel>
      )}
    </>
  )
}

export const iconButtonClassName =
  'inline-flex items-center justify-center whitespace-nowrap rounded-md border border-gray-200 bg-white text-xs text-gray-600 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 h-7 w-7'

export const secondaryButtonClassName =
  'inline-flex items-center justify-center whitespace-nowrap font-normal transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 gap-1.5 text-xs h-7 px-2 rounded-md hover:bg-gray-50 text-gray-700'

