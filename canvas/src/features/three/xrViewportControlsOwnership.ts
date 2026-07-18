export function xrViewportDragTerminationMatchesPointer(
  event: { readonly pointerId?: unknown },
  activePointerId: number | null,
): boolean {
  return typeof event.pointerId !== 'number' || event.pointerId === activePointerId
}
