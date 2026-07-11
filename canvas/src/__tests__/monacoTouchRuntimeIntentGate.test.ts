import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveMonacoRuntimeMode } from '@/lib/monaco/monacoRuntimeMode'

export function testResolveMonacoRuntimeModeDefersTouchViewportHydration() {
  if (resolveMonacoRuntimeMode({
    monacoPlatformSupported: false,
    isJsdom: false,
    deferMonacoOnTouchViewport: true,
    touchViewportActive: true,
    touchViewportIntentActivated: false,
  }) !== 'fallback') {
    throw new Error('expected unsupported platforms to stay on fallback mode')
  }

  if (resolveMonacoRuntimeMode({
    monacoPlatformSupported: true,
    isJsdom: false,
    deferMonacoOnTouchViewport: true,
    touchViewportActive: true,
    touchViewportIntentActivated: false,
  }) !== 'deferred-touch') {
    throw new Error('expected touch viewports to defer Monaco until explicit intent when enabled')
  }

  if (resolveMonacoRuntimeMode({
    monacoPlatformSupported: true,
    isJsdom: false,
    deferMonacoOnTouchViewport: true,
    touchViewportActive: true,
    touchViewportIntentActivated: true,
  }) !== 'monaco') {
    throw new Error('expected explicit touch activation to unlock Monaco runtime')
  }
}

export function testMonacoTextEditorSourceWiresTouchIntentGate() {
  const text = readFileSync(resolve(process.cwd(), 'src/lib/monaco/MonacoTextEditor.impl.tsx'), 'utf8')
  for (const snippet of [
    "useMediaQuery(MONACO_TOUCH_VIEWPORT_QUERY)",
    'resolveMonacoRuntimeMode({',
    'data-kg-monaco-runtime-mode={runtimeMode}',
    'data-kg-monaco-touch-intent="true"',
    'data-kg-monaco-touch-intent-activate="true"',
    'deferMonacoOnTouchViewport',
  ]) {
    if (!text.includes(snippet)) {
      throw new Error(`expected MonacoTextEditor to wire the touch runtime intent gate: ${snippet}`)
    }
  }

  const markdownEditorPaneText = readFileSync(resolve(process.cwd(), 'src/features/markdown-workspace/main/editor/MarkdownEditorPane.tsx'), 'utf8')
  if (!markdownEditorPaneText.includes('deferMonacoOnTouchViewport={!props.readOnly}')) {
    throw new Error('expected MarkdownEditorPane to opt the shared Monaco touch-intent gate into editable mobile editor flows')
  }

  const markdownWorkspaceMainText = readFileSync(resolve(process.cwd(), 'src/features/markdown-workspace/main/MarkdownWorkspaceMain.tsx'), 'utf8')
  for (const snippet of [
    'const renderJsonEditorPane = React.useCallback(',
    'language="json"',
    'ariaLabel="JSON Editor Text"',
  ]) {
    if (!markdownWorkspaceMainText.includes(snippet)) {
      throw new Error(`expected the split workspace JSON pane to stay on the shared MarkdownEditorPane path: ${snippet}`)
    }
  }

  const serializationSectionText = readFileSync(resolve(process.cwd(), 'src/features/schema-editor/SerializationSection.tsx'), 'utf8')
  const deferOptInCount = serializationSectionText.split('deferMonacoOnTouchViewport').length - 1
  if (deferOptInCount < 3) {
    throw new Error(`expected schema serialization editors to opt into the shared Monaco touch-intent gate, got ${deferOptInCount}`)
  }
}
