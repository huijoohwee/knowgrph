# AIAP22 Codebase Indexing, Traversal, and Tracing Pipeline

Aligned with:
- AgenticRAG schema (`huijoohwee.github.io/schema/AgenticRAG`)
- Generic KG/RAG Pipeline Principles (`docs/knowgrph-pipeline-principles.md`)
- Knowgrph Workflow Document (`docs/knowgrph-workflow-document.md`)
- Codebase Indexing, Traversal, and Tracing Pipeline Document (`docs/knowgrph-codebase-indexing-traversal-tracing-pipeline-document.md`)
- RACI matrix for Agentic GraphRAG (`docs/knowgrph-raci-document.md`)

This document describes how the external AIAP22 competition repository (`aiap22-hui-joo-hwee-045B`) is traversed, indexed, and exported as a JSON-LD graph suitable for Agentic GraphRAG. The pipeline mirrors the knowgrph codebase index pipeline but specializes node types, traversal labels, and runtime events for the AIAP22 ML workflow.

| Mode   | How to run                                                                                                          | What it produces and how to use it                                                                                                                        |
|--------|---------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| Local  | From `knowgrph/`: run `npm run graphrag:aiap22-workflow` and `python -m knowgrph_parser python-codebase-index -c orchestrator-config/aiap22-codebase-index-orchestrator-config.yaml -b aiap22-hui-joo-hwee-045B`. | Regenerates `data/outputs/aiap22-codebase-index-viz.jsonld`, schema, and orchestrator config for local Canvas sessions and offline Agentic GraphRAG runs. |
| CI     | In `aiap22-hui-joo-hwee-045B`: GitHub Actions workflow `.github/workflows/github-actions.yml` runs the AIAP22 pipeline, checks out `knowgrph`, generates the GraphRAG workflow, builds the index, and uploads an `aiap22-codebase-index` artifact. | Keeps a fresh bundle of index, schema, orchestrator config, and GraphRAG workflow attached to each CI run; see Section 6.2 for details.                   |
| Canvas | In Canvas: load `data/outputs/aiap22-codebase-index-viz.jsonld`, import `data/graphrag/aiap22-graphrag-workflow.jsonld` or `configs/graphrag/aiap22-codebase-config.yaml` in the Workflow tab, and use the Orchestrator tab to replay `graphRAGPath` chains and AIAP22 DuckDB presets. | Provides an interactive Agentic GraphRAG view where you can inspect `chunk_text`, `graphRAGPath`, `provenance`, and click `codebasePath` to open real AIAP22 files. |


- **`@context`** → Defines namespaces (`schema.org` for general metadata, custom vocab for code/tracing). 
- Indexing Layer → Nodes for files, modules, classes, functions. 
- Traversal Layer → Edges (relationships) showing imports, dependencies, call graphs. 
- Tracing Layer → Runtime events for calls, returns, exceptions linked back to static nodes for auditability.

---

## 1. Pipeline Overview

- **Goal**: Maintain a reproducible Agentic GraphRAG view of the AIAP22 Python codebase that:
  - Encodes structural relationships between files, modules, classes, and functions.
  - Exposes traversal edges (`imports`, `contains`, `calls`) for multi-hop reasoning over the ML pipeline.
  - Provides per-node provenance and lightweight runtime tracing events aligned with `AgenticRagNodeProvenance`.
- **Inputs**:
  - External codebase root:
    - `../aiap22-hui-joo-hwee-045B` (configurable via `-r/--codebase-root`)
  - Orchestrator configuration:
    - `orchestrator-config/aiap22-codebase-index-orchestrator-config.yaml`
- **Outputs**:
  - `data/outputs/aiap22-codebase-index-viz.jsonld` – AIAP22 codebase index graph.
  - `schema-config/aiap22-codebase-index-schema.json` – schema and visualization rules for AIAP22 nodes and edges.
  - `orchestrator-config/aiap22-codebase-index-orchestrator-config.yaml` – binding between parser, index, schema, and AgenticRAG settings.

The orchestration file declares the AgenticRAG schema and traversal labels that should be treated as primary candidates for multi-hop reasoning, and wires the AIAP22 GraphRAG configuration:

```yaml
# orchestrator-config/aiap22-codebase-index-orchestrator-config.yaml
graph:
  id: aiap22-codebase-index
  codebase_root: ../aiap22-hui-joo-hwee-045B
  index_jsonld: data/outputs/aiap22-codebase-index-viz.jsonld
  index_schema: schema-config/aiap22-codebase-index-schema.json
  workflow_json: data/graphrag/aiap22-graphrag-workflow.jsonld
  graphrag_workflow: configs/graphrag/aiap22-codebase-config.yaml

orchestrator:
  parser_script: python -m knowgrph_parser

agentic_rag:
  schema: https://huijoohwee.github.io/schema/AgenticRAG
  node_view_type: AgenticRagNodeView
  primary_fields:
    - chunk_text
    - embedding
    - provenance
  traversal_edges:
    - imports
    - contains
    - calls
    - hasRuntimeEvent
    - runtimeOf
  ignore_codebase_paths:
    - dir:.git
    - dir:.venv
    - dir:__pycache__
    - dir:experiments
    - dir:models
    - dir:results
```

This configuration:
- Anchors the AIAP22 index in the AgenticRAG schema and documents which structural relations participate in AgenticRAG-guided traversals.
- Treats `configs/graphrag/aiap22-codebase-config.yaml` as the canonical GraphRAG CLI configuration for dataset paths, chunking, embeddings, and DuckDB queries.
- Points `graph.workflow_json` at a workflow JSON-LD document (`data/graphrag/aiap22-graphrag-workflow.jsonld`) that can be generated from the same YAML using either the offline GraphRAG pipeline (`python -m knowgrph_parser graphrag-pipeline` or `canvas/src/cli/graphrag-config-to-workflow.ts`) or the Canvas Workflow tab importer.
- Allows the Toolbar Tools menu “Orchestrator → Import GraphRAG config” to load `configs/graphrag/aiap22-codebase-config.yaml` directly into the Main Panel GraphRAG workflow editor so the UI and external CLI stay aligned.

---

## 2. Structural Graph Model

### 2.1 Node Types

Nodes are synthesized directly from the Python source code using a static AST traversal exposed via `python -m knowgrph_parser python-codebase-index`:

- `File` – Python source files under `src/` (`@type: "File"`).
- `Class` – classes declared in those files (`@type: "Class"`).
- `Function` – functions and methods (`@type: "Function"`).
- `Module` – imported Python modules (`@type: "Module"`).
- `RuntimeEvent` – synthetic runtime events linked to key pipeline entrypoints (`@type: "RuntimeEvent"`).

Each node is exported as JSON-LD with an IRI-compatible identifier and path:

```json
{
  "@id": "kg:src/feature_engineering.py",
  "@type": "File",
  "name": "feature_engineering.py",
  "path": "src/feature_engineering.py",
  "labels": ["File"],
  "properties": {
    "module": "src.feature_engineering"
  },
  "metadata": {
    "source": "aiap22-codebase-index",
    "timestamp": "2025-12-24T15:50:36.887874Z",
    "codebaseId": "aiap22-hui-joo-hwee-045B",
    "codebasePath": "src/feature_engineering.py",
    "codebaseArea": "src"
  }
}
```

Class and function nodes carry additional structural properties:

- `module` – dotted Python module path.
- `qualname` – fully qualified name (including class for methods).
- `kind` – `"function"` or `"method"` for functions.
- `class` – owning class name for methods.

Example function node:

```json
{
  "@id": "kg:src/evaluation.py::function:evaluate",
  "@type": "Function",
  "name": "evaluate",
  "path": "src/evaluation.py",
  "labels": ["Function"],
  "properties": {
    "module": "src.evaluation",
    "qualname": "src.evaluation.evaluate",
    "name": "evaluate",
    "kind": "function"
  },
  "metadata": {
    "source": "aiap22-codebase-index",
    "timestamp": "2025-12-24T15:50:36.887874Z",
    "codebaseId": "aiap22-hui-joo-hwee-045B",
    "codebasePath": "src/evaluation.py",
    "codebaseArea": "src"
  }
}
```

Runtime event nodes represent call events for important pipeline entrypoints such as `src/main.py` and `src/evaluation.py`:

```json
{
  "@id": "kg:runtime:event:aiap22:evaluation",
  "@type": "RuntimeEvent",
  "name": "runtime:event:aiap22:evaluation",
  "labels": ["RuntimeEvent"],
  "properties": {
    "eventType": "call",
    "status": "ok",
    "occurredAt": "2025-12-24T15:50:36.887874Z",
    "codebaseId": "aiap22-hui-joo-hwee-045B"
  }
}
```

### 2.2 Edge Labels

Edges are emitted as adjacency properties on nodes, with JSON-LD context entries marking them as graph relations:

- `contains` – file-to-class and class-to-method containment.
- `imports` – static imports from Python files to modules.
- `calls` – intra-codebase function and method calls discovered via AST.
- `hasRuntimeEvent` – links from static code nodes to runtime event nodes.
- `runtimeOf` – inverse relation from runtime event nodes back to static nodes.

Example edges in the AIAP22 evaluation module:

```json
{
  "@id": "kg:src/evaluation.py",
  "@type": "File",
  "name": "evaluation.py",
  "path": "src/evaluation.py",
  "contains": [
    "kg:src/evaluation.py::function:auc_rank",
    "kg:src/evaluation.py::function:cls_report",
    "kg:src/evaluation.py::function:confusion",
    "kg:src/evaluation.py::function:evaluate",
    "kg:src/evaluation.py::function:evaluate_tuned",
    "kg:src/evaluation.py::function:plot_roc_pr",
    "kg:src/evaluation.py::function:specificity",
    "kg:src/evaluation.py::function:sweep_thresholds"
  ],
  "imports": [
    "kg:module:matplotlib.pyplot",
    "kg:module:numpy",
    "kg:module:sklearn.metrics"
  ],
  "hasRuntimeEvent": [
    "kg:kg:runtime:event:aiap22:evaluation"
  ]
}
```

The JSON-LD `@context` declares each edge label as an `@id` relation so that downstream tools treat these properties as graph edges rather than plain literals:

```json
{
  "@context": {
    "@vocab": "https://huijoohwee.github.io/knowgrph#",
    "schema": "https://schema.org/",
    "name": "schema:name",
    "path": "schema:path",
    "labels": "schema:additionalType",
    "properties": "https://huijoohwee.github.io/knowgrph#properties",
    "hasRuntimeEvent": {
      "@id": "https://huijoohwee.github.io/knowgrph#hasRuntimeEvent",
      "@type": "@id"
    },
    "runtimeOf": {
      "@id": "https://huijoohwee.github.io/knowgrph#runtimeOf",
      "@type": "@id"
    },
    "calls": {
      "@id": "https://huijoohwee.github.io/knowgrph#calls",
      "@type": "@id"
    },
    "contains": {
      "@id": "https://huijoohwee.github.io/knowgrph#contains",
      "@type": "@id"
    },
    "imports": {
      "@id": "https://huijoohwee.github.io/knowgrph#imports",
      "@type": "@id"
    }
  }
}
```

---

## 3. Agentic GraphRAG Metadata and Provenance

### 3.1 `@context` and AgenticRAG alignment

The AIAP22 index uses a compact JSON-LD `@context` compatible with the AgenticRAG node schema:

- `@vocab` – `https://huijoohwee.github.io/knowgrph#` for graph-specific terms.
- `schema` – `https://schema.org/` for generic metadata such as `name` and `path`.
- `graphRAGPath` – reserved for AgenticRAG path metadata (not yet populated for AIAP22).
- `chunk_text` and `embedding` – reserved for downstream RAG grounding and embeddings.
- Edge labels (`imports`, `contains`, `calls`, `hasRuntimeEvent`, `runtimeOf`) – declared as `@id` relations.

The top-level `metadata` object on the JSON-LD document anchors the graph in the AgenticRAG schema:

```json
{
  "metadata": {
    "schema": "https://huijoohwee.github.io/schema/AgenticRAG",
    "source": "aiap22-codebase-index",
    "graphType": "codebase-index",
    "codebaseId": "aiap22-hui-joo-hwee-045B",
    "ignoreCodebasePaths": [
      "dir:.git",
      "dir:.venv",
      "dir:__pycache__",
      "dir:experiments",
      "dir:models",
      "dir:results"
    ],
    "jsonLdMapping": {
      "contextEdgeProperties": ["imports", "contains", "calls", "hasRuntimeEvent", "runtimeOf"]
    },
    "layers": {
      "indexing": {
        "description": "Static index of aiap22 Python codebase: files, modules, classes, and functions."
      },
      "traversal": {
        "edgeLabels": ["imports", "contains", "calls", "hasRuntimeEvent", "runtimeOf"]
      },
      "tracing": {
        "eventTypes": ["call"],
        "linkProperties": ["hasRuntimeEvent", "runtimeOf"]
      }
    }
  }
}
```

The `jsonLdMapping.contextEdgeProperties` entry is derived from the `agentic_rag.traversal_edges` list in the orchestrator config and is used by Canvas and AgenticRAG workflows to understand which JSON-LD properties should be treated as traversable relations.

### 3.2 Per-node provenance (`metadata`)

Each node carries a `metadata` object compatible with `AgenticRagNodeProvenance`:

- `source` – `"aiap22-codebase-index"` to identify the pipeline.
- `timestamp` – export timestamp (UTC ISO-8601).
- `codebaseId` – `"aiap22-hui-joo-hwee-045B"`.
- `codebasePath` – original file path when applicable. For Python sources this is the path
  relative to the AIAP22 repository root (for example `src/evaluation.py` or
  `src/models/xgboost_model.py`), which allows dev tooling and downstream viewers to
  resolve real files via `/@fs` URLs using the configured `VITE_CODEBASE_ROOT`.
- `codebaseArea` – coarse-grained region:
  - `"src"` for `src/...` (including `src/models/...`).
  - `"models"` for top-level `models/...` artifacts such as serialized model files.
  - `"experiments"` for top-level `experiments/...`.
  - `"results"` for top-level `results/...`.
  - `"config"` for `config.yaml`.

This provenance can be surfaced directly as `provenance` inside `AgenticRagNodeView` instances without additional transformation.

---

## 4. Schema Configuration

The schema configuration in `schema-config/aiap22-codebase-index-schema.json` describes how the AIAP22 index is visualized and which properties are expected on each node type:

- Node styles:
  - `File` – blue.
  - `Module` – green.
  - `Class` – orange.
  - `Function` – indigo.
  - `RuntimeEvent` – red.
- Edge styles:
  - `imports` – dark neutral arrows for dependencies.
  - `contains` – purple arrows for structural containment.
  - `calls` – orange arrows for intra-codebase calls.
  - `hasRuntimeEvent` / `runtimeOf` – red and grey arrows for tracing links.
- Property schemas:
  - `graphRAGPath` is declared as an object for `File`, `Class`, and `Function` nodes so traversal metadata can be attached later without changing the schema.
  - `RuntimeEvent` nodes define `eventType`, `status`, and `occurredAt` string properties.

The schema remains structural and visualization-oriented; it does not enforce or interpret embeddings or RAG semantics, in line with the AgenticRAG validation rules.

---

## 5. Runtime Tracing Layer

The tracing layer links selected static nodes in the AIAP22 pipeline to synthetic runtime events:

- `RuntimeEvent` nodes are created for:
  - Calls into `src/main.py` (overall pipeline entrypoint).
  - Calls into `src/evaluation.py` (evaluation entrypoint).
- Each event records:
  - `eventType` – currently `"call"`.
  - `status` – simple status label such as `"ok"`.
  - `occurredAt` – the export timestamp.
  - `codebaseId` – `"aiap22-hui-joo-hwee-045B"`.
- Linking relations:
  - Static nodes (e.g. `src/evaluation.py`) have `hasRuntimeEvent` edges to the runtime event node IRIs.
  - Runtime event nodes have `runtimeOf` edges pointing back to static nodes.

This design demonstrates how Agentic GraphRAG can incorporate runtime telemetry while keeping the core index static and reproducible. Additional event types (e.g. `return`, `exception`) and richer status enums can be added later without changing the orchestrator wiring.

---

## 6. End-to-end Usage

From the knowgrph repository root, regenerate the AIAP22 index with:

```bash
npm run graphrag:aiap22-workflow

python -m knowgrph_parser python-codebase-index \
  -c orchestrator-config/aiap22-codebase-index-orchestrator-config.yaml \
  -b aiap22-hui-joo-hwee-045B
```

This command:

- Traverses the AIAP22 codebase under `../aiap22-hui-joo-hwee-045B`.
- Applies the ignore patterns from the orchestrator config (`.git`, `.venv`, `__pycache__`, and
  the top-level `experiments/`, `models/`, and `results/` directories). Nested Python packages
  such as `src/models/...` remain indexed so the full ML pipeline, including model
  implementations, participates in Agentic GraphRAG traversal.
- Extracts:
  - File, class, and function nodes with structural properties.
  - Module nodes for imported modules.
  - Call graph edges between functions and methods.
  - Runtime event nodes and tracing edges for key entrypoints.
- Writes `data/outputs/aiap22-codebase-index-viz.jsonld`.
- Ensures that `schema-config/aiap22-codebase-index-schema.json` and `orchestrator-config/aiap22-codebase-index-orchestrator-config.yaml` exist and are aligned with the AgenticRAG schema.

Once the index is regenerated, Canvas and external AgenticRAG workflows can load `aiap22-codebase-index-viz.jsonld` as a first-class AgenticRAG datasource, using:

- Structural edges (`imports`, `contains`, `calls`) for multi-hop reasoning over the AIAP22 ML pipeline.
- Provenance metadata (`metadata`) for auditing which code paths and files underlie each node.
- Tracing relations (`hasRuntimeEvent`, `runtimeOf`) to connect static pipeline structure with runtime behavior.
- Orchestrator traversal controls that can replay the AIAP22 `graphRAGPath` chains and a combined GraphRAG traversal over `imports`, `contains`, `calls`, `hasRuntimeEvent`, and `runtimeOf` starting from nodes such as `src/main.py`.

### 6.1 How to run the AIAP22 GraphRAG workflow

To keep the Canvas Orchestrator workflow, the GraphRAG CLI, and the AIAP22 orchestrator config in sync:

1. From the repository root, generate the GraphRAG workflow JSON-LD and update the orchestrator config:

   ```bash
   npm run graphrag:aiap22-workflow
   ```

   This reads `configs/graphrag/aiap22-codebase-config.yaml`, writes `data/graphrag/aiap22-graphrag-workflow.jsonld`, and ensures that `orchestrator-config/aiap22-codebase-index-orchestrator-config.yaml` points to both files under its `graph` section.

2. Run the AIAP22 codebase parser (if not already done) using the orchestrator config:

   ```bash
   python -m knowgrph_parser python-codebase-index \
     -c orchestrator-config/aiap22-codebase-index-orchestrator-config.yaml \
     -b aiap22-hui-joo-hwee-045B
   ```

3. In Canvas:

   - Load `data/outputs/aiap22-codebase-index-viz.jsonld` into the graph.
   - In the Workflow tab:
     - Use the GraphRAG section to import either:
       - The generated `data/graphrag/aiap22-graphrag-workflow.jsonld`, or
       - The source `configs/graphrag/aiap22-codebase-config.yaml` via the Tool Menu “Orchestrator → Import GraphRAG config” entry (which internally converts the YAML to the same workflow JSON-LD shape).
     - Treat `configs/graphrag/aiap22-codebase-config.yaml` as the canonical GraphRAG configuration: the Workflow editor reflects the same traversal, chunking, and embedding settings used by the offline AIAP22 pipeline and by `graph.workflow_json` in the orchestrator config.
   - In the Orchestrator tab:
     - Start from AIAP22 owner nodes such as `src/main.py` and `src/optimization.py::class:Optimizer`, which have `graphRAGPath` metadata defined in `orchestrator-config/aiap22-codebase-index-orchestrator-config.yaml`.
     - Use the GraphRAG traversal helpers to play the `graphRAGPath.traverse` chains and then run multi-hop traversals over `imports,contains,calls,hasRuntimeEvent,runtimeOf` from those starting points.
     - Open the AgenticRAG node inspector to inspect `chunk_text`, `graphRAGPath`, and `provenance` for the selected node.
     - When provenance includes a `codebasePath` field (for example `src/evaluation.py` or `src/models/xgboost_model.py`), click it to open the real AIAP22 file in the Bottom Panel code editor so AgenticRAG inspection stays grounded in the underlying source.
     - Run the AIAP22 DuckDB query presets for compliance, model selection, and training-pipeline call graphs that mirror the `duckdb_queries` block in `configs/graphrag/aiap22-codebase-config.yaml`.

### 6.2 CI automation via GitHub Actions

In addition to running the index and GraphRAG workflow generation locally, the AIAP22 repository (`aiap22-hui-joo-hwee-045B`) can keep the AgenticRAG view up to date via a GitHub Actions workflow:

- Workflow file: `.github/workflows/github-actions.yml` in the AIAP22 repository.
- Trigger: `on: [push, workflow_dispatch]`.
- High-level steps:
  - Run the existing AIAP22 end-to-end pipeline (install dependencies, download the dataset, execute `run.sh`).
  - Check out the `knowgrph` repository into a `knowgrph/` subdirectory of the AIAP22 workspace.
  - Install the minimal Python dependencies for knowgrph using `knowgrph/requirements.txt` (`rdflib`, `pyyaml`, `duckdb`).
  - Generate the AIAP22 GraphRAG workflow JSON-LD:

    ```yaml
    - name: Generate AIAP22 GraphRAG workflow
      working-directory: knowgrph
      run: |
        python -m knowgrph_parser graphrag-workflow
    ```

    This reads `configs/graphrag/aiap22-codebase-config.yaml`, writes `data/graphrag/aiap22-graphrag-workflow.jsonld`, and updates `orchestrator-config/aiap22-codebase-index-orchestrator-config.yaml` so its `graph.workflow_json` and `graph.graphrag_workflow` fields remain aligned.

  - Build the AIAP22 codebase index JSON-LD with the AIAP22 repository as the codebase root:

    ```yaml
    - name: Build AIAP22 codebase index JSON-LD
      working-directory: knowgrph
      run: |
        python -m knowgrph_parser python-codebase-index -c orchestrator-config/aiap22-codebase-index-orchestrator-config.yaml -r .. -b aiap22-hui-joo-hwee-045B
    ```

    Passing `-r ..` ensures that the parser treats the AIAP22 repository root as the codebase root, so `codebasePath` values are emitted as paths like `src/main.py` relative to the repo. The orchestrator config still controls traversal edges, ignore filters, and GraphRAG paths.

  - Publish the index, schema, orchestrator config, and GraphRAG workflow as build artifacts:

    ```yaml
    - name: Upload AIAP22 index artifacts
      uses: actions/upload-artifact@v4
      with:
        name: aiap22-codebase-index
        path: |
          knowgrph/data/outputs/aiap22-codebase-index-viz.jsonld
          knowgrph/schema-config/aiap22-codebase-index-schema.json
          knowgrph/orchestrator-config/aiap22-codebase-index-orchestrator-config.yaml
          knowgrph/data/graphrag/aiap22-graphrag-workflow.jsonld
    ```

This CI workflow keeps the AIAP22 Agentic GraphRAG view reproducible and discoverable:

- Every push can produce a fresh `aiap22-codebase-index` artifact bundle containing:
  - The AIAP22 codebase index JSON-LD.
  - The matching schema configuration.
  - The orchestrator binding (including traversal edges, ignore patterns, and `graphRAGPath` catalog).
  - The GraphRAG workflow JSON-LD aligned with the canonical CLI YAML.
- Canvas or external AgenticRAG tooling can download this bundle, load `aiap22-codebase-index-viz.jsonld` into the graph, and import the workflow document or YAML config into the Workflow and Orchestrator tabs to replay the same traversals that CI used to validate the pipeline.
