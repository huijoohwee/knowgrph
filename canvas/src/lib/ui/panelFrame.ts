export type CssStyle = Record<string, string | number | undefined>

export const PANEL_FRAME_ROOT_STYLE: CssStyle = {
  boxSizing: 'border-box',
  overflow: 'hidden',
  contain: 'layout paint',
  isolation: 'isolate',
  borderRadius: 'var(--kg-media-panel-radius, 10px)',
  border: 'var(--kg-media-panel-border-w, 1px) solid var(--kg-border)',
  background: 'var(--kg-media-panel-bg, var(--kg-panel-bg, rgba(255,255,255,0.92)))',
  boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  willChange: 'left, top, transform, width, height',
  display: 'flex',
  flexDirection: 'column',
}

export const PANEL_FRAME_HEADER_STYLE: CssStyle = {
  height: 'var(--kg-media-panel-header-h, 28px)',
  minHeight: 'var(--kg-media-panel-header-h, 28px)',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  paddingLeft: 'var(--kg-media-panel-padding, 6px)',
  paddingRight: 'var(--kg-media-panel-padding, 6px)',
  background: 'var(--kg-media-panel-header-bg, var(--kg-media-panel-bg, var(--kg-panel-bg, rgba(255,255,255,0.96))))',
  color: 'var(--kg-text-primary, var(--kg-text))',
  fontSize: 'var(--kg-media-panel-title-size, 12px)',
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  pointerEvents: 'auto',
}

export const PANEL_FRAME_BODY_STYLE: CssStyle = {
  flex: 1,
  padding: 'var(--kg-media-panel-padding, 6px)',
  boxSizing: 'border-box',
  minHeight: 0,
  position: 'relative',
}

