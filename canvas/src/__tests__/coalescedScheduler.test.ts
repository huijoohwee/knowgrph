import { scheduleCoalescedTask, cancelCoalescedTask } from '@/lib/async/coalescedScheduler'
import { scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'

export async function testCoalescedSchedulerCoalescesLatestCallback() {
  const key = 'test:coalescedScheduler:coalesce'
  const calls: string[] = []

  scheduleCoalescedTask(key, () => {
    calls.push('first')
  }, 10)

  scheduleCoalescedTask(key, () => {
    calls.push('second')
  }, 10)

  await new Promise(resolve => setTimeout(resolve, 40))

  if (calls.length !== 1) {
    throw new Error(`expected 1 call, got ${calls.length}`)
  }
  if (calls[0] !== 'second') {
    throw new Error(`expected last callback to win, got ${calls[0]}`)
  }
}

export async function testCoalescedSchedulerCancelPreventsCallback() {
  const key = 'test:coalescedScheduler:cancel'
  let called = false

  scheduleCoalescedTask(key, () => {
    called = true
  }, 10)

  cancelCoalescedTask(key)

  await new Promise(resolve => setTimeout(resolve, 40))

  if (called) {
    throw new Error('expected cancelCoalescedTask to prevent callback execution')
  }
}

export async function testWorkspaceSyncSchedulerRunsLatestPerTaskUnderSharedKey() {
  const calls: string[] = []
  scheduleWorkspaceSyncTask('runtime:refresh', () => {
    calls.push('runtime:first')
  }, 10)
  scheduleWorkspaceSyncTask('runtime:refresh', () => {
    calls.push('runtime:latest')
  }, 10)
  scheduleWorkspaceSyncTask('persistence:source-files', () => {
    calls.push('persistence:latest')
  }, 10)

  await new Promise(resolve => setTimeout(resolve, 40))

  if (calls.length !== 2) {
    throw new Error(`expected 2 calls, got ${calls.length}`)
  }
  if (!calls.includes('runtime:latest')) {
    throw new Error('expected runtime task to keep only latest callback')
  }
  if (!calls.includes('persistence:latest')) {
    throw new Error('expected persistence task to execute once under shared scheduler key')
  }
}
