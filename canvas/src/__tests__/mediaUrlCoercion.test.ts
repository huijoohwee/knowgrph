import { coerceMediaUrl } from '@/lib/url'

export const testCoerceMediaUrlAcceptsSafeRelative = () => {
  const cases = ['assets/x.png', './assets/x.png', '../assets/x.png', 'images/x.svg', 'video/x.mp4']
  for (const raw of cases) {
    const out = coerceMediaUrl(raw)
    if (out !== raw) throw new Error(`expected coerceMediaUrl to accept relative url: ${raw}`)
  }
}

export const testCoerceMediaUrlRejectsExplicitScheme = () => {
  const cases = ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hi', 'mailto:test@example.com']
  for (const raw of cases) {
    const out = coerceMediaUrl(raw)
    if (out != null) throw new Error(`expected coerceMediaUrl to reject scheme url: ${raw}`)
  }
}

