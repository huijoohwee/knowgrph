export type TestResult = { name: string; ok: boolean; error?: string }

export const execTest = async (
  results: TestResult[],
  name: string,
  fn: () => void | Promise<void>,
) => {
  const filter = process.argv.slice(2).find(arg => !arg.startsWith('-'))
  if (filter && !name.toLowerCase().includes(filter.toLowerCase())) return
  try {
    console.log(`RUN ${name}`)
    const timeoutMs = 120_000
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs)
    })
    try {
      await Promise.race([Promise.resolve().then(fn), timeoutPromise])
    } finally {
      if (timeoutId != null) clearTimeout(timeoutId)
    }
    results.push({ name, ok: true })
  } catch (e: unknown) {
    const msg = (() => {
      const em = e as { message?: unknown }
      return String(em?.message ?? e)
    })()
    results.push({ name, ok: false, error: msg })
  }
}
