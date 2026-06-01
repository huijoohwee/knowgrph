import React from 'react'
import { debounce } from '@/lib/async/debounce'

export function useDebouncedValue<T>(value: T, ms: number, resetKey?: unknown) {
  const [v, setV] = React.useState(value)
  const valueRef = React.useRef(v)
  const resetKeyRef = React.useRef(resetKey)

  const debouncedSetV = React.useMemo(
    () => debounce((val: T) => {
      if (Object.is(valueRef.current, val)) return
      valueRef.current = val
      setV(val)
    }, ms),
    [ms]
  )
  React.useEffect(() => {
    valueRef.current = v
  }, [v])

  React.useEffect(() => {
    debouncedSetV(value)
    return () => debouncedSetV.cancel()
  }, [value, debouncedSetV])

  React.useEffect(() => {
    if (resetKey === undefined) return
    if (Object.is(resetKeyRef.current, resetKey)) return
    resetKeyRef.current = resetKey
    debouncedSetV.cancel()
    if (Object.is(valueRef.current, value)) return
    debouncedSetV(value)
  }, [resetKey, value, debouncedSetV])

  return v
}
