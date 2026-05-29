export const WORKSPACE_IMPORT_SIDE_TASK_TIMEOUT_MS = 12_000
export const WORKSPACE_IMPORT_FINALIZE_SIDE_TASK_TIMEOUT_MS = 1_500

export type WorkspaceImportSideTask<T> = {
  promise: Promise<T>
  abort: () => void
}

export const startWorkspaceImportSideTask = <T>(args: {
  parentSignal?: AbortSignal | null
  run: (signal: AbortSignal) => Promise<T>
}): WorkspaceImportSideTask<T> => {
  const ctrl = new AbortController()
  const abort = () => {
    try {
      ctrl.abort()
    } catch {
      void 0
    }
  }
  const parentSignal = args.parentSignal || null
  if (parentSignal?.aborted) abort()
  else {
    try {
      parentSignal?.addEventListener('abort', abort, { once: true })
    } catch {
      void 0
    }
  }
  const promise = Promise.resolve().then(() => args.run(ctrl.signal)).finally(() => {
    try {
      parentSignal?.removeEventListener('abort', abort)
    } catch {
      void 0
    }
  })
  return { promise, abort }
}

export const waitForWorkspaceImportSideTask = async <T>(args: {
  task: WorkspaceImportSideTask<T>
  fallback: T
  timeoutMs: number
  abortOnTimeout?: boolean
}): Promise<T> => {
  const timeoutMs = Number.isFinite(args.timeoutMs) ? Math.max(1, Math.floor(args.timeoutMs)) : 1
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      args.task.promise,
      new Promise<T>(resolve => {
        timeoutId = setTimeout(() => {
          if (args.abortOnTimeout !== false) args.task.abort()
          resolve(args.fallback)
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId != null) clearTimeout(timeoutId)
  }
}
