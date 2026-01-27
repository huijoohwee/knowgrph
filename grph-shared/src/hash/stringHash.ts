const fnv1a32 = (input: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function hashString32(input: string): number {
  return fnv1a32(String(input ?? ''))
}

export function hashStringToHex(input: string): string {
  return hashString32(input).toString(16).padStart(8, '0')
}

export function hashStringToIndex(input: string, modulo: number): number {
  const m = Math.max(1, Math.floor(modulo))
  return hashString32(input) % m
}
