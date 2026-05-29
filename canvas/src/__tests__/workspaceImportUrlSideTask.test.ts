import {
  startWorkspaceImportSideTask,
  waitForWorkspaceImportSideTask,
} from '@/features/markdown-workspace/workspaceImport/importSideTask'

const waitForTick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

export async function testWorkspaceImportSideTaskTimeoutAbortsWithoutBlockingFinalization(): Promise<void> {
  let aborted = false
  const task = startWorkspaceImportSideTask({
    run: signal =>
      new Promise<string>(() => {
        signal.addEventListener('abort', () => {
          aborted = true
        }, { once: true })
      }),
  })
  const startedAt = Date.now()
  const result = await waitForWorkspaceImportSideTask({ task, fallback: '', timeoutMs: 5 })
  if (result !== '') throw new Error(`expected timed-out side task to resolve fallback, got ${JSON.stringify(result)}`)
  if (!aborted) throw new Error('expected timed-out side task to be aborted')
  if (Date.now() - startedAt > 1000) throw new Error('expected timed-out side task to avoid blocking import finalization')
}

export async function testWorkspaceImportSideTaskTimeoutCanLeaveTaskRunningForBackgroundUpdate(): Promise<void> {
  let aborted = false
  const task = startWorkspaceImportSideTask({
    run: signal =>
      new Promise<string>(resolve => {
        signal.addEventListener('abort', () => {
          aborted = true
        }, { once: true })
        setTimeout(() => resolve('done'), 20)
      }),
  })
  const result = await waitForWorkspaceImportSideTask({ task, fallback: '', timeoutMs: 5, abortOnTimeout: false })
  if (result !== '') throw new Error(`expected foreground side-task wait to resolve fallback, got ${JSON.stringify(result)}`)
  if (aborted) throw new Error('expected foreground side-task timeout to keep task alive for background completion')
  const completed = await task.promise
  if (completed !== 'done') throw new Error(`expected side task to complete after foreground timeout, got ${JSON.stringify(completed)}`)
  if (aborted) throw new Error('expected completed background side task to avoid abort')
}

export async function testWorkspaceImportSideTaskParentAbortPropagates(): Promise<void> {
  const parent = new AbortController()
  let aborted = false
  startWorkspaceImportSideTask({
    parentSignal: parent.signal,
    run: signal =>
      new Promise<string>(() => {
        if (signal.aborted) {
          aborted = true
          return
        }
        signal.addEventListener('abort', () => {
          aborted = true
        }, { once: true })
      }),
  })
  parent.abort()
  await waitForTick()
  if (!aborted) throw new Error('expected parent import abort to stop active side task')
}
