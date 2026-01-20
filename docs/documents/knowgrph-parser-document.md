# Knowgrph Client-Side Parsers: Universal Format Specification

## Design Mantras

```
- [ ] Extensibility; register new parsers; forbid hardcoded format list
- [ ] Modularity; isolate format logic; forbid parser interdependencies
- [ ] Neutrality; preserve source structure; forbid format assumptions
- [ ] Ordering; match by capability; forbid ambiguous dispatch
- [ ] Provenance; track source locations; forbid lossy line mapping
- [ ] Robustness; handle malformed input; forbid parse crashes
- [ ] Transparency; expose conversion steps; forbid hidden transformations
```

---

## Universal Design Principles

| Context             | Intent                              | Directive                                                                                      |
|---------------------|-------------------------------------|------------------------------------------------------------------------------------------------|
| Capability Matching | Select appropriate parser           | - [ ] Match by format signature; first-match wins; forbid multi-match ambiguity              |
| Format Neutrality   | Support any structure               | - [ ] Parse without domain assumptions; forbid dataset-specific logic                         |
| Layer Metadata      | Provide rendering hints             | - [ ] Emit neutral layer specs; forbid renderer coupling                                      |
| Line Preservation   | Maintain source mapping             | - [ ] Record 1-based line ranges; forbid lossy tokenization                                   |
| Media Detection     | Extract multimedia references       | - [ ] Parse all media types; forbid format-specific extraction                                |
| Parser Registration | Centralize format handling          | - [ ] Register all parsers; dispatch by capability; forbid scattered parser logic             |
| Property Mapping    | Preserve all attributes             | - [ ] Copy fields to properties; forbid selective copying                                     |
| Schema Generation   | Derive from parsed structure        | - [ ] Build schema from graph; forbid hardcoded schemas                                       |
| Token Sharing       | Optimize parsing                    | - [ ] Share tokens across components; forbid redundant tokenization                           |

---

## Parser Architecture

**Parser Stack**: Registry → Capability Matching → Format Dispatch → Structure Parsing → Graph Construction → Metadata Enrichment

**Processing Flow**: Format Detection → Parser Selection → Tokenization → JSON-LD Building → GraphData Conversion → Layer Derivation

**Design Principles**: First-match ordering | Format-agnostic structures | Provenance preservation | Shared tokenization

### Parser Registry

**Registration Order** (first-match precedence): CSV → JSON-LD → JSON → n8n → Markdown → Python → GraphRAG

**Selection Algorithm**: Iterate registered parsers → test canParse predicate → return first match → fallback to error

| Parser Type  | Capability Predicate                     | Output Format           | Typical Extensions        |
|--------------|------------------------------------------|-------------------------|---------------------------|
| CSV          | Text contains comma-delimited rows       | GraphData (tabular)     | .csv                      |
| JSON-LD      | Has @context field                       | GraphData (from @graph) | .jsonld                   |
| JSON         | Has nodes/edges or valid JSON structure  | GraphData (normalized)  | .json                     |
| n8n          | Has workflowInfo field                   | GraphData (workflow)    | .json (n8n export)        |
| Markdown     | Markdown blocks detected                 | JSON-LD → GraphData     | .md, .markdown            |
| Python       | Python AST parseable                     | GraphData (code graph)  | .py                       |
| GraphRAG     | Has graphRAG workflow structure          | GraphData (workflow)    | .json (GraphRAG export)   |

---

## Component Specifications

### Component: Parser Registry

**Responsibility**: Maintains ordered list of parsers and dispatches to first matching parser.

**Selection Strategy**: First-match ordered iteration over registered parsers with capability predicates.

| Context              | Intent                          | Directive                                                                                   | Module           | Class/Object    | Function/Method         | Dependency     | Input                        | Output                 | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|------------------|-----------------|-------------------------|----------------|------------------------------|------------------------|----------------------------------|
| Parser Registration  | Build parser list               | - [ ] Register in precedence order; forbid unordered registration                          | default.ts       | ParserRegistry  | registerParsers         | —              | Parser spec list             | Registry instance      | Array push in order              |
| Capability Testing   | Check format match              | - [ ] Test canParse predicate; forbid multi-match                                          | default.ts       | ParserRegistry  | testCapability          | —              | Text, parser spec            | Boolean (can parse)    | Predicate evaluation             |
| Parser Dispatch      | Select and invoke parser        | - [ ] Find first match; call parse method; forbid fallthrough without match               | default.ts       | ParserRegistry  | dispatchParser          | —              | Text, name                   | GraphData or error     | Find + invoke pattern            |
| Fallback Handling    | Handle no match                 | - [ ] Return descriptive error; suggest formats; forbid silent failure                     | default.ts       | ParserRegistry  | handleNoMatch           | —              | Text                         | Error object           | Error construction with hints    |

---

### Component: Markdown Parser

**Responsibility**: Parses Markdown to JSON-LD with structural and semantic layers, then converts to GraphData.

**Layer Emission**: documentStructure (nodes/edges for structure) + semantic (entities/co-occurrence) + provenance (line ranges)

| Context              | Intent                          | Directive                                                                                   | Module           | Class/Object    | Function/Method         | Dependency       | Input                        | Output                 | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|------------------|-----------------|-------------------------|------------------|------------------------------|------------------------|----------------------------------|
| Block Parsing        | Tokenize Markdown               | - [ ] Split by headers/paragraphs/code/tables; preserve order; forbid block loss          | markdown-it      | BlockParser     | parseBlocks             | markdown-it      | Markdown text                | Token list             | Regex/state machine tokenization |
| Structure Building   | Create document nodes           | - [ ] Build Document/Section/Paragraph nodes; link hierarchically; forbid orphaned nodes  | graph_builder    | StructureBuilder| buildStructure          | —                | Block list                   | JSON-LD @graph         | Hierarchical node creation       |
| Media Extraction     | Parse inline references         | - [ ] Extract ![](url), <img>, <video>, <iframe>; resolve URLs; forbid broken refs       | graph_builder    | MediaExtractor  | extractMedia            | URL resolver     | Block content, base URL      | Media node list        | Regex extraction with resolution |
| Semantic Processing  | Extract entities                | - [ ] Identify entities; compute co-occurrence; forbid domain vocabularies                | semantic_processor| EntityExtractor| extractEntities         | NLP features     | Text spans                   | Entity list            | Statistical feature-based        |
| Line Mapping         | Preserve source positions       | - [ ] Record lineStart/lineEnd; 1-based; forbid 0-based or missing ranges                | graph_builder    | LineMapper      | mapLineRanges           | —                | Token positions              | Line range metadata    | Token position to line number    |
| Layer Metadata       | Emit rendering hints            | - [ ] Populate metadata.layers; specify node/edge types; forbid renderer assumptions      | graph_builder    | MetadataBuilder | buildLayerMetadata      | —                | Graph structure              | Metadata object        | Type enumeration and categorization|
| JSON-LD Conversion   | Build JSON-LD                   | - [ ] Emit @context, @graph; follow JSON-LD spec; forbid malformed JSON-LD               | graph_builder    | JSONLDBuilder   | buildMarkdownJsonLd     | —                | Nodes, edges, metadata       | JSON-LD document       | JSON-LD structure assembly       |
| GraphData Conversion | Convert to GraphData            | - [ ] Parse JSON-LD to GraphData; preserve properties; forbid property loss               | parseJsonLd      | GraphDataConverter| convertToGraphData   | —                | JSON-LD document             | GraphData              | JSON-LD interpretation rules     |
| Metrics Tracking     | Record parse timing             | - [ ] Measure buildMarkdownJsonLd, parseJsonLd; store in metadata; forbid unmeasured ops | graph_builder    | MetricsTracker  | trackMetrics            | performance      | Start/end timestamps         | Metrics object         | Delta calculation                |

**Mermaid Support**:

| Context              | Intent                          | Directive                                                                                   | Module           | Class/Object    | Function/Method         | Dependency       | Input                        | Output                 | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|------------------|-----------------|-------------------------|------------------|------------------------------|------------------------|----------------------------------|
| Node Shape Parsing   | Support all Mermaid shapes      | - [ ] Parse [], (), [[]], {}, etc.; forbid unsupported shapes                             | mermaid_parser   | ShapeParser     | parseNodeShape          | —                | Mermaid node text            | Shape type             | Regex match against shape patterns|
| Edge Parsing         | Handle complex edges            | - [ ] Parse o--o, x--x, <-->; forbid edge parse errors                                    | mermaid_parser   | EdgeParser      | parseEdge               | —                | Mermaid edge text            | Edge object            | Pattern matching with symbols    |
| Subgraph Handling    | Support nested graphs           | - [ ] Parse subgraph blocks; maintain hierarchy; forbid subgraph loss                     | mermaid_parser   | SubgraphParser  | parseSubgraph           | —                | Mermaid block                | Subgraph structure     | Recursive descent                |
| Class Application    | Apply style definitions         | - [ ] Parse classDef; apply to nodes; forbid class mismatch                               | mermaid_parser   | ClassApplier    | applyClasses            | —                | Class defs, nodes            | Styled nodes           | Class name matching              |

---

### Component: HTML → Markdown Converter

**Responsibility**: Converts HTML documents to Markdown while preserving structure and media.

**Conversion Strategy**: Parse DOM → map tags to Markdown syntax → resolve URLs → emit Markdown

| Context              | Intent                          | Directive                                                                                   | Module           | Class/Object    | Function/Method         | Dependency     | Input                        | Output                 | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|------------------|-----------------|-------------------------|----------------|------------------------------|------------------------|----------------------------------|
| DOM Parsing          | Parse HTML structure            | - [ ] Use DOMParser; traverse tree; forbid malformed HTML                                 | html-parser      | DOMParser       | parseHTML               | DOMParser      | HTML text                    | DOM tree               | DOMParser.parseFromString        |
| Tag Mapping          | Convert tags to Markdown        | - [ ] Map h1→#, p→text, ul→bullets; forbid lossy mapping                                 | html-parser      | TagMapper       | mapTagToMarkdown        | —              | DOM node                     | Markdown syntax        | Switch on tag name               |
| Media Extraction     | Extract media elements          | - [ ] Find img/video/iframe; convert to ![](url); forbid media loss                       | html-parser      | MediaMapper     | extractMediaTags        | —              | DOM tree                     | Markdown markers       | Query selector then convert      |
| URL Resolution       | Resolve relative URLs           | - [ ] Resolve src/href against base; forbid broken links                                  | html-parser      | URLResolver     | resolveRelativeURL      | URL parser     | URL, base URL                | Absolute URL           | URL.resolve()                    |
| JSON-LD Extraction   | Extract embedded metadata       | - [ ] Find script[type=ld+json]; parse; forbid malformed JSON                             | html-parser      | JSONLDExtractor | extractJsonLd           | JSON parser    | DOM tree                     | JSON-LD object         | Script tag query + JSON.parse    |
| Safe HTML Rendering  | Render HTML blocks safely       | - [ ] Parse with DOMParser; validate sources; forbid XSS                                  | MarkdownHtmlBlock| SafeRenderer    | renderSafeHtmlBlock     | DOMParser      | HTML block, base URL         | React elements         | DOM traversal with safety checks |

---

### Component: JSON-LD Parser

**Responsibility**: Interprets JSON-LD documents as graph structures with AgenticRAG context support.

**Context Handling**: Detect @context URL → apply AgenticRAG rules if canonical → preserve all properties

| Context              | Intent                          | Directive                                                                                   | Module           | Class/Object    | Function/Method         | Dependency     | Input                        | Output                 | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|------------------|-----------------|-------------------------|----------------|------------------------------|------------------------|----------------------------------|
| Context Detection    | Identify JSON-LD                | - [ ] Check @context presence; validate structure; forbid non-JSON-LD                     | parseJsonLd      | ContextDetector | detectContext           | —              | JSON object                  | Boolean (is JSON-LD)   | @context field check             |
| AgenticRAG Handling  | Apply specialized context       | - [ ] Match canonical URL; apply AgenticRAG rules; forbid hardcoded logic                 | parseJsonLd      | AgenticRAGHandler| applyAgenticRAG        | —              | @context value               | Context config         | URL comparison                   |
| Graph Extraction     | Parse @graph array              | - [ ] Extract nodes/edges; validate IDs; forbid orphaned edges                            | parseJsonLd      | GraphExtractor  | extractGraph            | —              | @graph array                 | Nodes/edges lists      | Array iteration with ID validation|
| Property Copying     | Preserve all fields             | - [ ] Copy to GraphNode.properties; forbid selective copying                               | parseJsonLd      | PropertyMapper  | mapAllProperties        | —              | JSON-LD node                 | GraphNode              | Object.assign all fields         |
| Metadata Preservation| Copy graph-level metadata       | - [ ] Transfer metadata object; preserve layers/ontologies; forbid metadata loss          | parseJsonLd      | MetadataCopier  | copyMetadata            | —              | JSON-LD metadata             | GraphData.metadata     | Deep copy                        |

---

### Component: JSON Parser

**Responsibility**: Normalizes arbitrary JSON into GraphData via structure detection and field mapping.

**Normalization Strategy**: Detect nodes/edges → extract if present → otherwise wrap with rawToGraphData

| Context              | Intent                          | Directive                                                                                   | Module           | Class/Object    | Function/Method         | Dependency     | Input                        | Output                 | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|------------------|-----------------|-------------------------|----------------|------------------------------|------------------------|----------------------------------|
| Structure Detection  | Identify graph shape            | - [ ] Check for nodes/edges/links fields; detect variants; forbid format assumptions      | rawJsonSpec      | StructureDetector| hasGraphStructure      | —              | JSON object                  | Boolean (is graph)     | Field name matching (nodes/edges)|
| Direct Extraction    | Use existing arrays             | - [ ] Copy nodes/edges as-is; validate IDs; forbid malformed entries                      | rawJsonSpec      | DirectExtractor | extractDirectGraph      | —              | JSON object                  | GraphData              | Array presence check then copy   |
| Field Normalization  | Map to standard fields          | - [ ] Extract id/name/label/type; move rest to properties; forbid field loss             | rawToGraphData   | FieldNormalizer | normalizeFields         | —              | JSON entry                   | GraphNode/Edge         | Structural fields + properties   |
| Edge Endpoint Mapping| Support format variants         | - [ ] Accept source/target or from/to; normalize; forbid unmapped endpoints               | rawToGraphData   | EdgeMapper      | mapEdgeEndpoints        | —              | Edge object                  | Normalized edge        | Field aliases (source=from, etc.)|
| Default Assignment   | Provide fallback values         | - [ ] Assign "relatedTo" when no type; forbid empty required fields                       | rawToGraphData   | DefaultAssigner | assignDefaults          | —              | Partial edge                 | Complete edge          | Null check with fallback         |

---

### Component: Markdown Rendering (UI)

**Responsibility**: Renders Markdown in Canvas UI with line-aware preview and media extraction.

**Token Sharing**: Lexer runs once at parent level → tokens shared between Viewer/TOC/Editor → prevents redundant processing

| Context              | Intent                          | Directive                                                                                   | Module                | Class/Object    | Function/Method         | Dependency       | Input                        | Output                 | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|----------------------|-----------------|-------------------------|------------------|------------------------------|------------------------|----------------------------------|
| Token Generation     | Parse Markdown once             | - [ ] Lex at parent; share tokens; forbid redundant lexing                                 | markdown-it          | Lexer           | lex                     | markdown-it      | Markdown text                | Token AST              | markdown-it.parse()              |
| Line Range Extraction| Map tokens to source            | - [ ] Extract lineStart/lineEnd from tokens; 1-based; forbid 0-based ranges               | MarkdownViewer       | LineMapper      | extractLineRanges       | —                | Token list                   | Line range map         | Token.map property access        |
| Block Rendering      | Render Markdown blocks          | - [ ] Map headings/paragraphs/code/tables to UI; forbid lossy rendering                   | MarkdownViewer       | BlockRenderer   | renderBlocks            | React            | Token AST                    | React elements         | Token type switch                |
| Media Preview        | Extract and display media       | - [ ] Parse ![](url), <img>, <video>; render; forbid broken media                         | MarkdownViewer       | MediaRenderer   | renderMedia             | MarkdownHtmlBlock| Media tokens, base URL       | Media elements         | Tag/marker detection             |
| TOC Building         | Generate table of contents      | - [ ] Build tree from headings; preserve hierarchy; forbid flat TOC                        | MarkdownTOC          | TOCBuilder      | buildTocTree            | —                | Heading tokens               | TOC tree               | Parent-child nesting             |
| Heading Reordering   | Support drag-and-drop           | - [ ] Reorder with sibling constraints; update text; forbid hierarchy violations          | MarkdownEditor       | HeadingReorderer| reorderHeading          | TOC helpers      | Heading, target position     | Updated Markdown       | TOC tree manipulation            |
| Context Menu         | Locate nodes from preview       | - [ ] Right-click selection; find associated node; forbid missing provenance              | MarkdownPreview      | SelectionHandler| handleContextMenu       | —                | Selection, line range        | Selected node          | Line range matching              |

---

## Component Responsibility Matrix

| Subsystem        | Module                    | Component              | Interface/Method                 | Responsibility (S-V-O)                                                          | Dependencies                         | Contracts                                      | LOC    |
|------------------|---------------------------|------------------------|----------------------------------|-------------------------------------------------------------------------------|--------------------------------------|-----------------------------------------------|--------|
| Registry         | default.ts                | ParserRegistry         | `dispatchParser`                 | Registry tests capability → dispatches to first match → returns GraphData     | Parser specs                         | Text, name → GraphData or error               | ~150   |
| Markdown         | graph_builder             | MarkdownParser         | `parseMarkdownToGraphJsonLd`     | Parser tokenizes blocks → builds JSON-LD → converts to GraphData              | markdown-it, semantic_processor      | Markdown text → JSON-LD → GraphData           | ~500   |
| HTML             | html-parser               | HTMLConverter          | `parseHtmlToMarkdown`            | Converter parses DOM → maps tags → resolves URLs → emits Markdown            | DOMParser                            | HTML text → Markdown text                     | ~300   |
| JSON-LD          | parseJsonLd               | JSONLDParser           | `parseJsonLd`                    | Parser interprets @graph → applies AgenticRAG → builds GraphData             | —                                    | JSON-LD object → GraphData                    | ~250   |
| JSON             | rawToGraphData            | JSONNormalizer         | `rawToGraphData`                 | Normalizer detects structure → maps fields → wraps as GraphData              | —                                    | JSON object → GraphData                       | ~200   |
| Mermaid          | mermaid_parser            | MermaidParser          | `parseMermaid`                   | Parser handles node shapes → parses edges → builds graph                     | —                                    | Mermaid text → Graph structure                | ~400   |
| Rendering        | MarkdownViewer            | UIRenderer             | `renderMarkdown`                 | Renderer lexes tokens → maps to UI → shares tokens → displays Markdown       | markdown-it, React                   | Token AST → React elements                    | ~350   |
| Line Mapping     | MarkdownViewer            | LineMapper             | `mapLinesToNodes`                | Mapper reads lineStart/lineEnd → matches to nodes → enables provenance       | —                                    | Line ranges → Node selections                 | ~100   |

---

## Dependency & Integration Standards

**Dependency Declaration**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Parser Registration  | Centralize format handling      | - [ ] Register in default.ts; ordered precedence; forbid scattered parsers                |
| markdown-it          | Standardize Markdown parsing    | - [ ] Use markdown-it for lexing; share tokens; forbid custom tokenizers                  |
| JSON-LD Spec         | Follow W3C standards            | - [ ] Interpret @context/@graph per spec; forbid custom JSON-LD semantics                |

**Integration Contracts**

- **Parser Specs**:
  - Must provide `canParse` predicate and `parse` method.
  - Return `GraphData` or throw descriptive error.
- **Layer Metadata**:
  - JSON-LD emits `metadata.layers` with documentStructure and semantic hints.
  - Canvas reads `schema.layers.mode` to determine active layer.
- **Line Ranges**:
  - Tokens/nodes carry `metadata.lineStart` and `metadata.lineEnd` (1-based).
  - UI components use these for scroll-to-source and provenance selection.

**Coupling Metrics**

- Parsers are decoupled from each other:
  - Each parser in separate module with isolated logic.
  - Registry handles dispatch without parser awareness of peers.
- UI rendering decoupled from parsing:
  - Parsers emit JSON-LD or GraphData.
  - UI consumes via store, no direct parser calls.

---

## Code Organization Framework

**Directory Structure (relevant subset)**:

```text
canvas/
├── src/
│   └── features/
│       ├── parsers/
│       │   ├── default.ts
│       │   ├── html-parser.ts
│       │   └── jsonToMarkdown.ts
│       └── markdown/
│           └── ui/
│               ├── MarkdownViewer.tsx
│               ├── MarkdownTOC.tsx
│               └── MarkdownHtmlBlock.tsx
knowgrph_parser/
├── graph_builder.py
├── semantic_processor.py
├── mermaid_parser.py
└── json_to_markdown_cmd.py
```

**Naming Conventions**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Parser Specs         | Suffix with Spec                | - [ ] Name xxxSpec in registry; document capability; forbid generic names                 |
| Parser Functions     | Verb-oriented                   | - [ ] Use parseXxx, convertXxx; be descriptive; forbid noun-only names                    |
| Token Properties     | Follow markdown-it              | - [ ] Use lineStart/lineEnd (1-based); forbid custom fields                               |
| Layer Keys           | Use lowercase                   | - [ ] Name documentStructure, semantic; forbid camelCase in metadata                      |

**File Organization**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Parser Isolation     | One format per module           | - [ ] Separate MD/HTML/JSON parsers; forbid multi-format modules                          |
| Shared Utilities     | Extract common logic            | - [ ] Share URL resolution, line mapping; forbid duplication                              |
| Token Sharing        | Centralize lexing               | - [ ] Lex once, share tokens; forbid per-component lexing                                 |

---

## Testing & Quality Standards

**Test Coverage Metrics**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Parser Specs         | Test all registered parsers     | - [ ] Exercise CSV/JSON-LD/JSON/MD/Python/GraphRAG; verify GraphData; forbid untested parsers|
| Mermaid Support      | Cover all shapes                | - [ ] Test [], (), {}, etc.; verify edges; forbid shape parsing bugs                      |
| Line Mapping         | Validate provenance             | - [ ] Check lineStart/lineEnd accuracy; verify scroll-to-source; forbid off-by-one errors |
| Token Sharing        | Ensure no redundant lexing      | - [ ] Mock lexer; count calls; forbid multiple tokenizations                              |

**Test Categories**

- **Unit**:
  - Parser capability predicates with various inputs.
  - Tag-to-Markdown mapping for HTML converter.
- **Integration**:
  - Full parse from Markdown/HTML/JSON to GraphData.
  - Line mapping from selection to source position.
- **E2E**:
  - Mermaid diagram parsing with all shapes.
  - HTML block safety rendering.

**Quality Gates**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| GraphData Validation | Ensure valid output             | - [ ] Validate nodes/edges arrays; check IDs; forbid malformed GraphData                  |
| Layer Metadata       | Verify rendering hints          | - [ ] Check metadata.layers structure; forbid missing layer specs                         |
| Line Range Integrity | Validate 1-based ranges         | - [ ] Ensure lineStart <= lineEnd; forbid 0-based or negative                             |

---

## Operational Configuration: Parser Behavior

**Parser Configuration Variables**:

| Variable                          | Scope            | Default                            | Impact                                              |
|-----------------------------------|------------------|------------------------------------|-----------------------------------------------------|
| `PARSER_ORDER`                    | registry         | CSV, JSON-LD, JSON, n8n, MD, Python, GraphRAG | Controls parser precedence                    |
| `MERMAID_SHAPE_PATTERNS`          | mermaid parser   | All standard shapes                | Controls supported Mermaid shapes                   |
| `JSON_LD_CANONICAL_CONTEXT_URL`   | JSON-LD parser   | AgenticRAG context URL             | Triggers AgenticRAG context handling                |

**Parsing Workflow**:

| Step | Action                                  | Command/Trigger                         | Artifact Consumer                  |
|------|----------------------------------------|------------------------------------------|-------------------------------------|
| 1    | Detect format                          | Registry capability testing              | Parser dispatcher                   |
| 2    | Invoke matched parser                  | Parser.parse(text, name)                 | GraphData builder                   |
| 3    | Build JSON-LD (if applicable)          | Markdown/HTML parsers                    | JSON-LD converter                   |
| 4    | Convert to GraphData                   | parseJsonLd or direct construction       | GraphData object                    |
| 5    | Emit layer metadata                    | Parser metadata builder                  | Canvas layer selector               |

| Context              | Intent                          | Directive                                                                                   | Module/Component  | Class/Object | Function/Method              | Dependency      | Input                        | Output                 | Decision Logic                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|-------------------|--------------|------------------------------|-----------------|------------------------------|------------------------|----------------------------------|
| Parser Ordering      | Control precedence              | - [ ] Register in fixed order; test top to bottom; forbid random order                    | default.ts        | ParserRegistry| registerInOrder            | —               | Parser spec list             | Registry               | Array index order                |
| Format Dispatch      | Route to handler                | - [ ] Test capability; invoke first match; forbid fallthrough                             | default.ts        | ParserRegistry| parseGraph                 | Parser specs    | Text, name                   | GraphData or error     | Find-first then invoke           |

---

## Data Flow

**Pipeline**: Text Input → Format Detection → Parser Selection → Structure Parsing → JSON-LD Building (optional) → GraphData Conversion → Metadata Enrichment → Store Update

| Stage             | Input                          | Output                         | Responsibility                                              | Performance Consideration                    |
|-------------------|--------------------------------|--------------------------------|-------------------------------------------------------------|----------------------------------------------|
| Format Detection  | Text, filename                 | Parser spec                    | Registry tests capability predicates                        | O(1) per parser                              |
| Parser Selection  | Parser spec                    | Parser instance                | Registry returns first match                                | O(parsers) linear search                     |
| Structure Parsing | Text                           | AST or token list              | Parser tokenizes/parses format-specific structure           | O(n) in text length                          |
| JSON-LD Building  | AST                            | JSON-LD document               | Markdown/HTML parsers build JSON-LD                         | O(nodes + edges)                             |
| GraphData Conversion| JSON-LD or raw nodes/edges  | GraphData                      | parseJsonLd or direct normalization                         | O(nodes + edges)                             |
| Metadata Enrichment| GraphData                     | GraphData + metadata           | Add layers, provenance, metrics                             | O(metadata fields)                           |
| Store Update      | GraphData                      | Updated store state            | Zustand store update                                        | Immutable update                             |

---

## Design Decisions & Trade-offs

| Decision             | Rationale                          | Pros                                                  | Cons                                      | Mitigation                                    |
|----------------------|------------------------------------|-------------------------------------------------------|-------------------------------------------|-----------------------------------------------|
| First-Match Ordering | Clear precedence                   | Unambiguous dispatch, predictable behavior            | Format conflicts possible                 | Document order, test edge cases               |
| markdown-it          | Industry standard                  | Mature, extensible, well-tested                       | Learning curve for custom plugins         | Use default plugins, document extensions      |
| JSON-LD Intermediate | Neutral representation             | Format-agnostic, supports multiple ontologies         | Extra conversion step                     | Cache JSON-LD, optimize parseJsonLd           |
| Token Sharing        | Optimize performance               | Single lexer call, consistent tokens                  | Requires parent-level coordination        | Clear token passing conventions               |
| Line Preservation    | Enable provenance                  | Scroll-to-source, selection mapping                   | 1-based indexing complexity               | Consistent 1-based everywhere, test edge cases|
| Layer Metadata       | Decouple parser from renderer      | Parser-agnostic rendering, flexible layer modes       | Metadata schema coordination              | Document metadata contract, version schemas   |

---

## Parser Directives

### Format Handling Directives

| Context              | Intent                          | Directive                                                                                   | Enforcement Mechanism                        |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|----------------------------------------------|
| Capability Testing   | Match format accurately         | - [ ] Test signature before parse; forbid optimistic parsing                               | Predicate evaluation before dispatch         |
| Error Handling       | Surface parse failures          | - [ ] Return descriptive errors; log parse issues; forbid silent failures                  | Try-catch with error construction            |
| Fallback Strategy    | Handle no match gracefully      | - [ ] Suggest formats; provide hints; forbid cryptic errors                                | Error message with format suggestions        |

### Structure Preservation Directives

| Context              | Intent                          | Directive                                                                                   | Enforcement Mechanism                        |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|----------------------------------------------|
| Hierarchy Maintenance| Preserve nesting                | - [ ] Maintain parent-child relationships; forbid flattening                               | Recursive structure building                 |
| Property Copying     | Preserve all attributes         | - [ ] Copy all fields to properties; forbid selective copying                              | Object.assign or spread operators            |
| Line Range Accuracy  | Map to source correctly         | - [ ] Use 1-based indexing; validate ranges; forbid off-by-one errors                     | Automated range validation tests             |

---

## Documentation Coverage

**Parser Documents**:

| Document                             | Purpose                                                  | Quality Gates           | Steward              |
|--------------------------------------|----------------------------------------------------------|-------------------------|----------------------|
| `knowgrph-parser-document.md`        | Parser registry, format specs, line mapping              | docs:update, doc:lint, tests | Component Documenter |
| `knowgrph-semantic-document.md`      | Semantic extraction, entity/edge processing              | docs:update, doc:lint, tests | Component Documenter |
| `knowgrph-mermaid-frontmatter-document.md` | Mermaid parsing, frontmatter handling          | docs:update, doc:lint, tests | Component Documenter |

---

## Anti-Patterns (Forbidden)

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Optimistic Parsing   | Test capability first           | - [ ] Check canParse before parse; forbid parse-then-validate                             |
| Format Hardcoding    | Support any format              | - [ ] Register via specs; forbid if-else format chains                                    |
| Redundant Lexing     | Share tokens                    | - [ ] Lex once at parent; forbid per-component tokenization                               |
| 0-Based Line Ranges  | Use 1-based consistently        | - [ ] All line numbers 1-based; forbid 0-based indexing                                   |
| Lossy Conversion     | Preserve structure              | - [ ] Maintain hierarchy and properties; forbid dropping nodes/edges                      |
| Silent Failures      | Surface all errors              | - [ ] Return descriptive errors; log failures; forbid swallowing exceptions               |

---

## Repository Health Checklist

**Structural Health**:

| Context              | Status | Directive                                                                                   |
|----------------------|--------|---------------------------------------------------------------------------------------------|
| Parser Isolation     | ✓      | - [ ] Each parser in separate module; registry dispatch; forbid cross-parser dependencies |
| Token Sharing        | ✓      | - [ ] Lex once, share tokens; forbid redundant tokenization                               |

**Maintainability**:

| Context              | Status | Directive                                                                                   |
|----------------------|--------|---------------------------------------------------------------------------------------------|
| Test Coverage        | ✓      | - [ ] All formats covered; line mapping tested; forbid untested parsers                   |
| Error Messages       | ✓      | - [ ] Descriptive parse errors; format suggestions; forbid cryptic failures               |

**Operations**:

| Context              | Status | Directive                                                                                   |
|----------------------|--------|---------------------------------------------------------------------------------------------|
| Registry Ordering    | ✓      | - [ ] Fixed precedence order; documented; forbid arbitrary reordering                     |
| Layer Metadata       | ✓      | - [ ] Neutral rendering hints; schema versioned; forbid renderer coupling                 |

---

## Version Control Standards

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Parser Order         | Track precedence changes        | - [ ] Document order changes; version registry; forbid undocumented reordering            |
| Metadata Schema      | Maintain compatibility          | - [ ] Version metadata.layers structure; migrate gracefully; forbid breaking schema changes|
| Token Format         | Preserve line mapping           | - [ ] Version lineStart/lineEnd contract; forbid changing to 0-based                      |