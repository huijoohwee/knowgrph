import React from 'react'

export const useMarkdownBlockContainerHostOrchestration = (args: {
  editing: boolean
  hostRef: React.MutableRefObject<HTMLElement | null>
  forwardedRef: React.ForwardedRef<HTMLElement>
  editorRef: React.MutableRefObject<HTMLElement | null>
  lastDocumentPointerDownTargetRef: React.MutableRefObject<Node | null>
  lastDocumentPointerDownAtRef: React.MutableRefObject<number>
  originalOnClick?: React.MouseEventHandler<HTMLElement>
  openEditor: (event: React.MouseEvent<HTMLElement>) => void
  onEditingHostDoubleClick?: (event: React.MouseEvent<HTMLElement>) => void
  probe: (name: string, data?: Record<string, unknown>) => void
  probeSelection: (name: string, extra?: Record<string, unknown>) => void
}) => {
  React.useEffect(() => {
    if (!args.editing) return
    const onPointerDownCapture = (event: Event) => {
      const t = event.target
      args.lastDocumentPointerDownTargetRef.current = (t instanceof Node) ? t : null
      args.lastDocumentPointerDownAtRef.current = Date.now()
    }
    document.addEventListener('pointerdown', onPointerDownCapture, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDownCapture, true)
    }
  }, [args.editing, args.lastDocumentPointerDownAtRef, args.lastDocumentPointerDownTargetRef])

  const isTargetInsideEditor = React.useCallback((target: EventTarget | null): boolean => {
    const root = args.editorRef.current
    if (!root || !(target instanceof Node)) return false
    return root.contains(target)
  }, [args.editorRef])

  const setHostNodeRef = React.useCallback((node: HTMLElement | null) => {
    args.hostRef.current = node
    if (typeof args.forwardedRef === 'function') {
      args.forwardedRef(node)
    } else if (args.forwardedRef && typeof args.forwardedRef === 'object') {
      ;(args.forwardedRef as unknown as { current: HTMLElement | null }).current = node
    }
  }, [args.forwardedRef, args.hostRef])

  const onHostClick = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    args.originalOnClick?.(event)
    if (event.defaultPrevented) return
    if (args.editing) {
      if (isTargetInsideEditor(event.target)) return
      if (event.detail >= 2) return
      return
    }
    if (event.detail >= 2) return
    args.openEditor(event)
  }, [args, isTargetInsideEditor])

  const onHostDoubleClick = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    const wasEditing = args.editing
    args.probe('dblclick.host', { detail: event.detail })
    args.probeSelection('dblclick.host.selection.before')
    if (wasEditing) {
      args.onEditingHostDoubleClick?.(event)
      return
    }
    const currentTarget = event.currentTarget
    const target = event.target as EventTarget
    const clientX = event.clientX
    const clientY = event.clientY
    args.openEditor({
      detail: 2,
      currentTarget,
      target,
      clientX,
      clientY,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as React.MouseEvent<HTMLElement>)
    window.requestAnimationFrame(() => args.probeSelection('dblclick.host.selection.after', { path: 'opened' }))
    window.requestAnimationFrame(() => {
      args.onEditingHostDoubleClick?.({
        detail: 2,
        currentTarget,
        target,
        clientX,
        clientY,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as React.MouseEvent<HTMLElement>)
    })
  }, [args, isTargetInsideEditor])

  return {
    setHostNodeRef,
    onHostClick,
    onHostDoubleClick,
  }
}
