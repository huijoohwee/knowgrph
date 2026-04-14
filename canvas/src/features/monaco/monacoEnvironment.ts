import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { useGraphStore } from '@/hooks/useGraphStore'

let jsonWorkerCtorPromise: Promise<typeof EditorWorker> | null = null

const loadJsonWorkerCtor = () => {
  jsonWorkerCtorPromise ||= import('monaco-editor/esm/vs/language/json/json.worker?worker').then(mod => mod.default)
  return jsonWorkerCtorPromise
}

export function ensureMonacoEnvironment() {
  const g = globalThis as unknown as { MonacoEnvironment?: unknown }
  const preloadJsonWorker = () => {
    const state = useGraphStore.getState()
    if (!state.monacoWorkerJsonEnabled) return
    if (state.monacoWorkerJsonLoadMode !== 'eager') return
    void loadJsonWorkerCtor()
  }
  preloadJsonWorker()

  ;(g as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
    getWorker(_: unknown, label: string) {
      if (label === 'json') {
        const state = useGraphStore.getState()
        if (!state.monacoWorkerJsonEnabled) return new EditorWorker()
        return loadJsonWorkerCtor().then(JsonWorkerCtor => new JsonWorkerCtor())
      }
      return new EditorWorker()
    },
  }
}
