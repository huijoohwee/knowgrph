export type DesignCanvasFrameNodeRef = {
  id: string
  label: string
  type?: string
}

export type DesignCanvasFrameRect = {
  x: number
  y: number
  w: number
  h: number
}

export type DesignCanvasNodeStyle = {
  fill?: string
  stroke?: string
  strokeWidth?: number
  borderRadius?: number
  opacity?: number
  kind?: string
  zIndex?: number
  stackKey?: string
  xIndex?: number
  yIndex?: number
  boxShadow?: string
  position?: string
  tag?: string
}

export type DesignCanvasInlineMediaPreview = {
  tag: 'IMG' | 'VIDEO' | 'IFRAME'
  titleChip: string
  url: string
  clipId: string
}

export type DesignCanvasLabelChip = {
  boxX: number
  boxY: number
  boxW: number
  boxH: number
  textX: number
  textY: number
  textAnchor: 'start' | 'middle' | 'end'
  text: string
  fontSize: number
  fontWeight?: number
  fill: string
  bgFill: string
  bgOpacity: number
  stroke: string
  strokeOpacity: number
}

export type DesignCanvasLabelLayout = {
  label?: DesignCanvasLabelChip
  meta?: DesignCanvasLabelChip
}

export type DesignCanvasWireframeEdge = {
  id: string
  d: string
  opacity: number
}

export type DesignCanvasWireframePreview =
  | {
      kind: 'media'
      innerX: number
      innerY: number
      innerW: number
      innerH: number
      tag: string
      titleChip: string
      src: string
      isDataImage: boolean
      clipId: string
    }
  | {
      kind: 'text'
      title: string
      titleMaxChars: number
      x: number
      y: number
      fontSize: number
      fontWeight: number
      textAnchor: 'start' | 'middle' | 'end'
      lineH: number
      lines: string[]
      fill?: string
      fontFamily?: string
    }

export type DesignCanvasFrameVisual = {
  fill: string
  stroke: string
  strokeWidth: number
  strokeDasharray?: string
  rx: number
  rectOpacity: number
  strokeOpacity: number
  showDecor: boolean
  filter: string
}
