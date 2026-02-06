let lockCount = 0
let restoreStyles: null | {
  userSelect: string
  webkitUserSelect: string
  msUserSelect: string
} = null

const preventDefaultCapture = (e: Event) => {
  try {
    e.preventDefault()
  } catch {
    void 0
  }
}

export function lockGlobalUserSelect(): void {
  if (typeof document === 'undefined') return
  lockCount += 1
  if (lockCount !== 1) return
  const el = document.documentElement
  const style = el.style as CSSStyleDeclaration & { webkitUserSelect?: string; msUserSelect?: string }
  restoreStyles = {
    userSelect: style.userSelect || '',
    webkitUserSelect: style.webkitUserSelect || '',
    msUserSelect: style.msUserSelect || '',
  }
  style.userSelect = 'none'
  style.webkitUserSelect = 'none'
  style.msUserSelect = 'none'
  document.addEventListener('selectstart', preventDefaultCapture, true)
  document.addEventListener('dragstart', preventDefaultCapture, true)
}

export function unlockGlobalUserSelect(): void {
  if (typeof document === 'undefined') return
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount !== 0) return
  const el = document.documentElement
  const style = el.style as CSSStyleDeclaration & { webkitUserSelect?: string; msUserSelect?: string }
  if (restoreStyles) {
    style.userSelect = restoreStyles.userSelect
    style.webkitUserSelect = restoreStyles.webkitUserSelect
    style.msUserSelect = restoreStyles.msUserSelect
  }
  restoreStyles = null
  document.removeEventListener('selectstart', preventDefaultCapture, true)
  document.removeEventListener('dragstart', preventDefaultCapture, true)
}
