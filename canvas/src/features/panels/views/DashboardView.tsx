import React from 'react'
import MainPanelBody from '@/features/panels/ui/MainPanelBody'
import MainPanelDashboardHeader from '@/features/panels/ui/MainPanelDashboardHeader'
import BottomPanelStatsTab from '@/components/BottomPanel/BottomPanelStatsTab'
import { UI_LABELS } from '@/lib/config'

export default function DashboardView() {
  return (
    <MainPanelBody header={<MainPanelDashboardHeader />} scrollable={false}>
      <section className="h-full min-h-0 overflow-hidden" aria-label={UI_LABELS.dashboard}>
        <BottomPanelStatsTab />
      </section>
    </MainPanelBody>
  )
}

