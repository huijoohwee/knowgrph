type RafRequest = (callback: FrameRequestCallback) => number
type RafCancel = (handle: number) => void

const createSetTimeoutFallback = (): { request: RafRequest; cancel: RafCancel } => ({
  request: (callback) => setTimeout(() => callback(Date.now()), 0) as unknown as number,
  cancel: (handle) => clearTimeout(handle as unknown as ReturnType<typeof setTimeout>),
})

export const resolveRafRuntime = (): { request: RafRequest; cancel: RafCancel } => {
  if (typeof window !== 'undefined') {
    const request = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : null
    const cancel = typeof window.cancelAnimationFrame === 'function'
      ? window.cancelAnimationFrame.bind(window)
      : null
    if (request && cancel) return { request, cancel }
  }

  const globalRequest = typeof globalThis.requestAnimationFrame === 'function'
    ? globalThis.requestAnimationFrame.bind(globalThis)
    : null
  const globalCancel = typeof globalThis.cancelAnimationFrame === 'function'
    ? globalThis.cancelAnimationFrame.bind(globalThis)
    : null
  if (globalRequest && globalCancel) return { request: globalRequest, cancel: globalCancel }

  return createSetTimeoutFallback()
}
