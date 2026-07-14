function roundSignatureValue(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
}

export function readStoryboardOverlayPortHandleSignature(overlayEl: HTMLElement | null): string {
  if (!overlayEl) return ''
  return Array.from(overlayEl.querySelectorAll<HTMLElement>('[data-kg-port-handle="1"]'))
    .slice(0, 16)
    .map((handle, index) => {
      const rect = handle.getBoundingClientRect()
      return [index, handle.dataset.kgPortHandleKind || '', handle.dataset.kgPortDir || '', handle.dataset.kgPortKey || '', roundSignatureValue(rect.left), roundSignatureValue(rect.top), roundSignatureValue(rect.width), roundSignatureValue(rect.height)].join(':')
    })
    .join(';')
}
