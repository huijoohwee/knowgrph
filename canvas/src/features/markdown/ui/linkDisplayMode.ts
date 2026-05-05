const store = new Map<number, 'snapshot' | 'card'>()

export function getLinkDisplayMode(startLine: number): 'snapshot' | 'card' {
  return store.get(startLine) || 'snapshot'
}

export function setLinkDisplayMode(startLine: number, mode: 'snapshot' | 'card'): void {
  store.set(startLine, mode)
}

export function isLinkDisplayModeCard(startLine: number): boolean {
  return getLinkDisplayMode(startLine) === 'card'
}
