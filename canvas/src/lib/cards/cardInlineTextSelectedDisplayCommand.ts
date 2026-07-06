import React from 'react'
import { readInlineCommandMenuSigilFromKeyEvent, type InlineCommandMenuSigil } from '@/lib/command-menu/inlineCommandMenuTrigger'

export function useCardInlineTextSelectedDisplayCommand(args: {
  canEdit: boolean
  displayRef: React.RefObject<HTMLElement | null>
  editing: boolean
  enabled: boolean
  onActivate: () => void
  openCommandMenuForSigil: (sigil: InlineCommandMenuSigil) => boolean
  stopPropagation: boolean
}) {
  const { canEdit, displayRef, editing, enabled, onActivate, openCommandMenuForSigil, stopPropagation } = args
  React.useEffect(() => {
    if (editing || !canEdit || !enabled) return
    const ownerDocument = displayRef.current?.ownerDocument || null
    if (!ownerDocument) return
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      const sigil = readInlineCommandMenuSigilFromKeyEvent(event)
      const display = displayRef.current
      const selection = ownerDocument.getSelection()
      if (!sigil || !display || !selection || selection.isCollapsed) return
      if (!selection.anchorNode || !selection.focusNode || !display.contains(selection.anchorNode) || !display.contains(selection.focusNode)) return
      event.preventDefault()
      if (stopPropagation) event.stopPropagation()
      selection.removeAllRanges()
      onActivate()
      openCommandMenuForSigil(sigil)
    }
    ownerDocument.addEventListener('keydown', onDocumentKeyDown, true)
    return () => ownerDocument.removeEventListener('keydown', onDocumentKeyDown, true)
  }, [canEdit, displayRef, editing, enabled, onActivate, openCommandMenuForSigil, stopPropagation])
}
