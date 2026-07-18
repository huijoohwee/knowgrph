# Rich Media Deliverables Widget Contract

## Outcome

The Deliverables Widget Card is a layout preset of the canonical `TextGeneration/default/textGeneration` Widget Card. It does not introduce another node type or make Rich Media panels executable.

The authored flow is:

```text
Generated Result.output
  -> Deliverables Widget Card.prompt_in
  -> Run
  -> Slide Deck.output
  -> Financial Model.output
```

The source edge must persist `flow:sourcePortKey: output` and `flow:targetPortKey: prompt_in`. Workflow-created output edges persist `text_out -> output`. The shared dataflow reader unwraps persisted object/property cells before the connected source becomes the Widget Card runtime prompt.

## Palette and Run ownership

- Palette layout id: `rich-media-deliverables`.
- Registry identity: canonical Widget Card (`TextGeneration/default/textGeneration`).
- Run owner: the downstream Deliverables Widget Card.
- Rich Media source and output panels remain read/render/edit surfaces; they do not gain a Run action.
- The shared Rich Media rail unwraps typed property containers and active-tab cells, then exposes supported text/image/video/audio semantic ports at the panel midpoint; text panels therefore expose `output`, not an unrelated media URL port. Auto/model/POI and missing-tab surfaces retain the established center-rail fallback.
- The card retains its authored instructions while the connected `prompt_in` value is the source material supplied to generation.
- A newly dropped card adopts the committed composed source graph before it becomes runnable. Ordinary debounced history snapshots must not reset that draft; only explicit Restore, Undo, or Redo may force history authority. Canonical `workspace::node` and source-local `node` identities reconcile only when the inner identity is unique across source layers.

## Bounded MCP invocation

The preset instruction contains existing source-backed `/`, `@`, and `#` tokens. On explicit Run, the browser posts only normalized invocation tokens to same-origin Dev/Preview `POST /__knowgrph_mcp_agentic_os_docs_invoke`.

The bridge:

- accepts JSON only and rejects cross-site requests;
- bounds the body to 32 KiB and tokens to 12;
- invokes only `knowgrph.agentic_canvas_os.docs.invoke` through the local stdio MCP server;
- exposes no caller-selected tool, filesystem path, endpoint, mutation, deployment, Prod, or Cloudflare action;
- resolves every normalized requested token under one eight-second request deadline and rejects incomplete or duplicate response coverage;
- returns literal invocation success/error evidence, which is passed to the configured chat provider.

If any requested token fails to resolve, Run fails closed before provider generation or output publication. A card with no invocation tokens may still use the configured provider without claiming MCP invocation.

## Structured provider response

Generation must return JSON whose `structuredContent` contains:

- one `panels[]` item marked `richMediaDeliverableKind: slide-deck`, with at least two non-empty Markdown slides separated by a line containing only `---`;
- one `tables[]` item marked `richMediaDeliverableKind: financial-model`, with columns and rows that normalize to a Markdown pipe table.

Both deliverables are parsed through the existing MCP-shaped structured-content owner. Invalid, partial, single-slide, or non-table output fails before panel publication.

## Reusable Rich Media outputs

The two outputs use distinct workflow-owned identities:

| Output | `workflowOutputKey` | Render contract |
| --- | --- | --- |
| Slide Deck | `markdown-slide-deck` | `text/markdown`, `markdownPresentationMode: true`, existing Markdown presentation renderer |
| Financial Model | `financial-model-spreadsheet` | `text/markdown`, `tableFormat: markdown-pipe-table`, existing Markdown DataView/table renderer |

Publication uses the owned-output policy, so an existing authored downstream panel is not overwritten. Repeated Run upserts the same two panels and typed edges by anchor plus output key. Both panels freeze their generated local Markdown for display, so the lineage edge cannot replace the deck or table with the card's status summary. The two artifacts are staged in the draft graph and the outer Run performs one final durable persistence after both exist. Financial-model persistence removes HTML/`srcDoc`; Markdown remains the source of truth.

## Verification

Focused contracts cover:

- typed persisted Rich Media output crossing `output -> prompt_in` as a string;
- active text Rich Media panels exposing the authorable midpoint `output` rail, image panels exposing `imageUrl`, typed video cells exposing `videoUrl`, and auto mode retaining its center fallback;
- connected source precedence with authored instruction retention;
- bounded same-origin MCP invocation with exact all-token response coverage;
- structured deck/table parsing and fail-closed partial output;
- two distinct idempotent output panels without authored-target overwrite;
- presentation-mode and Markdown-only financial-table rendering;
- local-artifact display precedence across connected output edges and one final durable graph write.
- palette-drop persistence across composed-store commit, source reparse, and ordinary history append, with no canonical duplicate or double-prefixed node identity;
- Run lookup from a composed overlay id to its unique source-local draft node.

This contract is Dev/runtime work only. It grants no Prod mirror, Cloudflare, or release mutation.
