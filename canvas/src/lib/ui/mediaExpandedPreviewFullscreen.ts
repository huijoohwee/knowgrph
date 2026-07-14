export function requestMediaExpandedPreviewFullscreen(target: HTMLElement | null): void {
  if (!target) return
  const requestFullscreen = (target as HTMLElement & { requestFullscreen?: () => Promise<void> }).requestFullscreen
  if (typeof requestFullscreen !== 'function') return
  try {
    void Promise.resolve(requestFullscreen.call(target)).catch(() => void 0)
  } catch {
    void 0
  }
}

export function isMediaExpandedPreviewFullscreen(target: HTMLElement | null): boolean {
  return !!target && typeof document !== 'undefined' && document.fullscreenElement === target
}

export function toggleMediaExpandedPreviewFullscreen(target: HTMLElement | null): void {
  if (!target || typeof document === 'undefined') return
  if (!isMediaExpandedPreviewFullscreen(target)) {
    requestMediaExpandedPreviewFullscreen(target)
    return
  }
  const exitFullscreen = document.exitFullscreen
  if (typeof exitFullscreen !== 'function') return
  try {
    void Promise.resolve(exitFullscreen.call(document)).catch(() => void 0)
  } catch {
    void 0
  }
}
