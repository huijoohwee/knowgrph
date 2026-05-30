import React from 'react'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { createStripeHostedCheckoutSessionUrl } from '@/features/payments/stripeCheckout'
import { CHAT_PROVIDER_BYTEPLUS, CHAT_PROVIDER_DEERFLOW } from '@/lib/chatEndpoint'
import { DEERFLOW_API_DOC_AREA } from './deerflowApiDocs'
import type { SettingsRowActions, SettingsRowRefs, SettingsRowStatusState, SettingsRowUi } from './settingsRowTypes'
import { uiToolbarRowScrollClassName } from '@/features/toolbar/ui/toolbarStyles'
import { STRIPE_PAYMENT_SERVER_SECRET_ENV_SUMMARY } from 'grph-shared/payments/stripePaymentSsot'

type SettingsSpecialValueNodeProps = {
  area: string
  inputNode: React.ReactNode
  pillButtonClassName: string
  resolvedValueKey: string
  sKey: string
  statusPillClassName: string
  actions: Pick<
    SettingsRowActions,
    | 'applyActiveWorkspaceFileAsChatHistory'
    | 'applyActiveWorkspaceFileAsKnowgrph'
    | 'checkBytePlusHealth'
    | 'checkBytePlusVideoModelPreview'
    | 'checkChatHealth'
    | 'checkDeerFlowHealth'
    | 'checkGrabMapsHealth'
    | 'createAndSelectChatHistoryFile'
    | 'createAndSelectKnowgrphFile'
    | 'importCloudUrlForChatHistory'
    | 'importCloudUrlForKnowgrph'
    | 'openFilePicker'
    | 'openWorkspaceFile'
    | 'pushUiToast'
    | 'setChatHistoryPathStatus'
    | 'setIsGeneratingStripeCheckout'
    | 'setKnowgrphPathStatus'
    | 'setStripeCheckoutStatus'
    | 'setValues'
  >
  refs: SettingsRowRefs
  status: SettingsRowStatusState
  ui: Pick<SettingsRowUi, 'uiPanelKeyValueTextSizeClass'>
  values: Record<string, string | number | boolean>
}

const specialValueRowClassName = `${uiToolbarRowScrollClassName} gap-1.5`
const specialValueInputShellClassName = 'min-w-[7rem] flex-1 overflow-hidden'
const specialValueStatusShellClassName = 'min-w-0 max-w-full overflow-hidden'

export function shouldRenderSettingsSpecialValueNode({
  area,
  resolvedValueKey,
  sKey,
}: {
  area: string
  resolvedValueKey: string
  sKey: string
}): boolean {
  return (
    sKey === 'chatSystemPrompt'
    || (area === DEERFLOW_API_DOC_AREA && sKey === 'deerflowApi.provider')
    || resolvedValueKey === 'maps.grabmaps.apiKey'
    || sKey === 'stripeApi.auth.secret_key'
    || sKey === 'stripeApi.checkout.session_url'
    || sKey === 'chatHistoryWorkspacePath'
    || sKey === 'chatKnowgrphWorkspacePath'
    || sKey === 'chatHistoryCloudUrl'
    || sKey === 'chatKnowgrphCloudUrl'
  )
}

export function SettingsSpecialValueNode(props: SettingsSpecialValueNodeProps): React.ReactNode | null {
  const {
    actions,
    area,
    inputNode,
    pillButtonClassName,
    refs,
    resolvedValueKey,
    sKey,
    status,
    statusPillClassName,
    ui,
    values,
  } = props

  if (!shouldRenderSettingsSpecialValueNode({ area, resolvedValueKey, sKey })) return null

  if (sKey === 'chatSystemPrompt') {
    return (
      <div className={specialValueRowClassName}>
        <div className={specialValueInputShellClassName}>{inputNode}</div>
        <div className={specialValueStatusShellClassName} title={status.chatHealthDetails || undefined}>
          <StatusBadge
            label="Chat API"
            ok={status.isCheckingHealth ? null : (status.chatHealthOk ?? null)}
            msg={status.isCheckingHealth ? 'Checking...' : status.chatHealthOk === true ? 'Success' : status.chatHealthOk === false ? 'Failed' : 'Idle'}
            details={status.chatHealthDetails || undefined}
          />
        </div>
        {status.normalizedChatProvider !== CHAT_PROVIDER_BYTEPLUS ? (
          <div className={specialValueStatusShellClassName} title={status.bytePlusHealthDetails || undefined}>
            <StatusBadge
              label="BytePlus API"
              ok={status.isCheckingBytePlusHealth ? null : (status.bytePlusHealthOk ?? null)}
              msg={status.isCheckingBytePlusHealth ? 'Checking...' : status.bytePlusHealthOk === true ? 'Success' : status.bytePlusHealthOk === false ? 'Failed' : 'Idle'}
              details={status.bytePlusHealthDetails || undefined}
            />
          </div>
        ) : null}
        {status.normalizedChatProvider === CHAT_PROVIDER_DEERFLOW ? (
          <div className={specialValueStatusShellClassName} title={status.deerFlowHealthDetails || undefined}>
            <StatusBadge
              label="DeerFlow Gateway"
              ok={status.isCheckingDeerFlowHealth ? null : (status.deerFlowHealthOk ?? null)}
              msg={status.isCheckingDeerFlowHealth ? 'Checking...' : status.deerFlowHealthOk === true ? 'Success' : status.deerFlowHealthOk === false ? 'Failed' : 'Idle'}
              details={status.deerFlowHealthDetails || undefined}
            />
          </div>
        ) : null}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            actions.checkChatHealth()
            if (status.normalizedChatProvider !== CHAT_PROVIDER_BYTEPLUS) {
              actions.checkBytePlusHealth()
            }
            if (status.normalizedChatProvider === CHAT_PROVIDER_DEERFLOW) {
              actions.checkDeerFlowHealth()
            }
            actions.checkBytePlusVideoModelPreview()
          }}
          disabled={status.isCheckingHealth || status.isCheckingBytePlusHealth || status.isCheckingDeerFlowHealth || status.isCheckingBytePlusVideoModelPreview}
          className={pillButtonClassName}
        >
          {status.isCheckingHealth || status.isCheckingBytePlusHealth || status.isCheckingDeerFlowHealth || status.isCheckingBytePlusVideoModelPreview ? 'Checking...' : 'Check Health'}
        </button>
      </div>
    )
  }

  if (area === DEERFLOW_API_DOC_AREA && sKey === 'deerflowApi.provider') {
    return (
      <div className={specialValueRowClassName}>
        <div className={specialValueInputShellClassName}>{inputNode}</div>
        <div className={specialValueStatusShellClassName} title={status.deerFlowHealthDetails || undefined}>
          <StatusBadge
            label="DeerFlow Gateway"
            ok={status.isCheckingDeerFlowHealth ? null : (status.deerFlowHealthOk ?? null)}
            msg={status.isCheckingDeerFlowHealth ? 'Checking...' : status.deerFlowHealthOk === true ? 'Success' : status.deerFlowHealthOk === false ? 'Failed' : 'Idle'}
            details={status.deerFlowHealthDetails || undefined}
          />
        </div>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            actions.checkDeerFlowHealth()
          }}
          disabled={status.isCheckingDeerFlowHealth}
          className={pillButtonClassName}
        >
          {status.isCheckingDeerFlowHealth ? 'Checking...' : 'Check Health'}
        </button>
      </div>
    )
  }

  if (resolvedValueKey === 'maps.grabmaps.apiKey') {
    return (
      <div className={specialValueRowClassName}>
        <div className={specialValueInputShellClassName}>{inputNode}</div>
        <div className={specialValueStatusShellClassName} title={status.grabMapsHealthDetails || undefined}>
          <StatusBadge
            label="GrabMaps API"
            ok={status.isCheckingGrabMapsHealth ? null : (status.grabMapsHealthOk ?? null)}
            msg={status.isCheckingGrabMapsHealth ? 'Checking...' : status.grabMapsHealthOk === true ? 'Success' : status.grabMapsHealthOk === false ? 'Failed' : 'Idle'}
            details={status.grabMapsHealthDetails || undefined}
          />
        </div>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            void actions.checkGrabMapsHealth()
          }}
          disabled={status.isCheckingGrabMapsHealth}
          className={pillButtonClassName}
        >
          {status.isCheckingGrabMapsHealth ? 'Checking...' : 'Check Health'}
        </button>
      </div>
    )
  }

  if (sKey === 'stripeApi.auth.secret_key' || sKey === 'stripeApi.webhooks.signing_secret') {
    const secretLabel = sKey === 'stripeApi.auth.secret_key' ? 'Stripe secret keys' : 'Stripe webhook signing secrets'
    const envLabel = sKey === 'stripeApi.auth.secret_key' ? STRIPE_PAYMENT_SERVER_SECRET_ENV_SUMMARY : 'STRIPE_WEBHOOK_SECRET'
    return (
      <div className={specialValueRowClassName}>
        <div className={specialValueInputShellClassName}>
          <input
            value=""
            readOnly
            placeholder="Server-managed only"
            className={`w-full rounded-md border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary} px-2 py-1.5 ${ui.uiPanelKeyValueTextSizeClass}`}
            title="Server-managed only"
          />
          <div className={`mt-1 min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap ${ui.uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
            {secretLabel} are not stored in the browser. Use `{envLabel}` on the server.
          </div>
        </div>
        <span className={statusPillClassName} title="Secret stays server-side.">
          server-managed
        </span>
      </div>
    )
  }

  if (sKey === 'stripeApi.checkout.session_url') {
    const checkoutUrlValue = String(values[resolvedValueKey] ?? '').trim()
    return (
      <div className={specialValueRowClassName}>
        <div className={specialValueInputShellClassName}>
          <input
            value={checkoutUrlValue}
            readOnly
            placeholder="Server-managed Checkout Session url"
            className={`w-full rounded-md border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary} px-2 py-1.5 ${ui.uiPanelKeyValueTextSizeClass}`}
            title={checkoutUrlValue || 'Server-managed Checkout Session url'}
          />
          {status.stripeCheckoutStatus ? (
            <div className={`mt-1 min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap ${ui.uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>{status.stripeCheckoutStatus}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={async e => {
            e.stopPropagation()
            if (status.isGeneratingStripeCheckout) return
            actions.setStripeCheckoutStatus(null)
            actions.setIsGeneratingStripeCheckout(true)
            try {
              const origin = typeof window !== 'undefined' ? window.location.origin : ''
              const basePath = typeof window !== 'undefined' ? window.location.pathname : '/'
              const successUrl = `${origin}${basePath}?stripeCheckout=success&session_id={CHECKOUT_SESSION_ID}`
              const cancelUrl = `${origin}${basePath}?stripeCheckout=cancel`
              const created = await createStripeHostedCheckoutSessionUrl({ successUrl, cancelUrl })
              refs.dirtyRef.current.add(resolvedValueKey)
              actions.setValues(prev => ({ ...prev, [resolvedValueKey]: created.url }))
              actions.setStripeCheckoutStatus('Generated secure Checkout Session URL. Click Apply to persist.')
              actions.pushUiToast({
                id: `stripe-checkout-generated-${created.id}`,
                kind: 'neutral',
                message: 'Generated secure Stripe Checkout Session URL. Click Apply to persist.',
                ttlMs: 2600,
              })
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Failed to generate Stripe Checkout Session.'
              actions.setStripeCheckoutStatus(msg)
              actions.pushUiToast({
                id: 'stripe-checkout-generate-failed',
                kind: 'error',
                message: msg,
                ttlMs: 3200,
              })
            } finally {
              actions.setIsGeneratingStripeCheckout(false)
            }
          }}
          disabled={status.isGeneratingStripeCheckout}
          className={pillButtonClassName}
          title="Create a server-managed Checkout Session and fill the returned Session url."
        >
          {status.isGeneratingStripeCheckout ? 'Generating...' : 'Generate (secure)'}
        </button>
        <span className={statusPillClassName} title="Secret key stays server-side; browser only receives the returned Session url.">
          server-managed
        </span>
      </div>
    )
  }

  if (sKey === 'chatHistoryWorkspacePath') {
    const currentPath = typeof values.chatHistoryWorkspacePath === 'string' ? values.chatHistoryWorkspacePath.trim() : ''
    return (
      <div className={specialValueRowClassName}>
        <div className={specialValueInputShellClassName}>
          {inputNode}
          {status.chatHistoryPathStatus && (
            <div className={`mt-1 min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap ${ui.uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>{status.chatHistoryPathStatus}</div>
          )}
        </div>
        <button type="button" onClick={e => { e.stopPropagation(); actions.openFilePicker(refs.localImportInputRef.current) }} className={pillButtonClassName}>Import Files</button>
        <button type="button" onClick={e => { e.stopPropagation(); actions.openFilePicker(refs.localFolderImportInputRef.current) }} className={pillButtonClassName}>Import Folder</button>
        <button type="button" onClick={e => { e.stopPropagation(); actions.applyActiveWorkspaceFileAsChatHistory() }} className={pillButtonClassName}>Use Active</button>
        <button type="button" onClick={e => { e.stopPropagation(); void actions.createAndSelectChatHistoryFile() }} disabled={status.isUpdatingChatHistoryPath} className={pillButtonClassName}>{status.isUpdatingChatHistoryPath ? 'Creating...' : 'New File'}</button>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            if (!currentPath) {
              actions.setChatHistoryPathStatus('Chat history path is not set.')
              return
            }
            actions.openWorkspaceFile(currentPath)
          }}
          disabled={!currentPath}
          className={pillButtonClassName}
        >
          Open
        </button>
      </div>
    )
  }

  if (sKey === 'chatKnowgrphWorkspacePath') {
    const currentPath = typeof values.chatKnowgrphWorkspacePath === 'string' ? values.chatKnowgrphWorkspacePath.trim() : ''
    return (
      <div className={specialValueRowClassName}>
        <div className={specialValueInputShellClassName}>
          {inputNode}
          {status.knowgrphPathStatus && (
            <div className={`mt-1 min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap ${ui.uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>{status.knowgrphPathStatus}</div>
          )}
        </div>
        <button type="button" onClick={e => { e.stopPropagation(); actions.openFilePicker(refs.kgcLocalImportInputRef.current) }} className={pillButtonClassName}>Import Files</button>
        <button type="button" onClick={e => { e.stopPropagation(); actions.openFilePicker(refs.kgcLocalFolderImportInputRef.current) }} className={pillButtonClassName}>Import Folder</button>
        <button type="button" onClick={e => { e.stopPropagation(); actions.applyActiveWorkspaceFileAsKnowgrph() }} className={pillButtonClassName}>Use Active</button>
        <button type="button" onClick={e => { e.stopPropagation(); void actions.createAndSelectKnowgrphFile() }} disabled={status.isUpdatingKnowgrphPath} className={pillButtonClassName}>{status.isUpdatingKnowgrphPath ? 'Creating...' : 'New File'}</button>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            if (!currentPath) {
              actions.setKnowgrphPathStatus('chatKnowgrph path is not set.')
              return
            }
            actions.openWorkspaceFile(currentPath)
          }}
          disabled={!currentPath}
          className={pillButtonClassName}
        >
          Open
        </button>
      </div>
    )
  }

  if (sKey === 'chatHistoryCloudUrl') {
    return (
      <div className={specialValueRowClassName}>
        <div className={specialValueInputShellClassName}>{inputNode}</div>
        <button type="button" onClick={e => { e.stopPropagation(); actions.importCloudUrlForChatHistory() }} className={pillButtonClassName}>Import URL</button>
      </div>
    )
  }

  if (sKey === 'chatKnowgrphCloudUrl') {
    return (
      <div className={specialValueRowClassName}>
        <div className={specialValueInputShellClassName}>{inputNode}</div>
        <button type="button" onClick={e => { e.stopPropagation(); actions.importCloudUrlForKnowgrph() }} className={pillButtonClassName}>Import URL</button>
      </div>
    )
  }

  return null
}
