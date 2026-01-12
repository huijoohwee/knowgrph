export type TestResult = { name: string; ok: boolean; error?: string }

export const execTest = async (
  results: TestResult[],
  name: string,
  fn: () => void | Promise<void>,
) => {
  try {
    await fn()
    results.push({ name, ok: true })
  } catch (e: unknown) {
    const msg = (() => {
      const em = e as { message?: unknown }
      return String(em?.message ?? e)
    })()
    results.push({ name, ok: false, error: msg })
  }
}
