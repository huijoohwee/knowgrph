export function createUniqueId(prefix: string, used: Set<string>): string {
  let index = 1
  let id = `${prefix}${index}`
  while (used.has(id)) {
    index += 1
    id = `${prefix}${index}`
  }
  return id
}

