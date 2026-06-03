import {
  parseDelimitedTextAsync,
  type DelimitedTextParseOptions,
  type DelimitedTextParseResult,
} from './delimitedText'

type WorkerResponse =
  | { id: string; ok: true; result: DelimitedTextParseResult }
  | { id: string; ok: false; error: string }

function canUseDelimitedTextWorker(options: DelimitedTextParseOptions): boolean {
  if (typeof Worker === 'undefined') return false
  if (typeof URL === 'undefined') return false
  if (typeof options.onProgress === 'function') return false
  return true
}

function buildWorkerSafeOptions(options: DelimitedTextParseOptions): DelimitedTextParseOptions {
  const {
    signal,
    onProgress,
    ...safeOptions
  } = options
  void signal
  void onProgress
  return safeOptions
}

function parseDelimitedTextInWorker(text: string, options: DelimitedTextParseOptions): Promise<DelimitedTextParseResult> {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  const worker = new Worker(new URL('./delimitedText.worker.ts', import.meta.url), { type: 'module' })
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      options.signal?.removeEventListener('abort', handleAbort)
      worker.onmessage = null
      worker.onerror = null
      worker.terminate()
    }
    const handleAbort = () => {
      cleanup()
      reject(new DOMException('Delimited text parse aborted', 'AbortError'))
    }
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data
      if (!response || response.id !== requestId) return
      cleanup()
      if (response.ok === true) {
        resolve(response.result)
        return
      }
      reject(new Error(response.error || 'Delimited text worker parse failed'))
    }
    worker.onerror = event => {
      cleanup()
      reject(new Error(String(event.message || 'Delimited text worker parse failed')))
    }
    if (options.signal?.aborted) {
      handleAbort()
      return
    }
    options.signal?.addEventListener('abort', handleAbort, { once: true })
    worker.postMessage({
      id: requestId,
      text,
      options: buildWorkerSafeOptions(options),
    })
  })
}

export async function parseDelimitedTextWithWorkerFallback(
  text: string,
  options: DelimitedTextParseOptions = {},
): Promise<DelimitedTextParseResult> {
  if (!canUseDelimitedTextWorker(options)) return await parseDelimitedTextAsync(text, options)
  try {
    return await parseDelimitedTextInWorker(text, options)
  } catch (error) {
    if (options.signal?.aborted) throw error
    return await parseDelimitedTextAsync(text, options)
  }
}
