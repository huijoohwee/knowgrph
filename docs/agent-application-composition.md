---
title: "Knowgrph Agent Application Composition"
doc_type: "Runtime Contract"
status: "dev-runtime-ready"
schema: "application-composition-plan/v1"
invocation: "/application.compose #application-composition @application-manifest @component-catalog @integration-profile @runtime-proof"
canonical_source_contract: "docs/runtime-readiness-contract.md#docs_dependency"
external_runtime_dependency: "none"
---

# Knowgrph Agent Application Composition

Knowgrph can turn one source-backed manifest into an exact, typed, provider-neutral application plan and execute that plan as a bounded dependency sequence. Components stay interoperable through versioned ports and capabilities; agents, integrations, approvals, transports, and receipts remain with their existing owners.

The work is an independent implementation of the pinned Agentic Canvas OS composition contract. OpenAI Symphony influenced only the desired managed-work outcome. No Symphony code, prose, prompt, API, schema, fixture, test, package, service, or runtime dependency is copied or required.

## Invocation and MCP surface

The host-side invocation is exactly:

```text
/application.compose #application-composition @application-manifest @component-catalog @integration-profile @runtime-proof
```

The aliases select these local stdio MCP tools; they are not MCP wire methods:

- `knowgrph.application.catalog` returns component authoring schemas, exact interface/capability/owner/adapter evidence, and opaque integration records. It is read-only, zero-spend, and makes no external connection.
- `knowgrph.application.plan` accepts a manifest and `dry-run` or `live` mode. It verifies the manifest source digest, exact catalog and adapter-policy digests, typed DAG, reachability, bounds, owner evidence, and mode-compatible adapter before producing `application-composition-plan/v1`.
- `knowgrph.application.execute` accepts the same manifest and mode, expected plan digest, and idempotency key. It replans, rejects drift, and sequences only ready steps. It stops on the first failure, approval boundary, deadline uncertainty, or bound without automatic retry.

`@operator` is conditional runtime authority for paid, mutating, authenticated, or external work. It is deliberately absent from the canonical read-only tuple and from MCP arguments. External authorization is injected by the host owner and stays bound to the existing gateway action digest.

## Manifest invariants

`knowgrph.application-manifest/v1` requires:

- application id and exact semantic revision;
- a `workspace:/`, `kgdoc:`, or `urn:knowgrph:` source URI and SHA-256 of the canonical manifest projection excluding only `source.sha256`;
- the exact invocation tuple and current catalog/adapter policy digests;
- exact component id/revision slots with closed component configuration;
- typed edges, explicit entrypoint/output ports, and step/runtime/output bounds.

Nodes, edges, entrypoints, and outputs are canonicalized as unordered identity collections. Every required input has exactly one producer, output kinds are assignable to input kinds, the graph is acyclic, and every node must lie on a declared entrypoint-to-output path. Manifest control fields for hidden code, packages, callbacks, commands, transports, providers, endpoints, headers, environment maps, credentials, approvals, raw MCP objects, and caller-supplied adapters are rejected; URL-like strings inside typed values remain inert data.

Use `source.sha256 = digestApplicationManifestSource(manifest)` after assembling the manifest with a placeholder SHA. Fetch the active `catalogDigest`, `adapterPolicyDigest`, component revisions, and component configuration schemas from `knowgrph.application.catalog`.

## Runtime ownership

The v1 catalog provides local input, literal prompt template, registered-agent zero-call planning, approved external artifact, and output components. Adapters pin the exact component revisions and supported execution modes. The registered-agent adapter delegates to the existing `compileAgentRun(..., mode: "dry-run")` owner and cannot make a provider call. External artifact execution delegates once to the existing shared MCP gateway, uses its opaque profile/capability/schema evidence and idempotency fence, and cannot self-authorize.

Plans contain digests and public metadata, never node configuration, component source bodies, instruction text, transport configuration, secrets, or provider payloads. Live execution cancellation is propagated to the owner. Once the gateway marks actual external dispatch, every terminal application-ledger result remains protected and a later failure or cancellation carries reconciliation-required evidence; validation, approval, schema-drift, and cancellation failures before that marker remain safely TTL-evictable.

The bundled execution ledger and the gateway approval-token, idempotency, and receipt ledgers are bounded or owner-managed but process-local by default. This Dev surface does not claim cross-process replay safety or restart-safe exactly-once delivery. Embedding hosts that require those properties must inject durable bounded owners and reconcile uncertain external outcomes before retrying.

## Evolution

Component, interface, capability, schema, owner, adapter, integration profile, and application revisions are exact. A newer revision is never selected implicitly. Missing or changed evidence returns migration/drift diagnostics and leaves the existing plan unchanged. Future providers and component kinds extend the catalog and injected owner registry instead of adding provider-specific manifest fields.

## Local verification

```bash
npm run application-composition:check
```

The check covers canonical hashing and immutability, total fail-closed catalog validation, exact revision and mode fences, type/reachability failures, catalog/plan privacy, deterministic planning, offline execution, idempotency, ledger bounds, owner stop behavior, strict MCP contracts, stdio discovery/calls, and canonical VDEOXPLN routing. It performs no paid model call, external write, deployment, or production mutation.
