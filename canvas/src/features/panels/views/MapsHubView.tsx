import React from 'react'
import SettingsView from '@/features/panels/views/SettingsView'
import SiteSelectionWidget from '@/features/maps/SiteSelectionWidget'

export default function MapsHubView({
  searchQuery = '',
  requestedAnchorId,
  requestedAnchorSeq,
  onRegisterActions,
}: {
  searchQuery?: string
  requestedAnchorId?: string
  requestedAnchorSeq?: number
  onRegisterActions?: (a: {
    apply: () => void
    reset: () => void
    globalReset?: () => void
    collapseAll?: () => void
    expandAll?: () => void
    allCollapsed?: boolean
  }) => void
}) {
  return (
    <div className="flex flex-col min-h-full">
      <SiteSelectionWidget />
      <SettingsView
        searchQuery={searchQuery}
        requestedAnchorId={requestedAnchorId}
        requestedAnchorSeq={requestedAnchorSeq}
        mode="maps"
        onRegisterActions={onRegisterActions}
      />
    </div>
  )
}

