---
title: "Knowledge Graph GraphRAG Pipeline - PRD & TAD"
author: "joohwee"
tags: [EDA, MLP, Test]
date: 2026-01-13
mermaidAnchorsOnly: true
mermaid: |
  graph TD
    Start([Input Text]) --> Input["Singapore is a city-state in Southeast Asia.<br/>It has a population of about 5.9 million and is<br/>known for its financial hub, Changi Airport,<br/>and future development projects."]
    
    Input --> NLTK_Stage[NLTK Preprocessing]
    
    subgraph NLTK["Stage 1: NLTK Preprocessing"]
        NLTK_Stage --> NLTK_Tokenize[Tokenization]
        NLTK_Tokenize --> NLTK_Tokens["Tokens: Singapore, city-state, Southeast,<br/>Asia, population, about, 5.9, million,<br/>known, financial, hub, Changi,<br/>Airport, future, development, projects"]
        
        NLTK_Tokens --> NLTK_Stopwords[Remove Stopwords]
        NLTK_Stopwords --> NLTK_Clean["Filtered: Singapore, city-state,<br/>Southeast, Asia, population,<br/>5.9, million, known, financial,<br/>hub, Changi, Airport, future,<br/>development, projects"]
        
        NLTK_Clean --> NLTK_Lemma[Lemmatization]
        NLTK_Lemma --> NLTK_Output["Lemmas: singapore, city-state,<br/>southeast, asia, population,<br/>million, know, financial, hub,<br/>changi, airport, future,<br/>development, project"]
    end
    
    NLTK_Output --> HF_Stage[HuggingFace Tokenizers]
    
    subgraph HF["Stage 2: HuggingFace Tokenization"]
        HF_Stage --> HF_BPE[Byte-Pair Encoding]
        HF_BPE --> HF_Subwords["Subword Tokens:<br/>Sing|apore|is|a|city|-|state|in<br/>South|east|Asia|.|It|has|a<br/>population|of|about|5|.|9<br/>million|and|is|known|for|its<br/>financial|hub|,|Changi|Airport"]
        
        HF_Subwords --> HF_Count[Token Count]
        HF_Count --> HF_Output["Word tokens: 29<br/>Subword tokens: 35<br/>Compression ratio: 1.21"]
    end
    
    HF_Output --> spaCy_Stage[spaCy Processing]
    
    subgraph spaCy["Stage 3: spaCy NER & POS"]
        spaCy_Stage --> spaCy_NER[Named Entity Recognition]
        spaCy_NER --> spaCy_Entities["Entities Extracted:<br/>━━━━━━━━━━━━━━━<br/>Singapore → GPE<br/>Southeast Asia → LOC<br/>5.9 million → QUANTITY<br/>Changi Airport → FAC"]
        
        spaCy_Entities --> spaCy_POS[Part-of-Speech Tagging]
        spaCy_POS --> spaCy_Tags["POS Tags:<br/>Singapore/PROPN is/AUX a/DET<br/>city-state/NOUN in/ADP<br/>Southeast/PROPN Asia/PROPN"]
        
        spaCy_Tags --> spaCy_Dep[Dependency Parsing]
        spaCy_Dep --> spaCy_Output["Dependencies:<br/>Singapore ← nsubj → is<br/>city-state ← attr → is<br/>Asia ← pobj → in"]
    end
    
    spaCy_Output --> Triple_Stage[Triple Extraction]
    
    subgraph Triple["Stage 4: Semantic Triple Extraction"]
        Triple_Stage --> Triple_Parse[Analyze Dependencies]
        Triple_Parse --> Triple_Pattern[Pattern Matching:<br/>nsubj-ROOT-attr<br/>nsubj-ROOT-prep-pobj]
        
        Triple_Pattern --> Triple_Extract[Extract Relationships]
        Triple_Extract --> Triple_Output["Triples Generated:<br/>━━━━━━━━━━━━━━━━━━━<br/>subject, predicate, object<br/>━━━━━━━━━━━━━━━━━━━<br/>Singapore, is-a, city-state<br/>Singapore, located-in, Southeast Asia<br/>Singapore, has-population, 5.9 million<br/>Singapore, known-for, financial hub<br/>Singapore, known-for, Changi Airport<br/>Singapore, has, development projects"]
    end
    
    Triple_Output --> Graph_Stage[Graph Construction]
    
    subgraph Graph["Stage 5: NetworkX Graph"]
        Graph_Stage --> Graph_Nodes[Create Nodes]
        Graph_Nodes --> Graph_NodeList["Nodes 6:<br/>━━━━━━━━<br/>N1: Singapore<br/>N2: city-state<br/>N3: Southeast Asia<br/>N4: 5.9 million<br/>N5: Changi Airport<br/>N6: financial hub"]
        
        Graph_NodeList --> Graph_Edges[Create Edges]
        Graph_Edges --> Graph_EdgeList["Edges 6:<br/>━━━━━━━━━━━━━━━━<br/>N1 →is-a→ N2<br/>N1 →located-in→ N3<br/>N1 →has-population→ N4<br/>N1 →known-for→ N5<br/>N1 →known-for→ N6<br/>N1 →has→ projects"]
        
        Graph_EdgeList --> Graph_Community[Community Detection]
        Graph_Community --> Graph_Output["Communities: 2<br/>━━━━━━━━━━━━━<br/>C1: Location cluster<br/>Singapore, Southeast Asia,<br/>city-state<br/><br/>C2: Features cluster<br/>financial hub, Changi Airport,<br/>5.9 million, projects"]
    end
    
    Graph_Output --> Final[Knowledge Graph]
    
    subgraph Final_Graph["Final Output: Knowledge Graph"]
        Final --> Metrics["Graph Metrics:<br/>━━━━━━━━━━━<br/>Nodes: 6<br/>Edges: 6<br/>Density: 0.20<br/>Communities: 2<br/>Avg Degree: 2.0"]
        
        Metrics --> Visualization["Graph Structure:<br/>┌─────────────┐<br/>│  Singapore  │──is-a──→ city-state<br/>└─────────────┘<br/>       │<br/>       ├──located-in──→ Southeast Asia<br/>       ├──has-population──→ 5.9 million<br/>       ├──known-for──→ financial hub<br/>       ├──known-for──→ Changi Airport<br/>       └──has──→ projects"]
    end
    
    %% Library annotations
    NLTK_Stage -.->|nltk.tokenize| NLTK_Lib[NLTK Library]
    HF_Stage -.->|tokenizers| HF_Lib[HuggingFace]
    spaCy_Stage -.->|spacy.load| spaCy_Lib[spaCy en_core_web_sm]
    Triple_Stage -.->|dependency parser| Triple_Lib[spaCy Dependencies]
    Graph_Stage -.->|nx.Graph| Graph_Lib[NetworkX]
    
    classDef inputStyle fill:#e1f5ff,stroke:#0288d1,stroke-width:2px
    classDef processStyle fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef outputStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef dataStyle fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef libStyle fill:#fce4ec,stroke:#c2185b,stroke-width:1px,stroke-dasharray: 5 5
    
    class Start,Input inputStyle
    class NLTK_Stage,HF_Stage,spaCy_Stage,Triple_Stage,Graph_Stage processStyle
    class NLTK_Output,HF_Output,spaCy_Output,Triple_Output,Graph_Output outputStyle
    class NLTK_Tokens,NLTK_Clean,NLTK_Lemma,HF_Subwords,HF_Count,spaCy_Entities,spaCy_Tags,spaCy_Dep,Triple_Pattern,Triple_Extract,Graph_NodeList,Graph_EdgeList,Graph_Community,Metrics,Visualization dataStyle
    class NLTK_Lib,HF_Lib,spaCy_Lib,Triple_Lib,Graph_Lib libStyle
---

# Knowledge Graph GraphRAG Pipeline - PRD & TAD

**Version**: 1.0.0  
**Date**: 2026-01-22  
**Status**: Draft

---

## PART I: PRODUCT REQUIREMENTS DOCUMENT (PRD)

### Feature: GraphRAG Text-to-Knowledge-Graph Pipeline

#### Problem Statement

Data analysts, researchers, and knowledge workers struggle to extract structured insights from unstructured text documents. Manual entity extraction and relationship mapping is time-consuming, error-prone, and doesn't scale. Users need an automated pipeline that transforms natural language text into queryable knowledge graphs, enabling semantic search, relationship discovery, and retrieval-augmented generation workflows.

**User Pain Points**:
- Manually identifying entities in documents takes hours per document
- Relationship extraction requires domain expertise and is inconsistent
- Existing solutions are proprietary, expensive, or vendor-locked
- No visibility into processing stages makes debugging difficult
- Integration with LLM workflows requires custom glue code

**Quantified Impact**: Users spend 15-20 hours per week on manual knowledge extraction that could be automated, representing 40-50% of research time.

---

### User Stories

#### Epic: Text-to-Knowledge-Graph Transformation

**PRD-E001: Core Pipeline**

**PRD-E001-S001: Automated Entity Extraction**

**As a** data analyst  
**I want** the system to automatically identify named entities (people, places, organizations, dates) from text  
**So that** I can build knowledge graphs without manual tagging

**Acceptance Criteria**:
- **Given** plain text input containing entities  
- **When** user submits text for processing  
- **Then** system extracts entities with type labels (GPE, LOC, PERSON, ORG, DATE) with >85% precision

**PRD-E001-S002: Relationship Triple Extraction**

**As a** researcher  
**I want** the system to extract semantic relationships between entities in (subject, predicate, object) format  
**So that** I can understand how entities connect without reading full documents

**Acceptance Criteria**:
- **Given** text with entity relationships (e.g., "Singapore is located in Southeast Asia")  
- **When** system processes entities  
- **Then** system produces triples like "(Singapore, located-in, Southeast Asia)" with >75% accuracy

**PRD-E001-S003: Interactive Processing Visualization**

**As a** knowledge worker  
**I want** to see each pipeline stage's output in real-time  
**So that** I can understand how my text transforms into structured data

**Acceptance Criteria**:
- **Given** text submitted for processing  
- **When** pipeline executes  
- **Then** user sees progressive results from each stage (tokenization → NER → triple extraction → graph construction) within 3 seconds

**PRD-E001-S004: Knowledge Graph Construction**

**As a** data scientist  
**I want** extracted triples to form a queryable graph structure  
**So that** I can perform graph traversal and community detection

**Acceptance Criteria**:
- **Given** valid entity triples  
- **When** graph construction completes  
- **Then** system displays node count, edge count, and community clusters with interactive visualization

---

#### Epic: FOSS Stack Transparency

**PRD-E002: Open Source Tooling Visibility**

**PRD-E002-S001: Library Attribution**

**As a** developer  
**I want** to see which FOSS libraries handle each pipeline stage  
**So that** I can replicate the pipeline in my own infrastructure

**Acceptance Criteria**:
- **Given** user views pipeline interface  
- **When** hovering over any processing stage  
- **Then** system displays library name, GitHub repository link, and license type

**PRD-E002-S002: Code Snippet Examples**

**As a** developer  
**I want** minimal code examples for each pipeline stage  
**So that** I can implement custom processing without vendor lock-in

**Acceptance Criteria**:
- **Given** user selects a pipeline stage  
- **When** requesting implementation guidance  
- **Then** system shows ≤10 line code snippet demonstrating library usage

---

### Success Metrics

| Metric | Baseline | Target | Timeline | Measurement |
|--------|----------|--------|----------|-------------|
| Entity Extraction Precision | N/A | ≥85% | Week 4 | F1 score on CoNLL-2003 dataset |
| Triple Extraction Accuracy | N/A | ≥75% | Week 6 | Human evaluation on 100 sample triples |
| Processing Latency (p95) | N/A | <3s | Week 3 | End-to-end pipeline for 500-word documents |
| User Comprehension | N/A | ≥80% | Week 8 | Survey: "I understand how text became graph" |
| Developer Adoption | N/A | 50 implementations | Month 6 | GitHub stars + documented deployments |

---

### MoSCoW Prioritization

**Must Have**:
- NLTK preprocessing (stopword removal, lemmatization)
- spaCy NER with entity type labels
- Triple extraction producing (subject, predicate, object) format
- NetworkX graph construction with node/edge counts
- Interactive stage-by-stage visualization

**Should Have**:
- HuggingFace tokenizer compatibility demonstration
- Multiple text sample inputs
- Export graph as JSON/GraphML
- Error handling with user-friendly messages

**Could Have**:
- Custom entity type training
- Relationship confidence scores
- Graph query interface
- Multilingual support (Chinese, Spanish)

**Won't Have** (this release):
- LLM-based entity extraction (use rule-based NER)
- Real-time collaborative graph editing
- Vector embedding generation
- Production-scale graph database integration

---

### Out of Scope

- Graph database deployment (Neo4j, FalkorDB) - users handle their own infrastructure
- LLM API integration for generation - pipeline focuses on extraction only
- Authentication/authorization - demo is public
- Production data persistence - session-only storage
- Custom NER model training - uses pre-trained spaCy models

---

### Dependencies

**Required**:
- spaCy `en_core_web_sm` model (must be pre-downloaded)
- NLTK stopwords corpus (must be pre-downloaded)
- Modern browser with JavaScript enabled

**Assumed**:
- User has basic understanding of NLP concepts
- Text input is English language
- Documents are <5000 words

---

### Open Questions

- **Q1**: Should we support PDF/DOCX upload or text-only input?  
  **Status**: Research user preference - Week 2
  
- **Q2**: What graph visualization library provides best UX without CDN dependencies?  
  **Status**: Evaluate D3.js vs vis.js - Week 1
  
- **Q3**: Should triple extraction use OpenIE or spaCy dependency parsing?  
  **Status**: Benchmark accuracy/performance - Week 3

---

## PART II: TECHNICAL ARCHITECTURE DOCUMENT (TAD)

### Architecture Overview

**From text to knowledge graph**: System → receives unstructured text input → preprocesses via NLTK (tokenization, lemmatization, stopword removal) → extracts entities via spaCy NER → generates semantic triples through dependency parsing → constructs graph via NetworkX → delivers interactive visualization with nodes, edges, and community clusters.

**Architecture Pattern**: Sequential pipeline with stage isolation and progressive disclosure

---

### Component Specifications

#### TAD-C001: Preprocessing Engine

**Component**: NLTKPreprocessor  
**Responsibility**: Preprocessor → cleans raw text → removes stopwords and punctuation → produces normalized tokens for downstream NER  
**Interfaces**: 
```typescript
interface IPreprocessor {
  tokenize(text: string): string[]
  lemmatize(tokens: string[]): string[]
  removeStopwords(tokens: string[]): string[]
}
```
**Dependencies**: NLTK stopwords corpus, WordNet lemmatizer  
**Configuration**: `stopwords_language="english"`, `lemmatizer_pos="v|n|a"`

---

#### TAD-C002: Entity Recognition Service

**Component**: SpaCyNERExtractor  
**Responsibility**: Extractor → processes preprocessed tokens → identifies named entities with type labels → delivers structured entity list with spans  
**Interfaces**:
```typescript
interface INERExtractor {
  extractEntities(text: string): Entity[]
}
type Entity = {
  text: string
  label: string  // GPE, PERSON, ORG, etc.
  start: number
  end: number
}
```
**Dependencies**: spaCy `en_core_web_sm` model  
**Configuration**: `confidence_threshold=0.5`, `entity_types=["GPE","LOC","PERSON","ORG","FAC","QUANTITY"]`

---

#### TAD-C003: Triple Extraction Engine

**Component**: DependencyTripleExtractor  
**Responsibility**: Extractor → analyzes dependency parse tree → identifies subject-verb-object patterns → produces semantic triples for graph construction  
**Interfaces**:
```typescript
interface ITripleExtractor {
  extractTriples(doc: SpacyDoc): Triple[]
}
type Triple = {
  subject: string
  predicate: string
  object: string
  confidence: number
}
```
**Dependencies**: spaCy dependency parser  
**Configuration**: `pattern_rules=["nsubj-ROOT-dobj", "nsubj-ROOT-prep-pobj"]`

---

#### TAD-C004: Graph Construction Service

**Component**: NetworkXGraphBuilder  
**Responsibility**: Builder → consumes entity triples → constructs directed graph → computes community clusters → delivers graph metadata and visualization data  
**Interfaces**:
```typescript
interface IGraphBuilder {
  buildGraph(triples: Triple[]): Graph
  detectCommunities(graph: Graph): Community[]
}
type Graph = {
  nodes: Node[]
  edges: Edge[]
  communities: number
}
```
**Dependencies**: NetworkX graph algorithms  
**Configuration**: `algorithm="louvain"`, `resolution=1.0`

---

#### TAD-C005: Visualization Controller

**Component**: ReactPipelineUI  
**Responsibility**: Controller → manages pipeline state → orchestrates stage execution → renders progressive results → handles user interactions  
**Interfaces**:
```typescript
interface IPipelineController {
  processPipeline(text: string): Promise<PipelineResult>
  navigateStage(stage: number): void
}
```
**Dependencies**: React state management, Tailwind CSS  
**Configuration**: `max_stages=5`, `animation_duration=300ms`

---

### Integration Contracts

#### TAD-I001: Preprocessing → NER Interface

**Interface**: TextNormalizationContract  
**Protocol**: In-memory function call  
**Data Format**:
```typescript
Input: { raw: string }
Output: { tokens: string[], lemmas: string[] }
```
**Error Handling**: Invalid UTF-8 → return empty array + log warning

---

#### TAD-I002: NER → Triple Extraction Interface

**Interface**: EntityToTripleContract  
**Protocol**: In-memory object passing  
**Data Format**:
```typescript
Input: { entities: Entity[], doc: SpacyDoc }
Output: { triples: Triple[] }
```
**Error Handling**: No entities found → return empty triple array

---

#### TAD-I003: Triple → Graph Construction Interface

**Interface**: TripleToGraphContract  
**Protocol**: In-memory object transformation  
**Data Format**:
```typescript
Input: { triples: Triple[] }
Output: { nodes: Node[], edges: Edge[] }
```
**Error Handling**: Duplicate triples → merge with confidence aggregation

---

### Architectural Decisions

#### ADR-001: Use spaCy for NER Instead of Custom BERT Model

**Status**: Accepted  
**Date**: 2026-01-22  
**Deciders**: Architecture Team

**Context**: Need named entity recognition with balance of accuracy, speed, and ease of deployment.

**Decision**: Use pre-trained spaCy `en_core_web_sm` model for entity extraction.

**Alternatives Considered**:
1. **Fine-tuned BERT model**: Higher accuracy (90%+ F1) but requires GPU, slow inference (2-3s), complex deployment
2. **OpenAI API for NER**: High accuracy but vendor lock-in, API costs, network dependency
3. **Rule-based regex**: Fast but low accuracy (40-50% precision), brittle

**Rationale**: spaCy provides 85%+ accuracy, <500ms inference on CPU, zero external dependencies, FOSS licensed (MIT).

**Consequences**:
- **Positive**: Fast deployment, no GPU required, offline capability, reproducible
- **Negative**: Accuracy ceiling at ~85%, limited customization without retraining
- **Neutral**: Users can swap spaCy for custom models via interface contract

---

#### ADR-002: Use Dependency Parsing for Triple Extraction Instead of OpenIE

**Status**: Accepted  
**Date**: 2026-01-22  
**Deciders**: Architecture Team

**Context**: Need to extract (subject, predicate, object) triples from text.

**Decision**: Use spaCy dependency parser with pattern matching rules.

**Alternatives Considered**:
1. **Stanford OpenIE**: Higher recall but Java dependency, slower, GPL license conflicts
2. **AllenNLP OpenIE**: Good accuracy but requires large model download (500MB+), slow startup
3. **LLM-based extraction**: Most flexible but API costs, latency, non-deterministic

**Rationale**: spaCy dependency parsing is fast (<100ms), already loaded for NER, deterministic, provides structural relationships.

**Consequences**:
- **Positive**: Zero additional dependencies, consistent performance, explainable
- **Negative**: Lower recall than OpenIE (75% vs 85%), requires pattern tuning
- **Neutral**: Can add OpenIE as optional enhancement later

---

#### ADR-003: Use NetworkX for Graph Construction Instead of Neo4j

**Status**: Accepted  
**Date**: 2026-01-22  
**Deciders**: Architecture Team

**Context**: Need graph data structure for nodes, edges, and community detection.

**Decision**: Use NetworkX in-memory graph with Python-based algorithms.

**Alternatives Considered**:
1. **Neo4j embedded**: Persistent storage, Cypher query language but heavy footprint (200MB+), requires server
2. **TigerGraph**: High performance but complex setup, not FOSS
3. **Custom adjacency list**: Lightweight but reinvents algorithms

**Rationale**: NetworkX provides 50+ graph algorithms, pure Python (easy deployment), BSD licensed, sufficient for demo-scale graphs (<10k nodes).

**Consequences**:
- **Positive**: No database setup, portable, algorithm-rich, Python-native
- **Negative**: No persistence (session only), memory-limited scalability
- **Neutral**: Users can export to Neo4j/FalkorDB for production via GraphML

---

### Quality Attributes

#### Performance

**Requirement**: System processes 500-word documents end-to-end in <3 seconds (p95 latency).

**Architecture Pattern**: Sequential pipeline with early-exit on errors, lazy loading of NLP models.

**Validation**: Load test with 100 sample documents measuring per-stage latency.

**Metrics**:
```
NLTK preprocessing: <50ms
spaCy NER: <500ms
Triple extraction: <200ms
Graph construction: <100ms
Visualization render: <300ms
Total: <1150ms (with 150% buffer)
```

---

#### Scalability

**Requirement**: Support documents up to 5000 words without client-side memory issues.

**Architecture Pattern**: Streaming tokenization, batched entity processing, incremental graph construction.

**Validation**: Stress test with 10,000-word documents monitoring browser memory usage (<500MB).

**Constraints**: Beyond 10k words, recommend server-side processing.

---

#### Usability

**Requirement**: Users with basic NLP knowledge understand pipeline flow without documentation.

**Architecture Pattern**: Progressive disclosure UI with stage-by-stage visualization, inline tooltips, example outputs.

**Validation**: User testing with 10 participants achieving >80% task completion without help.

**Metrics**:
- Time to first entity extraction: <30 seconds
- Understanding of triple format: >85% correct interpretation
- Ability to identify pipeline stage: >90% accuracy

---

#### Maintainability

**Requirement**: Developers can swap NLP libraries (e.g., spaCy → Stanford NLP) without rewriting UI.

**Architecture Pattern**: Interface-based component contracts, dependency injection, config-driven library selection.

**Validation**: Successfully swap spaCy for alternative NER in <4 hours.

**Design Principles**:
- Each component implements interface contract
- No direct library imports in UI layer
- Configuration externalizes library choices

---

#### Observability

**Requirement**: Developers can debug pipeline failures by inspecting intermediate outputs.

**Architecture Pattern**: Stage-level error boundaries, structured logging, output serialization.

**Validation**: Inject errors at each stage and verify clear error messages + recovery guidance.

**Telemetry**:
```typescript
interface StageMetrics {
  stage: string
  status: "success" | "error"
  latency_ms: number
  output_size: number
  error_message?: string
}
```

---

### Deployment Strategy

**Pattern**: Static artifact deployment (client-side only)

**Deployment Flow**:
1. Build React application → bundle JavaScript/CSS
2. Verify NLP model loading → test spaCy model import
3. Deploy to CDN → upload to Cloudflare Pages / Netlify
4. Validate in production → smoke test with sample text

**Rollback Strategy**: Revert to previous CDN version via version tags.

**Zero-Downtime**: Not applicable (client-side app, no backend).

---

### Migration Path

**Current State**: Users manually extract entities using spreadsheets or regex.

**Target State**: Users process text through automated pipeline generating queryable graphs.

**Migration Steps**:
1. **Phase 1** (Week 1-2): Release with single text input, basic NER, simple graph
2. **Phase 2** (Week 3-4): Add triple extraction, community detection
3. **Phase 3** (Week 5-6): Add export formats (JSON, GraphML), multiple examples
4. **Phase 4** (Week 7-8): Optimize performance, add error handling

**Backward Compatibility**: Not applicable (new system, no legacy data).

**Data Migration**: Users copy-paste text from existing tools (no migration tooling needed).

---

## PART III: REQUIREMENT TRACEABILITY MATRIX

| PRD ID | PRD User Story | TAD Component | TAD Interface | ADR |
|--------|----------------|---------------|---------------|-----|
| PRD-E001-S001 | Entity Extraction | TAD-C002 | TAD-I002 | ADR-001 |
| PRD-E001-S002 | Triple Extraction | TAD-C003 | TAD-I003 | ADR-002 |
| PRD-E001-S003 | Interactive Visualization | TAD-C005 | N/A | N/A |
| PRD-E001-S004 | Graph Construction | TAD-C004 | TAD-I003 | ADR-003 |
| PRD-E002-S001 | Library Attribution | TAD-C005 | N/A | N/A |
| PRD-E002-S002 | Code Snippets | TAD-C005 | N/A | N/A |

---

## PART IV: VALIDATION CHECKLIST

### PRD Validation

- [x] User stories follow "As a...I want...So that" format
- [x] Acceptance criteria use Given-When-Then pattern
- [x] Features prioritized via MoSCoW framework
- [x] Problem statement precedes solution description
- [x] Success metrics are measurable and time-bound
- [x] Out of scope explicitly defined
- [x] No technical implementation details in PRD
- [x] User personas identified (data analyst, researcher, developer)

### TAD Validation

- [x] Components have single responsibility (SRP)
- [x] Interfaces specified with TypeScript contracts
- [x] Architectural decisions documented with ADR format
- [x] Quality attributes have measurable scenarios
- [x] Deployment strategy defined
- [x] No business logic in TAD (focuses on HOW not WHY)
- [x] Domain-agnostic design (NLP pipeline, not Singapore-specific)

### Traceability Validation

- [x] PRD-to-TAD mapping established in traceability matrix
- [x] All user stories map to TAD components
- [x] All TAD components trace back to PRD requirements
- [x] ADRs reference specific user stories where applicable

---

## PART V: OPEN QUESTIONS & RISKS

### Open Questions

**OQ-001**: Should we pre-load spaCy model or lazy-load on first use?  
**Impact**: Startup time (2s) vs first-use latency  
**Resolution Deadline**: Week 1  
**Owner**: Technical Lead

**OQ-002**: What is acceptable entity extraction precision for MVP?  
**Impact**: User satisfaction vs development time  
**Resolution Deadline**: Week 2  
**Owner**: Product Manager

**OQ-003**: Should graph visualization use force-directed layout or hierarchical?  
**Impact**: UX comprehension vs computational cost  
**Resolution Deadline**: Week 2  
**Owner**: UX Designer

### Risks

**RISK-001**: spaCy model size (40MB) causes slow initial page load  
**Mitigation**: Lazy-load model only when user submits text  
**Probability**: High | **Impact**: Medium | **Owner**: Engineering Lead

**RISK-002**: Browser memory limits prevent processing large documents  
**Mitigation**: Add document size validation (<5000 words), warn users  
**Probability**: Medium | **Impact**: Low | **Owner**: Engineering Lead

**RISK-003**: Triple extraction accuracy <75% frustrates users  
**Mitigation**: Set user expectations, show confidence scores, allow manual editing  
**Probability**: Low | **Impact**: High | **Owner**: Product Manager

---

## PART VI: GLOSSARY

**Entity**: Named item in text (person, place, organization, date, etc.) identified by NER.

**Triple**: Semantic relationship in (subject, predicate, object) format, e.g., "(Singapore, located-in, Southeast Asia)".

**Knowledge Graph**: Graph data structure where nodes are entities and edges are relationships.

**NER (Named Entity Recognition)**: NLP task of identifying and classifying named entities in text.

**Dependency Parsing**: Linguistic analysis identifying grammatical relationships between words.

**Community Detection**: Graph algorithm identifying clusters of densely connected nodes.

**FOSS (Free and Open Source Software)**: Software with source code freely available under open licenses.

**GraphRAG (Graph Retrieval-Augmented Generation)**: Technique combining knowledge graphs with LLM generation for improved accuracy.

---

## Document Metadata

**Document Type**: PRD + TAD (Combined)  
**Version**: 1.0.0  
**Last Updated**: 2026-01-22  
**Authors**: Product Team, Architecture Team  
**Reviewers**: [Pending]  
**Status**: Draft → Pending Review  
**Next Review Date**: 2026-01-29

**Adherence to Guidelines**: This document follows `prd-tad-guidelines.md` CID framework, maintains PRD/TAD separation, uses problem-first approach, specifies measurable outcomes, documents architectural decisions with ADRs, and establishes bidirectional traceability.

---

## Prompt_202601221200

https://claude.ai/chat/a049d9b9-5684-48c6-9888-f1754a019e2e

### Prompt-01

```
**FORBID >10 line code blocks, interactive demo**
RECOMMEND minimum viable, strictly FOSS to parse
"Singapore is a city-state in Southeast Asia. It has a population of about 5.9 million and is known for its financial hub, Changi Airport, and future development projects."

```
NLTK (preprocessing: stopwords, regex, lemmatization): https://github.com/nltk/nltk.git
  ↓
HuggingFace Tokenizers (primary tokenization interface): https://github.com/huggingface/tokenizers.git
  ├─ SentencePiece (Unigram/BPE, multilingual): https://github.com/google/sentencepiece.git
  ├─ BPE (minbpe, GPT-style): https://github.com/karpathy/minbpe.git
  └─ WordPiece internally (via HF Tokenizers)
  ↓
spaCy (dependency parsing, POS tagging, NER): https://github.com/explosion/spaCy
  ↓
AllenNLP (semantic role labeling, OpenIE): https://github.com/allenai/allennlp
  ↓
Entity Linking (DBpedia Spotlight / REL):
    - https://github.com/dbpedia-spotlight/dbpedia-spotlight
    - https://github.com/informagi/REL
  ↓
Triple Extraction (OpenIE standalone): https://github.com/dair-iitd/OpenIE-standalone
  ↓
Graph Construction:
    - NetworkX (graph algorithms): https://github.com/networkx/networkx
  ↓
Community Detection / Subgraph Partitioning:
    - NetworkX
  ↓
LLM Inference (retrieval-augmented reasoning over subgraphs)
```
```

#### Response-01

```
I've created an **interactive demo** that shows your minimum viable FOSS GraphRAG pipeline in action. The demo visualizes each step processing the Singapore text through the stack.

**Key features:**
- Click through 5 pipeline stages
- See actual outputs at each step
- Code snippets kept to 2-3 lines max (per your requirement)
- Links to all FOSS repos at bottom
- Shows real entities, triples, and graph structure

**Strictly FOSS components shown:**
1. **NLTK** → Stopword removal, lemmatization
2. **HuggingFace Tokenizers** → Subword tokenization for LLM compatibility
3. **spaCy** → NER (Singapore/GPE, Changi Airport/FAC) + POS tagging
4. **Triple Extraction** → Semantic relationships like "(Singapore, located-in, Southeast Asia)"
5. **NetworkX** → Graph construction with ~7 nodes, 6 edges, 2 communities (demo text)

The demo shows how your text flows through each component and what gets extracted at each stage—from raw text to a structured knowledge graph ready for LLM retrieval.
```

## Implementation (Canvas)

This PRD/TAD is implemented in the `knowgrph/canvas` pipeline as a domain-agnostic, client-side demo that produces canonical `GraphData` plus inspectable intermediate outputs.

### Where It Lives

- Pipeline (sequential stages, metrics, FOSS attribution): `canvas/src/lib/graph/graphragTextPipeline.ts`
- Parser integration (auto-detect `.txt` + plain-text `.md`): `canvas/src/features/parsers/default.ts` (`graphrag-text`)
- UI visualization (stage-by-stage inspector): `canvas/src/features/panels/views/GraphRagTextPipelineSection.tsx` (Parser tab)
- Tests (neutral fixtures + demo-fidelity fixture): `canvas/src/__tests__/graphragTextPipeline.test.ts`, `canvas/src/__tests__/demo/graphrag-pipeline-demo.md`

### Scope Notes

- The Canvas demo remains extraction-only (no LLM API integration) and runs without server dependencies.
- Library references and code snippets are shown for transparency; the demo pipeline itself uses heuristic implementations to stay portable.
