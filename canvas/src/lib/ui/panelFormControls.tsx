import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

export const PANEL_FORM_LABEL_TEXT_CLASSNAME = cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)
export const PANEL_FORM_SECTION_LABEL_TEXT_CLASSNAME = cn('block text-xs mb-1', UI_THEME_TOKENS.text.secondary)

const PANEL_FORM_SINGLE_LINE_FILLED_CONTROL_CLASSNAME = cn(
  'w-full min-w-0 max-w-full h-6 rounded-md border px-2 py-1 text-xs',
  UI_THEME_TOKENS.input.bg,
  UI_THEME_TOKENS.input.border,
  UI_THEME_TOKENS.input.text,
)

const PANEL_FORM_MULTI_LINE_FILLED_CONTROL_CLASSNAME = cn(
  'w-full resize rounded-md border px-2 py-1 text-xs',
  UI_THEME_TOKENS.input.bg,
  UI_THEME_TOKENS.input.border,
  UI_THEME_TOKENS.input.text,
)

const PANEL_FORM_SINGLE_LINE_TRANSPARENT_CONTROL_CLASSNAME = cn(
  'w-full min-w-0 max-w-full h-6 rounded border bg-transparent px-2 py-1 text-xs',
  UI_THEME_TOKENS.panel.border,
  UI_THEME_TOKENS.text.primary,
)

const PANEL_FORM_MULTI_LINE_TRANSPARENT_CONTROL_CLASSNAME = cn(
  'w-full resize rounded border bg-transparent px-2 py-1 text-xs',
  UI_THEME_TOKENS.panel.border,
  UI_THEME_TOKENS.text.primary,
)

type PanelFormControlVariant = 'filled' | 'transparent'
type PanelFieldVariant = 'micro' | 'section'
type PanelFieldLayout = 'block' | 'compact'
type PanelReadOnlyFieldProps = {
  label: React.ReactNode
  value: React.ReactNode
  className?: string
  labelClassName?: string
  valueClassName?: string
  variant?: PanelFieldVariant
  layout?: PanelFieldLayout
}

export type PanelFieldProps = {
  label: React.ReactNode
  children: React.ReactNode
  className?: string
  labelClassName?: string
  variant?: PanelFieldVariant
  layout?: PanelFieldLayout
}

type PanelTextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  variant?: PanelFormControlVariant
}
type PanelTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  variant?: PanelFormControlVariant
}
type PanelSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  variant?: PanelFormControlVariant
}
type PanelCheckboxProps = React.InputHTMLAttributes<HTMLInputElement>
type PanelRangeInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  variant?: PanelFormControlVariant
}

const PANEL_FORM_CHECKBOX_CLASSNAME = cn(
  'h-4 w-4 rounded',
  UI_THEME_TOKENS.input.border,
  UI_THEME_TOKENS.input.selectionControl,
)

const PANEL_FORM_RANGE_FILLED_CONTROL_CLASSNAME = cn(
  'w-full min-w-0 flex-1 accent-[color:var(--kg-accent)]',
  UI_THEME_TOKENS.input.selectionControl,
)

const PANEL_FORM_RANGE_TRANSPARENT_CONTROL_CLASSNAME = cn(
  'w-full min-w-0 flex-1 bg-transparent accent-[color:var(--kg-accent)]',
  UI_THEME_TOKENS.input.selectionControl,
)

export const PanelTextInput = React.forwardRef<HTMLInputElement, PanelTextInputProps>(function PanelTextInput(
  { className, variant = 'filled', ...props },
  ref,
) {
  return (
    <input
      {...props}
      ref={ref}
      className={cn(
        variant === 'transparent' ? PANEL_FORM_SINGLE_LINE_TRANSPARENT_CONTROL_CLASSNAME : PANEL_FORM_SINGLE_LINE_FILLED_CONTROL_CLASSNAME,
        className,
      )}
    />
  )
})

export const PanelTextarea = React.forwardRef<HTMLTextAreaElement, PanelTextareaProps>(function PanelTextarea(
  { className, variant = 'filled', ...props },
  ref,
) {
  return (
    <textarea
      {...props}
      ref={ref}
      className={cn(
        variant === 'transparent' ? PANEL_FORM_MULTI_LINE_TRANSPARENT_CONTROL_CLASSNAME : PANEL_FORM_MULTI_LINE_FILLED_CONTROL_CLASSNAME,
        className,
      )}
    />
  )
})

export const PanelSelect = React.forwardRef<HTMLSelectElement, PanelSelectProps>(function PanelSelect(
  { className, variant = 'filled', ...props },
  ref,
) {
  return (
    <select
      {...props}
      ref={ref}
      className={cn(
        variant === 'transparent' ? PANEL_FORM_SINGLE_LINE_TRANSPARENT_CONTROL_CLASSNAME : PANEL_FORM_SINGLE_LINE_FILLED_CONTROL_CLASSNAME,
        className,
      )}
    />
  )
})

export const PanelCheckbox = React.forwardRef<HTMLInputElement, PanelCheckboxProps>(function PanelCheckbox(
  { className, ...props },
  ref,
) {
  return <input {...props} ref={ref} type="checkbox" className={cn(PANEL_FORM_CHECKBOX_CLASSNAME, className)} />
})

export const PanelRangeInput = React.forwardRef<HTMLInputElement, PanelRangeInputProps>(function PanelRangeInput(
  { className, variant = 'filled', ...props },
  ref,
) {
  return (
    <input
      {...props}
      ref={ref}
      type="range"
      className={cn(
        variant === 'transparent' ? PANEL_FORM_RANGE_TRANSPARENT_CONTROL_CLASSNAME : PANEL_FORM_RANGE_FILLED_CONTROL_CLASSNAME,
        className,
      )}
    />
  )
})

export function PanelField({
  label,
  children,
  className,
  labelClassName,
  variant = 'micro',
  layout = 'block',
}: PanelFieldProps) {
  return (
    <label className={cn(layout === 'compact' ? 'grid gap-1' : 'block', className)}>
      <span
        className={cn(
          variant === 'section' ? PANEL_FORM_SECTION_LABEL_TEXT_CLASSNAME : PANEL_FORM_LABEL_TEXT_CLASSNAME,
          labelClassName,
        )}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

export function PanelReadOnlyField({
  label,
  value,
  className,
  labelClassName,
  valueClassName,
  variant = 'micro',
  layout = 'block',
}: PanelReadOnlyFieldProps) {
  return (
    <dl className={cn(layout === 'compact' ? 'grid gap-1' : 'space-y-0.5', className)}>
      <dt
        className={cn(
          variant === 'section' ? PANEL_FORM_SECTION_LABEL_TEXT_CLASSNAME : PANEL_FORM_LABEL_TEXT_CLASSNAME,
          labelClassName,
        )}
      >
        {label}
      </dt>
      <dd className={cn('m-0 text-xs', UI_THEME_TOKENS.text.secondary, valueClassName)}>{value}</dd>
    </dl>
  )
}

export function readPanelChoiceSurfaceClassName(options: {
  active: boolean
  multiline?: boolean
  className?: string
}): string {
  const { active, multiline = false, className } = options
  return cn(
    multiline ? 'block min-h-14 w-full rounded-md border px-2 py-1 text-left text-xs' : 'block w-full rounded-md border px-2 py-1 text-left text-xs',
    active
      ? `${UI_THEME_TOKENS.button.activeBorder} ${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
      : `${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`,
    className,
  )
}

export function readPanelBooleanChoiceButtonClassName(options: {
  active: boolean
  className?: string
}): string {
  const { active, className } = options
  return cn(
    'App-toolbar__btn border',
    UI_THEME_TOKENS.input.border,
    active
      ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
      : `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.primary}`,
    className,
  )
}
