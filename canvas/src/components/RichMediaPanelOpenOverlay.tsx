import type { RichMediaPanelModel } from './useRichMediaPanelModel'

export function RichMediaPanelOpenOverlay(args: {
  model: RichMediaPanelModel
}) {
  const { model } = args
  if (!model.allowClickToOpenOverlay) return null
  return (
    <a
      href={model.safeOpenUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={model.title}
      style={{
        background: 'transparent',
        cursor: 'pointer',
        display: 'block',
        inset: 0,
        pointerEvents: 'auto',
        position: 'absolute',
        textDecoration: 'none',
        touchAction: 'none',
        zIndex: 2,
      }}
      onPointerDownCapture={event => {
        try {
          event.preventDefault()
        } catch {
          void 0
        }
      }}
      onClick={event => {
        try {
          event.preventDefault()
          event.stopPropagation()
        } catch {
          void 0
        }
        model.openSafeUrl()
      }}
    />
  )
}
