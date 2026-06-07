type MonacoRangeLike = {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

type MonacoRangeConstructor = new (
  startLineNumber: number,
  startColumn: number,
  endLineNumber: number,
  endColumn: number,
) => MonacoRangeLike

type MonacoEditorLike = {
  saveViewState: () => unknown
  restoreViewState: (state: unknown) => void
}

type MonacoModelLike = {
  getValue: () => string
  setValue: (value: string) => void
  getLineCount: () => number
  getLineMaxColumn: (lineNumber: number) => number
  applyEdits: (edits: ReadonlyArray<{ range: MonacoRangeLike; text: string; forceMoveMarkers?: boolean }>) => unknown
}

export type ExternalMonacoValueApplyResult = 'append' | 'replace' | 'skip'

export function applyExternalMonacoValue(args: {
  editor: MonacoEditorLike
  model: MonacoModelLike
  rangeCtor: MonacoRangeConstructor
  value: string
  lastAppliedValueRef: { current: string }
  recomputeHiddenLongHtmlLines: () => void
}): ExternalMonacoValueApplyResult {
  const next = String(args.value || '')
  const current = args.model.getValue()
  if (next === current) return 'skip'
  if (next === args.lastAppliedValueRef.current) return 'skip'

  if (next.startsWith(current)) {
    const suffix = next.slice(current.length)
    if (!suffix) return 'skip'
    const line = Math.max(1, args.model.getLineCount())
    const column = Math.max(1, args.model.getLineMaxColumn(line))
    args.model.applyEdits([{
      range: new args.rangeCtor(line, column, line, column),
      text: suffix,
      forceMoveMarkers: true,
    }])
    args.lastAppliedValueRef.current = next
    args.recomputeHiddenLongHtmlLines()
    return 'append'
  }

  const viewState = args.editor.saveViewState()
  args.model.setValue(next)
  args.lastAppliedValueRef.current = next
  if (viewState) args.editor.restoreViewState(viewState)
  args.recomputeHiddenLongHtmlLines()
  return 'replace'
}
