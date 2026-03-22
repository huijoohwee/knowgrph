import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { DesignSystemPanel } from '@/features/design-system/DesignSystemPanel'
import type { DesignSystemPageId } from '@/hooks/store/designSystemSlice'
import DesignSystemHub from '@/features/design-system/pages/DesignSystemHub'
import TokensExplorer from '@/features/design-system/pages/TokensExplorer'
import UtilitiesAndPatterns from '@/features/design-system/pages/UtilitiesAndPatterns'

const resolvePage = (page: DesignSystemPageId) => {
  if (page === 'tokens') return <TokensExplorer />
  if (page === 'utilities') return <UtilitiesAndPatterns />
  return <DesignSystemHub />
}

export default function DesignSystemView() {
  const { requestedPage, setRequestedPage } = useGraphStore(
    useShallow(s => ({
      requestedPage: s.designSystemRequestedPage,
      setRequestedPage: s.setDesignSystemRequestedPage,
    })),
  )

  const [activePage, setActivePage] = React.useState<DesignSystemPageId>('hub')

  React.useEffect(() => {
    if (!requestedPage) return
    setActivePage(prev => (prev === requestedPage ? prev : requestedPage))
    setRequestedPage(null)
  }, [requestedPage, setRequestedPage])

  return (
    <DesignSystemPanel activePage={activePage} onNavigate={setActivePage}>
      {resolvePage(activePage)}
    </DesignSystemPanel>
  )
}

