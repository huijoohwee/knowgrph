# Knowgrph Multi-User Collaboration - PRD & TAD

**Document Version**: 1.1.0  
**Date**: 2026-05-29  
**Status**: Accepted and implemented P2P pilot  
**Scope**: MainPanel Collaboration, no-server WebRTC invite/answer sessions, peer roster, presence, document sync, targeted follow mode

---

## Document Purpose

**Context**: Knowgrph now ships a MainPanel Collaboration pilot for no-server peer-to-peer collaboration on the active workspace document. The shipped path uses a two-step invite/answer handshake, WebRTC data channels, owner-hosted multi-peer relay, live document sync, remote caret presence, roster state, and targeted follow mode.

**Intent**: Document the implemented pilot precisely and keep the larger authenticated D1/JWT membership model as a planned extension until source owners and tests exist.

**Directive**: Collaboration behavior must remain source-owned by the existing P2P protocol, store, runtime hook, and MainPanel view. Do not add parallel collaboration panels, downstream patches, hardcoded room fixtures, or compatibility aliases for unimplemented auth plans.

---

## Implemented Baseline

| Capability | Source Owner | Status |
|---|---|---|
| MainPanel Collaboration tab | `canvas/src/features/panels/mainPanelTabs.ts` | Shipped |
| Collaboration UI rows and actions | `canvas/src/features/panels/views/CollaborationView.tsx` | Shipped |
| Invite/answer token protocol | `canvas/src/features/collaboration/p2pCollaborationProtocol.ts` | Shipped |
| Session, peer, follow, and command state | `canvas/src/features/collaboration/p2pCollaborationStore.ts` | Shipped |
| WebRTC runtime and owner relay | `canvas/src/features/collaboration/useP2PCollaborationRuntime.ts` | Shipped |
| Collaboration icon semantics | `canvas/src/features/panels/ui/mainPanelTypeIcons.tsx` | Shipped |
| Runtime and UI regression tests | `canvas/src/__tests__/mainPanelCollaboration.test.tsx` | Shipped |

## Product Contract

### User Story: Start a Host Session

As a workspace owner, I want to start a host session and generate an invite token or URL so another peer can join my active document without a server-side room service.

Acceptance:
- MainPanel exposes a top-level `collaboration` tab.
- The Collaboration view can queue a `start-host` command.
- The runtime creates an invite payload containing protocol version, invite id, session id, owner peer id, host peer id, host display name, document key, offer, and created time.
- The invite is encoded through the shared P2P token helpers and can be carried by `kgCollab`.

### User Story: Join with Invite and Return an Answer

As a guest, I want to paste an invite and generate an answer token so the host can complete the WebRTC connection.

Acceptance:
- The store accepts invite input and queues `join-invite`.
- `parseP2PInviteInput()` validates the invite payload.
- The guest answer payload preserves session, owner, invite, guest, and display-name metadata.
- The answer can be carried by `kgCollabAnswer`.

### User Story: Relay Roster, Presence, and Document Sync

As the host, I want to relay roster, presence, and document updates across connected guests so each peer sees the active collaboration state.

Acceptance:
- Wire messages include `hello`, `presence`, `document-sync`, and `session-roster`.
- The runtime sends document sync messages with a stable document key and text hash.
- The host broadcasts roster updates when guests connect or disconnect.
- Remote peers include ownership, connection state, caret line, and last-seen metadata.

### User Story: Follow a Targeted Remote Peer

As a collaborator, I want follow mode to reveal only the selected live remote peer so collaboration does not cause noisy viewport or caret jumps.

Acceptance:
- The store scopes `followPeerId` to live remote peers.
- Runtime follow reveal is gated by `followModeEnabled` and the selected peer.
- Disconnecting or removing a peer clears stale follow targets.

## Out of Scope for the Implemented Pilot

- Email/password sign-up and sign-in.
- Workspace membership tables and invitation email delivery.
- Permission-gated D1 CRUD routes.
- Durable Objects room servers.
- Multi-document merge/conflict UI.
- Treating D1/JWT auth as shipped.

## Planned Extension Boundary

The larger authenticated collaboration model remains a planned extension. It must be implemented through source-owned Worker/D1 auth, membership, and authorization owners before this document can mark those capabilities as shipped.

| Planned Capability | Required Owner Before Acceptance |
|---|---|
| User auth and JWT validation | storage Worker auth middleware and focused tests |
| Workspace roles | D1 membership schema and role-checking routes |
| Permission-gated push/pull/export | storage Worker route checks |
| Server-backed activity/audit trail | D1 sync-event user attribution |
| Durable multi-peer room service | Durable Object or Worker-backed room owner |

## Success Metrics

| Metric | Evidence |
|---|---|
| Collaboration discoverability | `MAIN_PANEL_TABS` includes `collaboration` |
| Invite/answer fidelity | protocol tests preserve owner/session/peer metadata |
| Runtime relay | tests cover multi-peer roster, presence, and document relay |
| Follow-mode safety | tests prove target is live and cleared on disconnect/remove |
| No auth overclaim | docs guard rejects shipped-language claims for D1/JWT auth |

## Continuation

Technical architecture continues in [knowgrph-multi-user-collaboration-prd.tad.companion.md](knowgrph-multi-user-collaboration-prd.tad.companion.md).

---

## Requirement Traceability Matrix

| Requirement | Source Owner | Validation |
|---|---|---|
| Top-level Collaboration tab | `mainPanelTabs.ts` | `mainPanelCollaboration.test.tsx`, `multiUserCollaborationDocs.test.ts` |
| Invite/answer protocol | `p2pCollaborationProtocol.ts` | `collaboration.protocol.inviteAnswerRoster.preserveOwnerMetadata` |
| Peer/follow state | `p2pCollaborationStore.ts` | `collaboration.store.followTarget.scopedToLiveRemotePeers` |
| UI roster/actions | `CollaborationView.tsx` | `ui.mainPanel.collaboration.*` tests |
| Runtime relay | `useP2PCollaborationRuntime.ts` | `collaboration.runtime.*` tests |

---

## Revision History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-05-08 | joohwee | Initial authenticated D1/JWT collaboration plan |
| 1.1.0 | 2026-05-29 | joohwee | Promoted implemented no-server P2P Collaboration pilot and moved D1/JWT auth to planned extension boundary |
