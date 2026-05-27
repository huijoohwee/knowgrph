---
title: "Knowgrph Canvas"
doc_type: "Subsystem README"
status: "active"
lang: "en-US"
frontmatter_contract: "required"
---

# Knowgrph Canvas

## Authoring Contract

- The opening YAML frontmatter block remains the first-block machine SSOT for subsystem metadata, scope, and runtime context for this Canvas README.
- This document is a canonical authored subsystem README, not a generated registry surface or typed validation fixture.
- Frontmatter stays in plain YAML so the file demonstrates the default authoring path for subsystem docs, local-development instructions, and architecture overviews.
- If typed `{key, type, value}` envelopes are needed for ingest -> parse -> render validation, that coverage should live in a dedicated fixture doc rather than replacing canonical subsystem prose.
- Runtime guidance and ownership notes must still be derived from parsed frontmatter and document content only, never from file path assumptions or downstream mirrors.

React + TypeScript + Vite app for interactive graph visualization.

## Parser Architecture Overview

- Canvas uses a single JSON-LD parser in TypeScript for all datasets:
  - `parseJsonLd` in `canvas/src/lib/graph/jsonld.ts:1-118` converts JSON-LD into `GraphData`.
  - Built-in parser specs (`csv`, `json`, `jsonld`, `n8n`) live in `canvas/src/features/parsers/default.ts`.
- Workflow presets bind parser, dataset, and schema:
  - See `canvas/src/features/panels/views/ParserView.tsx` and `docs/knowgrph-workflow-document.md`.
- Offline CLI utilities live under `knowgrph_parser/` for markdown → JSON-LD and codebase indexing workflows.

This keeps canvas parsers structural and dataset-agnostic while allowing richer offline pipelines in Python.

## Python CLI

Python scripts in `knowgrph_parser/` support offline parsing and pipeline artifacts generation.

- `python -m knowgrph_parser jsonld-universal`
  - Universal JSON/JSON-LD handler that:
    - Loads JSON from disk.
    - Parses generic JSON-LD or `{nodes,edges}` graphs into `GraphData`.
    - Optionally delegates to a loaded external parser module.
  - Example (structural JSON-LD parsing, no external module):

    ```bash
    python -m knowgrph_parser jsonld-universal \
      --input test-data/a0.jsonld
    ```

  - Example (delegate to a custom parser implementation):

    ```bash
    python -m knowgrph_parser jsonld-universal \
      --input test-data/a0.jsonld \
      --parser-module myproject.parsers.jsonld_universal \
      --parser-func parse_jsonld \
      --format graph
    ```

## Local Development

- Install dependencies:

  ```bash
  cd canvas
  pnpm install
  ```

- Start the dev server:

  ```bash
  pnpm run dev
  ```

- Run tests:

  ```bash
  pnpm run test:ci
  ```

- Lint and type-check:

  ```bash
  pnpm run lint
  pnpm run check
  pnpm run typecheck:agenticrag
  ```

## ESLint Configuration Notes

Canvas uses `eslint` with a TypeScript configuration in `canvas/eslint.config.js`. For stricter rules, extend the config with `typescript-eslint` presets as needed.
