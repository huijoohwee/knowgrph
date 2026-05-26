import React from 'react'
import { cn } from '@/lib/utils'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type PlainTextInputEditorProps = {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  multiline?: boolean
  readOnly?: boolean
  className?: string
  inputClassName?: string
  id?: string
  rows?: number
  spellCheck?: boolean
  inputType?: React.HTMLInputTypeAttribute
  list?: string
  min?: number | string
  max?: number | string
  step?: number | string
  autoComplete?: string
  ariaLabel?: string
  onBlur?: React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>
  onSelect?: React.ReactEventHandler<HTMLInputElement | HTMLTextAreaElement>
  onDoubleClick?: React.MouseEventHandler<HTMLInputElement | HTMLTextAreaElement>
}

const PlainTextInputEditorBase = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, PlainTextInputEditorProps>(function PlainTextInputEditor({
  value,
  defaultValue,
  onChange,
  placeholder,
  disabled = false,
  multiline = false,
  readOnly = false,
  className,
  inputClassName,
  id,
  rows,
  spellCheck = false,
  inputType = 'text',
  list,
  min,
  max,
  step,
  autoComplete,
  ariaLabel,
  onBlur,
  onKeyDown,
  onSelect,
  onDoubleClick,
}: PlainTextInputEditorProps, ref) {
  if (multiline) {
    return (
      <textarea
        ref={ref as React.Ref<HTMLTextAreaElement>}
        id={id}
        value={value}
        defaultValue={defaultValue}
        onChange={ev => onChange?.(ev.currentTarget.value)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        rows={rows}
        spellCheck={spellCheck}
        aria-label={ariaLabel}
        autoComplete={autoComplete}
        autoCorrect="off"
        autoCapitalize="off"
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onSelect={onSelect}
        onDoubleClick={onDoubleClick}
        className={cn(
          'w-full h-full px-2 py-1 resize-none outline-none',
          UI_THEME_TOKENS.input.bg,
          UI_THEME_TOKENS.input.border,
          UI_THEME_TOKENS.input.text,
          className,
          inputClassName,
        )}
      />
    )
  }
  return (
    <input
      ref={ref as React.Ref<HTMLInputElement>}
      id={id}
      type={inputType}
      value={value}
      defaultValue={defaultValue}
      onChange={ev => onChange?.(ev.currentTarget.value)}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      spellCheck={spellCheck}
      list={list}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      autoComplete={autoComplete}
      autoCorrect="off"
      autoCapitalize="off"
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onSelect={onSelect}
      onDoubleClick={onDoubleClick}
      className={cn(
        'w-full px-1 py-[1px] border rounded outline-none',
        UI_THEME_TOKENS.input.bg,
        UI_THEME_TOKENS.input.border,
        UI_THEME_TOKENS.input.text,
        className,
        inputClassName,
      )}
    />
  )
})

export const PlainTextInputEditor = React.memo(PlainTextInputEditorBase)
