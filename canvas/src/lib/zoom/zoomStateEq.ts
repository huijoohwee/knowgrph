export type ZoomStateLike = {
  k: number
  x: number
  y: number
  graphDataRevision?: number
  viewportW?: number
  viewportH?: number
}

export const isSameZoomState = (a: ZoomStateLike | null | undefined, b: ZoomStateLike | null | undefined): boolean => {
  if (!a || !b) return false
  return (
    a.k === b.k &&
    a.x === b.x &&
    a.y === b.y &&
    a.graphDataRevision === b.graphDataRevision &&
    a.viewportW === b.viewportW &&
    a.viewportH === b.viewportH
  )
}

