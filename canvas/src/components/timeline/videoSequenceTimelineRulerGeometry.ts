export const VIDEO_SEQUENCE_RULER_AXIS_EDGE_INSET_PX = 14

export function resolveVideoSequenceRulerInsetLeft(percent: number): string {
  return `calc(${VIDEO_SEQUENCE_RULER_AXIS_EDGE_INSET_PX}px + (100% - ${VIDEO_SEQUENCE_RULER_AXIS_EDGE_INSET_PX * 2}px) * ${percent / 100})`
}

export function resolveVideoSequenceRulerInsetWidth(percent: number): string {
  return `calc((100% - ${VIDEO_SEQUENCE_RULER_AXIS_EDGE_INSET_PX * 2}px) * ${percent / 100})`
}
