export function hashString32(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0
  }
  return h | 0
}

export function hashStringToIndex(input: string, mod: number): number {
  const n = Math.abs(hashString32(input))
  return mod <= 0 ? 0 : n % mod
}

export function hashStringToHex(input: string): string {
  return Math.abs(hashString32(input)).toString(16)
}
