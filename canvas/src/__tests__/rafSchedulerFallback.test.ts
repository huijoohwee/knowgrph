import { createRafValueScheduler } from '@/lib/react/rafValueScheduler'

type ActiveWindowWithOptionalRaf = Window & typeof globalThis & {
  requestAnimationFrame?: unknown
  cancelAnimationFrame?: unknown
}

type MutableGlobalRaf = typeof globalThis & {
  window?: ActiveWindowWithOptionalRaf
  requestAnimationFrame?: typeof requestAnimationFrame
  cancelAnimationFrame?: typeof cancelAnimationFrame
}

export async function testRafValueSchedulerFallsBackWhenActiveWindowLacksRaf() {
  const globals = globalThis as MutableGlobalRaf
  const originalWindow = globals.window
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame
  const applied: number[] = []
  const fallbackHandles = new Set<ReturnType<typeof setTimeout>>()

  try {
    globals.window = {
      ...(originalWindow || {}),
      requestAnimationFrame: undefined,
      cancelAnimationFrame: undefined,
    } as unknown as ActiveWindowWithOptionalRaf

    globals.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const timeout = setTimeout(() => {
        fallbackHandles.delete(timeout)
        callback(Date.now())
      }, 0)
      fallbackHandles.add(timeout)
      return timeout as unknown as number
    }) as typeof requestAnimationFrame

    globals.cancelAnimationFrame = ((handle: number) => {
      const timeout = handle as unknown as ReturnType<typeof setTimeout>
      clearTimeout(timeout)
      fallbackHandles.delete(timeout)
    }) as typeof cancelAnimationFrame

    const scheduler = createRafValueScheduler<number>((next) => {
      applied.push(next)
    })
    scheduler.schedule(7)

    await new Promise(resolve => setTimeout(resolve, 20))

    if (applied.length !== 1 || applied[0] !== 7) {
      throw new Error(`expected RAF value scheduler to use the global fallback when active window lacks RAF, got ${JSON.stringify(applied)}`)
    }
  } finally {
    for (const handle of fallbackHandles) clearTimeout(handle)
    if (typeof originalWindow === 'undefined') {
      delete globals.window
    } else {
      globals.window = originalWindow
    }
    if (typeof originalRequestAnimationFrame === 'undefined') {
      delete globals.requestAnimationFrame
    } else {
      globals.requestAnimationFrame = originalRequestAnimationFrame
    }
    if (typeof originalCancelAnimationFrame === 'undefined') {
      delete globals.cancelAnimationFrame
    } else {
      globals.cancelAnimationFrame = originalCancelAnimationFrame
    }
  }
}
