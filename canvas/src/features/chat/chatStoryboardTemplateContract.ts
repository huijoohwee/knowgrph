export const CHAT_STORYBOARD_TEMPLATE_CONTRACT_PROMPT = [
  'KNOWGRPH 2D RENDERER STORYBOARD TEMPLATE CONTRACT:',
  '- Align with schema `kgc-2d-renderer-storyboard-template/v1` as structural guidance only; never clone template prose or generated fixture data.',
  '- Plain no-slash chat stays Markdown/`response:` YAML; do not emit standalone KGC frontmatter unless a recognized runtime invocation selects the KGC contract.',
  '- Storyboard/frontmatter intent is data: `kgCanvasSurfaceMode: "2d"`, `kgCanvasRenderMode: "2d"`, `kgCanvas2dRenderer: "storyboard"`, `kgDocumentSemanticMode: "document"`, `kgFrontmatterModeEnabled: true`, `kgMultiDimTableModeEnabled: false`, and `kgStrybldrStoryboard: true`.',
  '- Runtime readiness is evidence-gated: `runtime_readiness.status` cannot become runtime-ready without local proof; keep paid calls at 0 and provider job IDs, stream URLs, generated asset URLs, and proof paths blank until returned evidence exists.',
  '- Publish is fail-closed: Prod mirror and Cloudflare remain blocked until explicit operator instruction.',
  '- Storyboard dataflow stages stay source-owned: Source -> Ideation -> Invocation -> Storyboard -> Runtime -> Publish, with `flow.nodes`, `flow.edges`, `flow_diagrams`, and `strybldr_storyboard.elements` describing the same workflow.',
  '- Semantic HTML projection uses `main`, `section`, `article`, `header`, `nav`, `aside`, `figure`, `figcaption`, and `table`; generic `div` is layout-only and never the primary surface boundary.',
  '- Guardrails: no hardcoded source-specific media IDs, credentials, provider IDs, stream URLs, transcripts, generated assets, stale renderer aliases, downstream panel patches, or source-template backfill.',
].join('\n')

export const CHAT_STORYBOARD_TEMPLATE_AGENTIC_OS_DIRECTIVE_PROMPT = [
  'Storyboard template Agentic OS directive context:',
  '- Slash routes: /source.ingest, /source.parse, /source.normalize, /ingest-url, /workspace.review, /pipeline.trace, /harness.define, /canvas.project, /canvas.render, /runtime-ready.check, /deploy.guard, /memory.seed.',
  '- Semantic routes: #frontmatter, #harness, #token-economics, #runtime-ready, #canvas, #approval-gate, #dev-only, #no-hardcode.',
  '- Binding routes: @source.frontmatter, @source.body, @local-harness, @runtime-proof, @cost-log, @canvas, @operator, @dev-only.',
  '- Recognized command outputs must stay inside the selected response contract; `/prd-tad.create` and computing-flow requests use the structured KGC scaffold with this directive context.',
].join('\n')
