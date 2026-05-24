# Knowgrph Multi-User Collaboration - PRD & TAD

**Document Version**: 1.0.0
**Date**: 2026-05-08
**Status**: Proposed
**Scope**: Authentication, authorization, real-time multi-user CRUD collaboration on workspaces, documents, graph snapshots

**Implementation Note (2026-05-20)**: Dev now ships a separate `MainPanel Collaboration` pilot for pure no-server WebRTC P2P on the active workspace document using a 2-step invite/answer handshake, host-owned multi-peer relay, explicit peer roster and ownership badges, live document sync, remote caret presence, and targeted follow mode. This pilot does not replace the larger authenticated multi-user D1/Worker plan defined below.

---

## Document Purpose

**Context**: Knowgrph requires multi-user identity, workspace membership, and permission-gated CRUD collaboration on top of the existing Cloudflare D1 + Worker sync infrastructure.
**Intent**: Enable multiple authenticated users to read, edit, and co-author workspace documents and graph snapshots with role-based access control and conflict-aware sync.
**Directive**: This document defines product requirements and architecture contracts; PRD states WHAT/WHY, TAD states HOW; implementation details remain in code tasks.

---

## Companion Files

| File | Scope |
|---|---|
| `knowgrph-storage-sync-document.md` | Storage ladder, Worker push/pull/export, conflict resolution, client sync |
| `knowgrph-storage-schemas-document.md` | D1 SQL schema, browser-local cache shapes, contract types, route contracts |
| `knowgrph-database.md` | Legacy RxDB-to-PostgreSQL migration path (historical/deferred) |
| `knowgrph-backend-document.md` | Vite dev/preview middleware |
| `knowgrph-integrations-ssot-sync-directives.md` | Cross-repo publish topology and sync directives |

---

# PART I: PRODUCT REQUIREMENTS DOCUMENTATION (PRD)

## Problem Statement

### Current User Pain Points

**Problem 1: No User Identity**
The storage sync system has no concept of who is editing. Every mutation is scoped to `workspace_id` + `device_id` with no user attribution, making audit trails impossible.

**Problem 2: No Access Control**
Any device that knows a `workspace_id` can push/pull all documents. There is no mechanism to restrict read or write access per user.

**Problem 3: No Real-Time Collaboration Awareness**
Users cannot see who else is viewing or editing the same workspace. Concurrent edits produce silent conflicts with no presence signals.

**Problem 4: SSOT Ambiguity for Multi-User**
The canonical authoring source is a local filesystem (`huijoohwee/docs/`), which is inaccessible to remote collaborators. Multi-user authoring requires D1 to become the operational SSOT.

### Quantified Impact

- Zero authenticated users can collaborate today; the system is single-device anonymous.
- Every push/pull request is unauthenticated; any network observer with a workspace ID can read or mutate data.
- Concurrent edits from two devices on the same document produce revision conflicts with no user context for resolution.
- Remote collaborators cannot access workspace content without the filesystem seed pipeline.

---

## Personas

### Persona 1: Workspace Owner
**Role**: Creator who invites collaborators to a shared workspace
**Goal**: Control who can view and edit workspace documents
**Pain Point**: Cannot share a workspace without exposing full write access to everyone

### Persona 2: Editor
**Role**: Collaborator who co-authors documents and graph snapshots
**Goal**: Edit documents in real-time with other collaborators, see who else is active
**Pain Point**: No awareness of other editors; conflicts discovered only after push rejection

### Persona 3: Viewer
**Role**: Stakeholder who needs read-only access to workspace state
**Goal**: View documents and graph snapshots without risk of accidental edits
**Pain Point**: Cannot access workspace without full write permissions

---

## Epic PRD-E001: Authentication

### Story PRD-E001-S001: Sign In with Email and Password
**As a** workspace user
**I want** to sign in with email and password
**So that** my identity is established and my mutations are attributed to me

**Acceptance Criteria**:
- **Given** the sign-in screen
- **When** user submits valid email and password
- **Then** a JWT is issued and stored client-side
- **And** subsequent push/pull requests include the JWT in the Authorization header

### Story PRD-E001-S002: Sign Up and Workspace Creation
**As a** new user
**I want** to sign up and create a workspace
**So that** I become the owner of a new collaborative workspace

**Acceptance Criteria**:
- **Given** the sign-up screen
- **When** user submits email, password, and display name
- **Then** a user record is created in D1 and a default workspace is created with the user as owner
- **And** the user is redirected to the new workspace

---

## Epic PRD-E002: Authorization

### Story PRD-E002-S001: Role-Based Workspace Access
**As a** workspace owner
**I want** to assign roles (owner, editor, viewer) to members
**So that** collaborators have appropriate read/write permissions

**Acceptance Criteria**:
- **Given** workspace member management
- **When** owner assigns a role to a member
- **Then** the member's push/pull permissions reflect the role
- **And** viewers cannot push mutations; editors can push documents and chunks; owners can manage members

### Story PRD-E002-S002: Permission Enforcement on Push
**As a** workspace member
**I want** the system to enforce my role on every mutation
**So that** unauthorized writes are rejected before reaching D1

**Acceptance Criteria**:
- **Given** an authenticated user with viewer role
- **When** user attempts to push a document mutation
- **Then** the Worker returns 403 Forbidden
- **And** the client displays a permission denied notification

### Story PRD-E002-S003: Invite Members via Email
**As a** workspace owner
**I want** to invite collaborators by email address
**So that** new members can join the workspace without manual provisioning

**Acceptance Criteria**:
- **Given** the workspace member management UI
- **When** owner enters an email and selects a role
- **Then** an invitation record is created
- **And** the invited user sees the workspace in their dashboard after sign-in

---

## Epic PRD-E003: Multi-User Sync

### Story PRD-E003-S001: User-Attributed Mutations
**As a** workspace editor
**I want** my mutations to carry my user identity
**So that** the workspace audit trail shows who changed what

**Acceptance Criteria**:
- **Given** an authenticated editor pushes a document mutation
- **When** the Worker processes the mutation
- **Then** the `sync_events` record includes the authenticated `user_id`
- **And** the document revision history is queryable by user

### Story PRD-E003-S002: Cross-Device State Parity
**As a** user with multiple devices
**I want** my workspace state to be identical across all my devices
**So that** I can switch devices without losing work

**Acceptance Criteria**:
- **Given** user is signed in on two devices
- **When** user edits a document on device A
- **Then** device B receives the mutation on next pull cycle
- **And** both devices show identical document content and revision

### Story PRD-E003-S003: Conflict Resolution with User Context
**As a** workspace editor
**I want** conflict notifications to show who made the conflicting change
**So that** I can coordinate with the other editor

**Acceptance Criteria**:
- **Given** two editors push conflicting revisions to the same document
- **When** the second push is rejected with a conflict
- **Then** the conflict notification includes the other editor's display name and the conflicting revision timestamp
- **And** the user can choose Keep Local, Accept Remote, or Review Log

---

## Epic PRD-E004: SSOT Transition

### Story PRD-E004-S001: D1 Becomes Operational SSOT
**As a** workspace owner
**I want** D1 to be the authoritative data source for all workspace content
**So that** remote collaborators can access and edit without the filesystem seed pipeline

**Acceptance Criteria**:
- **Given** a workspace with members
- **When** any member creates or edits a document
- **Then** the document is persisted to D1 as the canonical version
- **And** the filesystem seed becomes a bootstrap-only source for initial workspace creation

### Story PRD-E004-S002: Optional Filesystem Export
**As a** workspace owner
**I want** to export workspace documents to the local filesystem
**So that** I can maintain a git-backed backup of workspace content

**Acceptance Criteria**:
- **Given** a workspace with documents in D1
- **When** owner triggers a filesystem export
- **Then** all documents are written to a configured local directory as markdown files
- **And** the export is idempotent and does not overwrite newer local changes

---

## Success Metrics

| Metric | Baseline | Target | Timeline | Measurement Method |
|--------|----------|--------|----------|--------------------|
| Authenticated collaboration sessions | 0 | >=2 concurrent users per workspace | Release +4 weeks | D1 sync_events query |
| Push permission enforcement | 0% (no auth) | 100% of push requests authenticated and role-checked | Release +2 weeks | Worker logs |
| Cross-device state parity | 0% (no sync) | 100% document parity within 30s | Release +2 weeks | Integration test |
| Conflict resolution with user context | No user attribution | 100% conflicts show editor identity | Release +4 weeks | Conflict UX tests |
| Unauthorized push rejection rate | N/A | 100% viewer pushes rejected with 403 | Release +2 weeks | Auth middleware tests |

---

## MoSCoW Prioritization

### Must Have
- [PRD-E001-S001] Sign in with email and password (JWT)
- [PRD-E001-S002] Sign up and workspace creation
- [PRD-E002-S001] Role-based workspace access (owner, editor, viewer)
- [PRD-E002-S002] Permission enforcement on push
- [PRD-E003-S001] User-attributed mutations
- [PRD-E003-S002] Cross-device state parity
- [PRD-E004-S001] D1 becomes operational SSOT

### Should Have
- [PRD-E002-S003] Invite members via email
- [PRD-E003-S003] Conflict resolution with user context
- [PRD-E004-S002] Optional filesystem export

### Could Have
- OAuth/social sign-in (Google, GitHub)
- Workspace activity feed (who changed what, when)
- Per-document permission overrides
- Rate limiting per user per workspace

### Won't Have (This Release)
- Real-time WebSocket collaboration (cursor sharing, live edits)
- Operational transform or CRDT-based concurrent editing
- Fine-grained field-level permissions
- Enterprise SSO (SAML, OIDC)
- Audit log retention beyond 30 days

---

## Out of Scope

- Replacing the existing minimal persisted client-cache architecture
- Migrating from D1 to PostgreSQL (remains deferred per `knowgrph-storage-sync-document.md` ADR-003)
- Real-time cursor sharing or live collaborative editing (deferred to Phase 4 per storage-sync roadmap)
- Changing the existing push/pull/export API contract (extends it, does not replace)
- Modifying the existing conflict resolution UX flow (extends it with user context)

---

## Dependencies

### Product Dependencies
- Existing storage sync infrastructure (Worker + D1 + minimal persisted client sync)
- Existing conflict resolution UX (toast + log + keep-local/accept-remote actions)
- Workspace FS and source-files bootstrap pipeline

### Technical Dependencies
- JWT signing and verification (HS256 or RS256)
- Password hashing (bcrypt or argon2) — can be delegated to Cloudflare Zero Trust or external auth provider
- D1 migration for new `users` and `workspace_members` tables
- Client-side JWT storage and refresh mechanism

### Validation Dependencies
- Existing test fixtures: `canvas/src/__tests__/knowgrphStorageContracts.test.ts`, `knowgrphStorageWorker.test.ts`
- New auth middleware tests
- New permission enforcement tests

---

## Open Questions

1. **Auth provider**: Self-managed JWT in Worker vs. Cloudflare Zero Trust vs. third-party (Clerk, Auth0, Supabase Auth)?
2. **Password storage**: Store hashed passwords in D1 `users` table vs. delegate entirely to external auth provider?
3. **JWT rotation**: Refresh token strategy and token expiry duration?
4. **Invitation delivery**: Email delivery mechanism for member invitations (Cloudflare Email Workers, external SMTP)?
5. **Workspace discovery**: How do invited users discover and navigate to shared workspaces?

---

## Continuation

Part II: Technical Architecture Documentation (TAD) — component specifications, integration contracts, ADRs, quality attributes, deployment strategy, architecture diagrams, component inventory, D1 schema extension, and traceability matrix — continues in [knowgrph-multi-user-collaboration-prd.tad.companion.md](knowgrph-multi-user-collaboration-prd.tad.companion.md).
