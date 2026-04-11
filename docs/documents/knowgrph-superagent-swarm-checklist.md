# Knowgrph: 0 → 1 “SuperAgent / Swarm Intelligence” Repo-Level Checklist

This document is a **repo-level** checklist to distinguish:

- **GraphRAG / KG tooling** (single-process ingestion + retrieval + visualization), vs
- **SuperAgent harness** (planner + tools + subagents + sandbox + memory), vs
- **Swarm intelligence / multi-agent simulation** (many agents interacting in an environment with event/state logs).

It is organized as **0 → 1 maturity steps** across **User Flow + Work Flow + Data Flow**.

---

## Definitions (operational)

### “SuperAgent” (harness)
A system that can **plan**, **call tools**, **spawn/coordinate subagents**, and **produce verifiable artifacts** with **run tracing** and (usually) **sandboxed execution**.

### “Swarm Intelligence”
A system that runs **many agents** (often 10s–1000s) in a **simulation loop** with:
- explicit **environment/world state**
- **agent policies/personas/memory**
- **events** and **replayable logs**
- aggregate metrics / emergence patterns

---

## Level 0 — “Claim Only” (not implemented)

### User Flow (0)
- [ ] README uses terms like “super agent”, “swarm”, “multi-agent”, but **no runnable entrypoint** exists.
- [ ] No “Hello agent” quickstart (e.g., `make dev`, `npm run agent`, `python -m ... server`).
- [ ] No stable API surface for runs/threads (no `/threads`, `/runs`, `/tool-calls` concepts).

### Work Flow (0)
- [ ] No tool registry (`tools/`, `toolkit.*`, `toolRegistry.*`) or tool schema definitions.
- [ ] No planner/executor loop (no `planner`, `runner`, `executor`, `agent_loop` module).
- [ ] No agent runtime boundary (everything is just library calls / UI components).

### Data Flow (0)
- [ ] No run-step trace schema (no `Run`, `Step`, `ToolCall`, `Observation` records).
- [ ] No persisted outputs folder with conventions (`outputs/{run_id}/...`).
- [ ] No memory store schema (file/db) or migrations/versioning.

**If most checks here are true, “SuperAgent/Swarm” is branding, not capability.**

---

## Level 1 — Minimal Agent MVP (single-agent + tools)

### User Flow (1)
- [ ] **One obvious entrypoint**:
  - CLI: `python -m <pkg> run ...` / `npm run agent` OR
  - Server: `make dev` then `POST /chat` / `POST /runs`
- [ ] **Example config** is present and documented:
  - `.env.example`, `config.yaml`, or `config.json`
  - includes **model settings**, **tool enablement**, **timeouts**
- [ ] “Happy path” demo that produces an artifact (e.g., a markdown report) with reproducible steps.

### Work Flow (1)
- [ ] Tool registry exists, with:
  - [ ] tool names, inputs/outputs (typed or JSON schema)
  - [ ] tool error surface (timeouts, retries, rate-limit strategy)
- [ ] Agent loop exists (even if naive):
  - [ ] intent/planning step
  - [ ] tool selection and execution
  - [ ] observation ingestion
  - [ ] final answer synthesis
- [ ] Cancellation/timeout strategy exists (at least per-run).

### Data Flow (1)
- [ ] Run record model exists:
  - `run_id`, `started_at`, `ended_at`, `status`, `error`
- [ ] Step record model exists:
  - `step_id`, `run_id`, `type` (plan/tool/answer), `inputs`, `outputs`, `latency_ms`
- [ ] Tool-call logging is persisted (file/db) with stable structure.
- [ ] Artifact output location is deterministic:
  - e.g., `outputs/<run_id>/report.md`

**Passing Level 1 means: “agent” is real and verifiable (not just UI naming).**

---

## Level 2 — SuperAgent Harness (subagents + skills + sandbox + memory)

### User Flow (2)
- [ ] UI or API exposes **threads/runs** and shows step-by-step tool calls.
- [ ] File upload + per-thread workspace:
  - upload → process → output artifacts
- [ ] A “skill” catalog exists:
  - list skills
  - enable/disable
  - run a skill with parameters

### Work Flow (2)
- [ ] **Subagent execution** exists:
  - [ ] task decomposition (fan-out)
  - [ ] parallel subruns
  - [ ] fan-in synthesis into final result
- [ ] **Sandbox abstraction** exists:
  - local vs docker vs remote provider
  - filesystem mapping (workspace/uploads/outputs separation)
- [ ] **Concurrency control** exists:
  - per-worker job limits, queueing, cancellation
- [ ] Skills are loadable modules:
  - `skills/<skill>/SKILL.md` (or equivalent)
  - skill loader/indexer
  - “toolbox” per skill

### Data Flow (2)
- [ ] Long-term memory store exists:
  - schema + dedupe rules + versioning/migrations
- [ ] Trace IDs exist across:
  - run → step → tool call → artifact
- [ ] Provenance model exists:
  - citations/links to sources
  - artifact metadata references inputs + steps

**Passing Level 2 means: “SuperAgent harness” is implemented.**

---

## Level 3 — Swarm Intelligence / Multi-Agent Simulation (environment + replay)

### User Flow (3)
- [ ] Create scenario/world from “seed” input (documents, signals, events).
- [ ] Configure simulation:
  - agent count, rounds/ticks, interventions, policies
- [ ] Run simulation + inspect:
  - timeline, event log, per-agent state
- [ ] Generate post-simulation report + drill-down into “why”.

### Work Flow (3)
- [ ] Simulation engine core exists:
  - `world/`, `sim/`, `scheduler/`, `tick_loop`
- [ ] Agent definitions exist:
  - persona/policy, memory, action space
- [ ] Interaction protocol exists:
  - message bus OR environment events
  - deterministic stepping (or controlled randomness with seeds)
- [ ] Metrics + stopping criteria exist:
  - emergent metrics, convergence/divergence, evaluation hooks

### Data Flow (3)
- [ ] World state schema exists (versioned).
- [ ] Append-only event log exists:
  - replayable, queryable
- [ ] Experiment tracking exists:
  - config snapshot → run → results
  - baselines + comparisons

**Passing Level 3 means: “swarm intelligence” is implemented beyond retrieval/traversal.**

---

## Evidence capture template (use for repo audits)

For each claimed capability, capture:

1. **Entrypoint**
   - path + command + expected output
2. **User flow proof**
   - UI route or API endpoint + screenshot/log
3. **Workflow proof**
   - modules/classes that implement loop/orchestration/simulation
4. **Data flow proof**
   - schemas + example run artifacts (1–2 files) + where persisted

---

## Current snapshot: `knowgrph` (high-level placement)

Based on repo scan (as of current workspace state):

- `knowgrph` is **strong in KG/GraphRAG pipeline + visualization**.
- `knowgrph` contains “agentic” naming, but key Level 1–3 artifacts are missing:
  - no real planner/tool runtime
  - no subagent harness
  - no sandbox provider layer
  - no simulation engine / replay logs

So: **it does not meet Level 1+ for “SuperAgent harness”**, and is **not Level 3 swarm intelligence**.
