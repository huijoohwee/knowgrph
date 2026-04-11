import React from 'react'
import { ensureWordSelectionInRoot, expandSelectionSegmentAt, findFirstSelectableSegment } from './markdownBlockContainerCore.interaction'

export const useMarkdownBlockContainerEditOpenCaretProbe = (args: {
  editable: boolean
  typographySelector: string
  editCaptureLayoutSpacing: boolean
  editStripLinePrefix: boolean
  editStripLinePrefixSpacingSanitize: boolean
  probe: (name: string, data?: Record<string, unknown>) => void
  resolveEditLineRangeOnOpen?: (eventTarget: HTMLElement | null) => { startLine: number; endLine: number } | null
  resolveEditMinHeightOnOpen?: (eventTarget: HTMLElement | null, currentTarget: HTMLElement) => number | null
  setSessionEditLineRange: React.Dispatch<React.SetStateAction<{ startLine: number; endLine: number } | null>>
  setEditing: React.Dispatch<React.SetStateAction<boolean>>
  editTypographySnapshotRef: React.MutableRefObject<React.CSSProperties | null>
  editSpacingSnapshotRef: React.MutableRefObject<React.CSSProperties | null>
  parityProbeSnapshotRef: React.MutableRefObject<{ source: HTMLElement; sourceMetrics: Record<string, string> } | null>
  editSessionIdRef: React.MutableRefObject<number>
  editOpenBlurGuardUntilRef: React.MutableRefObject<number>
  editMinHeightPxRef: React.MutableRefObject<number>
  lastPointerRef: React.MutableRefObject<{ x: number; y: number } | null>
  lastPointerTargetRef: React.MutableRefObject<Node | null>
  lastPointerSelectionModeRef: React.MutableRefObject<'caret' | 'word'>
  editorRef: React.RefObject<HTMLElement | null>
  editStartLine: number
  editEndLine: number
}) => {
  const openEditor = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    args.probe('openEditor.invoke', { detail: event.detail })
    if (!args.editable) {
      args.probe('openEditor.skip', { reason: 'not-editable' })
      return
    }
    const target = event.target as HTMLElement | null
    if (target?.closest('button,input,select,textarea,[contenteditable="true"]')) {
      args.probe('openEditor.skip', { reason: 'interactive-target' })
      return
    }
    try {
      const baseNode = target && event.currentTarget.contains(target) ? target : event.currentTarget
      const typographySource =
        baseNode.closest(args.typographySelector) as HTMLElement | null
      const sourceSurface = typographySource || event.currentTarget
      const computed = window.getComputedStyle(sourceSurface)
      args.editTypographySnapshotRef.current = {
        fontFamily: computed.fontFamily || undefined,
        fontSize: computed.fontSize || undefined,
        fontWeight: computed.fontWeight || undefined,
        fontStyle: computed.fontStyle || undefined,
        lineHeight: computed.lineHeight || undefined,
        letterSpacing: computed.letterSpacing || undefined,
        color: computed.color || undefined,
      }
      const spacingSnapshot = args.editCaptureLayoutSpacing
        ? {
            textAlign: (computed.textAlign || undefined) as React.CSSProperties['textAlign'],
            wordSpacing: computed.wordSpacing || undefined,
            textIndent: computed.textIndent || undefined,
            paddingTop: computed.paddingTop || undefined,
            paddingRight: computed.paddingRight || undefined,
            paddingBottom: computed.paddingBottom || undefined,
            paddingLeft: computed.paddingLeft || undefined,
            marginTop: computed.marginTop || undefined,
            marginRight: computed.marginRight || undefined,
            marginBottom: computed.marginBottom || undefined,
            marginLeft: computed.marginLeft || undefined,
            borderTopWidth: computed.borderTopWidth || undefined,
            borderRightWidth: computed.borderRightWidth || undefined,
            borderBottomWidth: computed.borderBottomWidth || undefined,
            borderLeftWidth: computed.borderLeftWidth || undefined,
            borderTopStyle: (computed.borderTopStyle || undefined) as React.CSSProperties['borderTopStyle'],
            borderRightStyle: (computed.borderRightStyle || undefined) as React.CSSProperties['borderRightStyle'],
            borderBottomStyle: (computed.borderBottomStyle || undefined) as React.CSSProperties['borderBottomStyle'],
            borderLeftStyle: (computed.borderLeftStyle || undefined) as React.CSSProperties['borderLeftStyle'],
            borderTopColor: computed.borderTopColor || undefined,
            borderRightColor: computed.borderRightColor || undefined,
            borderBottomColor: computed.borderBottomColor || undefined,
            borderLeftColor: computed.borderLeftColor || undefined,
            borderRadius: computed.borderRadius || undefined,
            boxSizing: computed.boxSizing || undefined,
            backgroundColor: computed.backgroundColor || undefined,
            caretColor: computed.caretColor || undefined,
          } as React.CSSProperties
        : null
      const editStripLinePrefix = args.editStripLinePrefix
      if (spacingSnapshot && editStripLinePrefix && args.editStripLinePrefixSpacingSanitize) {
        spacingSnapshot.textIndent = undefined
        spacingSnapshot.paddingLeft = undefined
        spacingSnapshot.paddingRight = undefined
        spacingSnapshot.marginLeft = undefined
        spacingSnapshot.marginRight = undefined
        spacingSnapshot.borderLeftWidth = undefined
        spacingSnapshot.borderRightWidth = undefined
        spacingSnapshot.borderLeftStyle = undefined
        spacingSnapshot.borderRightStyle = undefined
        spacingSnapshot.borderLeftColor = undefined
        spacingSnapshot.borderRightColor = undefined
      }
      args.editSpacingSnapshotRef.current = spacingSnapshot
      const probeKeys: Array<keyof CSSStyleDeclaration> = [
        'fontFamily',
        'fontSize',
        'fontWeight',
        'fontStyle',
        'lineHeight',
        'letterSpacing',
        'color',
        'textAlign',
        'wordSpacing',
        'textIndent',
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'marginTop',
        'marginRight',
        'marginBottom',
        'marginLeft',
        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'borderLeftWidth',
        'borderTopStyle',
        'borderRightStyle',
        'borderBottomStyle',
        'borderLeftStyle',
        'borderTopColor',
        'borderRightColor',
        'borderBottomColor',
        'borderLeftColor',
        'borderRadius',
        'boxSizing',
        'backgroundColor',
        'caretColor',
      ]
      const sourceMetrics = Object.fromEntries(
        probeKeys.map(key => [String(key), String(computed[key] || '')]),
      )
      args.parityProbeSnapshotRef.current = {
        source: sourceSurface,
        sourceMetrics,
      }
    } catch {
      args.editTypographySnapshotRef.current = null
      args.editSpacingSnapshotRef.current = null
      args.parityProbeSnapshotRef.current = null
    }
    const resolvedRange = args.resolveEditLineRangeOnOpen?.(target ?? null) ?? null
    args.setSessionEditLineRange(resolvedRange)
    args.lastPointerRef.current = { x: event.clientX, y: event.clientY }
    args.lastPointerTargetRef.current = event.target instanceof Node ? event.target : null
    args.lastPointerSelectionModeRef.current = event.detail >= 2 ? 'word' : 'caret'
    try {
      const resolvedH = args.resolveEditMinHeightOnOpen?.(target ?? null, event.currentTarget)
      const h = Number.isFinite(resolvedH as number)
        ? Number(resolvedH)
        : event.currentTarget.getBoundingClientRect().height
      args.editMinHeightPxRef.current = Number.isFinite(h) ? Math.max(0, h) : 0
    } catch {
      args.editMinHeightPxRef.current = 0
    }
    args.editSessionIdRef.current += 1
    args.editOpenBlurGuardUntilRef.current = Date.now() + 160
    if (event.detail < 2) {
      event.preventDefault()
      event.stopPropagation()
    }
    args.setEditing(prev => (prev ? prev : true))
    args.probe('openEditor.setEditing', { sessionId: args.editSessionIdRef.current, selectionMode: args.lastPointerSelectionModeRef.current })
  }, [args])

  const emitParityProbe = React.useCallback(() => {
    const probe = args.parityProbeSnapshotRef.current
    const editor = args.editorRef.current
    if (!probe || !editor) return
    const probeEnabled = (() => {
      try {
        const w = window as unknown as { __KG_EDIT_PARITY_PROBE__?: boolean }
        if (w.__KG_EDIT_PARITY_PROBE__ === true) return true
        const query = new URLSearchParams(window.location.search || '')
        return query.get('kgEditParityProbe') === '1'
      } catch {
        return false
      }
    })()
    if (!probeEnabled) return
    try {
      const read = probe.sourceMetrics
      const edit = window.getComputedStyle(editor)
      const keys: Array<keyof CSSStyleDeclaration> = [
        'fontFamily',
        'fontSize',
        'fontWeight',
        'fontStyle',
        'lineHeight',
        'letterSpacing',
        'color',
        'textAlign',
        'wordSpacing',
        'textIndent',
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'marginTop',
        'marginRight',
        'marginBottom',
        'marginLeft',
        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'borderLeftWidth',
        'borderTopStyle',
        'borderRightStyle',
        'borderBottomStyle',
        'borderLeftStyle',
        'borderTopColor',
        'borderRightColor',
        'borderBottomColor',
        'borderLeftColor',
        'borderRadius',
        'boxSizing',
        'backgroundColor',
        'caretColor',
      ]
      const mismatches = keys
        .map(key => ({ key, read: String(read[String(key)] || ''), edit: String(edit[key] || '') }))
        .filter(row => row.read !== row.edit)
      const payload = {
        startLine: args.editStartLine,
        endLine: args.editEndLine,
        mismatches,
      }
      const w = window as unknown as {
        __KG_EDIT_PARITY_LAST_MISMATCH__?: unknown
        __KG_EDIT_PARITY_LAST_PAYLOAD__?: unknown
        __KG_EDIT_PARITY_MISMATCH_COUNT__?: number
      }
      w.__KG_EDIT_PARITY_LAST_PAYLOAD__ = payload
      if (mismatches.length > 0) {
        w.__KG_EDIT_PARITY_LAST_MISMATCH__ = payload
        w.__KG_EDIT_PARITY_MISMATCH_COUNT__ = Number(w.__KG_EDIT_PARITY_MISMATCH_COUNT__ || 0) + 1
      }
      window.dispatchEvent(new CustomEvent('kg-edit-parity-probe', { detail: payload }))
      if (mismatches.length > 0) console.warn('kg-edit-parity-probe', payload)
      console.warn(`kg-edit-parity-probe-json ${JSON.stringify(payload)}`)
    } catch {
      void 0
    }
  }, [args])

  const placeCaretFromClientPoint = React.useCallback(() => {
    const point = args.lastPointerRef.current
    if (!point) return
    const root = args.editorRef.current
    if (!root) return
    const getRange = (): Range | null => {
      const docAny = document as unknown as {
        caretRangeFromPoint?: (x: number, y: number) => Range | null
      }
      const caretFromPointAny = document as unknown as {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
      }
      if (typeof caretFromPointAny.caretPositionFromPoint === 'function') {
        try {
          const pos = caretFromPointAny.caretPositionFromPoint(point.x, point.y)
          if (!pos) return null
          const range = document.createRange()
          range.setStart(pos.offsetNode, pos.offset)
          range.collapse(true)
          return range
        } catch {
          return null
        }
      }
      if (typeof docAny.caretRangeFromPoint === 'function') {
        try {
          return docAny.caretRangeFromPoint(point.x, point.y)
        } catch {
          return null
        }
      }
      return null
    }
    const range = getRange()
    const hasPointCaretApi = (() => {
      const docAny = document as unknown as {
        caretRangeFromPoint?: unknown
        caretPositionFromPoint?: unknown
      }
      return (
        typeof docAny.caretPositionFromPoint === 'function' ||
        typeof docAny.caretRangeFromPoint === 'function'
      )
    })()
    const buildLocalFallbackRange = (): Range | null => {
      const pointerTarget = args.lastPointerTargetRef.current
      const resolveLocalTextNode = (): Text | null => {
        if (!pointerTarget) return null
        if (pointerTarget.nodeType === Node.TEXT_NODE) {
          const textNode = pointerTarget as Text
          return root.contains(textNode.parentNode) ? textNode : null
        }
        const el =
          pointerTarget.nodeType === Node.ELEMENT_NODE
            ? (pointerTarget as Element)
            : pointerTarget.parentElement
        if (!el || !root.contains(el)) return null
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        let current = walker.nextNode() as Text | null
        while (current) {
          if (String(current.nodeValue || '').trim()) return current
          current = walker.nextNode() as Text | null
        }
        return null
      }
      const localText = resolveLocalTextNode()
      if (!localText) return null
      const segment = findFirstSelectableSegment(String(localText.nodeValue || ''))
      if (!segment) return null
      const fallback = document.createRange()
      fallback.setStart(localText, segment.start)
      fallback.setEnd(localText, segment.end)
      return fallback
    }
    if (!range) {
      if (args.lastPointerSelectionModeRef.current === 'word') {
        const selFallback = typeof window !== 'undefined' ? window.getSelection() : null
        const fallback = buildLocalFallbackRange()
        if (selFallback && fallback) {
          try {
            selFallback.removeAllRanges()
            selFallback.addRange(fallback)
          } catch {
            void 0
          }
        } else if (!hasPointCaretApi) {
          ensureWordSelectionInRoot(root)
        }
      }
      return
    }
    const container = range.startContainer
    const node = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement
    if (!node || !root.contains(node)) return
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel) return
    const hasStableSelectionInRoot = (() => {
      if (sel.rangeCount <= 0) return false
      try {
        const rr = sel.getRangeAt(0)
        if (rr.collapsed) return false
        const cc = rr.commonAncestorContainer
        const nn = cc.nodeType === Node.ELEMENT_NODE ? (cc as Element) : cc.parentElement
        if (!nn || !root.contains(nn)) return false
        return String(sel.toString() || '').trim().length > 0
      } catch {
        return false
      }
    })()
    if (args.lastPointerSelectionModeRef.current === 'word' && hasStableSelectionInRoot) {
      args.lastPointerSelectionModeRef.current = 'caret'
      return
    }
    try {
      const wantsWordSelection = args.lastPointerSelectionModeRef.current === 'word'
      if (
        wantsWordSelection &&
        (range.startContainer.nodeType === Node.TEXT_NODE || range.startContainer.nodeType === Node.ELEMENT_NODE)
      ) {
        const resolveTextNodeForWordSelection = (): Text | null => {
          if (range.startContainer.nodeType === Node.TEXT_NODE) return range.startContainer as Text
          const containerEl = range.startContainer as Element
          const fromChild = (() => {
            const idx = Math.max(0, Math.min(containerEl.childNodes.length - 1, range.startOffset))
            const direct = containerEl.childNodes[idx] || containerEl.childNodes[idx - 1] || null
            if (!direct) return null
            if (direct.nodeType === Node.TEXT_NODE) return direct as Text
            const walker = document.createTreeWalker(direct, NodeFilter.SHOW_TEXT)
            const first = walker.nextNode()
            return first && first.nodeType === Node.TEXT_NODE ? first as Text : null
          })()
          if (fromChild) return fromChild
          return null
        }
        const node = resolveTextNodeForWordSelection()
        if (!node) {
          const fallback = buildLocalFallbackRange()
          if (fallback) {
            sel.removeAllRanges()
            sel.addRange(fallback)
          } else {
            range.collapse(true)
            sel.removeAllRanges()
            sel.addRange(range)
          }
          args.lastPointerSelectionModeRef.current = 'caret'
          return
        }
        if (range.startContainer !== node) {
          try {
            range.setStart(node, 0)
            range.collapse(true)
          } catch {
            void 0
          }
        }
        const text = String(node.nodeValue || '')
        if (text.length > 0) {
          const segment = expandSelectionSegmentAt(text, range.startOffset)
          if (segment) {
            range.setStart(node, segment.start)
            range.setEnd(node, segment.end)
          } else {
            range.collapse(true)
          }
        } else {
          range.collapse(true)
        }
      } else {
        range.collapse(true)
      }
      sel.removeAllRanges()
      sel.addRange(range)
      if (wantsWordSelection && !String(sel.toString() || '').trim()) {
        const fallback = buildLocalFallbackRange()
        if (fallback) {
          sel.removeAllRanges()
          sel.addRange(fallback)
        } else if (!hasPointCaretApi) {
          ensureWordSelectionInRoot(root)
        }
      }
      args.lastPointerSelectionModeRef.current = 'caret'
    } catch {
      void 0
    }
  }, [args])

  return {
    openEditor,
    emitParityProbe,
    placeCaretFromClientPoint,
  }
}
