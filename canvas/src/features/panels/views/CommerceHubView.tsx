import React from 'react'
import SettingsView from '@/features/panels/views/SettingsView'
import {
  AGENTIC_COMMERCE_API_VERSION,
  AGENTIC_COMMERCE_ROUTE_PATHS,
} from 'grph-shared/payments/agenticCommerceSsot'
import { STRIPE_PAYMENT_ROUTE_PATHS } from 'grph-shared/payments/stripePaymentSsot'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type CommerceHubActions = {
  apply: () => void
  reset: () => void
  globalReset?: () => void
  collapseAll?: () => void
  expandAll?: () => void
  allCollapsed?: boolean
}

const COMMERCE_ROUTE_SECTIONS: Array<{
  title: string
  rows: Array<{ label: string; value: string }>
}> = [
  {
    title: 'Overview',
    rows: [
      { label: 'ACP config', value: `GET ${AGENTIC_COMMERCE_ROUTE_PATHS.acpConfig}` },
      { label: 'API version', value: AGENTIC_COMMERCE_API_VERSION },
    ],
  },
  {
    title: 'Sessions',
    rows: [
      { label: 'Checkout sessions', value: AGENTIC_COMMERCE_ROUTE_PATHS.checkoutSessions },
      { label: 'Stripe webhook', value: STRIPE_PAYMENT_ROUTE_PATHS.webhook },
    ],
  },
  {
    title: 'Web3',
    rows: [
      { label: 'Settle', value: AGENTIC_COMMERCE_ROUTE_PATHS.web3Settle },
      { label: 'Signals', value: 'Base RPC confirmation + EAS attestation' },
    ],
  },
  {
    title: 'Governance',
    rows: [
      { label: 'OpenBOX ingest', value: AGENTIC_COMMERCE_ROUTE_PATHS.openboxIngest },
      { label: 'Risk source', value: 'OpenBOX risk signal' },
    ],
  },
  {
    title: 'Proofs',
    rows: [
      { label: 'Harness proof', value: AGENTIC_COMMERCE_ROUTE_PATHS.commerceProofArtifact },
      { label: 'Trace artifact', value: AGENTIC_COMMERCE_ROUTE_PATHS.commerceTraceArtifact },
    ],
  },
]

const CommerceRouteReadiness = () => (
  <section className="mb-3 min-w-0" aria-label="Commerce readiness">
    <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {COMMERCE_ROUTE_SECTIONS.map(section => (
        <section key={section.title} className={`min-w-0 border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} rounded p-2`}>
          <h3 className={`truncate text-xs font-semibold ${UI_THEME_TOKENS.text.primary}`}>{section.title}</h3>
          <dl className="mt-2 space-y-1">
            {section.rows.map(row => (
              <div key={`${section.title}:${row.label}`} className="grid min-w-0 grid-cols-[minmax(5rem,0.35fr)_minmax(0,1fr)] gap-2">
                <dt className={`truncate text-[11px] ${UI_THEME_TOKENS.text.tertiary}`}>{row.label}</dt>
                <dd className={`min-w-0 truncate text-right font-mono text-[11px] ${UI_THEME_TOKENS.text.secondary}`}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  </section>
)

export default function CommerceHubView({
  searchQuery = '',
  requestedAnchorId,
  requestedAnchorSeq,
  onRegisterActions,
}: {
  searchQuery?: string
  requestedAnchorId?: string
  requestedAnchorSeq?: number
  onRegisterActions?: (a: CommerceHubActions) => void
}) {
  return (
    <>
      <CommerceRouteReadiness />
      <h2 className={`mb-2 truncate text-xs font-semibold ${UI_THEME_TOKENS.text.primary}`}>Payments</h2>
      <SettingsView
        searchQuery={searchQuery}
        requestedAnchorId={requestedAnchorId}
        requestedAnchorSeq={requestedAnchorSeq}
        mode="payments"
        onRegisterActions={onRegisterActions}
      />
    </>
  )
}
