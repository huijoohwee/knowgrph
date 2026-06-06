import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readRepoFile = (repoRelativePath: string): string =>
  readFileSync(resolve(process.cwd(), '..', repoRelativePath), 'utf8')

export function testMultiUserCollaborationDocsUseImplementedP2POwners(): void {
  const docs = [
    'docs/documents/knowgrph-multi-user-collaboration-prd.tad.md',
    'docs/documents/knowgrph-multi-user-collaboration-prd.tad.companion.md',
  ].map(readRepoFile).join('\n')
  const owners = [
    'canvas/src/features/panels/mainPanelTabs.ts',
    'canvas/src/features/panels/views/CollaborationView.tsx',
    'canvas/src/features/collaboration/p2pCollaborationProtocol.ts',
    'canvas/src/features/collaboration/p2pCollaborationStore.ts',
    'canvas/src/features/collaboration/useP2PCollaborationRuntime.ts',
    'canvas/src/components/toolbar/useCanvasToolbarContext.ts',
    'canvas/scripts/verify-multi-user-collaboration-e2e.ts',
    'canvas/package.json',
    'canvas/src/__tests__/mainPanelCollaboration.test.tsx',
    'canvas/src/__tests__/mainPanelCollaboration.protocolStore.test.ts',
    'canvas/src/__tests__/mainPanelCollaboration.view.test.tsx',
    'canvas/src/__tests__/mainPanelCollaboration.runtimeRelay.test.tsx',
    'canvas/src/__tests__/mainPanelCollaboration.runtimeLifecycle.test.tsx',
    'canvas/src/__tests__/mainPanelCollaboration.testkit.tsx',
  ].map(readRepoFile).join('\n')

  const requiredDocTokens = [
    '**Status**: Accepted and implemented P2P pilot',
    'no-server WebRTC invite/answer sessions',
    '`canvas/src/features/panels/views/CollaborationView.tsx` | Shipped',
    '`canvas/src/features/collaboration/p2pCollaborationProtocol.ts` | Shipped',
    '`canvas/src/features/collaboration/p2pCollaborationStore.ts` | Shipped',
    '`canvas/src/features/collaboration/useP2PCollaborationRuntime.ts` | Shipped',
    'The larger authenticated collaboration model remains a planned extension.',
    'Authenticated workspace membership, D1 role checks, server-side audit trails, and Durable Object rooms are not part of the implemented baseline.',
    '`npm --prefix canvas run validate:multi-user-collaboration:e2e`',
  ]
  for (const token of requiredDocTokens) {
    if (!docs.includes(token)) {
      throw new Error(`Expected multi-user collaboration docs to include ${JSON.stringify(token)}`)
    }
  }

  const requiredOwnerTokens = [
    "key: 'collaboration'",
    'useP2PCollaborationStore',
    'P2P_COLLAB_INVITE_SEARCH_PARAM',
    'P2P_COLLAB_ANSWER_SEARCH_PARAM',
    'P2P_COLLAB_PROTOCOL_VERSION',
    'parseP2PCollaborationWireMessage',
    'useP2PCollaborationRuntime',
    "detailTab === 'collaboration'",
    'validate:multi-user-collaboration:e2e',
    'QUERY_PARAM_OPEN_EDITOR_WORKSPACE',
    'verify-multi-user-collaboration-e2e.ts',
    'session-roster',
    'document-sync',
    'testP2PCollaborationRuntimeRelaysRosterPresenceAndDocumentAcrossGuests',
  ]
  for (const token of requiredOwnerTokens) {
    if (!owners.includes(token)) {
      throw new Error(`Expected multi-user collaboration source owner token ${JSON.stringify(token)}`)
    }
  }

  const staleDocTokens = [
    '**Status**: Proposed',
    'Zero authenticated users can collaborate today',
    'Every push/pull request is unauthenticated',
    'No Real-Time Collaboration Awareness',
    'No User Identity',
    'No Access Control',
    'a JWT is issued',
    'D1 Becomes Operational SSOT',
    'viewer role',
    'Worker returns 403 Forbidden',
    '0002_knowgrph_auth.sql',
    'Auth Middleware',
    'workspace_members',
    'users table',
  ]
  for (const token of staleDocTokens) {
    if (docs.includes(token)) {
      throw new Error(`Expected multi-user collaboration docs to remove stale token ${JSON.stringify(token)}`)
    }
  }
}
