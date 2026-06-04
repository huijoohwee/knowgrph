import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import PreviewOverlay from '@/features/panels/views/preview-panel/ui/PreviewOverlay'
import {
  buildStripeCheckoutReturnUrls,
  createStripeHostedCheckoutSessionUrl,
  redirectToStripeHostedCheckoutUrl,
} from '@/features/payments/stripeCheckout'
import {
  UI_RESPONSIVE_WIDE_DIALOG_MESSAGE_CLASSNAME,
  UI_RESPONSIVE_WIDE_DIALOG_PANEL_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'

export function PaywallOverlay(props: { portalTarget: HTMLElement | null }) {
  const [checkoutBusy, setCheckoutBusy] = React.useState(false)
  const mountedRef = React.useRef(true)
  const paywallEnabled = useGraphStore(s => s.paymentsStripePaywallEnabled === true)
  const floatingPanelOpen = useGraphStore(s => s.floatingPanelOpen === true)
  const floatingPanelView = useGraphStore(s => s.floatingPanelView)
  const setPaywallEnabled = useGraphStore(s => s.setPaymentsStripePaywallEnabled)
  const setCheckoutUrl = useGraphStore(s => s.setPaymentsStripeCheckoutUrl)
  const pushUiToast = useGraphStore(s => s.pushUiToast)
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelMicroLabelTextSizeClass = useGraphStore(s => s.uiPanelMicroLabelTextSizeClass || 'text-xs')

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  if (!paywallEnabled) return null
  if (!floatingPanelOpen) return null
  if (floatingPanelView !== 'chat') return null

  const checkoutUrlHint =
    'Open Checkout creates a server-managed Checkout Session through the payment Worker, then redirects this browser window to the hosted Stripe Checkout URL.'
  const redirectToCheckoutUrl = (url: string) => {
    try {
      redirectToStripeHostedCheckoutUrl(url)
    } catch (error) {
      pushUiToast({
        id: 'stripe-checkout-redirect-failed',
        kind: 'error',
        message: error instanceof Error ? error.message : 'Stripe Checkout redirect failed.',
        ttlMs: 10_000,
      })
    }
  }
  const handleOpenCheckout = async () => {
    if (checkoutBusy) return
    setCheckoutBusy(true)
    setCheckoutUrl('')
    try {
      const returnUrls = buildStripeCheckoutReturnUrls()
      const session = await createStripeHostedCheckoutSessionUrl(returnUrls)
      setCheckoutUrl(session.url)
      pushUiToast({
        id: 'stripe-checkout-session-created',
        kind: 'success',
        message: 'Stripe Checkout Session created. Redirecting to hosted Checkout.',
      })
      redirectToCheckoutUrl(session.url)
    } catch (error) {
      pushUiToast({
        id: 'stripe-checkout-session-create-failed',
        kind: 'error',
        message: error instanceof Error ? error.message : 'Stripe Checkout Session creation failed.',
        ttlMs: 10_000,
      })
    } finally {
      if (mountedRef.current) setCheckoutBusy(false)
    }
  }

  return (
    <PreviewOverlay
      open={paywallEnabled}
      onClose={() => setPaywallEnabled(false)}
      scope="container"
      portalTarget={props.portalTarget}
      overlayClassName="bg-black/60"
      panelClassName={`${UI_RESPONSIVE_WIDE_DIALOG_PANEL_CLASSNAME} bg-[color:var(--kg-panel-bg)] border ${UI_THEME_TOKENS.panel.border}`}
    >
      <section className={`h-full flex flex-col ${uiPanelTextFontClass}`} aria-label="Paywall">
        <header
          className={`flex items-center justify-between gap-3 px-3 py-2 border-b ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`}
        >
          <section className="min-w-0">
            <section className={`text-sm font-semibold ${UI_THEME_TOKENS.text.primary}`}>Paywall</section>
            <section className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
              Stripe Checkout gates Chat UI features.
            </section>
          </section>
          <section className="flex items-center gap-2">
            <button
              type="button"
              className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
              onClick={handleOpenCheckout}
              disabled={checkoutBusy}
              title={checkoutUrlHint}
            >
              {checkoutBusy ? 'Generating...' : 'Open Checkout'}
            </button>
            <button
              type="button"
              className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
              onClick={() => setPaywallEnabled(false)}
            >
              Close
            </button>
          </section>
        </header>
        <section className="flex-1 min-h-0 flex flex-col">
          <section className={`px-3 py-2 border-b ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.text.secondary} ${uiPanelMicroLabelTextSizeClass}`}>
            {checkoutBusy ? 'Creating a hosted Checkout Session.' : checkoutUrlHint}
          </section>
          <section className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
            <section className={`${UI_RESPONSIVE_WIDE_DIALOG_MESSAGE_CLASSNAME} p-4 text-center ${UI_THEME_TOKENS.text.secondary} ${uiPanelMicroLabelTextSizeClass}`}>
              Stripe Checkout is generated fresh by the payment Worker and opened in this browser window.
            </section>
          </section>
        </section>
      </section>
    </PreviewOverlay>
  )
}
