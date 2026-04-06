import { Z_INDEX_ANCHOR_OVERLAY, Z_INDEX_FLOATING_PANEL_DEFAULT, Z_INDEX_TOAST } from '@/lib/ui/zIndex'

export function testAnchorOverlayZIndexIsAboveFloatingPanels() {
  if (Z_INDEX_ANCHOR_OVERLAY <= Z_INDEX_FLOATING_PANEL_DEFAULT) {
    throw new Error('expected anchor overlays (dropdowns) to render above floating panels')
  }
  if (Z_INDEX_ANCHOR_OVERLAY > Z_INDEX_TOAST) {
    throw new Error('expected anchor overlays (dropdowns) to not exceed toast z-index')
  }
}
