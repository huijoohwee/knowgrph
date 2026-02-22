import React from 'react'
import { debounce } from '@/lib/async/debounce'

export function useDebouncedValue<T>(value: T, ms: number, resetKey?: unknown) {
  const [v, setV] = React.useState(value)

  const debouncedSetV = React.useMemo(
    () => debounce((val: T) => setV(val), ms),
    [ms]
  )

  React.useEffect(() => {
    debouncedSetV(value)
    return () => debouncedSetV.cancel()
  }, [value, debouncedSetV])

  React.useEffect(() => {
    if (resetKey === undefined) return
    debouncedSetV.cancel()
    setV(value)
  }, [resetKey, value, debouncedSetV])

  return v
}
