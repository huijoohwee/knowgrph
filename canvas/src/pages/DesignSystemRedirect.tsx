import { Navigate, useLocation } from 'react-router-dom'
import { QUERY_PARAM_DESIGN_SYSTEM_PAGE, QUERY_PARAM_OPEN_MAIN_PANEL } from '@/lib/routing/queryParams'
import type { DesignSystemPageId } from '@/hooks/store/designSystemSlice'

const resolvePage = (pathname: string): DesignSystemPageId => {
  if (pathname.endsWith('/tokens')) return 'tokens'
  if (pathname.endsWith('/utilities')) return 'utilities'
  return 'hub'
}

export default function DesignSystemRedirect() {
  const location = useLocation()
  const page = resolvePage(location.pathname)
  const params = new URLSearchParams()
  params.set(QUERY_PARAM_OPEN_MAIN_PANEL, 'designSystem')
  params.set(QUERY_PARAM_DESIGN_SYSTEM_PAGE, page)
  return <Navigate to={`/?${params.toString()}`} replace />
}
