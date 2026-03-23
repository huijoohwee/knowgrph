import { useEffect, useRef } from 'react'

export function useCanvasLayoutSync(args: {
  width: number
  height: number
  left: number
  top: number
  setCanvasDims: (x: { w: number; h: number }) => void
  setCanvasPos: (x: { x: number; y: number }) => void
}): void {
  const { width, height, left, top, setCanvasDims, setCanvasPos } = args
  const lastCanvasLayoutRef = useRef<null | { w: number; h: number; x: number; y: number }>(null)

  useEffect(() => {
    const next = {
      w: Math.max(1, Math.floor(width)),
      h: Math.max(1, Math.floor(height)),
      x: left,
      y: top,
    }
    const prev = lastCanvasLayoutRef.current
    if (prev && prev.w === next.w && prev.h === next.h && prev.x === next.x && prev.y === next.y) return
    lastCanvasLayoutRef.current = next
    if (!prev || prev.w !== next.w || prev.h !== next.h) setCanvasDims({ w: next.w, h: next.h })
    if (!prev || prev.x !== next.x || prev.y !== next.y) setCanvasPos({ x: next.x, y: next.y })
  }, [height, left, setCanvasDims, setCanvasPos, top, width])
}

