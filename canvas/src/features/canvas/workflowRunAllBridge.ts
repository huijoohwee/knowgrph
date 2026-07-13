import type { WorkflowRunAllEventDetail } from './utils'

const WORKFLOW_RUN_ALL_OWNER_WAIT_MS = 5_000

type WorkflowRunAllRunner = (detail: WorkflowRunAllEventDetail) => void

type PendingWorkflowRunAllRequest = {
  detail: WorkflowRunAllEventDetail
  resolve: (accepted: boolean) => void
  timeoutId: ReturnType<typeof setTimeout>
}

let activeWorkflowRunAllRunner: WorkflowRunAllRunner | null = null
const pendingWorkflowRunAllRequests = new Set<PendingWorkflowRunAllRequest>()

const waitForCommittedCanvas = async (): Promise<void> => {
  if (typeof requestAnimationFrame !== 'function') return
  await new Promise<void>(resolve => requestAnimationFrame(() => {
    requestAnimationFrame(() => resolve())
  }))
}

const startWorkflowRunAll = (
  runner: WorkflowRunAllRunner,
  detail: WorkflowRunAllEventDetail,
): void => {
  runner(detail)
}

const flushPendingWorkflowRunAllRequests = (): void => {
  const runner = activeWorkflowRunAllRunner
  if (!runner) return
  for (const pending of pendingWorkflowRunAllRequests) {
    pendingWorkflowRunAllRequests.delete(pending)
    clearTimeout(pending.timeoutId)
    startWorkflowRunAll(runner, pending.detail)
    pending.resolve(true)
  }
}

export const installWorkflowRunAllRunner = (runner: WorkflowRunAllRunner): (() => void) => {
  activeWorkflowRunAllRunner = runner
  flushPendingWorkflowRunAllRequests()
  return () => {
    if (activeWorkflowRunAllRunner === runner) activeWorkflowRunAllRunner = null
  }
}

export const requestWorkflowRunAllFromCommittedCanvas = async (
  detail: WorkflowRunAllEventDetail,
): Promise<boolean> => {
  await waitForCommittedCanvas()
  const runner = activeWorkflowRunAllRunner
  if (runner) {
    startWorkflowRunAll(runner, detail)
    return true
  }
  return new Promise(resolve => {
    const pending: PendingWorkflowRunAllRequest = {
      detail,
      resolve,
      timeoutId: setTimeout(() => {
        pendingWorkflowRunAllRequests.delete(pending)
        resolve(false)
      }, WORKFLOW_RUN_ALL_OWNER_WAIT_MS),
    }
    pendingWorkflowRunAllRequests.add(pending)
    flushPendingWorkflowRunAllRequests()
  })
}
