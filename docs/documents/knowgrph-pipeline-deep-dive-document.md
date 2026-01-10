---
ontologies:
  - prefix: prov
    iri: http://www.w3.org/ns/prov#
  - prefix: mex
    iri: http://mex.aksw.org/mex-core#
  - prefix: pplan
    iri: http://purl.org/net/p-plan#
  - prefix: mls
    iri: http://www.w3.org/ns/mls#
  - prefix: geo
    iri: http://www.opengis.net/ont/geosparql#
  - prefix: ro
    iri: https://w3id.org/ro/crate#
graphLayers:
  - competencyHyperspace
  - performanceSpace
  - classDistributionSpace
  - preprocessingCluster
  - modelTypeClusters
  - kpiViolationRegion
  - candidateClusters
  - assessmentRegion
---

# Enhanced GraphRAG Pipeline: ML-Inspired Deep Dive

This document provides a component-level deep dive into the GraphRAG pipeline. It uses ML-inspired analogies (features, models, ensembles, monitoring) while remaining fully domain-agnostic and configuration-driven.

## Layer 0.5: Statistical Feature Engineering

**From raw tokens to neutral features**: this layer computes statistical features on tokens and spans without relying on vocabulary lists or domain ontologies.

- Computes embedding coherence scores via cosine similarity.
- Measures syntactic distances via dependency path length.
- Tracks capitalization, token frequency ratios, and sentence complexity.
- Computes vocabulary diversity and temporal density.

Configuration controls:

- Window sizes and aggregation methods for coherence.
- Maximum path lengths and normalization strategies for syntactic distance.
- Minimum frequencies and smoothing strategies for frequency analysis.
- Percentile clipping and aggregation for complexity metrics.

All thresholds and behaviors are stored in configuration, not hardcoded into the code.

## Layer 1 Enhanced: Token Linking with Quality Gates

**TokenLinker** links tokens into phrases and entities based on statistical signals.

Forbidden patterns:

- Checking membership in domain-specific term lists.
- Branching on industry or dataset names.
- Looking up entity types in embedded domain ontologies.

Required patterns:

- Merging tokens when embedding coherence exceeds a configurable threshold.
- Linking tokens when syntactic distance is within a configured bound.
- Predicting entity types via statistical classifiers over features.

This layer:

- Computes features from token sequences via statistical methods.
- Applies thresholds from configuration rather than embedded constants.
- Validates spans using numerical constraints instead of domain rules.
- Tracks provenance to source positions without embedding structure types.

## Layer 2 Enhanced: Edge Elevation

**EdgeElevator** scores potential relationships between entities.

Features include:

- Syntactic path length between entity mentions.
- Semantic coherence between subject, predicate, and object.
- Presence of temporal markers, modality indicators, and negation.

The scoring function:

- Applies configurable feature transforms (clipping, log scaling).
- Combines weighted features into a scalar confidence score.
- Applies configured boosts for certain conditions (for example, temporal markers).
- Normalizes scores into a probability-like confidence metric.

Configuration specifies:

- Feature weights and transform behavior.
- Target precision/recall for validation splits.

## Layer 3 Enhanced: Threshold Tuning

**ThresholdTuner** selects thresholds for extraction using ML-inspired validation patterns.

- Uses stratified splits to preserve distribution properties.
- Runs grid search over candidate threshold combinations.
- Evaluates extraction quality (for example, F1) on validation folds.
- Selects thresholds that satisfy minimum quality constraints and maximize the chosen objective.

Configuration controls:

- Validation strategy (stratified cross-validation, holdout, or time-series split).
- Search spaces for phrase boundary, edge confidence, and merge thresholds.
- Optimization objective and early-stopping behavior.

## Layer 4 Enhanced: Document Unification

**DocumentUnifier** reconciles conflicting properties across entities that represent the same abstract object.

Algorithm:

- Clusters entities by similarity via configurable metrics and linkage methods.
- Detects conflicts when multiple values exist for the same property.
- Resolves conflicts via strategies such as majority vote, weighted vote, recency, or authority-based selection.
- Optionally preserves all candidate values with associated confidence information.

Configuration specifies:

- Similarity metrics and merge thresholds.
- Conflict resolution strategy and weightings for confidence, authority, and recency.
- Validation thresholds for maximum conflict rate and minimum merge precision.

## Layer 5 Enhanced: Feedback Loops and Monitoring

**FeedbackOrchestrator** provides continuous quality monitoring.

- Processes documents in batches and computes metrics such as precision, recall, confidence means, coherence, and mention consistency.
- Maintains a rolling history window for trend analysis.
- Detects degradation or drift by comparing baseline and current metrics using statistical thresholds.
- Triggers threshold retuning when degradation or drift is detected.
- Logs adjustments with enough metadata for reproducibility.

Configuration controls:

- Check intervals and window sizes.
- Quality targets and degradation thresholds per metric.
- Drift detection methods and significance levels.
- Retuning triggers and cooldown periods.

## Layer 6 Enhanced: Corpus Reasoning

**CorpusReasoner** analyzes the graph at corpus scale.

- Computes multiple centrality metrics (for example, PageRank-like, betweenness-like, and degree-based measures).
- Aggregates them into importance scores via configurable metric weights.
- Performs pattern mining with configurable support, confidence, and pattern length.

Configuration specifies:

- Which centrality metrics to compute.
- Weightings for each metric.
- Hyperparameters for pattern mining and interaction depth.

This enables corpus-level reasoning without introducing domain-specific logic.

## Layer 7 Enhanced: Agentic RAG

**AgenticQueryEngine** orchestrates multi-strategy retrieval over the graph.

- Parses queries into structured features (focus entities, intent type, expected result type, temporal constraints, aggregation requirements).
- Executes multiple retrieval strategies such as graph traversal, semantic search, and pattern matching.
- Fuses results with configurable fusion methods and strategy weights.
- Reranks results using configurable ranking models and features (confidence, provenance authority, temporal relevance, centrality).
- Extracts provenance text as context chunks for downstream LLMs.

Configuration controls:

- Which retrieval strategies are enabled and their hyperparameters.
- Fusion methods and confidence weights.
- Ranking models and ranking features.
- Context extraction limits and strategies.

## Neutrality Validation Framework

**NeutralityValidator** evaluates whether the pipeline behaves consistently across diverse corpora without embedding domain assumptions.

It:

- Runs the pipeline over multiple corpora with differing characteristics.
- Measures distributional properties of entities, edges, and graph structure.
- Detects potential neutrality violations (for example, domain-specific entity types or forbidden tokens in configuration).
- Evaluates consistency of key metrics across corpora using coefficient-of-variation thresholds.

Configuration defines:

- Corpora to test and associated gold standards where applicable.
- Minimum acceptable values for key metrics.
- Forbidden tokens that must not appear in source code or configuration.

## Reproducibility Guarantees

The pipeline includes configuration for experiment tracking and reproducibility:

- Tracks configuration, extracted entities, constructed graphs, quality metrics, threshold histories, and provenance mappings.
- Records versioning information such as commit hashes, configuration hashes, data hashes, and dependency versions.
- Exposes reproducibility settings (random seeds, deterministic mode, cache freezing).

These controls align the GraphRAG pipeline with ML experiment tracking and reproducibility standards while remaining domain-agnostic.

For end-to-end Canvas↔Markdown behavior and how provenance line ranges surface in the UI, see:
- `docs/documents/knowgrph-parser-document.md` (Markdown Rendering, Canvas UI)
- `docs/documents/knowgrph-renderer-document.md` (Canvas ↔ Markdown selection sync)
- `docs/documents/knowgrph-ui-ux-design-document.md` (Canvas ↔ Markdown panel UX)
