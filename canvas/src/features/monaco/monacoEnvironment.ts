import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'

export function ensureMonacoEnvironment() {
  const g = globalThis as unknown as { MonacoEnvironment?: unknown }
  if (g.MonacoEnvironment) return

  ;(g as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
    getWorker(_: unknown, label: string) {
      if (label === 'json') return new JsonWorker()
      return new EditorWorker()
    },
  }
}
