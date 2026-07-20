export async function readBoundedResponseBytes(response, options) {
  const { maximumBytes, resourceName } = options
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new RangeError('maximumBytes must be a positive safe integer.')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error(`${resourceName} response has no readable body.`)
  const chunks = []
  let receivedBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!(value instanceof Uint8Array)) throw new Error(`${resourceName} response returned non-byte data.`)
      receivedBytes += value.byteLength
      if (receivedBytes > maximumBytes) {
        try {
          await reader.cancel('bounded download size exceeded')
        } catch {
          // Preserve the authoritative size rejection if transport cancellation races.
        }
        throw new Error(`${resourceName} exceeds the bounded download size.`)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(receivedBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}
