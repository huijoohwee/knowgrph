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
    const startedAt = Date.now()
    const timeoutMs = (() => {
      const raw = Number(process.env.KG_TEST_CASE_TIMEOUT_MS)
      if (Number.isFinite(raw) && raw > 1_000) return Math.max(5_000, Math.min(10 * 60_000, Math.floor(raw)))
      return 60_000
    })()
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let heartbeatId: ReturnType<typeof setInterval> | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs)
    })
    try {
      heartbeatId = setInterval(() => {
        const elapsedMs = Date.now() - startedAt
        const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000))
        console.log(`RUNNING ${name} (${elapsedSec}s)`)
      }, 15_000)
      await Promise.race([Promise.resolve().then(fn), timeoutPromise])
    } finally {
      if (heartbeatId != null) clearInterval(heartbeatId)
      if (timeoutId != null) clearTimeout(timeoutId)
    }
    const durationMs = Date.now() - startedAt
    console.log(`DONE ${name} (${durationMs}ms)`)
    results.push({ name, ok: true })
  } catch (e: unknown) {
    const msg = (() => {
      const em = e as { message?: unknown }
      return String(em?.message ?? e)
    })()
    console.log(`DONE ${name} (error)`)
    results.push({ name, ok: false, error: msg })
  }
}
