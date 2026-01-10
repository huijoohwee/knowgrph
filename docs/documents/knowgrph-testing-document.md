# Knowgrph Document – Testing Overview

## Scope

- This document summarizes how Knowgrph uses fixtures and test helpers to validate ingestion, schema, canvas behavior, and neutrality requirements.
- It focuses on:
  - Neutral, configuration‑driven test inputs.
  - Markdown ingestion fixtures, including Mermaid frontmatter and interview graphs.
  - How tests are wired to use reusable helpers from the Canvas test suite.

## Markdown ingestion fixtures

- Core markdown ingestion tests live under `canvas/src/__tests__` and exercise:
  - Example workflow markdown (`exampleWorkflowMarkdownIngestion.test.ts`).
  - GitHub‑style markdown and HTML image ingestion (`markdownGithubIngestion.test.ts`, `markdownMediaSmoke.test.ts`, `markdownMediaToggleE2e.test.ts`).
  - Mermaid frontmatter templates and ontology‑aware frontmatter (`exampleWorkflowMarkdownIngestion.test.ts`, `markdownMediaToggleE2e.test.ts`).

### Interview markdown fixture (EDA → MLP → Deployment)

- The canvas test suite exposes a neutral helper for interview‑style markdown graphs:
  - Location: `canvas/src/__tests__/exampleWorkflowMarkdownIngestion.test.ts`.
  - Helper: `testEdaMlpInterviewSessionMarkdownProducesMermaidAnchorsAndInternalLinks(markdown: string)`:
    - Asserts that markdown containing frontmatter `mermaid:` plus anchors and internal links:
      - Produces non‑empty node and edge sets.
      - Emits `MermaidNode` nodes and `pointsTo` edges for Mermaid topology.
      - Emits `Anchor` and `InternalLink` nodes with `pointsTo` edges into anchors.
     - Uses a lightweight `assertMermaidSubgraphMembership` helper to verify that neutral Mermaid subgraph layers (`L0`, `L1`, …, `L6`) each contain the expected `MermaidNode` members without hardcoding any particular interview file path.
  - Jest‑style disk helper: `testEdaMlpInterviewSessionMarkdownFixtureFromDisk()`:
    - Reads markdown from disk using an environment‑configured path:
      - Environment variable: `KNOWGRPH_EDA_MLP_INTERVIEW_MD_PATH`.
      - The path is resolved relative to `process.cwd()` via `node:path.resolve`.
    - When the environment variable is not set or is empty, the helper returns early without running assertions.
    - When set, it:
      - Reads the target `.md` file via `readFileSync`.
      - Passes the markdown text into `testEdaMlpInterviewSessionMarkdownProducesMermaidAnchorsAndInternalLinks`.
    - In this repository, the recommended default value when running `npm test` from the repo root is:
      - `KNOWGRPH_EDA_MLP_INTERVIEW_MD_PATH=../data/test-data/eda-mlp-interview-session.fixture.md`
      - This resolves (from the `canvas` working directory used by the test runner) to `data/test-data/eda-mlp-interview-session.fixture.md`.

### Neutrality and configuration

- The interview markdown helper follows the codebase neutrality guidelines:
  - No hardcoded project‑specific or dataset‑specific file paths in the test module.
  - The location of the interview markdown fixture is controlled entirely via `KNOWGRPH_EDA_MLP_INTERVIEW_MD_PATH`.
  - The helper treats the markdown as a generic EDA→MLP→deployment interview document:
    - It asserts structure (Mermaid nodes, anchors, internal links) rather than any project‑specific content.
    - It keeps the test module reusable across different repositories or CI setups by adjusting only the environment.
