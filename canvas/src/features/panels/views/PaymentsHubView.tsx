import React from 'react'
import SettingsView from '@/features/panels/views/SettingsView'

export default function PaymentsHubView({
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
    <SettingsView
      searchQuery={searchQuery}
      requestedAnchorId={requestedAnchorId}
      requestedAnchorSeq={requestedAnchorSeq}
      mode="payments"
      onRegisterActions={onRegisterActions}
    />
  )
}

