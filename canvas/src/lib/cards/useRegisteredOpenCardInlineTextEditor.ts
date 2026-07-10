import React from 'react'
import { registerOpenCardInlineTextEditor } from '@/lib/cards/CardInlineTextEditorSupport'

export function useLiveCardInlineTextDraft(initialValue: string) {
  const [draft, setDraft] = React.useState(initialValue)
  const draftRef = React.useRef(draft)
  const updateDraft = React.useCallback((nextValue: string) => {
    draftRef.current = nextValue
    setDraft(nextValue)
  }, [])
  const readDraft = React.useCallback(() => draftRef.current, [])
  return { draft, readDraft, updateDraft }
}

export function useRegisteredOpenCardInlineTextEditor(args: {
  commit: (forcedValue?: string) => void
  editing: boolean
  ownerKey: string
  readValue: () => string | null
}) {
  const commitRef = React.useRef(args.commit)
  React.useLayoutEffect(() => {
    commitRef.current = args.commit
  }, [args.commit])

  const readValueRef = React.useRef(args.readValue)
  React.useLayoutEffect(() => {
    readValueRef.current = args.readValue
  }, [args.readValue])

  React.useLayoutEffect(() => {
    if (!args.editing) return
    return registerOpenCardInlineTextEditor(
      args.ownerKey,
      nextValue => commitRef.current(nextValue),
      () => readValueRef.current(),
    )
  }, [args.editing, args.ownerKey])
}
