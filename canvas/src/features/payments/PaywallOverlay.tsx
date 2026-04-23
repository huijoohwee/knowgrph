import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import PreviewOverlay from '@/features/panels/views/preview-panel/ui/PreviewOverlay'

export function PaywallOverlay(props: { portalTarget: HTMLElement | null }) {
  const paywallEnabled = useGraphStore(s => s.paymentsStripePaywallEnabled === true)
  const floatingPanelOpen = useGraphStore(s => s.floatingPanelOpen === true)
  const floatingPanelView = useGraphStore(s => s.floatingPanelView)
  const setPaywallEnabled = useGraphStore(s => s.setPaymentsStripePaywallEnabled)
  const checkoutUrl = useGraphStore(s => String(s.paymentsStripeCheckoutUrl || '').trim())
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelMicroLabelTextSizeClass = useGraphStore(s => s.uiPanelMicroLabelTextSizeClass || 'text-xs')

  if (!paywallEnabled) return null
  if (!floatingPanelOpen) return null
  if (floatingPanelView !== 'chat') return null

  const canLaunchCheckout = checkoutUrl.length > 0
  const checkoutUrlHint =
    'In MainPanel → Payments → Stripe Payment API: use “Generate (secure)” to create a server-managed Checkout Session and fill stripeApi.checkout.session_url, then click Apply. Stripe returns the Session `url` for active hosted Checkout Sessions, and it can use checkout.stripe.com or your custom domain.'
  const handleOpenCheckout = () => {
    if (!canLaunchCheckout) return
    try {
      window.open(checkoutUrl, '_blank', 'noopener,noreferrer')
    } catch {
      void 0
    }
  }

  return (
    <PreviewOverlay
      open={paywallEnabled}
      onClose={() => setPaywallEnabled(false)}
      scope="container"
      portalTarget={props.portalTarget}
      overlayClassName="bg-black/60"
      panelClassName={`w-[min(1100px,95vw)] h-[min(760px,95vh)] bg-[color:var(--kg-panel-bg)] border ${UI_THEME_TOKENS.panel.border}`}
    >
      <section className={`h-full flex flex-col ${uiPanelTextFontClass}`} aria-label="Paywall">
        <header
          className={`flex items-center justify-between gap-3 px-3 py-2 border-b ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`}
        >
          <div className="min-w-0">
            <div className={`text-sm font-semibold ${UI_THEME_TOKENS.text.primary}`}>Paywall</div>
            <div className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
              Stripe Checkout gates Chat UI features.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
              onClick={handleOpenCheckout}
              disabled={!canLaunchCheckout}
              title={canLaunchCheckout ? 'Open Stripe Checkout' : checkoutUrlHint}
            >
              Open Checkout
            </button>
            <button
              type="button"
              className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
              onClick={() => setPaywallEnabled(false)}
            >
              Close
            </button>
          </div>
        </header>
        <div className="flex-1 min-h-0 flex flex-col">
          <div className={`px-3 py-2 border-b ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.text.secondary} ${uiPanelMicroLabelTextSizeClass}`}>
            {canLaunchCheckout ? `Checkout URL: ${checkoutUrl}` : checkoutUrlHint}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
            <div className={`max-w-[46rem] p-4 text-center ${UI_THEME_TOKENS.text.secondary} ${uiPanelMicroLabelTextSizeClass}`}>
              {canLaunchCheckout
                ? 'Stripe Checkout is a hosted payment page. Use “Open Checkout” to launch the Checkout Session url in a new tab.'
                : 'Stripe Checkout requires the Session `url` returned by Stripe for an active hosted Checkout Session to open the hosted page.'}
            </div>
          </div>
        </div>
      </section>
    </PreviewOverlay>
  )
}
