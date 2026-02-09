import { ensureSpacePanKeyListenerInstalled, isSpacePanHeld, resetSpacePanHeldForTests } from '@/lib/canvas/space-pan'

type KeyEventLike = {
  code?: string
  key?: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  repeat?: boolean
  target?: { tagName?: string }
  preventDefault?: () => void
}

type ListenerMap = Record<string, ((e: KeyEventLike) => void)[]>

export const testSpacePanKeyStateTracksHeldSpace = () => {
  resetSpacePanHeldForTests()

  const listeners: ListenerMap = {}
  const fakeWindow = {
    addEventListener: (type: string, fn: (e: KeyEventLike) => void) => {
      listeners[type] = listeners[type] || []
      listeners[type].push(fn)
    },
  } as unknown as Window

  const g = globalThis as unknown as { window?: Window }
  g.window = fakeWindow

  ensureSpacePanKeyListenerInstalled()
  const keydown = (listeners['keydown'] || [])[0]
  const keyup = (listeners['keyup'] || [])[0]
  if (typeof keydown !== 'function') throw new Error('expected keydown listener installed')
  if (typeof keyup !== 'function') throw new Error('expected keyup listener installed')

  let prevented = 0
  keydown({ code: 'Space', key: ' ', metaKey: false, ctrlKey: false, altKey: false, repeat: false, target: { tagName: 'DIV' }, preventDefault: () => (prevented += 1) })
  if (!isSpacePanHeld()) throw new Error('expected Space to be marked held after keydown')
  if (prevented !== 1) throw new Error('expected Space keydown to preventDefault')

  keyup({ code: 'Space', key: ' ', target: { tagName: 'DIV' } })
  if (isSpacePanHeld()) throw new Error('expected Space to be released after keyup')

  keydown({ code: 'Space', key: ' ', metaKey: false, ctrlKey: false, altKey: false, repeat: false, target: { tagName: 'INPUT' }, preventDefault: () => (prevented += 1) })
  if (isSpacePanHeld()) throw new Error('expected Space not to be held when typing in input')

  keydown({ code: 'Space', key: ' ', metaKey: true, ctrlKey: false, altKey: false, repeat: false, target: { tagName: 'DIV' }, preventDefault: () => (prevented += 1) })
  if (isSpacePanHeld()) throw new Error('expected Space not to be held with meta modifier')
}
