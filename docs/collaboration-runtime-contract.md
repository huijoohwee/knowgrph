---
title: "Knowgrph Collaboration Runtime Contract"
doc_type: "Runtime Contract"
status: "active"
contract_version: 3
frontmatter_contract: "required"
ci_command_timeout_ms: 300000
invocation:
  actions: ["/change", "/fix", "/refactor", "/verify", "/release"]
  required_pr_keys: ["action", "scope", "actor", "base_sha"]
  scope_pattern: "^#[a-z0-9]+(?:[.-][a-z0-9]+)*$"
  actor_pattern: "^@[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$"
  base_sha_pattern: "^[0-9a-f]{40}$"
coordination:
  base_branch: "main"
  branch_pattern: "^agent/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"
  unique_active_scope: true
  protected_push_refs: ["refs/heads/main"]
local_development:
  canonical_mode: "canonical"
  task_mode: "task"
  mode_environment_variable: "KG_DEV_SOURCE_MODE"
  canonical_sources:
    - id: "knowgrph"
      repository_path: "."
      required_path: "."
      canonical_remote: "origin"
      canonical_branch: "main"
      fetch_required: true
      clean_required: true
      task_divergence_allowed: true
    - id: "agentic-canvas-os-docs"
      repository_path: "../agentic-canvas-os"
      required_path: "docs"
      canonical_remote: "origin"
      canonical_branch: "main"
      fetch_required: true
      clean_required: true
      task_divergence_allowed: false
deployment:
  allowed_workflows: [".github/workflows/release.yml"]
  required_trigger: "workflow_dispatch"
  forbidden_triggers: ["pull_request", "push", "repository_dispatch", "schedule"]
  command_patterns: ["wrangler(?:@[^ ]+)?\\s+pages\\s+deploy(?:\\s|$)", "npm\\s+run\\s+[^\\n]*deploy(?!ed)[^\\s]*(?:\\s|$)"]
ci_scopes:
  dependencies:
    roots: ["package.json", "package-lock.json", "canvas/package.json", "canvas/package-lock.json", "contracts/package.json", "grph-shared/package.json", "gympgrph/package.json", "mcp/package.json", "web/package.json"]
    commands:
      - ["npm", "run", "check"]
      - ["npm", "run", "runtime:check"]
  canvas:
    roots: ["canvas/src/", "canvas/scripts/", "grph-shared/src/", "gympgrph/src/"]
    commands:
      - ["npm", "run", "check"]
  runtime:
    roots: ["cloudflare/workers/", "contracts/", "mcp/", "web/"]
    commands:
      - ["npm", "run", "runtime:check"]
  documentation:
    roots: ["docs/", "CodeWiki.md", "README.md", "goal.md"]
    commands: []
  collaboration:
    roots: [".github/", ".githooks/", "AGENTS.md", "docs/branch-protection.md", "docs/collaboration-runtime-contract.md", "docs/conflict-resolution.md", "scripts/collaboration-contract.mjs", "scripts/dev-source-consistency.mjs", "scripts/check-dev-source-consistency.mjs", "scripts/check-collaboration-runtime.mjs", "scripts/check-pre-push-refs.mjs", "scripts/run-affected-ci.mjs", "scripts/__tests__/collaboration-contract.test.mjs", "scripts/__tests__/dev-source-consistency.test.mjs"]
    commands:
      - ["npm", "run", "test:collaboration-contract"]
fallback_commands:
  - ["npm", "run", "check"]
---

# Knowgrph Collaboration Runtime Contract

## Authority

This opening YAML frontmatter is the machine source of truth for collaboration grammar, local source identity, deployment isolation, and affected-scope CI selection. Runtime scripts parse it directly; workflow files must not duplicate its source registry or path-to-command mapping.

## Invocation Grammar

Every non-draft pull request starts with a YAML frontmatter declaration:

```yaml
---
action: /change
scope: "#canvas.render"
actor: "@developer-or-codex-task"
base_sha: "0123456789abcdef0123456789abcdef01234567"
---
```

- `/` declares one operation.
- `#` declares one semantic ownership scope.
- `@` declares one accountable human or Codex task.
- `base_sha` records the exact upstream `origin/main` commit used to start the work.

Draft pull requests may omit the declaration while their scope is being formed. A pull request must contain a valid declaration before it becomes ready for review.

## Ownership And Conflict Prevention

- One task owns one branch and one worktree.
- One semantic scope has one active implementation owner.
- Every task branch uses `agent/<device>/<semantic-scope>` and starts from the declared `origin/main` commit.
- If two active changes claim the same scope, serialize them or explicitly hand over ownership before further edits.
- Resolve conflicts in the highest upstream source owner, then regenerate derived artifacts.
- Do not commit lease files, lock records, or other coordination state that creates repository churn. Pull request metadata carries live task ownership.

## Continuous Integration

- `Integration Gate` is the sole required merge status.
- The gate validates this contract, runs source/build conflict compliance, and selects additional commands from `ci_scopes` based on changed paths.
- Dev CI never requires or writes a Prod mirror. Source-to-mirror parity runs only after the manual release workflow creates its ephemeral production artifact.
- Commands are arrays rather than shell strings, preventing shell interpolation and keeping execution provider-neutral.
- Every affected-scope command has the canonical bounded timeout; non-terminating checks fail closed instead of freezing the gate.
- Unknown changed paths fail safe through `fallback_commands`.
- Superseded runs on the same pull request or branch are cancelled.
- `runtime:check` owns the focused runtime/property suite, external invocation-dictionary validation, canonical stage topology, deterministic mock replay, and zero-spend proof.

## Cross-Device Handoff

1. The sending device stops its Codex task, validates, commits, and pushes.
2. The receiving device fetches the remote and verifies the sender's exact commit SHA.
3. Only one device may resume writes to that branch; the sender remains stopped.
4. A non-fast-forward update or duplicate active semantic scope halts both tasks for explicit upstream resolution.
5. GitHub pull-request metadata is the live coordination registry; shared folders and committed lease files are forbidden.

## Local Development Source Identity

- Normal `npm run dev` startup fetches every `local_development.canonical_sources` entry before Vite starts.
- Canonical mode requires every registered repository to be clean and exactly equal to its fetched canonical SHA. The port number never selects application or documentation source code.
- The centralized Agentic Canvas OS docs entry resolves from the sibling repository and requires its `docs` root. Stale, ahead, divergent, dirty, or missing sources fail closed with the responsible source identity.
- Task branches use `KG_DEV_SOURCE_MODE=task npm run dev -- --port <port>` explicitly. Task mode permits divergence only for the source whose contract declares `task_divergence_allowed: true`; the shared Agentic Canvas OS docs revision remains clean and canonical.
- Already-running servers retain the SHA they started with. Restart them after `origin/main` advances so the startup gate can validate the new canonical source.

## Deployment Boundary

- CI never deploys.
- Only a workflow listed in `deployment.allowed_workflows` may contain deployment commands.
- The allowed workflow must use only the explicit manual trigger declared by `deployment.required_trigger`.
- Production release requires an exact verified Dev commit, an explicit `DEPLOY` confirmation, and approval through the GitHub `production` environment.
- Prod repositories, Cloudflare resources, remote migrations, DNS, storage, and payment services remain untouched until an authorized release is manually started.
