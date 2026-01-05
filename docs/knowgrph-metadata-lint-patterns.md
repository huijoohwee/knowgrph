# Knowledge Graph Metadata Lint Patterns

> **Derived from**: `universal-lean-startup-schema.json`  
> **Purpose**: Real-world naming conventions for kg/RAG/GraphRAG configurations

---

## Namespace Conventions

### Standard Prefixes

| Prefix | IRI Base | Purpose | Usage |
|--------|----------|---------|-------|
| `ls:` | `http://example.org/lean-startup/` | Domain-specific concepts | Business domain classes/properties |
| `kg:` | `http://example.org/kg/` | Knowledge graph structures | Graph entities, ontologies, mappings |
| `rag:` | `http://example.org/rag/` | RAG/GraphRAG configs | Embeddings, contexts, workflows |
| `dt:` | `http://example.org/decision-tree/` | Decision tree elements | Nodes, branches, evidence, scoring |
| `example:` | `http://example.org/instances/` | Instance data | Actual data instances |

### Semantic Web Standards

| Prefix | IRI Base | Purpose |
|--------|----------|---------|
| `rdf:` | `http://www.w3.org/1999/02/22-rdf-syntax-ns#` | RDF primitives |
| `rdfs:` | `http://www.w3.org/2000/01/rdf-schema#` | Schema definitions |
| `xsd:` | `http://www.w3.org/2001/XMLSchema#` | Data types |
| `owl:` | `http://www.w3.org/2002/07/owl#` | OWL ontologies |

---

## ID Naming Patterns

### General Structure
```
{namespace}:{category}-{descriptive-name}
```

### Category Prefixes

| Category | Pattern | Example |
|----------|---------|---------|
| **Ontology** | `ontology-{domain}` | `example:ontology-lean-startup` |
| **Entity** | `entity-{concept}` | `example:entity-hypothesis` |
| **Model** | `model-{purpose}` | `example:model-startup-embeddings` |
| **Embedding** | `{context}-embedding` | `example:stage-embedding` |
| **Config** | `{type}-config-{scope}` | `example:embedding-config-lean` |
| **Rule** | `rule-{constraint}` | `example:rule-customer-relations` |
| **Context** | `context-{purpose}` | `example:context-customer-discovery` |
| **Action** | `action-{activity}` | `example:action-customer-interviews` |
| **Branch** | `branch-{condition}` | `example:branch-problem-solution-fit` |
| **Node** | `node-{decision}` | `example:node-hypothesis-formation` |
| **Metric** | `metric-{name}` | `example:metric-activation-rate` |
| **Evidence** | `evidence-{type}` | `example:evidence-early-stage` |
| **Insight** | `insight-{topic}` | `example:insight-customer-problem` |
| **Alternative** | `alt-{option}` | `example:alt-persevere` |
| **Outcome** | `outcome-{process}` | `example:outcome-customer-discovery` |
| **Hypothesis** | `hypothesis-{focus}` | `example:hypothesis-customer-problem` |
| **Experiment** | `experiment-{test}` | `example:experiment-pricing` |
| **MVP** | `mvp-{variant}` | `example:mvp-focused` |
| **Pivot** | `pivot-{type}` | `example:pivot-zoom-in` |
| **Engine** | `growth-engine-{type}` | `example:growth-engine-viral` |

---

## RAG/GraphRAG Specific Patterns

### Embedding Configurations

```json
{
  "@id": "example:embedding-config-{domain}",
  "@type": "rag:EmbeddingModel",
  "modelName": "text-embedding-{version}",
  "provider": "{Provider}",
  "embeddingDimension": 3072,
  "vectorSpace": "cosine-normalized"
}
```

**Pattern Rules**:
- ✅ `embedding-config-{domain}` for configuration objects
- ✅ `{context}-embedding` for specific embeddings
- ✅ Model names: `text-embedding-3-large`, `text-embedding-ada-002`
- ✅ Providers: PascalCase (`OpenAI`, `Cohere`, `HuggingFace`)

### Model Identifiers

```json
{
  "@id": "example:model-{purpose}-embeddings",
  "@type": "rag:EmbeddingModel",
  "modelName": "{provider-model-name}",
  "embeddingDimension": {integer},
  "specialization": "{domain}-domain"
}
```

**Pattern Rules**:
- ✅ `model-{purpose}` prefix
- ✅ Purpose: `startup`, `customer`, `financial`, `medical`
- ✅ Specialization: `{domain}-domain` or `{domain}-and-{domain}-domain`

### Embedding Instances

```json
{
  "@id": "example:{context}-embedding",
  "@type": "rag:Embedding",
  "embeddingDimension": 3072,
  "embeddedBy": "example:model-{purpose}",
  "vectorSpace": "cosine-normalized",
  "embeddingType": "{type}-embedding"
}
```

**Pattern Rules**:
- ✅ Context-based naming: `stage-embedding`, `customer-embedding`
- ✅ Types: `query-embedding`, `document-embedding`, `cohort-behavior-embedding`, `positioning-embedding`

### Context Windows

```json
{
  "@id": "example:context-{purpose}",
  "@type": "rag:ContextWindow",
  "contextSize": {integer},
  "contextStrategy": "{strategy-name}",
  "overlapTokens": {integer},
  "contextPriority": "{priority-method}-ranked"
}
```

**Pattern Rules**:
- ✅ `context-{purpose}` naming
- ✅ Strategies: kebab-case (`customer-problem-clustering`, `experiment-case-studies`)
- ✅ Priority: `{criteria}-ranked` format
- ✅ Sizes: Common values 4096, 8192, 12288, 16384, 32768

### Traversal Rules

```json
{
  "@id": "example:rule-{constraint-type}",
  "@type": "rag:TraversalRule",
  "ruleType": "{type}",
  "rulePriority": {integer}
}
```

**Pattern Rules**:
- ✅ `rule-{constraint}` naming
- ✅ Rule types: `relation-constraint`, `semantic-constraint`, `pattern-mining`
- ✅ Priorities: Integer ranking (1 = highest)

### RAG Workflows

```json
{
  "@type": "rag:RAGWorkflow",
  "name": "{Descriptive Name} Workflow",
  "retrievalMethod": "{method}"
}
```

```json
{
  "@type": "rag:GraphRAGWorkflow",
  "name": "{Descriptive Name} Workflow",
  "retrievalMethod": "graph-traversal",
  "maxHops": {integer}
}
```

**Pattern Rules**:
- ✅ Names: PascalCase with "Workflow" suffix
- ✅ Methods: `graph-traversal`, `hybrid-search`, `semantic-search`
- ✅ Max hops: Typically 2-5

---

## Property Naming Conventions

### Case Styles

| Context | Style | Example |
|---------|-------|---------|
| **JSON-LD Context Keys** | camelCase | `hasHypothesis`, `confidenceLevel` |
| **Property Names (Data)** | kebab-case | `customer-acquisition-cost`, `evidence-type` |
| **Type Names** | PascalCase | `LeanStartupDecisionTree`, `GraphRAGWorkflow` |
| **Metric Names** | kebab-case | `activation-rate`, `ltv-to-cac-ratio` |
| **Namespace Prefixes** | lowercase: | `ls:`, `kg:`, `rag:` |

### RAG Property Patterns

| Property | Type | Pattern | Example |
|----------|------|---------|---------|
| `contextSize` | integer | Powers of 2 | 8192, 16384 |
| `embeddingDimension` | integer | Model-specific | 1536, 3072 |
| `similarityThreshold` | decimal | 0.0-1.0 | 0.7, 0.85 |
| `maxHops` | integer | 1-5 typical | 2, 3 |
| `retrievalMethod` | string | kebab-case | `graph-traversal`, `hybrid-search` |
| `contextStrategy` | string | kebab-case | `customer-problem-clustering` |
| `contextPriority` | string | `{criteria}-ranked` | `pain-point-ranked` |
| `vectorSpace` | string | kebab-case | `cosine-normalized`, `euclidean` |

---

## Type Naming Patterns

### Class Types (PascalCase)

**Pattern**: `{ConceptName}`

```
KnowledgeGraph
Entity
DomainOntology
EmbeddingModel
RAGWorkflow
GraphRAGWorkflow
ContextWindow
TraversalRule
TraversalPath
```

### Relationship Types (camelCase)

**Pattern**: `{verb}{Object}`

```
hasHypothesis
hasExperiment
hasMVP
hasEmbedding
hasContext
leadsToLearning
triggersPivot
measuredBy
traversesPath
appliesRule
```

---

## Metadata Field Patterns

### Top-Level Metadata

```json
{
  "metadata": {
    "version": "{major}.{minor}.{patch}",
    "created": "YYYY-MM-DD",
    "source": "{source-identifier}",
    "domain": "{domain-name}",
    "title": "{Human Readable Title}"
  }
}
```

**Pattern Rules**:
- ✅ Version: Semantic versioning `1.0.0`
- ✅ Dates: ISO 8601 format `2025-12-16`
- ✅ Domain: kebab-case `lean-startup`, `customer-development`

### Nested Metadata

```json
{
  "metadata": {
    "includeDemographics": true,
    "includeBehaviors": true,
    "filterByStage": "growth",
    "filterByIndustry": "SaaS"
  }
}
```

**Pattern Rules**:
- ✅ Boolean flags: `include{Concept}`, `enable{Feature}`
- ✅ Filters: `filterBy{Criterion}`
- ✅ Values: camelCase or kebab-case

---

## Lint Rules

### Rule 1: ID Structure

```regex
^(example|ls|kg|rag|dt):[a-z]+-[a-z0-9-]+$
```

**Valid**:
- ✅ `example:entity-hypothesis`
- ✅ `rag:context-customer-discovery`
- ✅ `dt:node-pivot-or-persevere`

**Invalid**:
- ❌ `example:EntityHypothesis` (PascalCase)
- ❌ `example:entity_hypothesis` (underscore)
- ❌ `entity-hypothesis` (missing namespace)

### Rule 2: Embedding Config IDs

```regex
^example:(embedding-config|model)-[a-z-]+$
```

**Valid**:
- ✅ `example:embedding-config-lean`
- ✅ `example:model-startup-embeddings`

**Invalid**:
- ❌ `example:embeddingConfig-lean` (camelCase)
- ❌ `example:embedding_config_lean` (underscore)

### Rule 3: Context IDs

```regex
^example:context-[a-z-]+$
```

**Valid**:
- ✅ `example:context-customer-discovery`
- ✅ `example:context-growth-experiments`

### Rule 4: Rule IDs

```regex
^example:rule-[a-z-]+$
```

**Valid**:
- ✅ `example:rule-customer-relations`
- ✅ `example:rule-segment-similarity`

### Rule 5: Metric Names

```regex
^[a-z]+-[a-z-]+$
```

**Valid**:
- ✅ `activation-rate`
- ✅ `ltv-to-cac-ratio`
- ✅ `customer-acquisition-cost`

**Invalid**:
- ❌ `activationRate` (camelCase)
- ❌ `activation_rate` (underscore)

### Rule 6: Type Names (Classes)

```regex
^[A-Z][a-zA-Z]+$
```

**Valid**:
- ✅ `RAGWorkflow`
- ✅ `GraphRAGWorkflow`
- ✅ `EmbeddingModel`

**Invalid**:
- ❌ `ragWorkflow` (starts lowercase)
- ❌ `RAG_Workflow` (underscore)

### Rule 7: Relationship Properties

```regex
^[a-z]+[A-Z][a-zA-Z]*$
```

**Valid**:
- ✅ `hasHypothesis`
- ✅ `leadsToLearning`
- ✅ `traversesPath`

**Invalid**:
- ❌ `has-hypothesis` (kebab-case)
- ❌ `HasHypothesis` (starts uppercase)

---

## Category-Specific Patterns

### Knowledge Graph (kg:) Patterns

```
kg:Entity
kg:KnowledgeGraph
kg:DomainOntology
kg:OntologyLink

example:entity-{concept}
example:ontology-{domain}
```

**Properties**:
- `mappedTo` - ontology alignment
- `alignsWith` - ontology reference
- `ontologyIRI` - IRI string
- `mappingConfidence` - decimal 0-1

### RAG (rag:) Patterns

```
rag:Embedding
rag:EmbeddingModel
rag:ContextWindow
rag:RAGWorkflow
rag:GraphRAGWorkflow
rag:TraversalRule
rag:TraversalPath

example:model-{purpose}
example:context-{purpose}
example:rule-{constraint}
example:{context}-embedding
```

**Properties**:
- `embeddingDimension` - integer (1536, 3072, etc.)
- `contextSize` - integer (powers of 2)
- `similarityThreshold` - decimal 0-1
- `maxHops` - integer 1-5
- `retrievalMethod` - string (kebab-case)

### Decision Tree (dt:) Patterns

```
dt:DecisionNode
dt:ConditionNode
dt:ActionNode
dt:Evidence
dt:Insight
dt:Priority

example:node-{decision}
example:branch-{condition}
example:action-{activity}
example:evidence-{type}
example:insight-{topic}
```

**Properties**:
- `evidenceStrength` - decimal 0-1
- `insightConfidence` - decimal 0-1
- `priorityScore` - decimal 0-1
- `topsisScore` - decimal 0-1

### Domain-Specific (ls:) Patterns

```
ls:Hypothesis
ls:Experiment
ls:MVP
ls:PivotDecision
ls:ValidatedLearning

example:hypothesis-{focus}
example:experiment-{test}
example:mvp-{variant}
example:pivot-{type}
```

**Properties**:
- `hypothesisType` - string
- `experimentType` - string
- `pivotType` - string
- `confidenceLevel` - decimal 0-1
- `conversionRate` - decimal 0-1

---

## Validation Examples

### ✅ Valid Examples

```json
{
  "@id": "example:embedding-config-lean-startup",
  "@type": "rag:EmbeddingModel",
  "modelName": "text-embedding-3-large",
  "embeddingDimension": 3072,
  "vectorSpace": "cosine-normalized"
}
```

```json
{
  "@id": "example:context-customer-discovery",
  "@type": "rag:ContextWindow",
  "contextSize": 8192,
  "contextStrategy": "problem-clustering",
  "contextPriority": "pain-point-ranked"
}
```

```json
{
  "@id": "example:rule-semantic-similarity",
  "@type": "rag:TraversalRule",
  "ruleType": "semantic-constraint",
  "similarityThreshold": 0.75,
  "rulePriority": 1
}
```

### ❌ Invalid Examples

```json
{
  "@id": "embeddingConfigLean",  // ❌ Missing namespace, camelCase
  "@type": "rag:EmbeddingModel",
  "model_name": "text-embedding-3-large",  // ❌ underscore
  "EmbeddingDimension": 3072  // ❌ PascalCase property
}
```

```json
{
  "@id": "example:Context-CustomerDiscovery",  // ❌ PascalCase after namespace
  "@type": "rag:ContextWindow",
  "context_size": 8192,  // ❌ underscore
  "ContextStrategy": "problem-clustering"  // ❌ PascalCase
}
```

---

## Configuration Templates

### RAG Configuration Template

```json
{
  "@id": "example:rag-config-{domain}",
  "embeddingModel": {
    "@id": "example:model-{purpose}",
    "@type": "rag:EmbeddingModel",
    "modelName": "text-embedding-{version}",
    "provider": "{Provider}",
    "embeddingDimension": {dimension},
    "vectorSpace": "cosine-normalized"
  },
  "defaultContext": {
    "@id": "example:context-{purpose}",
    "@type": "rag:ContextWindow",
    "contextSize": {size},
    "contextStrategy": "{strategy-name}",
    "overlapTokens": {overlap}
  },
  "retrievalConfig": {
    "retrievalMethod": "hybrid-search",
    "topK": {integer},
    "similarityThreshold": {decimal}
  }
}
```

### GraphRAG Configuration Template

```json
{
  "@id": "example:graphrag-config-{domain}",
  "@type": "rag:GraphRAGWorkflow",
  "name": "{Purpose} Graph Workflow",
  "retrievalMethod": "graph-traversal",
  "maxHops": {1-5},
  "traversalRules": [
    {
      "@id": "example:rule-{constraint}",
      "@type": "rag:TraversalRule",
      "ruleType": "relation-constraint",
      "allowedRelations": [
        "{namespace}:{relation}",
        "{namespace}:{relation}"
      ],
      "rulePriority": 1
    },
    {
      "@id": "example:rule-semantic",
      "@type": "rag:TraversalRule",
      "ruleType": "semantic-constraint",
      "similarityThreshold": {decimal},
      "rulePriority": 2
    }
  ],
  "contextWindow": {
    "@id": "example:context-{purpose}",
    "@type": "rag:ContextWindow",
    "contextSize": {size},
    "contextStrategy": "{strategy}"
  }
}
```

---

## Quick Reference

### Common Prefixes by Context

| Purpose | ID Prefix | Example |
|---------|-----------|---------|
| Ontology definitions | `ontology-` | `example:ontology-lean-startup` |
| Embedding models | `model-` | `example:model-startup-embeddings` |
| Embedding configs | `embedding-config-` | `example:embedding-config-lean` |
| Context windows | `context-` | `example:context-customer-discovery` |
| Traversal rules | `rule-` | `example:rule-segment-similarity` |
| Entities | `entity-` | `example:entity-hypothesis` |
| Actions | `action-` | `example:action-customer-interviews` |
| Metrics | `metric-` | `example:metric-activation-rate` |
| Evidence | `evidence-` | `example:evidence-early-stage` |

### Common Property Suffixes

| Suffix | Type | Range | Example |
|--------|------|-------|---------|
| `-threshold` | decimal | 0.0-1.0 | `similarityThreshold: 0.75` |
| `-dimension` | integer | Model-specific | `embeddingDimension: 3072` |
| `-size` | integer | Powers of 2 | `contextSize: 8192` |
| `-score` | decimal | 0.0-1.0 | `confidenceScore: 0.88` |
| `-rate` | decimal | 0.0-1.0 | `activationRate: 0.34` |
| `-method` | string | kebab-case | `retrievalMethod: "hybrid-search"` |
| `-strategy` | string | kebab-case | `contextStrategy: "problem-clustering"` |

---

## Linting Tools Configuration

### ESLint-style Rule Configuration

```json
{
  "kg-metadata-lint": {
    "id-pattern": "^(example|ls|kg|rag|dt):[a-z]+-[a-z0-9-]+$",
    "property-case": "camelCase-or-kebab-case",
    "type-case": "PascalCase",
    "namespace-required": true,
    "embedding-dimension-values": [384, 768, 1536, 3072],
    "context-size-values": [4096, 8192, 12288, 16384, 32768],
    "similarity-threshold-range": [0.0, 1.0],
    "max-hops-range": [1, 10]
  }
}
```

### JSON Schema Validation Patterns

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "id": {
      "type": "string",
      "pattern": "^(example|ls|kg|rag|dt):[a-z]+-[a-z0-9-]+$"
    },
    "embeddingDimension": {
      "type": "integer",
      "enum": [384, 768, 1536, 3072]
    },
    "contextSize": {
      "type": "integer",
      "enum": [4096, 8192, 12288, 16384, 32768]
    },
    "similarityThreshold": {
      "type": "number",
      "minimum": 0.0,
      "maximum": 1.0
    },
    "maxHops": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10
    }
  }
}
```

---

## Summary

**Key Takeaways**:
1. IDs use `{namespace}:{category}-{name}` with kebab-case
2. Types use PascalCase
3. Properties use camelCase in @context, kebab-case in data
4. RAG configs follow specific prefixes: `model-`, `context-`, `rule-`
5. Metrics always use kebab-case
6. Dimensions and sizes use standard values
7. Thresholds and scores are 0-1 decimals