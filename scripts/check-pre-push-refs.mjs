import { pathToFileURL } from 'node:url'
import { readContract } from './collaboration-contract.mjs'

export const parsePrePushEntries = input => {
  const entries = []
  for (const line of String(input || '').split('\n')) {
    const fields = line.trim().split(/\s+/)
    if (fields.length !== 4) continue
    entries.push({
      localRef: fields[0],
      localSha: fields[1],
      remoteRef: fields[2],
      remoteSha: fields[3],
    })
  }
  return entries
}

export const findProtectedPushes = (input, protectedRefs) => {
  const protectedSet = new Set(protectedRefs)
  const violations = []
  for (const { remoteRef } of parsePrePushEntries(input)) {
    if (protectedSet.has(remoteRef)) violations.push(remoteRef)
  }
  return [...new Set(violations)].sort()
}

const main = async () => {
  const contract = await readContract()
  let input = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) input += chunk
  const violations = findProtectedPushes(input, contract.coordination.protected_push_refs)
  if (violations.length > 0) {
    throw new Error(`direct pushes to protected refs are forbidden: ${violations.join(', ')}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
