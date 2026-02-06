import {
  CANVAS_PRECEDENCE_RULES,
  CANVAS_SHORTCUT_COPY_LINES,
  CANVAS_SHORTCUTS,
} from '@/lib/canvas/interaction-ssot'

import { HELP_SHORTCUT_ITEMS } from '@/features/panels/config'

export function testCanvasHelpShortcutsSsotHasUniqueIdsAndLines() {
  const ids = new Set<string>()
  for (const s of CANVAS_SHORTCUTS) {
    const id = String(s.id || '').trim()
    if (!id) throw new Error('expected every canvas shortcut to have a non-empty id')
    if (ids.has(id)) throw new Error(`duplicate canvas shortcut id: ${id}`)
    ids.add(id)
  }

  const lines = new Set<string>()
  for (const line of CANVAS_SHORTCUT_COPY_LINES) {
    const t = String(line || '').trim()
    if (!t) throw new Error('expected every canvas shortcut copy line to be non-empty')
    if (lines.has(t)) throw new Error(`duplicate canvas shortcut copy line: ${t}`)
    lines.add(t)
  }

  if (CANVAS_PRECEDENCE_RULES.length < 2) {
    throw new Error('expected at least two precedence rules')
  }
  for (const r of CANVAS_PRECEDENCE_RULES) {
    const rule = String(r.rule || '').trim()
    const detail = String(r.detail || '').trim()
    if (!rule || !detail) throw new Error('expected precedence rules to have rule and detail')
  }
}

export function testHelpTabSearchAndCopyIncludesCanvasShortcutLines() {
  const helpSet = new Set(HELP_SHORTCUT_ITEMS)
  for (const line of CANVAS_SHORTCUT_COPY_LINES) {
    if (!helpSet.has(line)) {
      throw new Error(`expected HELP_SHORTCUT_ITEMS to include canvas shortcut line: ${line}`)
    }
  }
}

