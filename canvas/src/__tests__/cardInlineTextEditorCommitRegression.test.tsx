import { readFileSync } from 'node:fs'

const readUtf8 = (relativePath: string) => {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

export function testPlainTextInputEditorUsesReactChangeContract() {
  const plainTextInput = readUtf8('../components/ui/PlainTextInputEditor.tsx')
  if (plainTextInput.includes('onInput=')) {
    throw new Error('expected PlainTextInputEditor to avoid native onInput handlers and reuse the shared React change contract')
  }
  const changeHandlerCount = (plainTextInput.match(/onChange=\{ev => onChange\?\.\(ev\.currentTarget\.value\)\}/g) || []).length
  if (changeHandlerCount < 2) {
    throw new Error(`expected PlainTextInputEditor to publish the React change contract for both input variants, got ${changeHandlerCount}`)
  }
  for (const snippet of ['value={value}', 'value={value}\n        defaultValue={defaultValue}', 'value={value}\n      defaultValue={defaultValue}']) {
    if (!plainTextInput.includes(snippet)) {
      throw new Error(`expected PlainTextInputEditor to keep controlled value ownership for shared editors: ${snippet}`)
    }
  }
}

export function testCardInlineTextEditorPreservesSharedMultilineCommitContract() {
  const cardInlineEditor = readUtf8('../lib/cards/CardInlineTextEditor.tsx')
  for (const snippet of [
    '<PlainTextInputEditor',
    'value={draft}',
    'onChange={setDraft}',
    'onBlur={() => {',
    'commit()',
    "if (multiline && event.key === 'Enter' && (event.metaKey || event.ctrlKey))",
    'onCommit?.(next)',
  ]) {
    if (!cardInlineEditor.includes(snippet)) {
      throw new Error(`expected CardInlineTextEditor to preserve the shared multiline commit contract: ${snippet}`)
    }
  }
}
