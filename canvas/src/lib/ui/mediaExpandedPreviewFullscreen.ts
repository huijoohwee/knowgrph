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
