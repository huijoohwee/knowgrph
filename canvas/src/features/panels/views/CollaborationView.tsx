import React from 'react'
import { Users, Link2, ArrowRightLeft, LocateFixed, Radio, Copy, PlugZap, Plug, UserX } from 'lucide-react'
import { useGraphStore } from '@/hooks/useGraphStore'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import {
  KeyTypeValueRow,
  RightAlignedTooltipInput,
  RightAlignedValueCell,
} from '@/features/panels/ui/KeyTypeValueRow'
import ExpandCollapseAllButton from '@/features/panels/ui/ExpandCollapseAllButton'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { getIconSizeClass } from '@/lib/ui'
import { uiToolbarToggleActiveClassName } from '@/features/toolbar/ui/toolbarStyles'
import { useP2PCollaborationStore } from '@/features/collaboration/p2pCollaborationStore'

type SectionId = 'session' | 'invite' | 'answer' | 'peer'

type CollaborationViewProps = {
  searchQuery: string
  requestedAnchorId?: string
  requestedAnchorSeq?: number
  onRegisterActions?: (a: {
    collapseAll?: () => void
    expandAll?: () => void
    allCollapsed?: boolean
  }) => void
}

const SECTION_ORDER: SectionId[] = ['session', 'invite', 'answer', 'peer']

function buildCollapsedState(next: boolean): Record<SectionId, boolean> {
  return {
    session: next,
    invite: next,
    answer: next,
    peer: next,
  }
}

export default function CollaborationView({ searchQuery, onRegisterActions }: CollaborationViewProps) {
  const pushUiToast = useGraphStore(s => s.pushUiToast)
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const displayName = useP2PCollaborationStore(s => s.displayName)
  const role = useP2PCollaborationStore(s => s.role)
  const phase = useP2PCollaborationStore(s => s.phase)
  const statusText = useP2PCollaborationStore(s => s.statusText)
  const errorText = useP2PCollaborationStore(s => s.errorText)
  const sessionId = useP2PCollaborationStore(s => s.sessionId)
  const localPeerId = useP2PCollaborationStore(s => s.localPeerId)
  const ownerPeerId = useP2PCollaborationStore(s => s.ownerPeerId)
  const inviteInput = useP2PCollaborationStore(s => s.inviteInput)
  const inviteToken = useP2PCollaborationStore(s => s.inviteToken)
  const inviteUrl = useP2PCollaborationStore(s => s.inviteUrl)
  const answerInput = useP2PCollaborationStore(s => s.answerInput)
  const answerToken = useP2PCollaborationStore(s => s.answerToken)
  const followModeEnabled = useP2PCollaborationStore(s => s.followModeEnabled)
  const followPeerId = useP2PCollaborationStore(s => s.followPeerId)
  const localCaretLine = useP2PCollaborationStore(s => s.localCaretLine)
  const peers = useP2PCollaborationStore(s => s.peers)
  const setDisplayName = useP2PCollaborationStore(s => s.setDisplayName)
  const setInviteInput = useP2PCollaborationStore(s => s.setInviteInput)
  const setAnswerInput = useP2PCollaborationStore(s => s.setAnswerInput)
  const setFollowModeEnabled = useP2PCollaborationStore(s => s.setFollowModeEnabled)
  const setFollowPeerId = useP2PCollaborationStore(s => s.setFollowPeerId)
  const queueStartHost = useP2PCollaborationStore(s => s.queueStartHost)
  const queueJoinInvite = useP2PCollaborationStore(s => s.queueJoinInvite)
  const queueApplyAnswer = useP2PCollaborationStore(s => s.queueApplyAnswer)
  const queueDisconnect = useP2PCollaborationStore(s => s.queueDisconnect)
  const queueRemovePeer = useP2PCollaborationStore(s => s.queueRemovePeer)
  const [collapsedBySection, setCollapsedBySection] = React.useState<Record<SectionId, boolean>>(() => buildCollapsedState(false))

  const normalizedQuery = React.useMemo(() => String(searchQuery || '').trim().toLowerCase(), [searchQuery])
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const allCollapsed = React.useMemo(
    () => SECTION_ORDER.every(sectionId => collapsedBySection[sectionId]),
    [collapsedBySection],
  )
  const remotePeers = React.useMemo(() => peers.filter(peer => !peer.isLocal), [peers])
  const connectedRemotePeers = React.useMemo(
    () => remotePeers.filter(peer => peer.connectionState === 'connected'),
    [remotePeers],
  )
  const isOwner = Boolean(localPeerId && ownerPeerId && localPeerId === ownerPeerId)
  const hostActionLabel = role === 'host' ? 'Generate Invite' : 'Start Host'
  const collapseAll = React.useCallback(() => {
    setCollapsedBySection(buildCollapsedState(true))
  }, [])
  const expandAll = React.useCallback(() => {
    setCollapsedBySection(buildCollapsedState(false))
  }, [])
  const registeredActions = React.useMemo(() => ({
    collapseAll,
    expandAll,
    allCollapsed,
  }), [allCollapsed, collapseAll, expandAll])

  React.useEffect(() => {
    if (!followModeEnabled) return
    if (followPeerId) return
    if (connectedRemotePeers.length !== 1) return
    setFollowPeerId(connectedRemotePeers[0]?.peerId || null)
  }, [connectedRemotePeers, followModeEnabled, followPeerId, setFollowPeerId])

  React.useEffect(() => {
    onRegisterActions?.(registeredActions)
  }, [onRegisterActions, registeredActions])

  const toggleSection = React.useCallback((sectionId: SectionId) => {
    setCollapsedBySection(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }, [])

  const matchesQuery = React.useCallback((...parts: Array<string | number | null | undefined>) => {
    if (!normalizedQuery) return true
    return parts.some(part => String(part || '').toLowerCase().includes(normalizedQuery))
  }, [normalizedQuery])

  const copyText = React.useCallback(async (value: string, successMessage: string) => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable')
      }
      await navigator.clipboard.writeText(value)
      pushUiToast({ id: successMessage, kind: 'success', message: successMessage, ttlMs: 2200, dismissible: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Clipboard write failed'
      pushUiToast({ id: `${successMessage}:error`, kind: 'error', message, ttlMs: 3200, dismissible: true })
    }
  }, [pushUiToast])

  const buttonClassName = `App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
  const activeButtonClassName = `App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`
  const rowValueClassName = 'flex flex-wrap items-center justify-start gap-1 sm:justify-end'
  const noteClassName = `text-xs ${UI_THEME_TOKENS.text.secondary}`
  const statusPillClassName = `inline-flex min-h-6 items-center rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`
  const secondaryPillClassName = `${statusPillClassName} ${UI_THEME_TOKENS.text.secondary}`

  const renderHeader = (
    <header className={`sticky top-0 z-20 border-b ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.panel.border}`}>
      <div className="relative">
        <KeyTypeValueRow
          keyNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Key</span>}
          typeNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Type</span>}
          valueNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Value</span>}
          density="compact"
          className="h-9 py-0"
        />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
          <ExpandCollapseAllButton
            allCollapsed={allCollapsed}
            onExpandAll={expandAll}
            onCollapseAll={collapseAll}
            titleExpand="Expand"
            titleCollapse="Collapse (Default)"
          />
        </div>
      </div>
    </header>
  )

  const sessionRows = [
    matchesQuery('Display name', displayName, 'peer') && (
      <KeyTypeValueRow
        key="session-display-name"
        keyNode="Display Name"
        typeNode={<Users className={iconSizeClass} aria-hidden />}
        valueNode={(
          <RightAlignedTooltipInput
            tooltip="Name shown to the remote peer."
            value={displayName}
            onChange={event => setDisplayName(event.currentTarget.value)}
            placeholder="Peer"
          />
        )}
      />
    ),
    matchesQuery('Session', sessionId, role, phase) && (
      <KeyTypeValueRow
        key="session-state"
        keyNode="Session"
        typeNode={<Radio className={iconSizeClass} aria-hidden />}
        valueNode={(
          <RightAlignedValueCell>
            <div className={rowValueClassName}>
              <span className={statusPillClassName}>
                {role === 'idle' ? 'Idle' : `${role} · ${phase}`}
              </span>
              {ownerPeerId ? (
                <span className={secondaryPillClassName}>
                  owner {ownerPeerId.slice(0, 8)}
                </span>
              ) : null}
              {localPeerId ? (
                <span className={secondaryPillClassName}>
                  you {localPeerId.slice(0, 8)}
                </span>
              ) : null}
              {sessionId ? (
                <span className={secondaryPillClassName}>
                  {sessionId.slice(0, 12)}
                </span>
              ) : null}
            </div>
          </RightAlignedValueCell>
        )}
      />
    ),
    matchesQuery('Peers', peers.length, connectedRemotePeers.length, ownerPeerId) && (
      <KeyTypeValueRow
        key="session-peer-count"
        keyNode="Peer Count"
        typeNode={<Users className={iconSizeClass} aria-hidden />}
        valueNode={(
          <RightAlignedValueCell>
            <div className={rowValueClassName}>
              <span className={statusPillClassName}>
                total {peers.length}
              </span>
              <span className={secondaryPillClassName}>
                remote {remotePeers.length}
              </span>
              <span className={secondaryPillClassName}>
                connected {connectedRemotePeers.length}
              </span>
            </div>
          </RightAlignedValueCell>
        )}
      />
    ),
    matchesQuery('Runtime status', statusText, errorText) && (
      <KeyTypeValueRow
        key="session-status"
        keyNode="Runtime Status"
        typeNode={<PlugZap className={iconSizeClass} aria-hidden />}
        valueNode={(
          <RightAlignedValueCell>
            <span className={errorText ? UI_THEME_TOKENS.status.error : noteClassName}>
              {errorText || statusText}
            </span>
          </RightAlignedValueCell>
        )}
      />
    ),
    matchesQuery('Follow mode', followModeEnabled ? 'on' : 'off', localCaretLine) && (
      <KeyTypeValueRow
        key="session-follow-mode"
        keyNode="Follow Mode"
        typeNode={<LocateFixed className={iconSizeClass} aria-hidden />}
        valueNode={(
          <RightAlignedValueCell>
            <div className={rowValueClassName}>
              <button
                type="button"
                className={followModeEnabled ? activeButtonClassName : buttonClassName}
                onClick={() => setFollowModeEnabled(true)}
              >
                On
              </button>
              <button
                type="button"
                className={!followModeEnabled ? activeButtonClassName : buttonClassName}
                onClick={() => setFollowModeEnabled(false)}
              >
                Off
              </button>
              <span className={noteClassName}>
                {followPeerId ? `Target ${followPeerId.slice(0, 8)}` : 'Select a peer below'}
              </span>
              <span className={noteClassName}>
                {localCaretLine == null ? 'Local cursor idle' : `Local line ${localCaretLine}`}
              </span>
            </div>
          </RightAlignedValueCell>
        )}
      />
    ),
    matchesQuery('Host or disconnect', 'start host', 'disconnect') && (
      <KeyTypeValueRow
        key="session-actions"
        keyNode="Host Session"
        typeNode={<ArrowRightLeft className={iconSizeClass} aria-hidden />}
        valueNode={(
          <RightAlignedValueCell>
            <div className={rowValueClassName}>
              <button
                type="button"
                className={activeButtonClassName}
                onClick={() => queueStartHost()}
              >
                {hostActionLabel}
              </button>
              <button
                type="button"
                className={buttonClassName}
                onClick={() => queueDisconnect()}
              >
                Disconnect
              </button>
            </div>
          </RightAlignedValueCell>
        )}
      />
    ),
  ].filter(Boolean)

  const inviteRows = [
    matchesQuery('Invite link', inviteUrl, inviteToken) && (
      <KeyTypeValueRow
        key="invite-link"
        keyNode="Invite Link"
        typeNode={<Link2 className={iconSizeClass} aria-hidden />}
        valueNode={(
          <RightAlignedValueCell>
            <div className="flex w-full min-w-0 flex-wrap items-center gap-1 sm:justify-end">
              <RightAlignedTooltipInput
                tooltip="Share this invite URL with one guest. Generate another invite for each additional peer."
                value={inviteUrl}
                readOnly
                placeholder="Host generates one invite per guest."
                containerClassName="min-w-[14rem] flex-1"
              />
              <button
                type="button"
                className={buttonClassName}
                disabled={!inviteUrl}
                onClick={() => {
                  if (!inviteUrl) return
                  void copyText(inviteUrl, 'Collaboration invite copied')
                }}
              >
                <Copy className={iconSizeClass} aria-hidden />
                Copy
              </button>
            </div>
          </RightAlignedValueCell>
        )}
      />
    ),
    matchesQuery('Join invite', inviteInput, 'guest') && (
      <KeyTypeValueRow
        key="invite-join"
        keyNode="Join Invite"
        typeNode={<ArrowRightLeft className={iconSizeClass} aria-hidden />}
        valueNode={(
          <RightAlignedValueCell>
            <div className="flex w-full min-w-0 flex-wrap items-center gap-1 sm:justify-end">
              <RightAlignedTooltipInput
                tooltip="Paste the host invite URL or raw invite token."
                value={inviteInput}
                onChange={event => setInviteInput(event.currentTarget.value)}
                placeholder="Paste invite link or token"
                containerClassName="min-w-[14rem] flex-1"
              />
              <button
                type="button"
                className={activeButtonClassName}
                onClick={() => queueJoinInvite()}
              >
                Join
              </button>
            </div>
          </RightAlignedValueCell>
        )}
      />
    ),
  ].filter(Boolean)

  const answerRows = [
    matchesQuery('Guest answer', answerToken, 'copy answer') && (
      <KeyTypeValueRow
        key="answer-token"
        keyNode="Guest Answer"
        typeNode={<Copy className={iconSizeClass} aria-hidden />}
        valueNode={(
          <RightAlignedValueCell>
            <div className="flex w-full min-w-0 flex-wrap items-center gap-1 sm:justify-end">
              <RightAlignedTooltipInput
                tooltip="Guest sends this answer token back to the host."
                value={answerToken}
                readOnly
                placeholder="Join an invite to generate the answer token."
                containerClassName="min-w-[14rem] flex-1"
              />
              <button
                type="button"
                className={buttonClassName}
                disabled={!answerToken}
                onClick={() => {
                  if (!answerToken) return
                  void copyText(answerToken, 'Collaboration answer copied')
                }}
              >
                <Copy className={iconSizeClass} aria-hidden />
                Copy
              </button>
            </div>
          </RightAlignedValueCell>
        )}
      />
    ),
    matchesQuery('Apply answer', answerInput, 'host') && (
      <KeyTypeValueRow
        key="answer-apply"
        keyNode="Apply Answer"
        typeNode={<PlugZap className={iconSizeClass} aria-hidden />}
        valueNode={(
          <RightAlignedValueCell>
            <div className="flex w-full min-w-0 flex-wrap items-center gap-1 sm:justify-end">
              <RightAlignedTooltipInput
                tooltip="Host pastes the guest answer token to finish the WebRTC handshake."
                value={answerInput}
                onChange={event => setAnswerInput(event.currentTarget.value)}
                placeholder="Paste answer token"
                containerClassName="min-w-[14rem] flex-1"
              />
              <button
                type="button"
                className={activeButtonClassName}
                onClick={() => queueApplyAnswer()}
              >
                Connect
              </button>
            </div>
          </RightAlignedValueCell>
        )}
      />
    ),
  ].filter(Boolean)

  const peerRows = [
    ...peers
      .filter(peer => matchesQuery(peer.displayName, peer.documentKey, peer.ownership, peer.connectionState, peer.peerId))
      .map(peer => (
        <KeyTypeValueRow
          key={`peer-roster-${peer.peerId}`}
          keyNode={peer.displayName}
          typeNode={<Users className={iconSizeClass} aria-hidden />}
          valueNode={(
            <RightAlignedValueCell>
              <div className={rowValueClassName}>
                <span className={statusPillClassName}>
                  {peer.isLocal ? 'You' : peer.ownership === 'owner' ? 'Owner' : 'Guest'}
                </span>
                <span className={secondaryPillClassName}>
                  {peer.connectionState}
                </span>
                {peer.documentKey ? (
                  <span className={secondaryPillClassName}>
                    {peer.documentKey}
                  </span>
                ) : null}
                <span className={noteClassName}>
                  {peer.caretLine == null ? 'Cursor idle' : `Line ${peer.caretLine}`}
                </span>
                {!peer.isLocal ? (
                  <>
                    <button
                      type="button"
                      className={followModeEnabled && followPeerId === peer.peerId ? activeButtonClassName : buttonClassName}
                      onClick={() => {
                        setFollowModeEnabled(true)
                        setFollowPeerId(peer.peerId)
                      }}
                    >
                      Follow
                    </button>
                    <button
                      type="button"
                      className={!followModeEnabled || followPeerId !== peer.peerId ? buttonClassName : activeButtonClassName}
                      onClick={() => {
                        if (followPeerId === peer.peerId) {
                          setFollowPeerId(null)
                        }
                      }}
                    >
                      Unfollow
                    </button>
                    {isOwner && peer.ownership !== 'owner' ? (
                      <button
                        type="button"
                        className={buttonClassName}
                        onClick={() => queueRemovePeer(peer.peerId)}
                      >
                        <UserX className={iconSizeClass} aria-hidden />
                        Remove
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </RightAlignedValueCell>
          )}
        />
      )),
    matchesQuery('Transport', phase, statusText) && (
      <KeyTypeValueRow
        key="peer-transport"
        keyNode="Transport"
        typeNode={phase === 'connected' ? <PlugZap className={iconSizeClass} aria-hidden /> : <Plug className={iconSizeClass} aria-hidden />}
        valueNode={(
          <RightAlignedValueCell>
            <span className={noteClassName}>
              {role === 'host'
                ? (phase === 'connected' ? 'Owner relays presence and document sync across guests.' : 'Awaiting connected guests or a new invite answer.')
                : (phase === 'connected' ? 'Connected to the owner relay channel.' : 'Awaiting owner channel.')}
            </span>
          </RightAlignedValueCell>
        )}
      />
    ),
  ].filter(Boolean)

  const sectionDescriptors = ([
    { id: 'session', title: 'Session', rows: sessionRows },
    { id: 'invite', title: 'Invite', rows: inviteRows },
    { id: 'answer', title: 'Answer', rows: answerRows },
    { id: 'peer', title: 'Peers', rows: peerRows },
  ] satisfies Array<{ id: SectionId; title: string; rows: React.ReactNode[] }>).filter(
    section => section.rows.length > 0 || !normalizedQuery,
  )

  return (
    <article className="min-h-full flex flex-col space-y-0">
      {renderHeader}
      <section className="space-y-2 py-2">
        {sectionDescriptors.map(section => (
          <CollapsibleSection
            key={section.id}
            title={section.title}
            collapsed={normalizedQuery ? false : collapsedBySection[section.id]}
            onToggle={() => toggleSection(section.id)}
          >
            <div className="space-y-0.5">
              {section.rows}
            </div>
          </CollapsibleSection>
        ))}
        {!sectionDescriptors.length ? (
          <p className={`px-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
            No collaboration rows match the current search query.
          </p>
        ) : null}
      </section>
    </article>
  )
}
