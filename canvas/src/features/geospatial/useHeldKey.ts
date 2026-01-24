import React from 'react'

export function useHeldKey(args: { enabled: boolean; code: string }): boolean {
  const [held, setHeld] = React.useState(false)

  React.useEffect(() => {
    if (!args.enabled) {
      setHeld(false)
      return
    }

    const onDown = (e: KeyboardEvent) => {
      if (e.code === args.code) setHeld(true)
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === args.code) setHeld(false)
    }
    const onBlur = () => setHeld(false)

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [args.enabled, args.code])

  return held
}

