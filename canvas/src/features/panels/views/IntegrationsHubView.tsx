import React from 'react'
import SettingsView from '@/features/panels/views/SettingsView'

export default function IntegrationsHubView({
  searchQuery = '',
  onRegisterActions,
}: {
  searchQuery?: string
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
    <SettingsView searchQuery={searchQuery} mode="integrations" onRegisterActions={onRegisterActions} />
  )
}
