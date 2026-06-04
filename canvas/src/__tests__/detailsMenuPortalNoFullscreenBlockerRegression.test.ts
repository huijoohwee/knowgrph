import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testDetailsMenuPortalDoesNotInstallBlockingFullscreenLayer() {
  const p = resolve(process.cwd(), 'src', 'components', 'ui', 'DetailsMenu.tsx')
  const anchorOverlayPath = resolve(process.cwd(), 'src', 'lib', 'ui', 'overlay.tsx')
  const anchoredPopoverPath = resolve(process.cwd(), 'src', 'components', 'ui', 'AnchoredPopover.tsx')
  const rootHelperPath = resolve(process.cwd(), 'src', 'lib', 'ui', 'overlayPortalRoot.ts')
  const repositionHelperPath = resolve(process.cwd(), 'src', 'lib', 'ui', 'overlayReposition.ts')
  const helperPath = resolve(process.cwd(), 'src', 'lib', 'ui', 'overlayPortalStyle.ts')
  const text = readFileSync(p, 'utf8')
  const anchorOverlayText = readFileSync(anchorOverlayPath, 'utf8')
  const anchoredPopoverText = readFileSync(anchoredPopoverPath, 'utf8')
  const rootHelperText = readFileSync(rootHelperPath, 'utf8')
  const repositionHelperText = readFileSync(repositionHelperPath, 'utf8')
  const helperText = readFileSync(helperPath, 'utf8')
  if (!text.includes('buildNonBlockingPortalLayerStyle(Z_INDEX_MENU)')) {
    throw new Error('expected DetailsMenu portal root to use the shared non-blocking portal layer owner')
  }
  if (!anchorOverlayText.includes('buildNonBlockingPortalLayerStyle(Z_INDEX_ANCHOR_OVERLAY)')) {
    throw new Error('expected AnchorOverlay portal root to use the shared non-blocking portal layer owner')
  }
  if (!anchoredPopoverText.includes('buildNonBlockingPortalLayerStyle(zIndex)')) {
    throw new Error('expected AnchoredPopover portal root to use the shared non-blocking portal layer owner')
  }
  if (!anchorOverlayText.includes('useBodyPortalRoot(open, { createBeforeOpen: true })')) {
    throw new Error('expected AnchorOverlay portal root lifecycle to use the shared body portal root owner')
  }
  if (!anchoredPopoverText.includes('useBodyPortalRoot(props.open)')) {
    throw new Error('expected AnchoredPopover portal root lifecycle to use the shared body portal root owner')
  }
  if (!anchorOverlayText.includes('useOverlayRepositionObservers({ open, rootRef: containerRef, updatePosition })')) {
    throw new Error('expected AnchorOverlay reposition observers to use the shared overlay reposition owner')
  }
  if (!text.includes('useOverlayRepositionObservers({')) {
    throw new Error('expected DetailsMenu reposition observers to use the shared overlay reposition owner')
  }
  if (!text.includes('withInteractivePortalContentStyle(portalStyle)')) {
    throw new Error('expected DetailsMenu portal content to opt into pointer events through the shared portal content owner')
  }
  if ([text, anchorOverlayText, anchoredPopoverText].some(source => source.includes("position: 'fixed', inset: 0"))) {
    throw new Error('expected overlay portal owners not to recreate the fullscreen portal layer style locally')
  }
  if ([anchorOverlayText, anchoredPopoverText].some(source => source.includes('document.body.appendChild') || source.includes("document.createElement('section')"))) {
    throw new Error('expected overlay portal owners not to recreate the body portal root lifecycle locally')
  }
  if (!rootHelperText.includes('createBodyPortalRoot') || !rootHelperText.includes('document.body.appendChild(portalRoot)')) {
    throw new Error('expected shared body portal root owner to create and attach overlay roots')
  }
  if (!repositionHelperText.includes('ResizeObserver') || !repositionHelperText.includes('MutationObserver') || !repositionHelperText.includes('refreshOverlayPositionAfterMount')) {
    throw new Error('expected shared overlay reposition owner to centralize resize, mutation, and mount refresh behavior')
  }
  if ([text, anchorOverlayText].some(source => source.includes('new ResizeObserver') || source.includes('new MutationObserver'))) {
    throw new Error('expected overlay owners not to recreate resize or mutation observers locally')
  }
  if (!helperText.includes("pointerEvents: 'none'") || !helperText.includes("isolation: 'isolate'")) {
    throw new Error('expected shared portal layer style to stay non-blocking and isolated')
  }
}
