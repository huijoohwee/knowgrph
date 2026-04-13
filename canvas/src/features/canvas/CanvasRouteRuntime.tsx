import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { normalizeSingleRootRoute } from '@/lib/routing/normalizeSingleRoot'

export function CanvasRouteRuntime() {
  const location = useLocation()
  const navigate = useNavigate()

  React.useEffect(() => {
    const normalized = normalizeSingleRootRoute({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    })
    if (!normalized) return
    navigate(
      {
        pathname: normalized.pathname,
        search: normalized.search,
        hash: normalized.hash,
      },
      { replace: true },
    )
  }, [location.hash, location.pathname, location.search, navigate])

  return null
}
