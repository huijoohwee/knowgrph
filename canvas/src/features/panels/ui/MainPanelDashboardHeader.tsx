import React from 'react'
import MainPanelSectionHeader from '@/features/panels/ui/MainPanelSectionHeader'
import { UI_LABELS } from '@/lib/config'

export default function MainPanelDashboardHeader() {
  return (
    <MainPanelSectionHeader
      title={UI_LABELS.dashboard}
      ariaLabel={UI_LABELS.dashboard}
    />
  )
}
