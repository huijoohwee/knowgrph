# Knowgrph Design Document

Canonical design documentation lives in `docs/documents/knowgrph-design-document.md`.

This root document exists as the auto-generated table surface used by `canvas/src/cli/lint-doc.ts`.

## Orchestrator Sections

<!-- ORCHESTRATOR_SECTIONS_TABLE_START -->

| Section ID | Label | Storage Key | Owner |
| --- | --- | --- | --- |
| graphRag | GraphRAG Workflow (AgenticRAG) | kg:orchestrator:graphRagCollapsed | orchestrator.prefs |
| presets | Traversal presets and helpers | kg:orchestrator:presetsCollapsed | orchestrator.prefs |
| editor | Traversal editor and layers | kg:orchestrator:editorCollapsed | orchestrator.prefs |
| context | AgenticRAG context and ignore filters | kg:orchestrator:contextCollapsed | orchestrator.prefs |
| workflowIndexing | Indexing parameters | kg:orchestrator:workflow:indexingCollapsed | orchestrator.prefs |
| workflowTracing | Tracing options | kg:orchestrator:workflow:tracingCollapsed | orchestrator.prefs |

<!-- ORCHESTRATOR_SECTIONS_TABLE_END -->

## Render Sections

<!-- RENDER_SECTIONS_TABLE_START -->

| Section ID | Label | Storage Key | Owner |
| --- | --- | --- | --- |
| renderPresets | Render presets and tuning | kg:render:presetsCollapsed | render.prefs |
| datasetInspector | Dataset inspector | kg:render:datasetInspectorCollapsed | render.prefs |
| codebaseIndexPipeline | Codebase index pipeline | kg:render:codebaseIndexCollapsed | render.prefs |
| threeLinks | Renderer: edges and particles | kg:render:three:linksCollapsed | render.prefs |
| threeLayout | Renderer: layout and geometry | kg:render:three:layoutCollapsed | render.prefs |
| threeBackgroundFog | Renderer: background and fog | kg:render:three:backgroundFogCollapsed | render.prefs |
| threeStarfield | Renderer: starfield and depth | kg:render:three:starfieldCollapsed | render.prefs |
| threeCamera | Renderer: camera and motion | kg:render:three:cameraCollapsed | render.prefs |
| threeSelection | Renderer: selection highlighting | kg:render:three:selectionCollapsed | render.prefs |

<!-- RENDER_SECTIONS_TABLE_END -->
