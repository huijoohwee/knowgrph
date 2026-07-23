import assert from 'node:assert/strict'
import test from 'node:test'
import {
  installServiceWorkerRevisionUpdateOwner,
  SERVICE_WORKER_UPDATE_MIN_INTERVAL_MS,
} from '../lib/pwa/serviceWorkerRevisionUpdateOwner'

const flushPromises = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 0))
}

test('service worker revision owner updates on registration and bounded recovery events', async () => {
  const windowTarget = new EventTarget()
  const documentTarget = Object.assign(new EventTarget(), {
    visibilityState: 'hidden' as DocumentVisibilityState,
  })
  let now = 0
  let updateCount = 0
  let settledCount = 0
  const dispose = installServiceWorkerRevisionUpdateOwner({
    registration: {
      async update() {
        updateCount += 1
      },
    },
    documentTarget,
    windowTarget,
    now: () => now,
    onUpdateSettled() {
      settledCount += 1
    },
  })

  await flushPromises()
  assert.equal(updateCount, 1, 'registration must check the canonical worker immediately')

  windowTarget.dispatchEvent(new Event('online'))
  await flushPromises()
  assert.equal(updateCount, 1, 'online events inside the bounded interval must not duplicate checks')

  now = SERVICE_WORKER_UPDATE_MIN_INTERVAL_MS
  windowTarget.dispatchEvent(new Event('online'))
  await flushPromises()
  assert.equal(updateCount, 2, 'online recovery must recheck after the bounded interval')

  now += SERVICE_WORKER_UPDATE_MIN_INTERVAL_MS
  documentTarget.visibilityState = 'visible'
  documentTarget.dispatchEvent(new Event('visibilitychange'))
  await flushPromises()
  assert.equal(updateCount, 3, 'foreground recovery must recheck after the bounded interval')

  dispose()
  now += SERVICE_WORKER_UPDATE_MIN_INTERVAL_MS
  windowTarget.dispatchEvent(new Event('online'))
  documentTarget.dispatchEvent(new Event('visibilitychange'))
  await flushPromises()
  assert.equal(updateCount, 3, 'disposed owners must release all update triggers')
  assert.equal(settledCount, 3, 'each completed update check must release revision cleanup')
})

test('service worker revision owner retries promptly after an offline registration failure', async () => {
  const windowTarget = new EventTarget()
  const documentTarget = Object.assign(new EventTarget(), {
    visibilityState: 'hidden' as DocumentVisibilityState,
  })
  let updateCount = 0
  let errorCount = 0
  let settledCount = 0
  installServiceWorkerRevisionUpdateOwner({
    registration: {
      async update() {
        updateCount += 1
        if (updateCount === 1) throw new Error('offline')
      },
    },
    documentTarget,
    windowTarget,
    now: () => 0,
    onError() {
      errorCount += 1
    },
    onUpdateSettled() {
      settledCount += 1
    },
  })

  await flushPromises()
  assert.equal(updateCount, 1)
  assert.equal(errorCount, 1)

  windowTarget.dispatchEvent(new Event('online'))
  await flushPromises()
  assert.equal(updateCount, 2, 'online recovery must not inherit the throttle from a failed update')
  assert.equal(settledCount, 2, 'failed and successful checks must both release stable active-worker cleanup')
})
