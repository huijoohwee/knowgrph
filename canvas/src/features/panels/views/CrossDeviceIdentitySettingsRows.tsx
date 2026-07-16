import React from 'react'
import { refreshAgenticOsRemoteGrammarCatalog } from '@/features/agentic-os/agenticOsRemoteGrammarClient'
import {
  isKnowgrphRuntimeIdentityFresh,
  serializeKnowgrphRuntimeIdentity,
  useKnowgrphRuntimeIdentity,
  type KnowgrphRuntimeIdentity,
} from '@/features/runtime-identity/knowgrphRuntimeIdentity'
import { useCanvasKeyTypeValueStaticRowProps } from '@/features/panels/ui/canvasKeyTypeValueRuntime'
import { getUiSectionActionClassName } from '@/lib/ui/sectionChipChrome'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { KeyTypeValueStaticRow } from 'grph-shared/react/keyTypeValueRow'

const revisionText = (value: string): string => value || 'unavailable'

export function CrossDeviceIdentitySettingsRowsContent({ identity }: { identity: KnowgrphRuntimeIdentity }) {
  const [copyStatus, setCopyStatus] = React.useState('')
  const staticRowProps = useCanvasKeyTypeValueStaticRowProps('default')
  const fresh = isKnowgrphRuntimeIdentityFresh(identity)
  const serializedIdentity = React.useMemo(() => serializeKnowgrphRuntimeIdentity(identity), [identity])
  const copyIdentity = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(serializedIdentity)
      setCopyStatus('Copied')
    } catch {
      setCopyStatus('Copy unavailable')
    }
  }, [serializedIdentity])
  const revisionValue = (value: string) => <code className="min-w-0 break-all">{revisionText(value)}</code>

  return (
    <>
      <KeyTypeValueStaticRow
        {...staticRowProps}
        keyNode={<span className="font-semibold">Status</span>}
        typeNode={<code>identity/v1</code>}
        valueNode={(
          <span
            className={fresh ? 'text-emerald-400' : 'text-amber-400'}
            data-kg-main-panel-settings-runtime-identity="1"
            data-kg-runtime-identity="knowgrph-runtime-identity/v1"
            data-kg-runtime-identity-surface="main-panel-settings"
            data-kg-runtime-identity-status={fresh ? 'fresh' : identity.catalogHydration.status}
            data-kg-runtime-knowgrph-revision={identity.knowgrphRevision}
            data-kg-runtime-agentic-canvas-os-revision={identity.agenticCanvasOsRevision}
            data-kg-runtime-catalog-revision={identity.catalogRevision}
          >
            {identity.catalogHydration.status} · attempt {identity.catalogHydration.attempts}/2
          </span>
        )}
      />
      <KeyTypeValueStaticRow {...staticRowProps} keyNode="Device" typeNode="runtime" valueNode={<code>{identity.device}</code>} />
      <KeyTypeValueStaticRow {...staticRowProps} keyNode="Branch" typeNode="git" valueNode={revisionValue(identity.branch)} />
      <KeyTypeValueStaticRow {...staticRowProps} keyNode="Knowgrph SHA" typeNode="git SHA" valueNode={revisionValue(identity.knowgrphRevision)} />
      <KeyTypeValueStaticRow {...staticRowProps} keyNode="Docs SHA" typeNode="git SHA" valueNode={revisionValue(identity.agenticCanvasOsRevision)} />
      <KeyTypeValueStaticRow {...staticRowProps} keyNode="Catalog SHA" typeNode="git SHA" valueNode={revisionValue(identity.catalogRevision)} />
      <KeyTypeValueStaticRow
        {...staticRowProps}
        keyNode="Catalog"
        typeNode="/ · # · @"
        valueNode={(
          <code data-kg-runtime-catalog-counts={`${identity.catalogCounts.slash}/${identity.catalogCounts.hash}/${identity.catalogCounts.at}`}>
            / {identity.catalogCounts.slash} · # {identity.catalogCounts.hash} · @ {identity.catalogCounts.at}
          </code>
        )}
      />
      <KeyTypeValueStaticRow
        {...staticRowProps}
        keyNode="Actions"
        typeNode="control"
        valueNode={(
          <section className="flex min-w-0 flex-wrap items-center gap-1">
            <button
              type="button"
              className={getUiSectionActionClassName('primary')}
              disabled={identity.catalogHydration.status === 'loading'}
              onClick={() => void refreshAgenticOsRemoteGrammarCatalog()}
            >
              Refresh identity catalog
            </button>
            <button type="button" className={getUiSectionActionClassName('primary')} onClick={() => void copyIdentity()}>
              Copy identity JSON
            </button>
            {copyStatus ? <output className={UI_THEME_TOKENS.text.tertiary}>{copyStatus}</output> : null}
          </section>
        )}
      />
    </>
  )
}

export function CrossDeviceIdentitySettingsRows() {
  const identity = useKnowgrphRuntimeIdentity()
  return <CrossDeviceIdentitySettingsRowsContent identity={identity} />
}
