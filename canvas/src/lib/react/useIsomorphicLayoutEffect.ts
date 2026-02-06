import React from 'react'

export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' && typeof document !== 'undefined' && typeof document.createElement === 'function'
    ? React.useLayoutEffect
    : React.useEffect

