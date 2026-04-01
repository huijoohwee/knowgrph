import { scheduleCoalescedTask, cancelCoalescedTask } from '@/lib/async/coalescedScheduler'

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

