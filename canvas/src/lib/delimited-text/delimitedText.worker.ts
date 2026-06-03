import { parseDelimitedText, type DelimitedTextParseOptions } from './delimitedText'

type WorkerRequest = {
  id: string
  text: string
  options?: DelimitedTextParseOptions
}

type WorkerResponse =
  | { id: string; ok: true; result: ReturnType<typeof parseDelimitedText> }
  | { id: string; ok: false; error: string }

type WorkerScope = {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (message: WorkerResponse) => void
}

const workerScope = self as unknown as WorkerScope

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  try {
    const result = parseDelimitedText(String(request?.text || ''), request?.options || {})
    workerScope.postMessage({ id: request.id, ok: true, result })
  } catch (error) {
    workerScope.postMessage({
      id: request?.id || '',
      ok: false,
      error: String((error as { message?: unknown })?.message ?? error),
    })
  }
}
