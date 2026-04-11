import React from 'react'
import { isMarkdownRuntimeProbeEnabled, recordMarkdownRuntimeProbe } from './markdownBlockContainerCore.probe'

export const useMarkdownBlockContainerRuntimeProbe = (args: {
  startLine: number
  endLine?: number
  editing: boolean
  editorRef: React.RefObject<HTMLElement | null>
}) => {
  const probeEnabledRef = React.useRef(false)

  React.useEffect(() => {
    probeEnabledRef.current = isMarkdownRuntimeProbeEnabled()
  }, [])

  const probe = React.useCallback((name: string, data?: Record<string, unknown>) => {
    if (!probeEnabledRef.current) return
    recordMarkdownRuntimeProbe(name, {
      startLine: args.startLine,
      endLine: args.endLine,
      editing: args.editing,
      ...data,
    })
  }, [args.editing, args.endLine, args.startLine])

  const probeSelection = React.useCallback((name: string, extra?: Record<string, unknown>) => {
    if (!probeEnabledRef.current) return
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel || sel.rangeCount <= 0) {
      probe(name, { rc: 0, ...extra })
      return
    }
    const r = sel.getRangeAt(0)
    const c = r.commonAncestorContainer
    const n = c.nodeType === Node.ELEMENT_NODE ? (c as Element) : c.parentElement
    const root = args.editorRef.current
    const inEditor = !!(root && n && root.contains(n))
    const txt = String(sel.toString() || '').slice(0, 96)
    probe(name, { rc: sel.rangeCount, collapsed: r.collapsed, inEditor, txt, ...extra })
  }, [args.editorRef, probe])

  return {
    probe,
    probeSelection,
  }
}
