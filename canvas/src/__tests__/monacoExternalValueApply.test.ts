import { applyExternalMonacoValue } from '@/lib/monaco/monacoExternalValueApply'

class TestRange {
  constructor(
    public startLineNumber: number,
    public startColumn: number,
    public endLineNumber: number,
    public endColumn: number,
  ) {}
}

function createModel(initial: string) {
  let value = initial
  const calls: string[] = []
  return {
    calls,
    model: {
      getValue: () => value,
      setValue: (next: string) => {
        calls.push(`setValue:${next}`)
        value = next
      },
      getLineCount: () => Math.max(1, value.split('\n').length),
      getLineMaxColumn: (lineNumber: number) => {
        const line = value.split('\n')[Math.max(0, lineNumber - 1)] || ''
        return line.length + 1
      },
      applyEdits: (edits: ReadonlyArray<{ text: string }>) => {
        calls.push(`applyEdits:${edits.map(edit => edit.text).join('')}`)
        value += edits.map(edit => edit.text).join('')
      },
    },
  }
}

export function testApplyExternalMonacoValueAppendsStreamingSuffixWithoutSetValueRewrite() {
  const fixture = createModel('## Provider Stream Trace\n\nchunk one')
  let recomputeCount = 0
  const result = applyExternalMonacoValue({
    editor: {
      saveViewState: () => {
        throw new Error('append path must not save full replacement view state')
      },
      restoreViewState: () => {
        throw new Error('append path must not restore full replacement view state')
      },
    },
    model: fixture.model,
    rangeCtor: TestRange,
    value: '## Provider Stream Trace\n\nchunk one\nchunk two',
    lastAppliedValueRef: { current: '## Provider Stream Trace\n\nchunk one' },
    recomputeHiddenLongHtmlLines: () => { recomputeCount += 1 },
  })
  if (result !== 'append') throw new Error(`expected append result, got ${result}`)
  if (fixture.calls.length !== 1 || !fixture.calls[0].startsWith('applyEdits:')) {
    throw new Error(`expected one incremental edit instead of full setValue, got ${JSON.stringify(fixture.calls)}`)
  }
  if (recomputeCount !== 1) throw new Error(`expected one decoration recompute, got ${recomputeCount}`)
}

export function testApplyExternalMonacoValueUsesReplaceOnlyForNonAppendTransition() {
  const fixture = createModel('_Streaming..._')
  let restored = false
  const lastAppliedValueRef = { current: '_Streaming..._' }
  const result = applyExternalMonacoValue({
    editor: {
      saveViewState: () => ({ top: 1 }),
      restoreViewState: () => { restored = true },
    },
    model: fixture.model,
    rangeCtor: TestRange,
    value: '## Provider Stream Trace',
    lastAppliedValueRef,
    recomputeHiddenLongHtmlLines: () => undefined,
  })
  if (result !== 'replace' || fixture.calls[0] !== 'setValue:## Provider Stream Trace' || !restored) {
    throw new Error(`expected one bounded non-append replacement, got ${JSON.stringify({ result, calls: fixture.calls, restored })}`)
  }
  if (lastAppliedValueRef.current !== '## Provider Stream Trace') {
    throw new Error(`expected last applied value to update, got ${lastAppliedValueRef.current}`)
  }
}
