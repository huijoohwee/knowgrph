import React from 'react'

export function useDebouncedValue<T>(value: T, ms: number, resetKey?: unknown) {
  const [v, setV] = React.useState(value)

  const valueRef = React.useRef(value)

  React.useEffect(() => {
    valueRef.current = value
  }, [value])

  React.useEffect(() => {
    if (resetKey === undefined) return
    setV(valueRef.current)
  }, [resetKey])

  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms, resetKey])
  return v
}
