import React from 'react'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import {
  buildFloatingPanelChatComposerDisplayText,
  buildFloatingPanelChatComposerOverlayParts,
  deleteFloatingPanelChatComposerProjectedTokenDisplayRange,
  FloatingPanelChatComposerMediaOverlay,
  isFloatingPanelChatComposerProjectedCaretInsideChip,
  resolveFloatingPanelChatComposerRawText,
  type TextareaInvocationMediaAttachment,
} from '@/lib/ui/textareaInvocationProjection'

export type TextareaInvocationSelectionRange = { start: number; end: number }

export type TextareaInvocationEditorProps = {
  value: string
  onChange: (value: string) => void
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
  ariaLabel: string
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  inputClassName?: string
  overlayChromeClassName?: string
  overlayTextClassName: string
  projectedLayoutClassName: string
  mediaAttachments?: readonly TextareaInvocationMediaAttachment[] | null
  dataAttributes?: Record<`data-${string}`, string | number | boolean | undefined>
  ariaControls?: string
  ariaExpanded?: boolean
  onDisplayChange?: (displayValue: string) => void
  onDisplaySelectionChange?: (displayValue: string) => void
  submitOnModEnter?: boolean
  onSelectAll?: () => void
  onProjectedDelete?: () => void
  selectionRange?: TextareaInvocationSelectionRange
  onSelectionRangeChange?: (range: TextareaInvocationSelectionRange) => void
}

const focusTextarea = (input: HTMLTextAreaElement | null): void => {
  if (!input) return
  try {
    input.focus({ preventScroll: true })
  } catch {
    input.focus()
  }
}

export function TextareaInvocationEditor(props: TextareaInvocationEditorProps) {
  const internalRef = React.useRef<HTMLTextAreaElement | null>(null)
  const inputRef = props.inputRef || internalRef
  const overlayRef = React.useRef<HTMLElement | null>(null)
  const [internalSelectionRange, setInternalSelectionRange] = React.useState<TextareaInvocationSelectionRange>({ start: 0, end: 0 })
  const selectionRange = props.selectionRange || internalSelectionRange
  const setSelectionRange = React.useCallback((range: TextareaInvocationSelectionRange) => {
    setInternalSelectionRange(range)
    props.onSelectionRangeChange?.(range)
  }, [props])
  const projectionOptions = React.useMemo(() => ({ mediaAttachments: props.mediaAttachments }), [props.mediaAttachments])
  const overlay = React.useMemo(
    () => buildFloatingPanelChatComposerOverlayParts(props.value, projectionOptions),
    [projectionOptions, props.value],
  )
  const displayValue = React.useMemo(
    () => buildFloatingPanelChatComposerDisplayText(props.value, projectionOptions),
    [projectionOptions, props.value],
  )
  const hideNativeCaret = overlay.hasOverlay && isFloatingPanelChatComposerProjectedCaretInsideChip(
    props.value,
    selectionRange.start,
    selectionRange.end,
    projectionOptions,
  )

  React.useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const start = input.selectionStart ?? displayValue.length
    const end = input.selectionEnd ?? displayValue.length
    if (selectionRange.start !== start || selectionRange.end !== end) setSelectionRange({ start, end })
  }, [displayValue, inputRef, selectionRange.end, selectionRange.start, setSelectionRange])

  const updateSelection = React.useCallback((target: HTMLTextAreaElement, value: string) => {
    setSelectionRange({
      start: target.selectionStart ?? value.length,
      end: target.selectionEnd ?? value.length,
    })
    props.onDisplaySelectionChange?.(value)
  }, [props])

  const deleteProjectedToken = React.useCallback((target: HTMLTextAreaElement, direction: 'backward' | 'forward'): boolean => {
    if (!overlay.hasOverlay) return false
    const next = deleteFloatingPanelChatComposerProjectedTokenDisplayRange({
      text: props.value,
      selectionStart: target.selectionStart ?? target.value.length,
      selectionEnd: target.selectionEnd ?? target.value.length,
      direction,
      mediaAttachments: props.mediaAttachments,
    })
    if (!next) return false
    props.onChange(next.text)
    props.onProjectedDelete?.()
    requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      focusTextarea(input)
      input.setSelectionRange(next.cursor, next.cursor)
      setSelectionRange({ start: next.cursor, end: next.cursor })
    })
    return true
  }, [inputRef, overlay.hasOverlay, props])

  return (
    <section className="relative h-full" data-kg-textarea-invocation-editor="shared">
      <FloatingPanelChatComposerMediaOverlay
        input={props.value}
        mediaAttachments={props.mediaAttachments}
        projectedSelectionRange={selectionRange}
        showProjectedCaret={hideNativeCaret}
        uiPanelTextFontClass={props.overlayTextClassName}
        overlayChromeClassName={props.overlayChromeClassName}
        projectedLayoutClassName={props.projectedLayoutClassName}
        overlayRef={overlayRef}
      />
      <PlainTextInputEditor
        ref={inputRef}
        id={props.id}
        value={displayValue}
        onChange={value => {
          props.onChange(resolveFloatingPanelChatComposerRawText(value, props.value, projectionOptions))
          props.onDisplayChange?.(value)
          const input = inputRef.current
          if (input) updateSelection(input, value)
        }}
        onSelect={event => updateSelection(event.currentTarget as HTMLTextAreaElement, event.currentTarget.value)}
        onScroll={event => {
          const overlayElement = overlayRef.current
          if (!overlayElement) return
          overlayElement.scrollTop = event.currentTarget.scrollTop
          overlayElement.scrollLeft = event.currentTarget.scrollLeft
        }}
        onBeforeInput={event => {
          const inputType = (event.nativeEvent as InputEvent).inputType
          const direction = inputType === 'deleteContentBackward' ? 'backward' : inputType === 'deleteContentForward' ? 'forward' : null
          if (!direction || !deleteProjectedToken(event.currentTarget as HTMLTextAreaElement, direction)) return
          event.preventDefault()
        }}
        onKeyDown={event => {
          const target = event.currentTarget as HTMLTextAreaElement
          if (overlay.hasOverlay && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
            event.preventDefault()
            target.setSelectionRange(0, target.value.length)
            setSelectionRange({ start: 0, end: target.value.length })
            props.onSelectAll?.()
            return
          }
          if (overlay.hasOverlay && (event.key === 'Backspace' || event.key === 'Delete') && deleteProjectedToken(target, event.key === 'Backspace' ? 'backward' : 'forward')) {
            event.preventDefault()
            return
          }
          if (props.submitOnModEnter && (event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            target.form?.requestSubmit()
          }
        }}
        placeholder={props.placeholder}
        ariaLabel={props.ariaLabel}
        ariaControls={props.ariaControls}
        ariaExpanded={props.ariaExpanded}
        disabled={props.disabled}
        multiline
        className={props.className}
        inputClassName={`${props.inputClassName || ''} ${overlay.hasOverlay ? `text-transparent ${hideNativeCaret ? 'caret-transparent' : 'caret-[color:var(--kg-text-primary)]'} ${props.projectedLayoutClassName}` : ''}`}
        dataAttributes={{
          ...props.dataAttributes,
          'data-kg-chat-input-overlay-active': overlay.hasOverlay ? '1' : undefined,
          'data-kg-chat-input-media-overlay-active': overlay.hasMedia ? '1' : undefined,
        }}
      />
    </section>
  )
}
