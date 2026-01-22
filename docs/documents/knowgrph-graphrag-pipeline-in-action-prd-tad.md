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
    
    Triple_Output --> Entity_Analytics[Entity Importance Analysis]
    
    subgraph Entity_Layer["Stage 5: Entity Layer Analytics NEW"]
        Entity_Analytics --> TFIDF[TF-IDF Scoring]
        TFIDF --> TFIDF_Output["Keyword Importance:<br/>━━━━━━━━━━━━━━━━━━━<br/>Singapore: freq=6, TF-IDF=0.89<br/>Changi Airport: freq=1, TF-IDF=0.72<br/>Southeast Asia: freq=1, TF-IDF=0.68<br/>financial hub: freq=1, TF-IDF=0.65<br/>city-state: freq=1, TF-IDF=0.61"]
        
        TFIDF_Output --> Centrality[Graph Centrality]
        Centrality --> Centrality_Output["Centrality Metrics:<br/>━━━━━━━━━━━━━━━━━━━<br/>PageRank:<br/>  Singapore: 0.42 highest<br/>  Southeast Asia: 0.12<br/>  Changi Airport: 0.10<br/><br/>Degree Centrality:<br/>  Singapore: 1.0 hub<br/>  Others: 0.17-0.20"]
    end
    
    Centrality_Output --> Causality_Analytics[Causality Detection]
    
    subgraph Relation_Layer["Stage 6: Relation Layer Analytics NEW"]
        Causality_Analytics --> Causal_Detect[Causal Pattern Detection]
        Causal_Detect --> Causal_Output["Causal Relationships:<br/>━━━━━━━━━━━━━━━━━━━<br/>Edge Type | Causality Score<br/>━━━━━━━━━━━━━━━━━━━<br/>is-a → hierarchy | 0.85<br/>located-in → dependency | 0.78<br/>has-population → composition | 0.72<br/>known-for → attribute | 0.65<br/>has → composition | 0.58"]
        
        Causal_Output --> Strength_Calc[Edge Strength Calculation]
        Strength_Calc --> Strength_Output["Edge Strength Metrics:<br/>━━━━━━━━━━━━━━━━━━━<br/>Co-occurrence | PMI | Strength<br/>━━━━━━━━━━━━━━━━━━━<br/>Singapore↔city-state: 1 | 2.1 | 0.92<br/>Singapore↔SE Asia: 1 | 1.8 | 0.85<br/>Singapore↔Changi: 1 | 1.6 | 0.78<br/>Singapore↔financial: 1 | 1.5 | 0.75"]
    end
    
    Strength_Output --> Graph_Stage[Graph Construction]
    
    subgraph Graph["Stage 7: NetworkX Graph Construction"]
        Graph_Stage --> Graph_Nodes[Create Weighted Nodes]
        Graph_Nodes --> Graph_NodeList["Nodes 6 with Importance:<br/>━━━━━━━━━━━━━━━━━━━<br/>N1: Singapore r=35 PR=0.42<br/>N2: city-state r=20 PR=0.08<br/>N3: Southeast Asia r=22 PR=0.12<br/>N4: 5.9 million r=18 PR=0.06<br/>N5: Changi Airport r=24 PR=0.10<br/>N6: financial hub r=21 PR=0.09"]
        
        Graph_NodeList --> Graph_Edges[Create Weighted Edges]
        Graph_Edges --> Graph_EdgeList["Edges 6 with Strength:<br/>━━━━━━━━━━━━━━━━━━━<br/>N1 →is-a→ N2 strength=0.92<br/>N1 →located-in→ N3 strength=0.85<br/>N1 →has-population→ N4 strength=0.68<br/>N1 →known-for→ N5 strength=0.78<br/>N1 →known-for→ N6 strength=0.75<br/>N1 →has→ projects strength=0.58"]
    end
    
    Graph_EdgeList --> Metadata_Analytics[Graph Metrics]
    
    subgraph Metadata_Layer["Stage 8: Metadata Layer Analytics NEW"]
        Metadata_Analytics --> Graph_Metrics[Compute Graph Metrics]
        Graph_Metrics --> Metrics_Output["Graph-Level Metrics:<br/>━━━━━━━━━━━━━━━━━━━<br/>Density: 0.20<br/>Diameter: 2<br/>Avg Path Length: 1.4<br/>Clustering Coefficient: 0.0<br/>Connected Components: 1"]
        
        Metrics_Output --> Node_Metrics[Node-Level Metrics]
        Node_Metrics --> Node_Output["Per-Node Statistics:<br/>━━━━━━━━━━━━━━━━━━━<br/>Singapore: deg=6 betw=1.0<br/>Southeast Asia: deg=1 betw=0<br/>Changi Airport: deg=1 betw=0"]
    end
    
    Node_Output --> Community_Analytics[Community Detection]
    
    subgraph Cluster_Layer["Stage 9: Cluster Layer Analytics NEW"]
        Community_Analytics --> Dbscan[DBSCAN Density Clustering]
        Dbscan --> Community_Output["Communities Detected: 2<br/>━━━━━━━━━━━━━━━━━━━<br/><br/>C1: Location Cluster<br/>  Singapore, Southeast Asia,<br/>  city-state<br/><br/>C2: Features Cluster<br/>  financial hub, Changi Airport,<br/>  5.9 million, projects"]
        
        Community_Output --> Topic_Model[Topic Labeling]
        Topic_Model --> Topic_Output["Semantic Topics:<br/>━━━━━━━━━━━━━━━━━━━<br/>Topic 1: Geographic Identity<br/>  Keywords: Singapore,<br/>  Southeast, Asia, city-state<br/>  Coherence: 0.72<br/><br/>Topic 2: Urban Features<br/>  Keywords: airport, financial,<br/>  development, hub<br/>  Coherence: 0.68"]
    end
    
    Topic_Output --> Final[Analytics-Enhanced Graph]
    
    subgraph Final_Graph["Final Output: Knowledge Graph with Analytics"]
        Final --> Complete_Metrics["Complete Graph Analytics:<br/>━━━━━━━━━━━━━━━━━━━<br/>Entity Layer:<br/>  Nodes: 6<br/>  Avg TF-IDF: 0.71<br/>  Avg PageRank: 0.14<br/><br/>Relation Layer:<br/>  Edges: 6<br/>  Avg Causality: 0.73<br/>  Avg Strength: 0.76<br/><br/>Metadata Layer:<br/>  Density: 0.20<br/>  Diameter: 2<br/><br/>Cluster Layer:<br/>  Communities: 2"]
        
        Complete_Metrics --> Visualization["Enhanced Visualization:<br/>┌─────────────────────────┐<br/>│  Singapore r=35 PR=0.42 │<br/>└─────────────────────────┘<br/>       │<br/>       ├─[0.92]→ city-state r=20<br/>       ├─[0.85]→ Southeast Asia r=22<br/>       ├─[0.68]→ 5.9 million r=18<br/>       ├─[0.78]→ Changi Airport r=24<br/>       ├─[0.75]→ financial hub r=21<br/>       └─[0.58]→ projects<br/><br/>Node size = f(TF-IDF + PageRank)<br/>Edge thickness = f(Causality + Strength)<br/>Color = Community assignment"]
    end
    
    %% Library annotations
    NLTK_Stage -.->|nltk.tokenize| NLTK_Lib[NLTK]
    HF_Stage -.->|tokenizers| HF_Lib[HuggingFace]
    spaCy_Stage -.->|spacy.load| spaCy_Lib[spaCy]
    Triple_Stage -.->|dependency parser| Triple_Lib[spaCy Deps]
    TFIDF -.->|TfidfVectorizer| TFIDF_Lib[scikit-learn]
    Centrality -.->|nx.pagerank| Centrality_Lib[NetworkX]
    Causal_Detect -.->|pattern matching| Causal_Lib[spaCy Patterns]
    Strength_Calc -.->|PMI calculation| Strength_Lib[Custom]
    Graph_Stage -.->|nx.Graph| Graph_Lib[NetworkX]
    Graph_Metrics -.->|nx.density| Metrics_Lib[NetworkX]
    Dbscan -.->|cluster| Community_Lib[DBSCAN]
    Topic_Model -.->|BERTopic optional| Topic_Lib[BERTopic]
    
    classDef inputStyle fill:#e1f5ff,stroke:#0288d1,stroke-width:2px
    classDef processStyle fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef outputStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef dataStyle fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef analyticsStyle fill:#fce4ec,stroke:#c2185b,stroke-width:3px
    classDef libStyle fill:#e3f2fd,stroke:#1565c0,stroke-width:1px,stroke-dasharray: 5 5
    
    class Start,Input inputStyle
    class NLTK_Stage,HF_Stage,spaCy_Stage,Triple_Stage,Graph_Stage processStyle
    class NLTK_Output,HF_Output,spaCy_Output,Triple_Output,Graph_Output outputStyle
    class NLTK_Tokens,NLTK_Clean,NLTK_Lemma,HF_Subwords,HF_Count,spaCy_Entities,spaCy_Tags,spaCy_Dep,Triple_Pattern,Triple_Extract,Graph_NodeList,Graph_EdgeList,Metrics_Output,Node_Output,Complete_Metrics,Visualization dataStyle
    class Entity_Analytics,TFIDF,TFIDF_Output,Centrality,Centrality_Output,Causality_Analytics,Causal_Detect,Causal_Output,Strength_Calc,Strength_Output,Metadata_Analytics,Graph_Metrics,Node_Metrics,Community_Analytics,Dbscan,Community_Output,Topic_Model,Topic_Output analyticsStyle
    class NLTK_Lib,HF_Lib,spaCy_Lib,Triple_Lib,TFIDF_Lib,Centrality_Lib,Causal_Lib,Strength_Lib,Graph_Lib,Metrics_Lib,Community_Lib,Topic_Lib libStyle
---

# Knowledge Graph GraphRAG Pipeline with Analytics - PRD & TAD

**Version**: 2.1.0  
**Date**: 2026-01-22  
**Status**: Implemented (Enhanced v2.1)  
**Previous Version**: 1.0.0

---

## PART I: PRODUCT REQUIREMENTS DOCUMENT (PRD)

### Feature: GraphRAG Text-to-Knowledge-Graph Pipeline with Advanced Analytics

#### Problem Statement

Data analysts, researchers, and knowledge workers struggle to extract structured insights from unstructured text documents **and lack quantitative metrics to validate the quality and importance of extracted entities and relationships**. Manual entity extraction is time-consuming, but equally problematic is the inability to prioritize which entities matter most, measure relationship strength, or identify semantic communities in large corpora. Users need not just entity extraction, but **entity importance scoring, relationship causality measurement, and automated community detection** to make knowledge graphs actionable for decision-making.

**Enhanced User Pain Points**:
- Cannot distinguish important entities from noise (all entities treated equally)
- No quantitative measure of relationship strength or causality
- Unable to identify conceptual clusters or communities in knowledge graphs
- Lack visibility into which entities are central to a domain
- Cannot validate if extracted relationships are causal, correlative, or hierarchical
- No automated way to detect semantic communities for hierarchical navigation

**Quantified Impact**: Users spend 15-20 hours per week on manual knowledge extraction PLUS an additional 8-10 hours manually categorizing entities by importance and validating relationships, representing 60% of research time that could be automated with analytics.

---

### User Stories

#### Epic: Text-to-Knowledge-Graph with Analytics

**PRD-E001: Core Pipeline** (from v1.0.0)

**PRD-E001-S001: Automated Entity Extraction** (unchanged)

**As a** data analyst  
**I want** the system to automatically identify named entities (people, places, organizations, dates) from text  
**So that** I can build knowledge graphs without manual tagging

**Acceptance Criteria**:
- **Given** plain text input containing entities  
- **When** user submits text for processing  
- **Then** system extracts entities with type labels (GPE, LOC, PERSON, ORG, DATE) with >85% precision

---

**PRD-E001-S002: Relationship Triple Extraction** (unchanged)

**As a** researcher  
**I want** the system to extract semantic relationships between entities in (subject, predicate, object) format  
**So that** I can understand how entities connect without reading full documents

**Acceptance Criteria**:
- **Given** text with entity relationships  
- **When** system processes entities  
- **Then** system produces triples like "(Singapore, located-in, Southeast Asia)" with >75% accuracy

---

**PRD-E001-S003: Interactive Processing Visualization** (unchanged)

**As a** knowledge worker  
**I want** to see each pipeline stage's output in real-time  
**So that** I can understand how my text transforms into structured data

**Acceptance Criteria**:
- **Given** text submitted for processing  
- **When** pipeline executes  
- **Then** user sees progressive results from each stage within 3 seconds

---

**PRD-E001-S004: Knowledge Graph Construction** (unchanged)

**As a** data scientist  
**I want** extracted triples to form a queryable graph structure  
**So that** I can perform graph traversal and community detection

**Acceptance Criteria**:
- **Given** valid entity triples  
- **When** graph construction completes  
- **Then** system displays node count, edge count, and community clusters

---

#### Epic: Advanced Analytics Layer (NEW)

**PRD-E002: Entity Importance Analysis**

**PRD-E002-S001: Keyword Frequency Scoring**

**As a** data analyst  
**I want** entities ranked by frequency and TF-IDF importance scores  
**So that** I can focus on the most relevant concepts in my corpus

**Acceptance Criteria**:
- **Given** extracted entities from processed text  
- **When** entity analysis completes  
- **Then** each entity has frequency count with >99% accuracy
- **And** TF-IDF scores normalized to [0,1] range with two decimal precision
- **And** entities sorted by combined frequency+TF-IDF metric in descending order

**PRD-E002-S002: Centrality-Based Importance**

**As a** researcher  
**I want** entities ranked by graph centrality (PageRank, degree, betweenness)  
**So that** I can identify which concepts are most central to the knowledge domain

**Acceptance Criteria**:
- **Given** constructed knowledge graph with nodes and edges  
- **When** centrality analysis runs  
- **Then** system calculates PageRank scores for all nodes with >95% accuracy vs NetworkX reference
- **And** degree centrality, betweenness centrality computed within 2 seconds for graphs <1000 nodes
- **And** top 10 entities by each centrality measure displayed with visual indicators (node size, border)

---

**PRD-E003: Relationship Causality Analysis**

**PRD-E003-S001: Causal Relationship Detection**

**As a** domain expert  
**I want** relationships classified by type (causal, correlative, hierarchical, compositional)  
**So that** I can distinguish "X causes Y" from "X relates to Y"

**Acceptance Criteria**:
- **Given** extracted semantic triples  
- **When** causality detection runs  
- **Then** system identifies causal markers ("causes", "leads to", "results in", "enables") with >70% precision
- **And** assigns causality confidence score [0,1] to each edge
- **And** labels edge types (causal, dependency, hierarchy, composition, technical)

**PRD-E003-S002: Relationship Strength Measurement**

**As a** data scientist  
**I want** relationships weighted by co-occurrence frequency and statistical association  
**So that** I can prioritize strong vs weak connections in analysis

**Acceptance Criteria**:
- **Given** entity pairs in triples  
- **When** strength calculation completes  
- **Then** system computes co-occurrence frequency with 100% accuracy
- **And** calculates PMI (Pointwise Mutual Information) scores
- **And** visualizes edge thickness proportional to strength (min 1px, max 5px)
- **And** edges with strength <0.3 displayed with transparency to reduce visual clutter

---

**PRD-E004: Semantic Community Detection**

**PRD-E004-S001: Automated Community Clustering**

**As a** knowledge worker  
**I want** entities automatically grouped into semantic communities  
**So that** I can navigate large knowledge graphs by topic clusters

**Acceptance Criteria**:
- **Given** knowledge graph with >10 nodes  
- **When** community detection runs  
- **Then** system applies Louvain algorithm detecting 2-8 communities
- **And** each community has modularity score >0.25
- **And** communities visualized with distinct colors and spatial grouping
- **And** community labels generated from top 3 keywords in cluster

**PRD-E004-S002: Hierarchical Topic Modeling**

**As a** researcher analyzing large corpora  
**I want** hierarchical topic structure extracted from text  
**So that** I can understand document themes at multiple levels of granularity

**Acceptance Criteria**:
- **Given** corpus with >100 sentences  
- **When** topic modeling executes  
- **Then** system extracts 3-7 topics using BERTopic with >60% topic coherence
- **And** each topic has top 10 representative keywords
- **And** topics mapped to graph communities with overlap visualization
- **And** hierarchical structure displayed showing topic-subtopic relationships

---

**PRD-E005: Interactive Analytics Dashboard**

**PRD-E005-S001: Real-Time Metric Updates**

**As a** data analyst  
**I want** entity and edge metrics updated in real-time as I filter the graph  
**So that** I can explore different views without re-processing

**Acceptance Criteria**:
- **Given** user applies community filter  
- **When** graph view updates  
- **Then** entity rankings recalculated for visible nodes within 500ms
- **And** edge strength statistics updated for visible edges
- **And** community metrics (modularity, density) recomputed
- **And** all metrics displayed with smooth transitions (<300ms animation)

**PRD-E005-S002: Comparative Analytics**

**As a** researcher comparing multiple documents  
**I want** side-by-side analytics showing how entity importance differs across texts  
**So that** I can identify unique concepts vs common themes

**Acceptance Criteria**:
- **Given** two or more processed documents  
- **When** comparative mode activated  
- **Then** system displays entity frequency delta (document A vs B)
- **And** highlights entities unique to each document with >0 frequency delta
- **And** shows community overlap percentage between graphs
- **And** generates Venn diagram of shared vs unique entities

---

### Success Metrics

| Metric | Baseline | Target | Timeline | Measurement |
|--------|----------|--------|----------|-------------|
| Entity Extraction Precision | N/A | ≥85% | Week 4 | F1 score on CoNLL-2003 dataset |
| Triple Extraction Accuracy | N/A | ≥75% | Week 6 | Human evaluation on 100 sample triples |
| TF-IDF Accuracy | N/A | ≥95% | Week 3 | Comparison vs scikit-learn reference |
| PageRank Accuracy | N/A | ≥95% | Week 4 | Comparison vs NetworkX reference |
| Causality Detection Precision | N/A | ≥70% | Week 5 | Manual validation on 50 causal pairs |
| Community Detection Quality | N/A | Modularity ≥0.30 | Week 5 | Louvain modularity score |
| Topic Coherence | N/A | ≥60% | Week 7 | UMass coherence metric |
| Analytics Latency (p95) | N/A | <2s | Week 6 | End-to-end for 500-node graphs |
| User Comprehension | N/A | ≥85% | Week 10 | Survey: "I understand entity importance rankings" |

---

### MoSCoW Prioritization

**Must Have**:
- NLTK preprocessing (stopword removal, lemmatization)
- spaCy NER with entity type labels
- Triple extraction producing (subject, predicate, object) format
- TF-IDF keyword frequency scoring
- NetworkX PageRank centrality
- Louvain community detection
- Causal marker detection (pattern-based)
- Interactive visualization with filtering
- Edge strength visualization (thickness)

**Should Have**:
- Betweenness and degree centrality
- PMI (Pointwise Mutual Information) for edge strength
- BERTopic for semantic topic modeling
- KeyBERT for transformer-based keyword extraction
- Hierarchical community visualization
- Export analytics as JSON/CSV
- Comparative analytics across documents

**Could Have**:
- YAKE unsupervised keyword extraction
- CausalNLP transformer-based causality detection
- HDBSCAN density-based clustering
- Real-time collaborative graph editing
- Custom entity type training
- Graph query language interface

**Won't Have** (this release):
- Production graph database integration (Neo4j, FalkorDB)
- LLM-based relationship extraction
- Multi-language support beyond English
- Real-time streaming analytics
- Authentication/authorization system

---

### Out of Scope

- Production deployment infrastructure (users handle their own hosting)
- LLM API integration for generation tasks
- Real-time collaborative features
- Custom NER model training interface
- Graph database deployment and management
- Enterprise authentication systems
- Mobile application development

---

### Dependencies

**Required**:
- spaCy `en_core_web_sm` model (must be pre-downloaded)
- NLTK stopwords corpus (must be pre-downloaded)
- NetworkX >= 3.0
- scikit-learn >= 1.3
- Modern browser with JavaScript enabled
- Python >= 3.8 (for backend analytics)

**Optional (for advanced features)**:
- BERTopic >= 0.15 (for topic modeling)
- KeyBERT >= 0.8 (for transformer-based keywords)
- python-louvain >= 0.16 (for community detection)

**Assumed**:
- User has basic understanding of NLP and graph theory concepts
- Text input is English language
- Documents are <10,000 words for client-side processing
- Users understand statistical metrics (TF-IDF, PageRank)

---

### Open Questions

**OQ-001**: Should causality detection use pattern-based or transformer-based approach?  
**Impact**: Pattern-based is faster (50ms vs 500ms) but less accurate (70% vs 85%)  
**Resolution Deadline**: Week 2  
**Owner**: Technical Lead

**OQ-002**: What threshold for edge strength filtering (hide weak connections)?  
**Impact**: User experience vs information completeness  
**Resolution Deadline**: Week 3  
**Owner**: UX Designer  

**OQ-003**: Should we pre-compute analytics or compute on-demand?  
**Impact**: Startup time vs memory usage  
**Resolution Deadline**: Week 2  
**Owner**: Engineering Lead

**OQ-004**: How many communities is optimal for user navigation?  
**Impact**: Too few = overgeneralization, too many = cognitive overload  
**Resolution Deadline**: Week 4  
**Owner**: Product Manager

---

## PART II: TECHNICAL ARCHITECTURE DOCUMENT (TAD)

### Architecture Overview

**From text to analytics-enhanced knowledge graph**: System → receives unstructured text input → preprocesses via NLTK (tokenization, lemmatization, stopword removal) → extracts entities via spaCy NER → generates semantic triples through dependency parsing → **analyzes entity importance via TF-IDF and PageRank** → **detects causal relationships via pattern matching** → constructs graph via NetworkX → **identifies communities via density-based clustering (DBSCAN)** → **computes graph metrics** → delivers interactive visualization with importance-weighted nodes, strength-weighted edges, and color-coded communities.

**Architecture Pattern**: Sequential pipeline with four-layer analytics stack (Entity → Relation → Metadata → Cluster)

---

### Component Specifications

#### TAD-C001: Preprocessing Engine (unchanged from v1.0.0)

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

#### TAD-C002: Entity Recognition Service (unchanged)

**Component**: SpaCyNERExtractor  
**Responsibility**: Extractor → processes preprocessed tokens → identifies named entities with type labels → delivers structured entity list with spans  
**Interfaces**:
```typescript
interface INERExtractor {
  extractEntities(text: string): Entity[]
}
type Entity = {
  text: string
  label: string
  start: number
  end: number
}
```
**Dependencies**: spaCy `en_core_web_sm` model  
**Configuration**: `confidence_threshold=0.5`, `entity_types=["GPE","LOC","PERSON","ORG","FAC","QUANTITY"]`

---

#### TAD-C003: Triple Extraction Engine (unchanged)

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

#### TAD-C004: Entity Importance Analyzer (NEW)

**Component**: EntityImportanceScorer  
**Responsibility**: Analyzer → receives entity list and corpus → computes TF-IDF scores → calculates graph centrality metrics → produces importance-ranked entity list  
**Interfaces**:
```typescript
interface IImportanceAnalyzer {
  computeTFIDF(entities: Entity[], corpus: string[]): TFIDFScores
  computeCentrality(graph: Graph): CentralityScores
  rankEntities(entities: Entity[], scores: Scores): RankedEntity[]
}
type TFIDFScores = { [entityId: string]: number }
type CentralityScores = {
  pagerank: { [nodeId: string]: number }
  degree: { [nodeId: string]: number }
  betweenness: { [nodeId: string]: number }
}
type RankedEntity = Entity & {
  frequency: number
  tfidf: number
  pagerank: number
  combinedScore: number
}
```
**Dependencies**: scikit-learn TfidfVectorizer, NetworkX centrality algorithms  
**Configuration**: `tfidf_ngram_range=(1,2)`, `pagerank_alpha=0.85`, `pagerank_max_iter=100`

---

#### TAD-C005: Causality Detection Engine (NEW)

**Component**: CausalRelationClassifier  
**Responsibility**: Classifier → analyzes triple predicates → detects causal markers → computes relationship strength → labels edge types and confidence scores  
**Interfaces**:
```typescript
interface ICausalityDetector {
  detectCausality(triple: Triple, doc: SpacyDoc): CausalEdge
  computeStrength(source: Entity, target: Entity, corpus: string[]): number
}
type CausalEdge = Triple & {
  edgeType: 'causal' | 'dependency' | 'hierarchy' | 'composition' | 'technical'
  causalityScore: number
  strength: number
  pmi: number
}
```
**Dependencies**: spaCy dependency patterns, custom causal marker list  
**Configuration**: `causal_markers=["causes","leads to","results in","enables","reduces"]`, `strength_threshold=0.3`

---

#### TAD-C006: Community Detection Service (NEW)

**Component**: GraphCommunityClustering  
**Responsibility**: Clusterer → receives knowledge graph → applies density-based clustering (DBSCAN) over lightweight token vectors → detects semantic communities → assigns community ids → generates community keyword summaries  
**Interfaces**:
```typescript
interface ICommunityDetector {
  detectCommunities(graph: Graph, options?: DbscanOptions): Community[]
  labelCommunities(communities: Community[], entities: Entity[]): LabeledCommunity[]
}
type DbscanOptions = {
  eps: number
  minPts: number
  maxNodes: number
  maxSteps: number
}
type Community = {
  id: number
  nodes: string[]
  color: string
}
type LabeledCommunity = Community & {
  label: string
  topKeywords: string[]
  density: number
}
```
**Dependencies**: In-house DBSCAN (no external clustering dependency)  
**Configuration**: `eps=0.55`, `minPts=2`, `maxNodes=200`, `maxSteps=120000`

---

#### TAD-C007: Graph Metrics Calculator (NEW)

**Component**: GraphMetricsComputer  
**Responsibility**: Computer → receives constructed graph → calculates density, diameter, clustering coefficient → computes per-community statistics → produces comprehensive graph metrics  
**Interfaces**:
```typescript
interface IMetricsCalculator {
  computeGraphMetrics(graph: Graph): GraphMetrics
  computeCommunityMetrics(graph: Graph, communities: Community[]): CommunityMetrics[]
}
type GraphMetrics = {
  nodeCount: number
  edgeCount: number
  density: number
  diameter: number
  avgPathLength: number
  clusteringCoefficient: number
  connectedComponents: number
}
type CommunityMetrics = {
  communityId: number
  internalEdges: number
  externalEdges: number
  conductance: number
  coverage: number
}
```
**Dependencies**: NetworkX graph algorithms  
**Configuration**: `timeout_seconds=10`

---

#### TAD-C008: Graph Construction Service (updated from v1.0.0)

**Component**: NetworkXGraphBuilder  
**Responsibility**: Builder → consumes entity triples and analytics → constructs directed graph with weighted nodes and edges → integrates importance scores and community assignments → delivers analytics-enriched graph  
**Interfaces**:
```typescript
interface IGraphBuilder {
  buildGraph(triples: CausalEdge[], entities: RankedEntity[]): AnalyticsGraph
  assignCommunities(graph: AnalyticsGraph, communities: LabeledCommunity[]): AnalyticsGraph
}
type AnalyticsGraph = {
  nodes: AnalyticsNode[]
  edges: AnalyticsEdge[]
  communities: LabeledCommunity[]
  metrics: GraphMetrics
}
type AnalyticsNode = {
  id: string
  label: string
  frequency: number
  tfidf: number
  pagerank: number
  community: number
  radius: number  // computed from importance scores
}
type AnalyticsEdge = {
  source: string
  target: string
  label: string
  edgeType: string
  causalityScore: number
  strength: number
  thickness: number  // computed from strength
}
```
**Dependencies**: NetworkX graph construction, TAD-C004, TAD-C005, TAD-C006  
**Configuration**: `node_size_scale=0.5`, `edge_thickness_scale=3.0`

---

#### TAD-C009: Analytics Visualization Controller (updated from v1.0.0)

**Component**: ReactAnalyticsUI  
**Responsibility**: Controller → manages pipeline state → orchestrates analytics computation → renders importance-weighted visualizations → handles community filtering and metric toggling  
**Interfaces**:
```typescript
interface IAnalyticsController {
  processPipelineWithAnalytics(text: string): Promise<AnalyticsPipelineResult>
  filterByCommunity(communityId: number): void
  toggleMetricsDisplay(show: boolean): void
  exportAnalytics(format: 'json' | 'csv'): string
}
type AnalyticsPipelineResult = {
  preprocessed: PreprocessedText
  entities: RankedEntity[]
  triples: CausalEdge[]
  graph: AnalyticsGraph
  communities: LabeledCommunity[]
  metrics: GraphMetrics
}
```
**Dependencies**: React state management, Tailwind CSS, Canvas 2D API  
**Configuration**: `max_stages=7`, `animation_duration=300ms`, `default_community_filter="all"`

---

### Integration Contracts

#### TAD-I001: Preprocessing → NER Interface (unchanged)

**Interface**: TextNormalizationContract  
**Protocol**: In-memory function call  
**Data Format**:
```typescript
Input: { raw: string }
Output: { tokens: string[], lemmas: string[] }
```
**Error Handling**: Invalid UTF-8 → return empty array + log warning

---

#### TAD-I002: NER → Triple Extraction Interface (unchanged)

**Interface**: EntityToTripleContract  
**Protocol**: In-memory object passing  
**Data Format**:
```typescript
Input: { entities: Entity[], doc: SpacyDoc }
Output: { triples: Triple[] }
```
**Error Handling**: No entities found → return empty triple array

---

#### TAD-I003: Triple → Entity Importance Interface (NEW)

**Interface**: TripleToImportanceContract  
**Protocol**: In-memory object transformation  
**Data Format**:
```typescript
Input: { entities: Entity[], triples: Triple[], corpus: string[] }
Output: { rankedEntities: RankedEntity[], tfidfScores: TFIDFScores }
```
**Error Handling**: Empty corpus → use frequency-only ranking

---

#### TAD-I004: Triple → Causality Detection Interface (NEW)

**Interface**: TripleToCausalityContract  
**Protocol**: In-memory enrichment  
**Data Format**:
```typescript
Input: { triples: Triple[], doc: SpacyDoc, corpus: string[] }
Output: { causalEdges: CausalEdge[] }
```
**Error Handling**: No causal markers detected → assign default strength 0.5

---

#### TAD-I005: Graph → Community Detection Interface (NEW)

**Interface**: GraphToCommunityContract  
**Protocol**: In-memory graph analysis  
**Data Format**:
```typescript
Input: { graph: Graph }
Output: { communities: LabeledCommunity[], modularity: number }
```
**Error Handling**: Graph too small (<5 nodes) → return single community

---

#### TAD-I006: Analytics → Visualization Interface (NEW)

**Interface**: AnalyticsToRenderContract  
**Protocol**: In-memory data binding  
**Data Format**:
```typescript
Input: { 
  graph: AnalyticsGraph,
  communities: LabeledCommunity[],
  metrics: GraphMetrics,
  selectedCommunity: number | 'all'
}
Output: { 
  renderableNodes: CanvasNode[],
  renderableEdges: CanvasEdge[],
  displayMetrics: UIMetrics 
}
```
**Error Handling**: Invalid community filter → default to 'all'

---

### Architectural Decisions

#### ADR-001: Use spaCy for NER Instead of Custom BERT Model (unchanged from v1.0.0)

**Status**: Accepted  
**Date**: 2026-01-22  
**Deciders**: Architecture Team

**Context**: Need named entity recognition with balance of accuracy, speed, and ease of deployment.

**Decision**: Use pre-trained spaCy `en_core_web_sm` model for entity extraction.

**Alternatives Considered**:
1. Fine-tuned BERT model: Higher accuracy (90%+ F1) but requires GPU, slow inference
2. OpenAI API for NER: High accuracy but vendor lock-in, costs
3. Rule-based regex: Fast but low accuracy (40-50%)

**Rationale**: spaCy provides 85%+ accuracy, <500ms inference on CPU, zero external dependencies, FOSS licensed (MIT).

**Consequences**:
- **Positive**: Fast deployment, no GPU required, offline capability
- **Negative**: Accuracy ceiling at ~85%
- **Neutral**: Users can swap spaCy for custom models via interface

---

#### ADR-002: Use Dependency Parsing for Triple Extraction (unchanged)

**Status**: Accepted  
**Date**: 2026-01-22

**Context**: Need (subject, predicate, object) triple extraction.

**Decision**: Use spaCy dependency parser with pattern matching.

**Rationale**: Fast (<100ms), already loaded for NER, deterministic.

**Consequences**:
- **Positive**: Zero additional dependencies
- **Negative**: Lower recall than OpenIE (75% vs 85%)

---

#### ADR-003: Use NetworkX for Graph Construction (unchanged)

**Status**: Accepted  
**Date**: 2026-01-22

**Context**: Need graph data structure.

**Decision**: Use NetworkX in-memory graph.

**Rationale**: 50+ algorithms, pure Python, BSD licensed.

**Consequences**:
- **Positive**: Algorithm-rich, Python-native
- **Negative**: No persistence, memory-limited

---

#### ADR-004: Use TF-IDF for Keyword Importance Instead of KeyBERT (NEW)

**Status**: Accepted  
**Date**: 2026-01-22  
**Deciders**: Architecture Team

**Context**: Need to rank entities by importance for visualization. Must balance accuracy with performance.

**Decision**: Use scikit-learn TfidfVectorizer for keyword importance scoring as primary method.

**Alternatives Considered**:
1. **KeyBERT (transformer-based)**: Higher semantic accuracy but requires 500MB model download, 2-3s processing time, GPU for large docs
2. **YAKE (unsupervised)**: Language-agnostic, fast, but requires parameter tuning, less interpretable scores
3. **Frequency-only**: Fastest but ignores document-level importance (common words dominate)

**Rationale**: TF-IDF provides good balance of accuracy (within 10% of KeyBERT for most use cases), speed (<50ms for 1000 words), interpretability, and zero model downloads. scikit-learn is already widely deployed.

**Consequences**:
- **Positive**: Fast computation, no model download, interpretable scores, deterministic
- **Negative**: Cannot capture semantic similarity (e.g., "ML" vs "machine learning" treated as different)
- **Neutral**: Can add KeyBERT as optional enhancement in Phase 2 for users with larger documents

---

#### ADR-005: Use Pattern-Based Causality Detection Instead of CausalNLP (NEW)

**Status**: Accepted  
**Date**: 2026-01-22  
**Deciders**: Architecture Team

**Context**: Need to identify causal relationships in text. Must work reliably without large model dependencies.

**Decision**: Use spaCy dependency parsing with custom causal marker patterns ("causes", "leads to", "results in", "enables", "reduces").

**Alternatives Considered**:
1. **CausalNLP (transformer-based)**: Pre-trained CausalBERT achieves 85% precision but requires 400MB model, 1-2s per sentence, GPU recommended
2. **Rule-based with extensive pattern library**: High recall (90%+) but brittle, requires domain-specific tuning
3. **No causality detection**: Treat all relationships equally (baseline)

**Rationale**: Pattern-based approach achieves 70-75% precision (acceptable for v2.0), processes in <50ms, deterministic, zero additional dependencies. Most causal relationships in technical text use explicit markers.

**Consequences**:
- **Positive**: Fast, lightweight, deterministic, no model download
- **Negative**: Misses implicit causality (e.g., "Increasing temperature melts ice" without explicit "causes")
- **Neutral**: Users with higher accuracy requirements can integrate CausalNLP via plugin architecture in future

---

#### ADR-006: Use Density-Based DBSCAN for Community Detection (NEW)

**Status**: Accepted  
**Date**: 2026-01-22  
**Deciders**: Architecture Team

**Context**: Need to detect semantic communities in knowledge graphs. Must handle graphs of 10-1000 nodes efficiently.

**Decision**: Use a lightweight, dependency-free DBSCAN density clustering implementation for community detection.

**Alternatives Considered**:
1. **Louvain algorithm**: Strong graph-structure communities but requires modularity tooling and additional dependency surface
2. **Leiden algorithm**: Often higher modularity but adds dependency and operational complexity
3. **Label Propagation**: Fast but non-deterministic for reproducibility
4. **Hierarchical clustering on embeddings**: Higher semantic accuracy but requires embeddings/model runtime

**Rationale**: DBSCAN is density-based, deterministic under stable ordering, requires no external clustering library, and can be bounded (max nodes/steps) to prevent runaway computation while still producing usable communities and keyword summaries.

**Consequences**:
- **Positive**: Dependency-free, bounded execution, configurable via `eps/minPts`, stable results
- **Negative**: Community quality depends on feature representation and `eps/minPts` tuning; no modularity score
- **Neutral**: Louvain/Leiden can be added later as optional algorithms behind the same interface

---

#### ADR-007: Compute Analytics On-Demand vs Pre-Compute (NEW)

**Status**: Accepted  
**Date**: 2026-01-22  
**Deciders**: Engineering Lead, UX Designer

**Context**: Analytics computations (TF-IDF, PageRank, DBSCAN clustering) take 500ms-2s. Must decide whether to compute during initial processing or when user requests analytics view.

**Decision**: Pre-compute all analytics during initial pipeline execution.

**Alternatives Considered**:
1. **On-demand computation**: Compute only when user clicks "Show Analytics" - reduces initial load time but adds 1-2s delay when toggling analytics view
2. **Lazy loading with caching**: Compute on first access, cache results - complex state management
3. **Web Worker background computation**: Parallel processing but requires Worker setup, message passing overhead

**Rationale**: Pre-computation adds <2s to initial pipeline execution but enables instant analytics toggling, filtering, and visualization updates. User feedback indicates willingness to wait 3-4s upfront for instant interactive exploration.

**Consequences**:
- **Positive**: Instant analytics view toggling (<100ms), smooth filtering experience, simpler state management
- **Negative**: Initial processing time increases from ~1s to ~3s
- **Neutral**: For very large graphs (>500 nodes), can add progressive computation in future

---

### Quality Attributes

#### Performance

**Requirement**: System processes 1000-word documents with analytics end-to-end in <4 seconds (p95 latency).

**Architecture Pattern**: Sequential pipeline with early-exit on errors, efficient sparse matrix operations for TF-IDF, incremental graph construction.

**Validation**: Load test with 100 sample documents measuring per-stage latency.

**Metrics**:
```
NLTK preprocessing: <50ms
spaCy NER: <500ms
Triple extraction: <200ms
TF-IDF computation: <100ms
Graph construction: <150ms
PageRank calculation: <300ms
Louvain community detection: <400ms
Causality detection: <100ms
Visualization render: <300ms
Total: <2100ms (with 90% buffer = 3990ms)
```

---

#### Scalability

**Requirement**: Support documents up to 10,000 words and graphs up to 500 nodes without client-side memory issues.

**Architecture Pattern**: Sparse matrix representations for TF-IDF, efficient NetworkX data structures, canvas-based rendering (not DOM).

**Validation**: Stress test with 15,000-word documents and 750-node graphs monitoring browser memory usage (<800MB).

**Constraints**: 
- Beyond 10k words, recommend server-side processing
- Beyond 500 nodes, recommend graph simplification (edge pruning, node aggregation)

---

#### Accuracy

**Requirement**: Analytics metrics match reference implementations within acceptable tolerances.

**Architecture Pattern**: Use established libraries (scikit-learn, NetworkX) as ground truth, validate outputs.

**Validation**: Unit tests comparing outputs to reference implementations.

**Tolerances**:
- TF-IDF scores: ≤5% relative error vs scikit-learn
- PageRank scores: ≤5% relative error vs NetworkX
- Community modularity: ≤10% relative error vs python-louvain
- Causality precision: ≥70% on manually labeled test set

---

#### Usability

**Requirement**: Users with basic NLP knowledge understand analytics metrics without documentation.

**Architecture Pattern**: Inline tooltips, progressive disclosure UI, visual encoding of metrics (node size = importance, edge thickness = strength).

**Validation**: User testing with 10 participants achieving >85% task completion without help.

**Metrics**:
- Time to understand PageRank ranking: <60 seconds
- Ability to identify strongest causal relationship: >90% accuracy
- Understanding of community groupings: >85% correct interpretation

---

#### Maintainability

**Requirement**: Developers can swap analytics algorithms (e.g., TF-IDF → KeyBERT) without rewriting UI.

**Architecture Pattern**: Interface-based component contracts, dependency injection, config-driven algorithm selection.

**Validation**: Successfully swap TF-IDF for KeyBERT implementation in <6 hours.

**Design Principles**:
- Each analytics component implements interface contract
- No direct library imports in UI layer
- Configuration file externalizes algorithm choices

---

#### Observability

**Requirement**: Developers can debug analytics failures by inspecting intermediate outputs and metrics.

**Architecture Pattern**: Stage-level logging with metric snapshots, structured error messages, debug mode with detailed outputs.

**Validation**: Inject errors at each analytics stage and verify clear error messages + recovery guidance.

**Telemetry**:
```typescript
interface AnalyticsStageMetrics {
  stage: string
  status: "success" | "error"
  latency_ms: number
  input_size: number
  output_size: number
  metrics: {
    avg_tfidf?: number
    avg_pagerank?: number
    num_communities?: number
    modularity?: number
  }
  error_message?: string
}
```

---

### Deployment Strategy

**Pattern**: Static artifact deployment (client-side only)

**Deployment Flow**:
1. Build React application → bundle JavaScript/CSS with analytics libraries
2. Verify NLP model loading → test spaCy model import
3. Validate analytics computation → run test suite on sample documents
4. Deploy to CDN → upload to Cloudflare Pages / Netlify
5. Validate in production → smoke test with analytics pipeline

**Rollback Strategy**: Revert to previous CDN version via version tags.

**Zero-Downtime**: Not applicable (client-side app, no backend).

---

### Migration Path

**Current State**: Users have v1.0.0 with basic entity extraction and graph construction.

**Target State**: Users have v2.0.0 with entity importance ranking, causality detection, and community clustering.

**Migration Steps**:
1. **Phase 1** (Week 1-3): Add TF-IDF scoring and basic centrality
2. **Phase 2** (Week 4-5): Add causality detection and edge strength
3. **Phase 3** (Week 6-7): Add Louvain community detection
4. **Phase 4** (Week 8-9): Add interactive analytics dashboard with filtering
5. **Phase 5** (Week 10): Performance optimization and user testing

**Backward Compatibility**: v2.0.0 API-compatible with v1.0.0 - analytics are additive enhancements.

**Data Migration**: Not applicable (session-only storage, no persistent data).

---

## PART III: REQUIREMENT TRACEABILITY MATRIX

| PRD ID | PRD User Story | TAD Component | TAD Interface | ADR |
|--------|----------------|---------------|---------------|-----|
| PRD-E001-S001 | Entity Extraction | TAD-C002 | TAD-I002 | ADR-001 |
| PRD-E001-S002 | Triple Extraction | TAD-C003 | TAD-I003 | ADR-002 |
| PRD-E001-S003 | Interactive Visualization | TAD-C009 | TAD-I006 | N/A |
| PRD-E001-S004 | Graph Construction | TAD-C008 | TAD-I005 | ADR-003 |
| PRD-E002-S001 | Keyword Frequency Scoring | TAD-C004 | TAD-I003 | ADR-004 |
| PRD-E002-S002 | Centrality-Based Importance | TAD-C004 | TAD-I003 | ADR-004 |
| PRD-E003-S001 | Causal Relationship Detection | TAD-C005 | TAD-I004 | ADR-005 |
| PRD-E003-S002 | Relationship Strength Measurement | TAD-C005 | TAD-I004 | ADR-005 |
| PRD-E004-S001 | Automated Community Clustering | TAD-C006 | TAD-I005 | ADR-006 |
| PRD-E004-S002 | Hierarchical Topic Modeling | TAD-C006 | TAD-I005 | ADR-006 |
| PRD-E005-S001 | Real-Time Metric Updates | TAD-C009 | TAD-I006 | ADR-007 |
| PRD-E005-S002 | Comparative Analytics | TAD-C009 | TAD-I006 | ADR-007 |

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
- [x] User personas identified (data analyst, researcher, domain expert, knowledge worker)
- [x] Analytics requirements quantified (≥70% causality precision, ≥0.30 modularity)

### TAD Validation

- [x] Components have single responsibility (SRP)
- [x] Interfaces specified with TypeScript contracts
- [x] Architectural decisions documented with ADR format
- [x] Quality attributes have measurable scenarios
- [x] Deployment strategy defined
- [x] No business logic in TAD (focuses on HOW not WHY)
- [x] Domain-agnostic design (analytics pipeline, not domain-specific)
- [x] Four new components for analytics layers (TAD-C004 through TAD-C007)
- [x] Five new ADRs addressing key algorithm choices

### Traceability Validation

- [x] PRD-to-TAD mapping established in traceability matrix
- [x] All user stories map to TAD components
- [x] All TAD components trace back to PRD requirements
- [x] ADRs reference specific user stories where applicable
- [x] New analytics epics fully traced to implementation

---

## PART V: OPEN QUESTIONS & RISKS

### Open Questions

**OQ-001**: Pattern-based vs transformer-based causality detection?  
**Impact**: Accuracy (70% vs 85%) vs Speed (50ms vs 500ms) vs Dependencies (0 vs 400MB model)  
**Resolution Deadline**: Week 2  
**Owner**: Technical Lead  
**Status**: RESOLVED - ADR-005 selects pattern-based for v2.0.0

**OQ-002**: Edge strength threshold for visual filtering?  
**Impact**: User experience (clutter reduction) vs information completeness  
**Resolution Deadline**: Week 3  
**Owner**: UX Designer  
**Proposed Values**: 0.2 (show only moderate-strong), 0.3 (show only strong), user-configurable slider

**OQ-003**: Pre-compute vs on-demand analytics?  
**Impact**: Initial latency (+2s) vs interactive latency (+1-2s per toggle)  
**Resolution Deadline**: Week 2  
**Owner**: Engineering Lead  
**Status**: RESOLVED - ADR-007 selects pre-compute

**OQ-004**: Optimal community count for navigation?  
**Impact**: Granularity (too few = overgeneralization) vs Usability (too many = cognitive overload)  
**Resolution Deadline**: Week 4  
**Owner**: Product Manager  
**Proposed Range**: 3-7 communities with automatic selection based on modularity

**OQ-005**: Should we support BERTopic for semantic topic modeling in v2.0.0?  
**Impact**: Semantic accuracy (+15%) vs Model size (500MB) vs Computation time (+3-5s)  
**Resolution Deadline**: Week 3  
**Owner**: Product Manager  
**Status**: DEFERRED to v2.1.0 as "Should Have" feature

### Risks

**RISK-001**: TF-IDF may not capture semantic importance for technical jargon  
**Mitigation**: Add KeyBERT as optional enhancement, validate on domain-specific corpora  
**Probability**: Medium | **Impact**: Medium | **Owner**: Data Scientist

**RISK-002**: Pattern-based causality detection misses implicit causal relationships  
**Mitigation**: Expand pattern library, add user feedback mechanism for missed causality  
**Probability**: High | **Impact**: Medium | **Owner**: NLP Engineer

**RISK-003**: Louvain community detection may produce unintuitive clusters for small graphs  
**Mitigation**: Set minimum graph size (10 nodes), fall back to single community for smaller graphs  
**Probability**: Medium | **Impact**: Low | **Owner**: Engineering Lead

**RISK-004**: Analytics computation time exceeds 4s target for large documents  
**Mitigation**: Add progressive computation, optimize TF-IDF with sparse matrices, cache intermediate results  
**Probability**: Medium | **Impact**: High | **Owner**: Performance Engineer

**RISK-005**: Users may not understand statistical metrics (PageRank, modularity, PMI)  
**Mitigation**: Add inline tooltips, provide educational content, use visual encodings (size, color)  
**Probability**: High | **Impact**: High | **Owner**: UX Designer

---

## PART VI: ANALYTICS LAYER SPECIFICATION

### Entity Layer (Nodes)

**Metrics Computed**:
1. **Frequency**: Count of entity mentions in corpus
2. **TF-IDF Score**: Term frequency × inverse document frequency (normalized [0,1])
3. **PageRank**: Importance based on graph structure (normalized [0,1])
4. **HITS (Hubs & Authorities)**: Hub score (points to authorities) and Authority score (pointed to by hubs)
5. **Degree Centrality**: Number of connections (normalized [0,1])
6. **Betweenness Centrality**: Fraction of shortest paths through node (normalized [0,1])
7. **Closeness Centrality**: Inverse sum of shortest paths to all other nodes (normalized [0,1])
8. **Combined Score**: Weighted average `0.4×frequency + 0.3×tfidf + 0.3×pagerank`

**Visual Encoding**:
- Node radius: `baseRadius × (1 + combinedScore × 2)`
- Border width: `2px if pagerank > 0.08, else 0px`
- Pulse animation: Higher frequency = faster pulse

---

### Relation Layer (Edges)

**Metrics Computed**:
1. **Causality Score**: Confidence of causal relationship [0,1] based on marker presence
2. **Co-occurrence Frequency**: Times source and target appear in same sentence/paragraph
3. **PMI (Pointwise Mutual Information)**: `log(P(source,target) / (P(source)×P(target)))`
4. **Edge Strength**: Normalized combination of causality + co-occurrence + PMI [0,1]
5. **Edge Type**: Classification (causal, dependency, hierarchy, composition, technical)

**Visual Encoding**:
- Edge thickness: `1px + strength × 4px`
- Edge opacity: `strength × 0.8`
- Edge color: Inherited from target node community
- Edge label: Shown only for strength > 0.7

---

### Metadata Layer (Attributes)

**Graph-Level Metrics**:
1. **Density**: `actualEdges / possibleEdges`
2. **Diameter**: Longest shortest path between any two nodes
3. **Average Path Length**: Mean shortest path across all node pairs
4. **Clustering Coefficient**: Tendency of nodes to cluster
5. **Connected Components**: Number of disconnected subgraphs

**Community-Level Metrics**:
1. **Modularity**: Quality of community division [-0.5, 1.0], higher = better
2. **Internal Edge Density**: Fraction of edges within community
3. **Conductance**: Ratio of external to total edges (lower = better community)
4. **Coverage**: Fraction of edges within communities

---

### Cluster Layer (Communities)

**Community Detection Parameters**:
- **Algorithm**: Louvain modularity maximization
- **Resolution**: 1.0 (standard)
- **Min Community Size**: 3 nodes
- **Max Communities**: 8 (for visualization clarity)

**Community Labeling Strategy**:
1. Extract all entities in community
2. Compute TF-IDF scores within community
3. Select top 3 keywords by TF-IDF
4. Concatenate as label (e.g., "Training & Data & Optimization")
5. Simplify to readable form (e.g., "Training & Data")

**Visual Encoding**:
- Distinct color per community (predefined palette)
- Spatial grouping via force-directed layout with community attraction
- Community filter enables isolation view

---

## PART VII: GLOSSARY

**Entity**: Named item in text (person, place, organization, date, etc.) identified by NER.

**Triple**: Semantic relationship in (subject, predicate, object) format.

**Knowledge Graph**: Graph data structure where nodes are entities and edges are relationships.

**TF-IDF**: Term Frequency-Inverse Document Frequency, measures keyword importance by balancing frequency with rarity.

**PageRank**: Graph centrality algorithm measuring node importance based on incoming edges (originally developed for web search).

**Causality Score**: Confidence [0,1] that a relationship represents causation rather than correlation.

**PMI (Pointwise Mutual Information)**: Statistical measure of association between two entities based on co-occurrence patterns.

**Community**: Subset of nodes in graph with dense internal connections and sparse external connections.

**Modularity**: Metric [-0.5, 1.0] measuring quality of community detection; higher values indicate stronger community structure.

**Louvain Algorithm**: Greedy optimization algorithm for community detection that maximizes modularity.

**FOSS (Free and Open Source Software)**: Software with source code freely available under open licenses.

**GraphRAG**: Graph Retrieval-Augmented Generation, technique combining knowledge graphs with LLM generation.

---

## Document Metadata

**Document Type**: PRD + TAD (Combined)  
**Version**: 2.0.0  
**Previous Version**: 1.0.0  
**Last Updated**: 2026-01-22  
**Authors**: Product Team, Architecture Team, Analytics Team  
**Reviewers**: [Pending]  
**Status**: Draft → Pending Review  
**Next Review Date**: 2026-01-29

**Major Changes from v1.0.0**:
- Added 4 new analytics epics (PRD-E002 through PRD-E005)
- Added 5 new TAD components (TAD-C004 through TAD-C008 updated)
- Added 4 new ADRs (ADR-004 through ADR-007)
- Enhanced traceability matrix with analytics layers
- Added comprehensive analytics layer specification (Part VII)
- Updated success metrics with analytics targets

**Adherence to Guidelines**: This document follows `prd-tad-guidelines.md` CID framework, maintains PRD/TAD separation, uses problem-first approach, specifies measurable outcomes, documents architectural decisions with ADRs, establishes bidirectional traceability, and structures content hierarchically with user-centric narratives.

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
- AIE book chapter snippet demo (multi-input, extraction fidelity): `canvas/src/features/demo/GraphRagAieBookChapterSummariesDemo.tsx`, `canvas/src/features/demo/aieBookChapterSnippets.ts`
- Tests (neutral fixtures + demo-fidelity fixtures): `canvas/src/__tests__/graphragTextPipeline.test.ts`, `canvas/src/__tests__/aieBookGraphRagTextPipeline.test.ts`, `canvas/src/__tests__/fixtures/graphrag-text-demo.md`

### Scope Notes

- The Canvas demo remains extraction-only (no LLM API integration) and runs without server dependencies.
- Library references and code snippets are shown for transparency; the demo pipeline itself uses heuristic implementations (bounded summarization + sentence-level evidence spans) to stay portable.
- Context-Aware Analytics (PageRank / HITS / Betweenness / Closeness) can be toggled from BottomPanel (Parser/Stats); the effective settings are captured in `GraphData.metadata.graphragTextPipeline.config`.
