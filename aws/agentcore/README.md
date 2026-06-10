# AWS AgentCore Runtime tier

Thin **MCP-forwarding adapter** to the knowgrph Cloudflare control plane,
deployable on **Amazon Bedrock AgentCore Runtime**. Per the spec's R11
spend-isolation boundary and audit decision 13.0, this tier:

- holds **no** model provider keys,
- invokes **no** Bedrock / paid model directly, and
- only **forwards** `knowgrph.video_remix.run` + the stage tools to the
  Cloudflare `McpAgent` over MCP Streamable HTTP.

> Scope note: the container image, `agentcore configure` registration, and the
> least-privilege IAM role are authored by tasks 13.1–13.3. This README
> documents the **AgentCore CLI project configuration (task 13.2)** and the
> **inbound auth reconciliation (task 13.4)**.

## AgentCore CLI project configuration (task 13.2)

**Requirements:** R12.2, R14.1 · follows the `agentcore-samples`
`01-tutorials/01-AgentCore-runtime/02-hosting-MCP-server` pattern.

### Tool

The AgentCore CLI is the Node.js 20+ npm package
[`@aws/agentcore`](https://github.com/aws/agentcore-cli). It is declared as a
**pinned dev dependency** in [`package.json`](package.json) (`@aws/agentcore`
pinned to an exact version, matching the repo's no-`^`/`~` convention) and is
installed globally for operator use:

```bash
# Node.js 20+ required
npm install -g @aws/agentcore@0.19.0
agentcore --version
```

> If the older Python starter toolkit (`bedrock-agentcore-starter-toolkit`) is
> still installed it shares the `agentcore` command name; uninstall it first to
> avoid ambiguity.

### Registration

The `agentcore configure` settings that register **this** containerized MCP
server live in the repo at [`agentcore.config.json`](agentcore.config.json)
under the additive `cli` block (the `runtime` block remains the single source
of truth for the runtime contract):

- **agentName:** `knowgrph-agentcore-mcp-forwarder`
- **entrypoint:** `src/server.js`
- **protocol:** `MCP`
- **architecture / platform:** `arm64` / `linux/arm64`
- **MCP endpoint:** `0.0.0.0:8000/mcp` (stateless streamable-HTTP)
- **container:** `Dockerfile` built from the `..` (`aws/`) build context
- **pinned versions:** CLI `@aws/agentcore` and the `node:20-slim` ARM64 base
  image are pinned so `configure`/`launch` are reproducible.

No `modelProvider` stanza and no model provider keys appear anywhere: this
artifact is the thin MCP-forwarding adapter (decision 13.0) hosted as a
Node-based container (decision 13.12, option a), so the R11 spend-isolation
boundary holds.

### Workflow (configure → local test → launch → invoke)

`launch`/`invoke` are **operator-run and `cloud-deploy`-gated** (task 13.9); the
only network-free step here is the local test.

```bash
# 1. configure — register the MCP server (entrypoint, protocol=MCP, ARM64)
npm run agentcore:configure
#    (= agentcore configure --entrypoint src/server.js --protocol MCP --arm64)

# 2. local test — network-free, deterministic (no docker / no network)
npm test

# 3. launch — OPERATOR-GATED (task 13.9): build + push ARM64 image, create the
#    AgentCore Runtime
agentcore launch

# 4. invoke — OPERATOR-GATED (task 13.9): smoke the deployed endpoint
agentcore invoke '{"method":"tools/list"}'
```

> The modern `@aws/agentcore` CLI maps this flow to
> `create`/`dev`/`deploy`/`invoke`; the `configure`/`launch`/`invoke` names are
> kept here to match the spec's AgentCore Runtime contract wording and tasks
> 13.8/13.9.

## Inbound auth: R15 Auth_Token reconciliation (task 13.4)

**Requirements:** R15.1, R15.2, R15.3, R15.9 · **Properties:** 1, 28, 29

### Decision — thin verifying layer (not the native JWT authorizer)

AgentCore Runtime supports a native inbound JWT authorizer
(`customJWTAuthorizer`). We **do not** use it for this connector. The native
authorizer is built for **OIDC** providers: it needs a `discoveryUrl` (an OIDC
`.well-known` document exposing a **JWKS of asymmetric public keys**, e.g.
RS256) plus an allowed-clients / audience list, and validates a token against
that issuer's published keys.

The R15 **Auth_Token** (Decision 0.1) is a stateless, **symmetric HS256** JWT
minted by the Agent_Api itself (`POST /auth/session`) using a **server-side
shared secret**. There is no external OIDC issuer, no `.well-known` discovery
endpoint, and no JWKS of public keys for the native authorizer to fetch — so
**AgentCore's native JWT authorizer cannot verify the HS256 token cleanly.**

**Resolution:** run a **thin verifying layer at the entry of the
AgentCore-hosted MCP server** that performs the **same R15 verification as the
existing agent-api middleware** before any forwarding. It is implemented in
[`src/inbound-auth.js`](src/inbound-auth.js) as `withInboundAuth(forward, deps)`
and **reuses** the agent-api verification primitives rather than duplicating
them:

| Reused primitive | Source | Role |
|---|---|---|
| `createAuthVerifier` | `aws/agent-api/src/lib/auth-verify.js` | HS256 verify (pinned alg, `exp` + configurable issuance-age window) |
| `buildCallerIdentity` | `aws/agent-api/src/lib/caller-identity.js` | establish Caller_Identity from verified claims |
| `buildUnauthorizedResponse` / `buildAuthUnavailableResponse` | `aws/agent-api/src/lib/auth-verify.js` | canonical non-disclosing 401 / 500 |

Because both tiers call the *same* code, they cannot drift in how a token is
verified or what is disclosed on rejection.

### Behavior

- **Missing / malformed / invalid-signature / expired Auth_Token** → HTTP 401,
  the MCP forward seam is **never** invoked (no MCP forwarding), **no**
  Run_Manifest data is disclosed, and the error reveals neither credential
  contents nor internal config. _(R15.1, R15.3 / Property 28)_
- **Valid Auth_Token** → establish **Caller_Identity** from the verified claims
  **before** forwarding, then forward to the Cloudflare McpAgent.
  _(R15.2 / Property 29)_
- **Auth ≠ approval** → a verified Auth_Token authorizes only **access** to the
  forward; it **never** substitutes for an Approval_Token at a spend boundary.
  This tier performs **no** paid action and **no** approval logic; every spend
  boundary stays gated downstream at the Cloudflare `Hitl_Gate_Service`
  (task 13.5). The verified request is forwarded exactly as an
  authenticated-but-unapproved call, so the control-plane Approval_Gate still
  runs unchanged. _(R15.9 / Property 1)_

### Secret handling (R15.7 / R11)

The HS256 signing/verification secret is **server-side only**. It is read from
the container environment key `AUTH_JWT_SECRET` (sourced from AWS Secrets
Manager at deploy time, the same secret the Agent_Api signs with) and is never
placed in the image, build args, logs, or any response.

### Configuration

The reconciliation is pinned in
[`agentcore.config.json`](agentcore.config.json) under `inboundAuth`
(`strategy: "thin-verifying-layer"`, `nativeJwtAuthorizer.enabled: false`).

### Tests

`npm run agentcore:test` (network-free, deterministic; static secret provider +
fixed clock). Covers valid pass-through + Caller_Identity establishment, the
four rejection classes (missing / malformed / bad-signature / expired) with no
forwarding and no manifest disclosure, the non-disclosing 401 body, the
auth-≠-approval invariant, and the server-side-secret-unavailable 500.
