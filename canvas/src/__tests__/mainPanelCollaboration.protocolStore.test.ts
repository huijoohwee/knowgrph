import {
  encodeP2PAnswerPayload,
  encodeP2PInvitePayload,
  parseP2PCollaborationWireMessage,
  parseP2PAnswerInput,
  parseP2PInviteInput,
  P2P_COLLAB_PROTOCOL_VERSION,
  type P2PCollaborationWireMessage,
} from '@/features/collaboration/p2pCollaborationProtocol'
import { useP2PCollaborationStore } from '@/features/collaboration/p2pCollaborationStore'
import { makePeer, resetCollaborationStore } from './mainPanelCollaboration.testkit'

export async function testP2PCollaborationProtocolPreservesOwnerInviteAndRosterMetadata() {
  const inviteToken = encodeP2PInvitePayload({
    v: P2P_COLLAB_PROTOCOL_VERSION,
    kind: 'invite',
    inviteId: 'invite-01',
    sessionId: 'session-01',
    ownerPeerId: 'owner-01',
    hostPeerId: 'owner-01',
    hostDisplayName: 'Session Owner',
    documentKey: '/docs/roadmap.md',
    offer: { type: 'offer', sdp: 'offer-sdp' },
    createdAt: 111,
  })
  const invitePayload = parseP2PInviteInput(inviteToken)
  if (invitePayload.inviteId !== 'invite-01') throw new Error('expected invite id to round-trip')
  if (invitePayload.ownerPeerId !== 'owner-01') throw new Error('expected owner peer id to round-trip')
  if (invitePayload.documentKey !== '/docs/roadmap.md') throw new Error('expected invite document key to round-trip')

  const answerToken = encodeP2PAnswerPayload({
    v: P2P_COLLAB_PROTOCOL_VERSION,
    kind: 'answer',
    inviteId: 'invite-01',
    sessionId: 'session-01',
    ownerPeerId: 'owner-01',
    guestPeerId: 'guest-02',
    guestDisplayName: 'Guest Two',
    answer: { type: 'answer', sdp: 'answer-sdp' },
    createdAt: 222,
  })
  const answerPayload = parseP2PAnswerInput(answerToken)
  if (answerPayload.inviteId !== 'invite-01') throw new Error('expected answer invite id to round-trip')
  if (answerPayload.ownerPeerId !== 'owner-01') throw new Error('expected answer owner id to round-trip')
  if (answerPayload.guestPeerId !== 'guest-02') throw new Error('expected guest peer id to round-trip')

  const rosterMessage: P2PCollaborationWireMessage = {
    v: P2P_COLLAB_PROTOCOL_VERSION,
    kind: 'session-roster',
    sessionId: 'session-01',
    ownerPeerId: 'owner-01',
    peers: [
      {
        peerId: 'owner-01',
        displayName: 'Session Owner',
        documentKey: '/docs/roadmap.md',
        caretLine: 4,
        connectedAt: 100,
        lastSeenAt: 120,
        ownership: 'owner',
      },
      {
        peerId: 'guest-02',
        displayName: 'Guest Two',
        documentKey: '/docs/roadmap.md',
        caretLine: 8,
        connectedAt: 110,
        lastSeenAt: 130,
        ownership: 'guest',
      },
    ],
    sentAt: 333,
  }
  const parsedRoster = parseP2PCollaborationWireMessage(JSON.stringify(rosterMessage))
  if (!parsedRoster || parsedRoster.kind !== 'session-roster') {
    throw new Error('expected session roster wire message to parse')
  }
  if (parsedRoster.ownerPeerId !== 'owner-01') throw new Error('expected roster owner to round-trip')
  if (parsedRoster.peers.length !== 2) throw new Error('expected roster peers to round-trip')
  if (parsedRoster.peers[0]?.ownership !== 'owner') throw new Error('expected owner snapshot to round-trip')
  if (parsedRoster.peers[1]?.ownership !== 'guest') throw new Error('expected guest snapshot to round-trip')
}

export async function testP2PCollaborationStoreScopesFollowTargetToLiveRemotePeers() {
  resetCollaborationStore()
  const store = useP2PCollaborationStore.getState()
  store.setSessionState({
    role: 'host',
    phase: 'connected',
    sessionId: 'session-keep',
    localPeerId: 'owner-01',
    ownerPeerId: 'owner-01',
    statusText: 'Connected peers: 2',
  })
  store.replacePeers([
    makePeer({ peerId: 'owner-01', displayName: 'Owner Local', ownership: 'owner', isLocal: true }),
    makePeer({ peerId: 'guest-a', displayName: 'Guest A', ownership: 'guest' }),
    makePeer({ peerId: 'guest-b', displayName: 'Guest B', ownership: 'guest' }),
  ])
  store.setFollowPeerId('guest-a')
  if (useP2PCollaborationStore.getState().followPeerId !== 'guest-a') {
    throw new Error('expected follow target to accept a live remote peer')
  }

  store.removePeer('guest-a')
  if (useP2PCollaborationStore.getState().followPeerId !== null) {
    throw new Error('expected follow target to clear when the tracked peer leaves')
  }

  store.setFollowPeerId('owner-01')
  if (useP2PCollaborationStore.getState().followPeerId !== null) {
    throw new Error('expected follow target to reject the local peer')
  }

  store.replacePeers([
    makePeer({ peerId: 'owner-01', displayName: 'Owner Local', ownership: 'owner', isLocal: true }),
    makePeer({ peerId: 'guest-b', displayName: 'Guest B', ownership: 'guest' }),
  ])
  store.setFollowPeerId('guest-b')
  if (useP2PCollaborationStore.getState().followPeerId !== 'guest-b') {
    throw new Error('expected follow target to move to the surviving remote peer')
  }

  resetCollaborationStore()
}
