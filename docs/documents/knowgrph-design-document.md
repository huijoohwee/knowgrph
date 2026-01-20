# Knowgrph Design Document

## Purpose

This document is the design-level index for Knowgrph. It provides a stable entry point for the end-to-end pipeline and links to deeper, single-responsibility documents.

## End-to-end pipeline (summary)

- Import: Markdown is ingested and normalized into a parseable form.
- Parse: Markdown (including Mermaid blocks) is converted into JSON-LD.
- Derive: JSON-LD is converted into `GraphData` (nodes + edges) with stable identifiers.
- Layout: Seed layout + simulation constraints produce stable node/group positions (16:9, centered, non-overlapping).
- Render: Canvas layers render nodes/edges/groups with toggle-safe caching to prevent unnecessary re-layout.

## Key design documents

- Pipeline overview: `knowgrph-pipeline-document.md`
- Pipeline deep dive: `knowgrph-pipeline-deep-dive-document.md`
- Parser: `knowgrph-parser-document.md`
- Orchestrator: `knowgrph-orchestrator-document.md`
- Renderer: `knowgrph-renderer-document.md`
- Canvas UX: `knowgrph-ui-ux-design-document.md`
- Mermaid layout/config: `knowgrph-mermaid-layout-configuration.md`
- Schema: `knowgrph-schema-document.md`
- Semantic layer: `knowgrph-semantic-document.md`
- System design: `knowgrph-system-design-document.md`

