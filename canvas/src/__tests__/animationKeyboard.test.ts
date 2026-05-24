import {
  isAnimationTimelineMutationHotkeyAction,
  resolveAnimationTimelineHotkeyAction,
  shouldIgnoreAnimationTimelineHotkeys,
} from '@/components/AnimationCanvas/animationKeyboard'

export function testResolveAnimationTimelineHotkeyActionMapsNativeKeyboardShortcuts() {
  const cases = [
    [{ code: 'Space' }, 'toggle-playback'],
    [{ code: 'ArrowLeft' }, 'step-prev-beat'],
    [{ code: 'ArrowRight' }, 'step-next-beat'],
    [{ code: 'KeyR' }, 'reset-playhead'],
    [{ code: 'KeyD' }, 'duplicate-beat'],
    [{ code: 'KeyS' }, 'split-beat'],
    [{ code: 'KeyL' }, 'edit-beat-label'],
    [{ code: 'KeyN' }, 'edit-beat-note'],
    [{ code: 'KeyM' }, 'edit-beat-summary'],
    [{ code: 'KeyT' }, 'edit-beat-tags'],
    [{ code: 'KeyH' }, 'toggle-lane-hidden'],
    [{ code: 'KeyU' }, 'toggle-lane-muted'],
    [{ code: 'KeyO' }, 'toggle-lane-solo'],
    [{ code: 'BracketLeft' }, 'move-lane-up'],
    [{ code: 'BracketRight' }, 'move-lane-down'],
    [{ code: 'Comma' }, 'move-selected-item-prev-beat'],
    [{ code: 'Period' }, 'move-selected-item-next-beat'],
    [{ key: 'd' }, 'duplicate-beat'],
    [{ key: 'S' }, 'split-beat'],
    [{ key: 'l' }, 'edit-beat-label'],
    [{ key: 'n' }, 'edit-beat-note'],
    [{ key: 'm' }, 'edit-beat-summary'],
    [{ key: 't' }, 'edit-beat-tags'],
    [{ key: 'h' }, 'toggle-lane-hidden'],
    [{ key: 'u' }, 'toggle-lane-muted'],
    [{ key: 'o' }, 'toggle-lane-solo'],
    [{ key: '[' }, 'move-lane-up'],
    [{ key: ']' }, 'move-lane-down'],
    [{ key: ',' }, 'move-selected-item-prev-beat'],
    [{ key: '.' }, 'move-selected-item-next-beat'],
  ] as const
  for (const [input, expected] of cases) {
    const actual = resolveAnimationTimelineHotkeyAction(input)
    if (actual !== expected) {
      throw new Error(`expected hotkey ${JSON.stringify(input)} to resolve to ${expected}, got ${String(actual)}`)
    }
  }
  if (resolveAnimationTimelineHotkeyAction({ code: 'KeyZ', key: 'z' }) !== null) {
    throw new Error('expected unsupported keys to resolve to null')
  }
}

export function testShouldIgnoreAnimationTimelineHotkeysBlocksEditingAndInteractiveTargets() {
  const ignoredCases = [
    { editingBeat: true },
    { dragging: true },
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { targetTagName: 'input' },
    { targetTagName: 'button' },
    { targetTagName: 'textarea' },
    { targetRole: 'textbox' },
    { targetContentEditable: true },
  ] as const
  for (const input of ignoredCases) {
    if (!shouldIgnoreAnimationTimelineHotkeys(input)) {
      throw new Error(`expected hotkey gate to ignore ${JSON.stringify(input)}`)
    }
  }
}

export function testShouldIgnoreAnimationTimelineHotkeysAllowsPlainCanvasFocus() {
  const ignored = shouldIgnoreAnimationTimelineHotkeys({
    targetTagName: 'div',
    targetRole: 'presentation',
    targetContentEditable: false,
  })
  if (ignored) {
    throw new Error('expected plain canvas focus target to allow native timeline hotkeys')
  }
}

export function testIsAnimationTimelineMutationHotkeyActionOnlyFlagsMutatingShortcuts() {
  if (!isAnimationTimelineMutationHotkeyAction('duplicate-beat')) {
    throw new Error('expected duplicate-beat to be treated as a mutation hotkey')
  }
  if (!isAnimationTimelineMutationHotkeyAction('split-beat')) {
    throw new Error('expected split-beat to be treated as a mutation hotkey')
  }
  for (const action of ['toggle-lane-hidden', 'toggle-lane-muted', 'toggle-lane-solo', 'move-lane-up', 'move-lane-down', 'move-selected-item-prev-beat', 'move-selected-item-next-beat'] as const) {
    if (!isAnimationTimelineMutationHotkeyAction(action)) {
      throw new Error(`expected ${action} to be treated as a mutation hotkey`)
    }
  }
  for (const action of ['toggle-playback', 'step-prev-beat', 'step-next-beat', 'reset-playhead', 'edit-beat-label', 'edit-beat-note', 'edit-beat-summary', 'edit-beat-tags'] as const) {
    if (isAnimationTimelineMutationHotkeyAction(action)) {
      throw new Error(`expected ${action} to stay non-mutating`)
    }
  }
}
