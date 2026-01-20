# Knowgrph Agentic RAG Demo Architecture

## Design Mantras

```
- [ ] Accessibility; enable instant experience; forbid manual configuration barriers
- [ ] Neutrality; use generic content; forbid branded or sector-specific demos
- [ ] Performance; run client-side; forbid server dependencies
- [ ] Reproducibility; use fixed seed data; forbid non-deterministic demos
- [ ] Transparency; surface metrics; forbid black-box pipeline execution
- [ ] Modularity; separate demo from core pipeline; forbid demo-specific logic in production code
```

---

## Agentic RAG Demo Architecture

**Demo Stack**: Sample Data → HTML Parser → Markdown Conversion → Agentic RAG Pipeline → Graph Extraction → Canvas Visualization

**Execution Flow**: User Trigger → Status Update → Data Loading → Pipeline Execution → Graph Construction → Curation Panel Display

**Design Principles**: Browser-Only Execution | Zero-Configuration Experience | Neutral Content | Immediate Feedback | Metrics Transparency

### High-Level Components

- **Demo Entry Point**: `handleRunDemo` in `ToolbarMenuLauncher.tsx` coordinates demo workflow and status updates.
- **Demo Runner**: `runAgenticRagDemo` in `src/__tests__/demo/runner.ts` orchestrates data loading, parsing, and pipeline execution.
- **Sample Data**: `src/__tests__/demo/data.ts` provides neutral AI Engineering Field Guide (Version 4.0) content covering Fundamentals, ML, DL, Ethics, and Practice.
- **HTML Parser**: `src/features/parsers/html-parser.ts` converts HTML to Markdown, handling collapsed sections (`<details>`) and extracting JSON-LD.
- **Agentic RAG Pipeline**: `@/features/agentic-rag` executes token linking, edge elevation, and threshold tuning entirely in browser.

### Integration Bridge: Demo Workflow → Canvas Renderer

| Demo Stage                    | Canvas Component Equivalent           | Configuration Controls                                    |
|-------------------------------|---------------------------------------|-----------------------------------------------------------|
| User Trigger                  | Toolbar "Demo" button click           | `handleRunDemo` event handler                             |
| Status Update                 | Floating Panel status message         | `setStatus("Running Agentic RAG...")`                     |
| Data Loading                  | Sample data retrieval                 | `data.ts` import                                          |
| HTML → Markdown Conversion    | HTML parser invocation                | `html-parser.ts` with `<details>` handling                |
| Pipeline Execution            | Agentic RAG pipeline run              | `DEFAULT_AGENTIC_RAG_CONFIG`                              |
| Graph Construction            | GraphData normalization               | Token linking + edge elevation + metadata attachment      |
| Visualization                 | Canvas scene rendering                | Graph layout + node styling + edge rendering              |
| Curation Panel Display        | Panel activation                      | `openCurationPanel()` on completion                       |

---

## Component Responsibility Matrix

| Layer/Subsystem       | Path/Module                                   | Component                   | Interface/Method            | Responsibility (S-V-O)                                                                        | Dependencies                          | Contracts                                         | LOC    |
|-----------------------|-----------------------------------------------|-----------------------------|-----------------------------|-----------------------------------------------------------------------------------------------|---------------------------------------|---------------------------------------------------|--------|
| Demo Trigger          | `canvas/src/features/toolbar/ToolbarMenuLauncher.tsx` | ToolbarMenuLauncher  | `handleRunDemo`             | Handler → triggers demo workflow → updates status → opens curation panel on completion        | Demo runner, status store             | Async event handler returning Promise<void>       | ~50    |
| Demo Runner           | `canvas/src/__tests__/demo/runner.ts`         | Demo Runner                 | `runAgenticRagDemo`         | Runner → loads sample data → parses HTML → executes pipeline → constructs GraphData           | Sample data, HTML parser, pipeline    | Returns `GraphData` with metadata                 | ~200   |
| Sample Data           | `canvas/src/__tests__/demo/data.ts`           | Sample Data Module          | `DEMO_HTML_CONTENT`         | Module → exports AI Engineering Field Guide HTML → covers ML/DL/Ethics/Practice topics        | None (static data)                    | Exported const string with HTML content           | ~800   |
| HTML Parser           | `canvas/src/features/parsers/html-parser.ts`  | HTML Parser                 | `parseHtml`                 | Parser → converts HTML to Markdown → extracts JSON-LD → handles `<details>` sections          | Markdown converter, JSON-LD extractor | Returns `{markdown, jsonld}` object               | ~400   |
| Agentic RAG Pipeline  | `canvas/src/features/agentic-rag/AgenticRagPipeline.ts` | AgenticRagPipeline   | `execute`                   | Pipeline → links tokens → elevates edges → tunes thresholds → attaches provenance             | NLP utilities, graph builder          | Returns `GraphData` with extraction metrics       | ~600   |
| Graph Visualizer      | `canvas/src/features/graph/GraphRenderer.tsx` | GraphRenderer               | `render`                    | Renderer → layouts nodes → styles entities → renders edges → displays metrics                 | GraphData, schema-config              | React component with canvas scene                 | ~1000  |

---

## Demo Workflow Specifications

### Workflow Stage 1: User Trigger

**From Toolbar → Demo Initiation**: User clicks "Demo" button (MonitorPlay icon) in Toolbar "Workspace Actions" section → triggers `handleRunDemo` → updates status to "Running Agentic RAG..." → disables UI interactions.

**Configuration Schema**:

```yaml
demo.triggerButton.icon:
  scope: ui_global
  type: React component
  mutability: deployment_configurable
  validation: must be valid Lucide React icon
  impact: visual representation of demo trigger (default: MonitorPlay)

demo.triggerButton.label:
  scope: ui_global
  type: string
  mutability: deployment_configurable
  validation: non-empty string
  impact: accessible label for demo button (default: "Demo")
```

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Button Rendering      | Display demo trigger          | - [ ] Render MonitorPlay icon with label; forbid unlabeled buttons                         | `ToolbarMenuLauncher`     | `renderDemoButton`   | void                      | React element         | JSX button with icon + label            |
| Click Handling        | Initiate demo workflow        | - [ ] Attach onClick handler; call `handleRunDemo`; forbid missing event handler           | `ToolbarMenuLauncher`     | `handleRunDemo`      | click event               | Promise<void>         | async function invocation               |
| Status Update         | Inform user of progress       | - [ ] Set status to "Running Agentic RAG..."; forbid silent execution                      | `handleRunDemo`           | `setStatus`          | status string             | void                  | status store update                     |

---

### Workflow Stage 2: Data Loading

**From Sample Data → HTML Content**: Demo runner imports `DEMO_HTML_CONTENT` from `data.ts` → validates non-empty HTML → passes to HTML parser.

**Sample Data Schema**:

```yaml
DEMO_HTML_CONTENT:
  scope: demo_global
  type: string (HTML)
  mutability: immutable (static export)
  validation: must be valid HTML with semantic structure
  impact: source content for Agentic RAG extraction

contentStructure:
  sections:
    - Fundamentals (Python, SQL)
    - Machine Learning (Scikit-learn)
    - Deep Learning (TensorFlow, PyTorch)
    - Ethics and Responsible AI
    - Practice and Application
  format: HTML with <details> collapsed sections
  size: ~800 LOC HTML
```

**Content Neutrality**:

| Neutrality Aspect     | Implementation                                                  |
|-----------------------|-----------------------------------------------------------------|
| Domain-Agnostic       | AI Engineering Field Guide covers general ML/DL topics          |
| No Branding           | Content references generic tools (Python, SQL, TensorFlow)      |
| Reusable Structure    | HTML follows semantic standards (`<details>`, `<section>`)      |
| Stable Fixture        | Static content ensures reproducible demo runs                   |

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Data Import           | Load sample HTML              | - [ ] Import `DEMO_HTML_CONTENT` from `data.ts`; forbid runtime data fetching              | `runAgenticRagDemo`       | N/A (import)         | void                      | HTML string           | ES module import                        |
| Content Validation    | Ensure non-empty data         | - [ ] Assert HTML length > 0; forbid empty content                                         | `runAgenticRagDemo`       | `validateHtml`       | HTML string               | boolean valid         | length check assertion                  |

---

### Workflow Stage 3: HTML → Markdown Conversion

**From HTML → Markdown + JSON-LD**: HTML parser processes `DEMO_HTML_CONTENT` → converts to Markdown → extracts JSON-LD metadata → handles `<details>` collapsed sections → outputs `{markdown, jsonld}`.

**Parser Configuration**:

```yaml
htmlParser.detailsHandling:
  scope: parser_specific
  type: string (enum: "expand" | "preserve" | "remove")
  mutability: deployment_configurable
  validation: valid handling mode
  impact: controls how <details> sections are processed (default: "expand")

htmlParser.jsonldExtraction:
  scope: parser_specific
  type: boolean
  mutability: deployment_configurable
  validation: boolean
  impact: enables JSON-LD script tag extraction (default: true)
```

**Processing Flow**:

| Stage                    | Input                          | Output                         | Responsibility                                              | Performance Consideration                    |
|--------------------------|--------------------------------|--------------------------------|-------------------------------------------------------------|----------------------------------------------|
| HTML Parsing             | HTML string                    | DOM tree                       | Parse HTML into traversable document structure              | O(n) HTML parsing with browser DOM APIs      |
| Details Expansion        | DOM tree with `<details>`      | Expanded DOM tree              | Expand collapsed sections for full content extraction       | O(k) where k = <details> elements            |
| Markdown Conversion      | Expanded DOM tree              | Markdown string                | Convert semantic HTML to Markdown preserving structure      | O(n) DOM traversal with node type mapping    |
| JSON-LD Extraction       | DOM tree                       | JSON-LD object or null         | Extract `<script type="application/ld+json">` content       | O(script tags) with JSON parsing             |

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Details Expansion     | Extract full content          | - [ ] Expand all `<details>` elements; convert to visible sections; forbid collapsed content loss | `html-parser`             | `expandDetails`      | DOM tree                  | expanded DOM          | querySelectorAll + open attribute set   |
| Markdown Conversion   | Preserve semantic structure   | - [ ] Map HTML elements to Markdown; maintain hierarchy; forbid lossy conversion            | `html-parser`             | `convertToMarkdown`  | DOM tree                  | Markdown string       | recursive DOM traversal + syntax mapping|
| JSON-LD Extraction    | Capture metadata              | - [ ] Extract JSON-LD scripts; parse JSON; forbid ignoring metadata                        | `html-parser`             | `extractJsonLd`      | DOM tree                  | JSON-LD object or null| script tag query + JSON.parse           |

---

### Workflow Stage 4: Agentic RAG Pipeline Execution

**From Markdown → Knowledge Graph**: Agentic RAG Pipeline processes Markdown → performs token linking → elevates edges with confidence scores → tunes thresholds → attaches provenance metadata → constructs GraphData.

**Pipeline Configuration**:

```yaml
DEFAULT_AGENTIC_RAG_CONFIG.tokenLinking:
  scope: pipeline_global
  type: object
  mutability: deployment_configurable
  validation: must define entity extraction parameters
  impact: controls entity identification and mention tracking

DEFAULT_AGENTIC_RAG_CONFIG.edgeElevation:
  scope: pipeline_global
  type: object
  mutability: deployment_configurable
  validation: must define relationship extraction thresholds
  impact: controls edge confidence scoring and filtering

DEFAULT_AGENTIC_RAG_CONFIG.thresholdTuning:
  scope: pipeline_global
  type: object
  mutability: deployment_configurable
  validation: must define dynamic parameter adjustment rules
  impact: adapts extraction based on text characteristics
```

**Pipeline Stages**:

| Stage                    | Input                          | Output                         | Responsibility                                              | Performance Consideration                    |
|--------------------------|--------------------------------|--------------------------------|-------------------------------------------------------------|----------------------------------------------|
| Token Linking            | Markdown text                  | Entity nodes with provenance   | Identify entities, track line numbers, compute mention counts| O(n * m) where n = tokens, m = entity patterns|
| Edge Elevation           | Entity nodes                   | Relationship edges             | Extract relationships, assign confidence scores              | O(e * p) where e = entities, p = patterns    |
| Threshold Tuning         | Text characteristics           | Adjusted parameters            | Dynamically tune extraction based on density, complexity     | O(1) statistical analysis of text            |
| Graph Construction       | Entities + Edges + Metadata    | GraphData                      | Normalize to AgenticRAG schema, attach extraction metrics    | O(n + m) node/edge iteration                 |

**Extraction Metrics**:

```yaml
metadata.extractionMetrics.entityDensity:
  scope: graph_global
  type: number
  mutability: immutable
  validation: ratio of entities to total tokens
  impact: indicates content richness for entity extraction

metadata.extractionMetrics.relationshipCount:
  scope: graph_global
  type: number
  mutability: immutable
  validation: count of extracted edges
  impact: indicates relationship extraction success

metadata.extractionMetrics.averageConfidence:
  scope: graph_global
  type: number
  mutability: immutable
  validation: mean confidence score across edges
  impact: indicates relationship extraction quality
```

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Token Linking         | Extract entities              | - [ ] Identify named entities; track line numbers; forbid position loss                    | `AgenticRagPipeline`      | `linkTokens`         | Markdown text             | entity nodes          | NER + line number tracking              |
| Edge Elevation        | Extract relationships         | - [ ] Find entity co-occurrences; compute confidence; forbid low-confidence edges          | `AgenticRagPipeline`      | `elevateEdges`       | entity nodes              | relationship edges    | co-occurrence analysis + scoring        |
| Threshold Tuning      | Adapt to content              | - [ ] Analyze text density; adjust thresholds; forbid static parameters                    | `AgenticRagPipeline`      | `tuneThresholds`     | text statistics           | updated config        | density-based parameter adjustment      |
| Metric Attachment     | Record extraction stats       | - [ ] Compute entity density, relationship counts; attach to metadata; forbid missing metrics| `AgenticRagPipeline`      | `attachMetrics`      | graph data                | enriched GraphData    | statistical calculation + metadata merge|

---

### Workflow Stage 5: Graph Visualization

**From GraphData → Canvas Display**: Canvas renderer receives GraphData → applies layout algorithm → styles nodes by type → renders edges with confidence weights → displays extraction metrics → opens Curation panel.

**Visualization Configuration**:

```yaml
demo.visualization.layout:
  scope: demo_global
  type: string (enum: "force" | "radial" | "tree")
  mutability: runtime_configurable
  validation: valid layout mode
  impact: initial graph layout for demo (default: "force")

demo.visualization.autoOpenCuration:
  scope: demo_global
  type: boolean
  mutability: deployment_configurable
  validation: boolean
  impact: automatically open Curation panel on completion (default: true)
```

**Rendering Flow**:

| Stage                    | Input                          | Output                         | Responsibility                                              | Performance Consideration                    |
|--------------------------|--------------------------------|--------------------------------|-------------------------------------------------------------|----------------------------------------------|
| Graph Layout             | GraphData                      | Positioned nodes               | Apply force-directed or other layout algorithm               | O(n² iterations) for force layout            |
| Node Styling             | Entity nodes                   | Styled node visuals            | Apply colors, sizes based on entity type and metrics         | O(n) node iteration                          |
| Edge Rendering           | Relationship edges             | Styled edge visuals            | Render edges with confidence-based opacity or width          | O(m) edge iteration                          |
| Metrics Display          | Extraction metrics             | Metrics overlay or panel       | Show entity density, relationship counts in UI               | O(1) metric rendering                        |
| Curation Panel Opening   | Completion event               | Panel activation               | Open Curation panel for graph inspection and editing         | O(1) panel state update                      |

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Layout Application    | Position nodes                | - [ ] Apply layout algorithm; compute positions; forbid overlapping nodes                  | `GraphRenderer`           | `applyLayout`        | GraphData                 | positioned nodes      | force simulation or hierarchical layout |
| Node Styling          | Differentiate entities        | - [ ] Style by entity type; use semantic colors; forbid uniform styling                    | `GraphRenderer`           | `styleNodes`         | nodes, schema-config      | styled nodes          | type-based color/size lookup            |
| Edge Rendering        | Show relationships            | - [ ] Render edges with confidence weights; forbid unlabeled edges                         | `GraphRenderer`           | `renderEdges`        | edges                     | canvas drawing        | confidence → opacity/width mapping      |
| Panel Activation      | Enable curation               | - [ ] Open Curation panel on completion; forbid leaving user without next action           | `handleRunDemo`           | `openCurationPanel`  | void                      | void (panel update)   | panel state setter                      |

---

## Demo Data Specifications

### AI Engineering Field Guide (Version 4.0)

**Content Coverage**:

| Section                | Topics                                          | Purpose                                      |
|------------------------|-------------------------------------------------|----------------------------------------------|
| Fundamentals           | Python, SQL, Data Structures                    | Foundation for ML/AI engineering             |
| Machine Learning       | Scikit-learn, Model Selection, Evaluation       | Classical ML techniques and tools            |
| Deep Learning          | TensorFlow, PyTorch, Neural Networks            | Modern deep learning frameworks              |
| Ethics                 | Bias, Fairness, Responsible AI                  | Ethical considerations in AI development     |
| Practice               | Deployment, Monitoring, Production ML           | Real-world application and operations        |

**HTML Structure**:

```yaml
htmlStructure.detailsSections:
  scope: content_organization
  type: array (<details> elements)
  mutability: immutable (static content)
  validation: each section has <summary> and content
  impact: enables progressive disclosure in demo content

htmlStructure.semanticMarkup:
  scope: content_organization
  type: HTML5 semantic elements
  mutability: immutable
  validation: valid HTML5 structure
  impact: ensures clean Markdown conversion
```

**Neutrality Requirements**:

| Requirement           | Implementation                                  | Rationale                                    |
|-----------------------|-------------------------------------------------|----------------------------------------------|
| No Vendor Lock-In     | References open-source tools (Python, TensorFlow)| Avoids commercial product promotion          |
| Domain-Agnostic       | Covers general AI/ML topics, not specific industry | Applicable across sectors                  |
| Educational Focus     | Structured as field guide with learning progression | Suitable for diverse user backgrounds      |
| Stable Content        | Static HTML fixture, no external dependencies    | Ensures reproducible demo experience         |

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Content Authoring     | Provide neutral demo data     | - [ ] Use open-source tool references; cover broad topics; forbid vendor-specific content  | `data.ts`                 | N/A (static content) | N/A                       | HTML string           | Manual content curation                 |
| HTML Validation       | Ensure clean structure        | - [ ] Validate semantic HTML5; check `<details>` structure; forbid malformed markup        | Content validation        | `validateHtml`       | HTML string               | validation result     | HTML parser + schema check              |

---

## Configuration and Customization

### Demo Configuration Options

**Configuration Schema**:

```yaml
demo.enableQuickStart:
  scope: deployment_global
  type: boolean
  mutability: deployment_configurable
  validation: boolean
  impact: enables/disables Demo button in toolbar (default: true)

demo.sampleDataSource:
  scope: deployment_global
  type: string (enum: "builtin" | "url" | "custom")
  mutability: deployment_configurable
  validation: valid data source type
  impact: controls where demo data is loaded from (default: "builtin")

demo.customDataUrl:
  scope: deployment_global
  type: string (URL)
  mutability: deployment_configurable
  validation: valid HTTP(S) URL when sampleDataSource="url"
  impact: external URL for custom demo content

demo.pipelineConfig:
  scope: demo_global
  type: object
  mutability: deployment_configurable
  validation: must match AgenticRagConfig schema
  impact: overrides DEFAULT_AGENTIC_RAG_CONFIG for demo runs
```

**Customization Workflow**:

| Step | Action                                  | Configuration Change                         | Impact                                       |
|------|-----------------------------------------|----------------------------------------------|----------------------------------------------|
| 1    | Disable demo feature                    | Set `demo.enableQuickStart: false`           | Hides Demo button from toolbar               |
| 2    | Use external demo data                  | Set `demo.sampleDataSource: "url"`           | Fetches content from `demo.customDataUrl`    |
| 3    | Adjust extraction thresholds            | Override `demo.pipelineConfig`               | Customizes entity/relationship extraction    |
| 4    | Change visualization layout             | Set `demo.visualization.layout: "radial"`    | Uses radial layout instead of force-directed |

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Config Loading        | Read demo settings            | - [ ] Load config from deployment settings; forbid hardcoded config                        | Demo runner               | `loadDemoConfig`     | void                      | config object         | settings import + merge with defaults   |
| External Data Fetch   | Support custom content        | - [ ] Fetch from URL when configured; handle errors; forbid silent failures                | Demo runner               | `fetchCustomData`    | URL string                | HTML string           | fetch API + error handling              |
| Config Validation     | Ensure valid settings         | - [ ] Validate config schema; check required fields; forbid invalid configurations         | Config validator          | `validateDemoConfig` | config object             | validation result     | JSON schema validation                  |

---

## Status Handling and User Feedback

### Status Update Mechanism

**Status Flow**: Demo Start → "Running Agentic RAG..." → Pipeline Execution → "Extracting entities..." → "Building graph..." → Completion → "Demo complete" → Curation Panel Opens

**Configuration Schema**:

```yaml
demo.statusMessages.running:
  scope: ui_global
  type: string
  mutability: deployment_configurable
  validation: non-empty string
  impact: status message during pipeline execution (default: "Running Agentic RAG...")

demo.statusMessages.extracting:
  scope: ui_global
  type: string
  mutability: deployment_configurable
  validation: non-empty string
  impact: status message during entity extraction (default: "Extracting entities...")

demo.statusMessages.building:
  scope: ui_global
  type: string
  mutability: deployment_configurable
  validation: non-empty string
  impact: status message during graph construction (default: "Building graph...")

demo.statusMessages.complete:
  scope: ui_global
  type: string
  mutability: deployment_configurable
  validation: non-empty string
  impact: status message on completion (default: "Demo complete")
```

**Progress Indicators**:

| Stage                    | Status Message                 | UI Element                    | Duration Estimate          |
|--------------------------|--------------------------------|-------------------------------|----------------------------|
| Initialization           | "Running Agentic RAG..."       | Floating Panel status line    | ~100ms                     |
| Entity Extraction        | "Extracting entities..."       | Floating Panel status line    | ~500ms - 2s                |
| Relationship Extraction  | "Building graph..."            | Floating Panel status line    | ~300ms - 1s                |
| Completion               | "Demo complete"                | Floating Panel status line    | Momentary before panel open|

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Status Update         | Inform user of progress       | - [ ] Update status at each stage; forbid silent execution                                 | `handleRunDemo`           | `setStatus`          | status string             | void                  | status store update                     |
| Progress Estimation   | Set user expectations         | - [ ] Provide realistic duration estimates; forbid indefinite waits                        | Demo runner               | N/A (timing-based)   | N/A                       | N/A                   | Stage-based status updates              |
| Error Handling        | Graceful failure              | - [ ] Catch pipeline errors; show error status; forbid silent failures                     | `handleRunDemo`           | `handleDemoError`    | error object              | void                  | try/catch + error status update         |

---

## Testing & Quality Standards

**Test Coverage Metrics**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Demo Execution       | Validate end-to-end workflow    | - [ ] Test full demo run; verify graph output; forbid untested pipeline stages            |
| HTML Parsing         | Ensure clean conversion         | - [ ] Test `<details>` handling; verify Markdown output; forbid malformed conversion      |
| Pipeline Integration | Validate Agentic RAG execution  | - [ ] Test token linking, edge elevation; verify metrics; forbid missing extraction tests |

**Test Categories**:

- **Unit Tests**: HTML parser, status updates, config loading.
- **Integration Tests**: Full demo workflow from button click to graph display.
- **Performance Tests**: Pipeline execution time, memory usage during demo.

**Quality Gates**:

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Execution Time       | Ensure responsive demo          | - [ ] Target <5s for full demo run; forbid slow pipeline configurations                   |
| Graph Quality        | Validate extraction output      | - [ ] Assert minimum entity/edge counts; forbid empty graphs                               |
| Error Recovery       | Handle failures gracefully      | - [ ] Test with malformed data; verify error messages; forbid crashes                     |

---

## Repository Health Checklist

**Demo Health**:

| Context              | Status | Directive                                                                                   |
|----------------------|--------|---------------------------------------------------------------------------------------------|
| Sample Data Currency | ☐      | - [ ] Review demo content annually; update to current ML/AI practices; forbid outdated content |
| Pipeline Performance | ☐      | - [ ] Monitor demo execution time; optimize if >5s; forbid degraded performance            |
| Browser Compatibility| ☐      | - [ ] Test in Chrome, Firefox, Safari; verify client-side execution; forbid browser-specific failures |

**User Experience Health**:

| Context              | Status | Directive                                                                                   |
|----------------------|--------|---------------------------------------------------------------------------------------------|
| Status Messages      | ☐      | - [ ] Verify status updates at each stage; forbid silent execution gaps                    |
| Error Messages       | ☐      | - [ ] Test error scenarios; verify user-friendly messages; forbid cryptic errors           |
| Curation Panel UX    | ☐      | - [ ] Verify panel opens on completion; check graph visibility; forbid empty panel display |

---

## Anti-Patterns (Forbidden)

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Server Dependencies  | Enable offline demo             | - [ ] Execute pipeline client-side; forbid server API calls for demo                       |
| Hardcoded Content    | Enable customization            | - [ ] Load from `data.ts`; support external URLs; forbid inline HTML in demo runner        |
| Blocking UI          | Maintain responsiveness         | - [ ] Use async pipeline execution; show progress; forbid synchronous blocking             |
| Missing Metrics      | Enable transparency             | - [ ] Attach extraction metrics to GraphData; forbid opaque pipeline results               |
| Silent Failures      | Inform users of errors          | - [ ] Show error status on failure; log errors; forbid silent failure without notification |

---

## Performance Optimization

### Client-Side Execution Constraints

**Browser Performance Targets**:

| Metric                  | Target Value | Constraint Reasoning                                      |
|-------------------------|--------------|-----------------------------------------------------------|
| Total Demo Time         | <5 seconds   | Maintain user engagement, prevent perceived hang          |
| Entity Extraction Time  | <2 seconds   | NLP processing in browser must be efficient               |
| Graph Construction Time | <1 second    | Node/edge normalization should be fast                    |
| Memory Usage            | <100 MB      | Avoid browser memory pressure during demo                 |

**Optimization Strategies**:

| Strategy                | Implementation                                  | Performance Gain                    |
|-------------------------|-------------------------------------------------|-------------------------------------|
| Lazy NLP Loading        | Load NLP models on demand, cache in memory      | Reduces initial load time           |
| Threshold Pre-Tuning    | Use pre-computed thresholds for demo content    | Eliminates tuning computation       |
| Progressive Rendering   | Render graph incrementally as entities extracted| Provides immediate visual feedback  |
| Web Workers (Future)    | Offload pipeline to worker thread               | Prevents main thread blocking       |

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Performance Monitoring| Track execution time          | - [ ] Record stage durations; log to metrics; forbid unmonitored performance               | Demo runner               | `recordStageTime`    | stage name, start time    | duration metric       | Date.now() subtraction + logging        |
| Memory Management     | Avoid memory leaks            | - [ ] Clear temp data after demo; forbid uncleaned references                              | Demo runner               | `cleanupDemo`        | void                      | void                  | variable nulling + GC hint              |
| Lazy Loading          | Defer heavy resources         | - [ ] Load NLP models on first demo run; cache; forbid eager loading                       | Pipeline initializer      | `lazyLoadNlpModels`  | void                      | Promise<models>       | conditional import + caching            |

---

## Data Flow: Demo Execution Pipeline

**Pipeline**: User Click → Status Update → Data Load → HTML Parse → Markdown Convert → Token Link → Edge Elevate → Threshold Tune → Graph Build → Canvas Render → Curation Open

| Stage                    | Input                          | Output                         | Responsibility                                              | Performance Consideration                    |
|--------------------------|--------------------------------|--------------------------------|-------------------------------------------------------------|----------------------------------------------|
| User Click               | Button click event             | Demo workflow trigger          | Capture user intent to run demo                              | O(1) event handler                           |
| Status Update            | Workflow trigger               | Status message                 | Display "Running Agentic RAG..." to user                     | O(1) store update                            |
| Data Load                | Demo workflow trigger          | HTML string                    | Import or fetch demo content                                 | O(1) static import or O(n) fetch             |
| HTML Parse               | HTML string                    | DOM tree                       | Parse HTML for processing                                    | O(n) HTML parsing                            |
| Markdown Convert         | DOM tree                       | Markdown string                | Convert HTML to Markdown                                     | O(n) DOM traversal                           |
| Token Link               | Markdown string                | Entity nodes with provenance   | Extract entities and track positions                         | O(n * m) NER processing                      |
| Edge Elevate             | Entity nodes                   | Relationship edges             | Extract relationships with confidence scores                 | O(e * p) relationship extraction             |
| Threshold Tune           | Text statistics                | Adjusted config                | Optimize extraction parameters                               | O(1) statistical analysis                    |
| Graph Build              | Entities + Edges + Metadata    | GraphData                      | Normalize to AgenticRAG schema                               | O(n + m) node/edge iteration                 |
| Canvas Render            | GraphData                      | Visual graph scene             | Layout and render graph                                      | O(n² iterations) force layout                |
| Curation Open            | Completion event               | Panel activation               | Open Curation panel for interaction                          | O(1) panel state update                      |

---

## Future Enhancements

**Potential Improvements**:

| Enhancement             | Description                                     | Benefit                                      | Complexity  |
|-------------------------|-------------------------------------------------|----------------------------------------------|-------------|
| Multi-Sample Demos      | Provide multiple demo content options           | Showcase different extraction scenarios      | Medium      |
| Interactive Tuning      | Allow real-time threshold adjustment during demo| Educational insight into pipeline parameters | High        |
| Export Demo Results     | Enable saving demo graph as starter template    | Facilitate onboarding workflow               | Low         |
| Comparison View         | Side-by-side comparison of extraction configs   | Demonstrate tuning impact                    | Medium      |
| Web Worker Execution    | Offload pipeline to background thread           | Prevent UI blocking on large demos           | High        |

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|
| Multi-Sample Support  | Enable diverse demonstrations | - [ ] Design sample catalog; support selection UI; forbid hardcoded single sample          |
| Interactive Tuning    | Provide learning experience   | - [ ] Add tuning controls; re-run extraction; forbid static-only demo                      |
| Export Functionality  | Bridge demo to production     | - [ ] Serialize GraphData; offer download; forbid locked demo results                      |