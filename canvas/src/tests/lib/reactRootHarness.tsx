import React, { act } from 'react'
import type { Root } from 'react-dom/client'

export const waitForNextTask = (): Promise<void> =>
  new Promise<void>(resolve => {
    setTimeout(resolve, 0)
  })

export const waitForTasks = async (count = 1) => {
  for (let i = 0; i < count; i += 1) {
    await waitForNextTask()
  }
}

export const waitForNextFrame = (win: Window): Promise<void> => {
  const anyWindow = win as unknown as { requestAnimationFrame?: (cb: () => void) => number }
  if (!anyWindow.requestAnimationFrame) {
    anyWindow.requestAnimationFrame = (cb: () => void) => setTimeout(cb, 0) as unknown as number
  }
  return new Promise<void>(resolve => anyWindow.requestAnimationFrame!(() => resolve()))
}

export const waitForFrames = async (win: Window, count = 1) => {
  for (let i = 0; i < count; i += 1) {
    await waitForNextFrame(win)
  }
}

export const installDeterministicRaf = (win: Window) => {
  const requestAnimationFrame = (cb: (ts: number) => void) =>
    setTimeout(() => cb(Date.now()), 0) as unknown as number
  ;(win as unknown as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame = requestAnimationFrame
  ;(globalThis as unknown as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame = requestAnimationFrame
  return requestAnimationFrame
}

export const mountReactRoot = async (
  root: Root,
  element: React.ReactElement,
  options?: {
    window?: Window
    frames?: number
    tasks?: number
  },
) => {
  await act(async () => {
    root.render(element)
    if (options?.window && (options.frames || 0) > 0) {
      await waitForFrames(options.window, options.frames)
    }
    if ((options?.tasks || 0) > 0) {
      await waitForTasks(options?.tasks)
    }
  })
}

export const unmountReactRoot = async (
  root: Root,
  options?: {
    window?: Window
    tasks?: number
  },
) => {
  await act(async () => {
    root.unmount()
    if (options?.window) {
      await waitForNextFrame(options.window)
    }
    if ((options?.tasks || 0) > 0) {
      await waitForTasks(options.tasks)
    }
  })
}
