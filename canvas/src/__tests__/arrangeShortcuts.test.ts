import { readArrangeShortcut, readNudgeDelta } from '@/lib/canvas/arrangeShortcuts'

export function testArrangeShortcutsParseAndNudge() {
  const mk = (partial: Partial<KeyboardEvent> & { key: string }): KeyboardEvent => {
    return partial as unknown as KeyboardEvent
  }

  const a = readArrangeShortcut(mk({ key: 'L', altKey: true, shiftKey: true }))
  if (a !== 'align-left') throw new Error('expected Alt+Shift+L to align-left')
  const b = readArrangeShortcut(mk({ key: 'h', altKey: true, shiftKey: true }))
  if (b !== 'align-center-x') throw new Error('expected Alt+Shift+H to align-center-x')
  const c = readArrangeShortcut(mk({ key: 'y', altKey: true, shiftKey: true }))
  if (c !== 'distribute-y') throw new Error('expected Alt+Shift+Y to distribute-y')
  const d = readArrangeShortcut(mk({ key: 'L', altKey: true, shiftKey: true, metaKey: true }))
  if (d != null) throw new Error('expected meta to disable arrange shortcut')

  const n1 = readNudgeDelta({ e: mk({ key: 'ArrowRight' }), snapGridEnabled: false, snapGridSize: 10 })
  if (!n1 || n1.dx !== 1 || n1.dy !== 0) throw new Error('expected ArrowRight nudge by 1')
  const n2 = readNudgeDelta({ e: mk({ key: 'ArrowDown', shiftKey: true }), snapGridEnabled: false, snapGridSize: 10 })
  if (!n2 || n2.dx !== 0 || n2.dy !== 10) throw new Error('expected Shift+ArrowDown nudge by 10')
  const n3 = readNudgeDelta({ e: mk({ key: 'ArrowLeft' }), snapGridEnabled: true, snapGridSize: 8 })
  if (!n3 || n3.dx !== -8 || n3.dy !== 0) throw new Error('expected grid nudge by gridSize')
  const n4 = readNudgeDelta({ e: mk({ key: 'ArrowLeft', shiftKey: true }), snapGridEnabled: true, snapGridSize: 8 })
  if (!n4 || n4.dx !== -40 || n4.dy !== 0) throw new Error('expected Shift grid nudge by 5x gridSize')
  const n5 = readNudgeDelta({ e: mk({ key: 'ArrowLeft', altKey: true }), snapGridEnabled: true, snapGridSize: 8 })
  if (!n5 || n5.dx !== -1 || n5.dy !== 0) throw new Error('expected Alt to bypass grid snapping on nudge')
}

