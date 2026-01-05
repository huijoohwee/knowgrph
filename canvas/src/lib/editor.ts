export function findNearestIdBeforePos(text: string, pos: number) {
  const head = text.slice(0, pos)
  const m = head.match(/"id"\s*:\s*"([^"]+)"\s*$/)
  return m ? m[1] : null
}

export function findObjectBoundsById(text: string, id: string) {
  const pat = `"id": "${id}`
  const idx = text.indexOf(pat)
  if (idx < 0) return null
  let start = idx
  while (start > 0 && text[start] !== '{') start--
  if (text[start] !== '{') return null
  let depth = 0
  let i = start
  for (; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) break
    }
  }
  return { start, end: i + 1 }
}

export function findEnclosingBlockBounds(text: string, pos: number) {
  let start = pos
  while (start > 0 && text[start] !== '{') start--
  if (text[start] !== '{') return null
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return { start, end: i + 1 }
    }
  }
  return null
}

export function findIdInBlock(text: string, start: number, end: number) {
  const sub = text.slice(start, end)
  const m = sub.match(/"id"\s*:\s*"([^"]+)"/)
  return m ? m[1] : null
}

export function countLinesUpTo(text: string, idx: number) {
  const s = text.slice(0, idx)
  const m = s.match(/\n/g)
  return m ? m.length : 0
}

export function smoothScrollTextareaToCenter(el: HTMLTextAreaElement, line: number) {
  const lh = parseFloat(getComputedStyle(el).lineHeight || '16')
  const target = Math.max(0, line * lh - el.clientHeight / 2)
  const from = el.scrollTop
  const to = target
  const duration = 220
  const start = performance.now()
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / duration)
    const v = from + (to - from) * ease(p)
    el.scrollTop = v
    if (p < 1) requestAnimationFrame(step)
  }
  if (Math.abs(to - from) > 0.5) requestAnimationFrame(step)
}

export function centerBlock(el: HTMLTextAreaElement, text: string, start: number, _end: number) {
  void _end
  const startLine = countLinesUpTo(text, start)
  const lh = parseFloat(getComputedStyle(el).lineHeight || '16')
  const marginLines = 0
  const target = Math.max(0, startLine * lh - marginLines * lh)
  const from = el.scrollTop
  const to = target
  const duration = 220
  const startTs = performance.now()
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  const step = (now: number) => {
    const p = Math.min(1, (now - startTs) / duration)
    const v = from + (to - from) * ease(p)
    el.scrollTop = v
    if (p < 1) requestAnimationFrame(step)
  }
  if (Math.abs(to - from) > 0.5) requestAnimationFrame(step)
}
