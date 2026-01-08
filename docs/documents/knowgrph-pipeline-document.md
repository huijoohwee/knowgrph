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
polygonLayers:
  - competencyHyperspace
  - performanceSpace
  - classDistributionSpace
  - preprocessingCluster
  - modelTypeClusters
  - kpiViolationRegion
  - candidateClusters
  - assessmentRegion
---

# Enhanced GraphRAG Pipeline: ML-Inspired Neutrality Standards

## Integration Bridge: ML Pipeline → Graph Construction

### Architectural Translation Matrix

**Your ML Pipeline Strength** → **GraphRAG Component** → **Neutrality Enforcement**

| ML Component | Graph Equivalent | Configuration Parameter | Domain-Agnostic Implementation |
|--------------|-----------------|------------------------|-------------------------------|
| `data_loader.py` (SQLite→DataFrame) | `DocumentLoader` | `source_config.format`, `source_config.schema` | Loader reads ANY structured format via pluggable parsers |
| `feature_engineering.py` (domain bins, ratios) | `TokenLinker` | `phrase_boundary_threshold`, `entity_span_limits` | Linker detects phrases via embedding coherence, NO domain vocabularies |
| `preprocessing.py` (clipping, log-transform, scaling) | `SemanticNormalizer` | `outlier_clip_percentile`, `transform_strategy` | Normalizer applies statistical transforms, NO hardcoded feature names |
| `data_splitter.py` (stratified 70/15/15) | `CorpusPartitioner` | `split_ratios`, `stratify_by_property` | Partitioner maintains distribution balance, NO dataset-specific logic |
| `pipeline_validator.py` (class distribution checks) | `GraphSchemaValidator` | `expected_node_types`, `edge_density_range` | Validator checks structural properties, NO embedded entity types |
| `models/` (Logistic, KNN, XGBoost) | `ExtractionStrategies` | `strategy_config.method`, `strategy_config.params` | Strategies implement pattern detection, NO domain-specific heuristics |
| `evaluation.py` (ROC/PR AUC, threshold tuning) | `QualityMonitor` | `target_metrics`, `threshold_sweep_config` | Monitor computes statistical metrics, NO hardcoded quality gates |
| `model_selector.py` (best model ranking) | `ComponentOrchestrator` | `selection_criteria`, `optimization_objectives` | Orchestrator ranks via config-driven criteria, NO embedded preferences |

---

## Layer 0: Configuration-Driven Architecture (ML Pipeline Lesson)

### Component: PipelineConfigurator

**From embedded logic to adaptive behavior**: PipelineConfigurator → loads external configuration schemas → validates parameter constraints → distributes config to all components → enables runtime adaptation → delivers neutral pipeline that operates identically across medical, legal, financial, or technical corpora without code changes.

In the canvas implementation, AgenticRagConfig in the TypeScript layer mirrors these configuration fields and can be initialized from default values or external configuration surfaces (for example, environment variables and workflow JSON-LD documents). Constants such as AGENTIC_RAG_CONTEXT_URL and AGENTIC_RAG_SCHEMA_URL are derived from a configurable schema base URL so that the same pipeline can operate against different AgenticRAG context deployments without code changes.

#### **Subject-Verb-Object Directives**
```
configurator loads schema_definitions_from_external_yaml
configurator validates parameter_constraints_against_bounds
configurator distributes config_fragments_to_components
configurator tracks configuration_versions_for_reproducibility
configurator enables runtime_parameter_updates_without_restarts
configurator logs configuration_provenance_per_execution
```

#### **Universal Configuration Schema** (Inspired by `config.yaml`)

```yaml
# Document Source Abstraction (NO hardcoded paths)
sources:
  loader_type: generic  # sqlite | filesystem | api | stream
  connection:
    type: ${SOURCE_TYPE}  # environment variable injection
    params:
      path: ${DATA_PATH}
      format: ${DOC_FORMAT}  # pdf | docx | md | html
  schema_discovery:
    auto_detect: true
    fallback_schema: null

# Token Linking Configuration (NO domain vocabularies)
token_linking:
  phrase_boundary_threshold: 0.75
  max_entity_span_tokens: 8
  coreference_distance_limit: 5
  embedding_model:
    provider: sentence_transformers  # configurable provider
    model_id: all-MiniLM-L6-v2
    cache_dir: ${MODEL_CACHE}

# Edge Elevation Configuration (NO relationship types hardcoded)
edge_elevation:
  edge_confidence_threshold: 0.65
  max_syntactic_path_length: 4
  temporal_marker_boost: 0.15
  property_extractors:
    - type: temporal
      patterns: null  # loaded from patterns.yaml, not embedded
    - type: modality
      patterns: null
    - type: negation
      patterns: null

# Threshold Tuning Configuration (ML-inspired adaptive thresholds)
threshold_tuning:
  auto_tune_enabled: true
  tuning_sensitivity: 0.1
  feedback_window_size: 10
  quality_targets:
    entity_precision: 0.85  # analogous to ML FPR constraint
    entity_recall: 0.75     # analogous to ML recall target
    edge_confidence_mean: 0.70

# Document Unification Configuration (NO dataset-specific merge rules)
document_unification:
  entity_merge_threshold: 0.85
  conflict_resolution_strategy: majority_vote  # enum, not hardcoded
  cross_document_inference_depth: 2
  similarity_metric: cosine  # configurable distance function

# Feedback Loops Configuration (ML-inspired quality monitoring)
feedback_loops:
  enabled: true
  quality_check_interval: 25  # documents per evaluation
  max_feedback_iterations: 5
  metric_tracking:
    - entity_coherence
    - edge_confidence_distribution
    - mention_consistency
    - property_conflict_rate

# Corpus Reasoning Configuration (NO domain-specific patterns)
corpus_reasoning:
  min_pattern_support: 0.05
  emergent_relationship_threshold: 0.70
  corpus_centrality_algorithm: pagerank  # enum: pagerank | betweenness | degree

# Agentic RAG Configuration (NO query intent hardcoding)
agentic_rag:
  default_traversal_depth: 3
  min_result_count: 5
  max_context_chunks: 10
  follow_up_suggestion_count: 5
  llm_provider:
    type: anthropic  # configurable provider
    model: claude-sonnet-4-5
    temperature: 0.2

# Quality Metrics Configuration (ML-inspired evaluation framework)
evaluation:
  validation_split: 0.15  # analogous to ML validation set
  test_split: 0.15
  metrics:
    extraction:
      - entity_precision
      - entity_recall
      - edge_confidence_mean
    unification:
      - merge_precision
      - duplicate_rate
      - conflict_resolution_rate
    corpus:
      - pattern_support
      - emergent_edge_confidence
    query:
      - answer_relevance
      - citation_coverage
      - traversal_efficiency

# Provenance Configuration (NO structure types embedded)
provenance:
  track_source_blocks: true
  block_type_registry: null  # loaded from schema, not hardcoded
  bidirectional_linking: true
  line_range_precision: sentence  # enum: token | sentence | paragraph
```

---

## Layer 0.5: Statistical Feature Engineering (ML Pipeline Lesson)

### Component: StatisticalFeatureComputer

**From raw tokens to neutral features**: StatisticalFeatureComputer → computes domain-agnostic statistical properties → measures embedding coherence without semantic interpretation → calculates syntactic complexity via universal metrics → delivers numerical features for downstream components that operate identically across all corpora.

#### **Subject-Verb-Object Directives**
```
computer computes embedding_coherence_scores_via_cosine_similarity
computer measures syntactic_path_lengths_via_dependency_distances
computer calculates token_frequency_distributions_via_counting
computer computes capitalization_pattern_scores_via_position_analysis
computer measures sentence_complexity_via_depth_metrics
computer calculates vocabulary_diversity_via_type_token_ratios
computer tracks statistical_properties_without_semantic_interpretation
```

#### **Universal Feature Set** (Analogous to ML Feature Engineering)

| Feature Category | Computation Method | Neutrality Guarantee |
|-----------------|-------------------|---------------------|
| **Embedding Coherence** | `cosine_similarity(token_i, token_i+1)` | NO vocabulary assumptions |
| **Syntactic Distance** | `dependency_path_length(token_i, token_j)` | NO grammar rules hardcoded |
| **Capitalization Score** | `count(uppercase_tokens) / count(all_tokens)` | NO proper noun lists |
| **Frequency Ratio** | `log(token_frequency / corpus_frequency)` | NO stopword lists |
| **Sentence Complexity** | `mean(dependency_tree_depth)` | NO language-specific rules |
| **Co-occurrence Strength** | `PMI(entity_i, entity_j)` | NO domain dictionaries |
| **Temporal Density** | `count(temporal_markers) / sentence_length` | NO temporal ontologies |

#### **Configuration Schema**

```yaml
statistical_features:
  embedding_coherence:
    window_size: 3  # tokens for local coherence
    aggregation: mean  # mean | max | percentile_75
  syntactic_distance:
    max_path_length: 10  # clip beyond this
    normalization: log_scale  # linear | log_scale | sqrt
  frequency_analysis:
    min_frequency: 2  # ignore hapax legomena
    smoothing: laplace  # laplace | good_turing | none
  complexity_metrics:
    tree_depth_percentile: 0.95  # clip outliers
    measure: mean  # mean | median | max
```

---

## Layer 1 Enhanced: Token Linking with ML-Inspired Quality Gates

### Component: TokenLinker (Neutrality-Enforced)

**FORBIDDEN PATTERNS** (Violate Neutrality):
- ❌ `if entity_text in MEDICAL_TERMS: merge_tokens()`
- ❌ `if capitalized and len(tokens) == 2 and industry == "pharma": create_entity()`
- ❌ `entity_type = DOMAIN_ONTOLOGY.lookup(entity_text)`

**REQUIRED PATTERNS** (Maintain Neutrality):
- ✅ `if embedding_coherence > config.phrase_boundary_threshold: merge_tokens()`
- ✅ `if syntactic_distance < config.max_path_length: link_tokens()`
- ✅ `entity_type = statistical_classifier.predict(features)`

#### **Subject-Verb-Object Directives** (Neutrality-Compliant)
```
linker computes features_from_token_sequences_via_statistical_methods
linker applies thresholds_from_configuration_not_embedded_constants
linker links tokens_based_on_numerical_scores_not_vocabularies
linker validates spans_against_statistical_constraints_not_domain_rules
linker tracks provenance_to_source_positions_without_block_type_coupling
```

#### **Threshold Tuning Algorithm** (Inspired by ML `evaluation.py`)

```python
# Analogous to your FPR ≤ 3%, Recall ≥ 70% tuning
def tune_phrase_boundary_threshold(validation_corpus, config):
    """
    Subject: tuner
    Verb: optimizes
    Object: phrase_boundary_threshold
    Via: precision_recall_sweep_on_validation_corpus
    """
    thresholds = np.arange(
        config.threshold_range.min,
        config.threshold_range.max,
        config.threshold_range.step
    )
    
    results = []
    for threshold in thresholds:
        linker.set_threshold(threshold)
        entities = linker.extract(validation_corpus)
        
        precision = compute_entity_precision(entities, gold_standard)
        recall = compute_entity_recall(entities, gold_standard)
        
        results.append({
            'threshold': threshold,
            'precision': precision,
            'recall': recall,
            'f1': 2 * precision * recall / (precision + recall)
        })
    
    # Select threshold meeting constraints (analogous to FPR ≤ 3%)
    qualified = [
        r for r in results 
        if r['precision'] >= config.min_precision  # e.g., 0.85
        and r['recall'] >= config.min_recall      # e.g., 0.75
    ]
    
    if not qualified:
        logger.warning("No threshold meets quality targets; selecting best F1")
        return max(results, key=lambda r: r['f1'])['threshold']
    
    # Among qualified, maximize F1 (analogous to max ROC AUC)
    return max(qualified, key=lambda r: r['f1'])['threshold']
```

---

## Layer 2 Enhanced: Edge Elevation with Stratified Validation

### Component: EdgeElevator (ML-Inspired Confidence Scoring)

#### **Confidence Computation** (Analogous to ML Model Probabilities)

```python
def compute_edge_confidence(subject, verb, object, context, config):
    """
    Subject: elevator
    Verb: computes
    Object: edge_confidence_score
    Via: weighted_feature_combination_from_configuration
    
    Analogous to ML logistic regression probability computation:
    P(edge) = sigmoid(w1*syntactic_score + w2*semantic_score + ... + bias)
    """
    features = {
        'syntactic_path_length': measure_dependency_distance(subject, object),
        'semantic_coherence': cosine_similarity(
            embed(subject), embed(verb), embed(object)
        ),
        'temporal_marker_present': detect_temporal_patterns(context),
        'modality_strength': measure_modality_indicators(context),
        'negation_scope': check_negation_overlap(verb, context)
    }
    
    # Transform features (analogous to your log-transform, clipping)
    for feature_name, transform_config in config.feature_transforms.items():
        if transform_config.log_scale:
            features[feature_name] = np.log1p(features[feature_name])
        if transform_config.clip_percentile:
            features[feature_name] = np.clip(
                features[feature_name],
                0,
                np.percentile(features[feature_name], transform_config.clip_percentile)
            )
    
    # Weighted combination (analogous to linear model coefficients)
    confidence = sum(
        config.feature_weights[fname] * fvalue
        for fname, fvalue in features.items()
    )
    
    # Apply configured boost (analogous to your temporal_marker_boost)
    if features['temporal_marker_present']:
        confidence += config.temporal_marker_boost
    
    return sigmoid(confidence)  # normalize to [0, 1]
```

#### **Configuration Schema**

```yaml
edge_elevation:
  feature_weights:  # analogous to ML model coefficients
    syntactic_path_length: -0.15  # negative: shorter paths = higher confidence
    semantic_coherence: 0.40
    temporal_marker_present: 0.20
    modality_strength: 0.10
    negation_scope: -0.10
  
  feature_transforms:  # analogous to your preprocessing
    syntactic_path_length:
      log_scale: false
      clip_percentile: null
    semantic_coherence:
      log_scale: false
      clip_percentile: 99
  
  confidence_calibration:  # analogous to threshold tuning
    validation_split: 0.15
    target_precision: 0.80
    target_recall: 0.75
```

---

## Layer 3 Enhanced: Adaptive Threshold Tuning (ML Validation Set Pattern)

### Component: ThresholdTuner (Stratified Cross-Validation)

#### **Algorithm** (Inspired by ML Hyperparameter Optimization)

```python
def optimize_thresholds_stratified_cv(corpus, config):
    """
    Subject: tuner
    Verb: optimizes
    Object: extraction_thresholds
    Via: stratified_k_fold_validation_on_corpus
    
    Analogous to your ML optimization.py:
    - Stratified split preserves entity type distribution
    - K-fold prevents overfitting to single validation set
    - Grid search over threshold space
    """
    folds = stratified_k_fold_split(
        corpus,
        n_splits=config.cv_folds,
        stratify_by='entity_density'  # analogous to class balance
    )
    
    threshold_grid = {
        'phrase_boundary': np.arange(0.5, 0.95, 0.05),
        'edge_confidence': np.arange(0.4, 0.9, 0.05),
        'entity_merge': np.arange(0.7, 0.95, 0.05)
    }
    
    best_config = None
    best_score = -np.inf
    
    for threshold_combo in itertools.product(*threshold_grid.values()):
        fold_scores = []
        
        for train_idx, val_idx in folds:
            train_corpus = corpus[train_idx]
            val_corpus = corpus[val_idx]
            
            # Extract with candidate thresholds
            linker.set_thresholds(dict(zip(threshold_grid.keys(), threshold_combo)))
            entities = linker.extract(train_corpus)
            edges = elevator.extract_relationships(entities)
            
            # Evaluate on validation fold
            metrics = evaluate_extraction_quality(
                entities, edges, val_corpus, gold_standard=None
            )
            fold_scores.append(metrics['f1_score'])
        
        # Average across folds (analogous to cross-validation)
        mean_score = np.mean(fold_scores)
        
        if mean_score > best_score:
            best_score = mean_score
            best_config = dict(zip(threshold_grid.keys(), threshold_combo))
    
    return best_config
```

#### **Configuration Schema**

```yaml
threshold_optimization:
  method: stratified_cv  # stratified_cv | holdout | time_series_split
  cv_folds: 5
  stratify_by: entity_density  # entity_density | document_length | vocabulary_diversity
  
  search_space:
    phrase_boundary_threshold:
      min: 0.5
      max: 0.95
      step: 0.05
    edge_confidence_threshold:
      min: 0.4
      max: 0.9
      step: 0.05
    entity_merge_threshold:
      min: 0.7
      max: 0.95
      step: 0.05
  
  optimization_objective: f1_score  # f1_score | precision | recall
  early_stopping:
    enabled: true
    patience: 3  # folds without improvement
```

---

## Layer 4 Enhanced: Document Unification with Conflict Resolution (ML-Inspired)

### Component: DocumentUnifier (Ensemble Voting Strategy)

#### **Conflict Resolution Algorithm** (Analogous to ML Model Ensembling)

```python
def resolve_property_conflicts_via_voting(entity_cluster, config):
    """
    Subject: unifier
    Verb: resolves
    Object: property_conflicts
    Via: weighted_voting_across_source_documents
    
    Analogous to ML ensemble methods:
    - Each document is a "weak learner"
    - Voting aggregates predictions
    - Confidence weights analogous to model performance
    """
    properties = defaultdict(list)
    
    # Collect all property values across cluster
    for entity in entity_cluster:
        for prop_name, prop_value in entity.properties.items():
            properties[prop_name].append({
                'value': prop_value,
                'source_doc': entity.source_document,
                'confidence': entity.extraction_confidence,
                'recency': entity.document_timestamp
            })
    
    resolved = {}
    
    for prop_name, candidates in properties.items():
        if len(candidates) == 1:
            resolved[prop_name] = candidates[0]['value']
            continue
        
        # Detect conflicts
        unique_values = set(c['value'] for c in candidates)
        if len(unique_values) == 1:
            resolved[prop_name] = candidates[0]['value']
            continue
        
        # Apply resolution strategy (analogous to ensemble aggregation)
        if config.conflict_resolution_strategy == 'majority_vote':
            resolved[prop_name] = majority_vote(candidates)
        
        elif config.conflict_resolution_strategy == 'weighted_vote':
            # Weight by extraction confidence (analogous to model performance)
            votes = defaultdict(float)
            for candidate in candidates:
                votes[candidate['value']] += candidate['confidence']
            resolved[prop_name] = max(votes.items(), key=lambda x: x[1])[0]
        
        elif config.conflict_resolution_strategy == 'most_recent':
            # Temporal precedence (analogous to time-series models)
            resolved[prop_name] = max(
                candidates, key=lambda c: c['recency']
            )['value']
        
        elif config.conflict_resolution_strategy == 'highest_authority':
            # Source reliability (analogous to model trust scores)
            authority_scores = {
                doc: config.document_authority_map.get(doc, 0.5)
                for doc in set(c['source_doc'] for c in candidates)
            }
            resolved[prop_name] = max(
                candidates,
                key=lambda c: authority_scores[c['source_doc']]
            )['value']
        
        elif config.conflict_resolution_strategy == 'retain_all':
            # Preserve uncertainty (analogous to ensemble diversity)
            resolved[prop_name] = {
                'values': [c['value'] for c in candidates],
                'sources': [c['source_doc'] for c in candidates],
                'confidence_distribution': [c['confidence'] for c in candidates]
            }
    
    return resolved
```

#### **Configuration Schema**

```yaml
document_unification:
  entity_clustering:
    similarity_metric: cosine  # cosine | euclidean | jaccard
    linkage_method: average  # average | complete | ward
    merge_threshold: 0.85
  
  conflict_resolution:
    strategy: weighted_vote  # majority_vote | weighted_vote | most_recent | highest_authority | retain_all
    
    # Analogous to ML ensemble weights
    confidence_weights:
      extraction_confidence: 0.6
      document_authority: 0.3
      recency_score: 0.1
    
    # Analogous to ML source reliability
    document_authority_map:  # externalized, not hardcoded
      high_quality_sources: 1.0
      medium_quality_sources: 0.7
      low_quality_sources: 0.3
      unknown_sources: 0.5
  
  validation:
    max_conflict_rate: 0.15  # analogous to ML error tolerance
    min_merge_precision: 0.85
```

---

## Layer 5 Enhanced: Feedback Loops (ML Monitoring Pattern)

### Component: FeedbackOrchestrator (Continuous Evaluation)

#### **Quality Monitoring Algorithm** (Inspired by ML Model Monitoring)

```python
def monitor_extraction_quality_continuously(pipeline, config):
    """
    Subject: orchestrator
    Verb: monitors
    Object: extraction_quality_metrics
    Via: rolling_window_statistical_process_control
    
    Analogous to ML production monitoring:
    - Track metrics over time (precision, recall, F1)
    - Detect drift via statistical tests
    - Trigger retraining/retuning when quality degrades
    """
    quality_history = deque(maxlen=config.feedback_window_size)
    
    while True:
        # Process batch of documents
        batch = pipeline.get_next_batch(size=config.quality_check_interval)
        
        # Extract entities and relationships
        entities = pipeline.extract_entities(batch)
        edges = pipeline.extract_relationships(entities)
        
        # Compute quality metrics (analogous to ML evaluation)
        metrics = {
            'entity_precision': compute_entity_precision(entities, config.validation_sample),
            'entity_recall': compute_entity_recall(entities, config.validation_sample),
            'edge_confidence_mean': np.mean([e.confidence for e in edges]),
            'entity_coherence': compute_cluster_coherence(entities),
            'mention_consistency': compute_coreference_accuracy(entities)
        }
        
        quality_history.append(metrics)
        
        # Detect degradation (analogous to ML drift detection)
        if len(quality_history) >= config.min_history_size:
            baseline_metrics = np.mean(list(quality_history)[:config.baseline_window], axis=0)
            current_metrics = np.mean(list(quality_history)[-config.current_window:], axis=0)
            
            degradation_detected = any(
                (baseline_metrics[k] - current_metrics[k]) > config.degradation_threshold
                for k in metrics.keys()
            )
            
            if degradation_detected:
                logger.warning("Quality degradation detected, triggering threshold retuning")
                
                # Retune thresholds (analogous to ML retraining)
                new_thresholds = optimize_thresholds_stratified_cv(
                    validation_corpus=config.validation_corpus,
                    config=config
                )
                
                pipeline.update_thresholds(new_thresholds)
                
                # Log adjustment (analogous to ML model versioning)
                log_threshold_adjustment(
                    old_thresholds=pipeline.current_thresholds,
                    new_thresholds=new_thresholds,
                    trigger_metrics=metrics,
                    timestamp=datetime.now()
                )
```

#### **Configuration Schema**

```yaml
feedback_monitoring:
  quality_check_interval: 25  # documents per evaluation
  feedback_window_size: 100   # rolling window for trend analysis
  
  # Analogous to ML monitoring thresholds
  quality_targets:
    entity_precision:
      min: 0.85
      degradation_threshold: 0.05  # trigger if drops by 5%
    entity_recall:
      min: 0.75
      degradation_threshold: 0.05
    edge_confidence_mean:
      min: 0.70
      degradation_threshold: 0.08
  
  # Analogous to ML statistical process control
  drift_detection:
    method: statistical_test  # statistical_test | simple_threshold
    test_type: mann_whitney  # mann_whitney | t_test | ks_test
    significance_level: 0.05
    baseline_window: 20  # samples
    current_window: 10   # samples
  
  # Analogous to ML retraining triggers
  retuning_policy:
    trigger_on_degradation: true
    trigger_on_drift: true
    cooldown_period: 50  # documents between retunings
```

---

## Layer 6 Enhanced: Corpus Reasoning (ML Feature Importance Pattern)

### Component: CorpusReasoner (Feature Attribution)

#### **Entity Importance Ranking** (Analogous to ML SHAP Values)

```python
def compute_entity_importance_scores(graph, config):
    """
    Subject: reasoner
    Verb: computes
    Object: entity_importance_scores
    Via: multiple_centrality_metrics_with_weighted_aggregation
    
    Analogous to ML feature importance:
    - PageRank = global importance (like permutation importance)
    - Betweenness = bridging importance (like SHAP interaction)
    - Degree = local importance (like coefficient magnitude)
    """
    centrality_metrics = {}
    
    # Compute multiple centrality measures (analogous to ensemble feature importance)
    if 'pagerank' in config.importance_metrics:
        centrality_metrics['pagerank'] = nx.pagerank(
            graph,
            alpha=config.pagerank_alpha,
            max_iter=config.pagerank_max_iter
        )
    
    if 'betweenness' in config.importance_metrics:
        centrality_metrics['betweenness'] = nx.betweenness_centrality(
            graph,
            normalized=True
        )
    
    if 'degree' in config.importance_metrics:
        centrality_metrics['degree'] = {
            node: degree / graph.number_of_nodes()
            for node, degree in graph.degree()
        }
    
    if 'eigenvector' in config.importance_metrics:
        centrality_metrics['eigenvector'] = nx.eigenvector_centrality(
            graph,
            max_iter=config.eigenvector_max_iter
        )
    
    # Aggregate scores (analogous to ensemble feature importance)
    importance_scores = {}
    for node in graph.nodes():
        score = sum(
            config.metric_weights[metric] * centrality_metrics[metric][node]
            for metric in config.importance_metrics
        )
        importance_scores[node] = score
    
    return importance_scores
```

#### **Configuration Schema**

```yaml
corpus_reasoning:
  entity_importance:
    # Analogous to ML feature importance methods
    importance_metrics:
      - pagerank
      - betweenness
      - degree
    
    # Analogous to ensemble weights
    metric_weights:
      pagerank: 0.5
      betweenness: 0.3
      degree: 0.2
    
    # Algorithm hyperparameters (externalized, not hardcoded)
    pagerank_alpha: 0.85
    pagerank_max_iter: 100
    eigenvector_max_iter: 100
  
  pattern_mining:
    min_pattern_support: 0.05  # analogous to ML minimum class frequency
    min_confidence: 0.60       # analogous to ML prediction confidence
    max_pattern_length: 5      # analogous to ML interaction depth
```

---

## Layer 7 Enhanced: Agentic RAG (ML Inference Pattern)

### Component: AgenticQueryEngine (Ensemble Retrieval)

#### **Query Execution Algorithm** (Analogous to ML Ensemble Prediction)

```python
def execute_agentic_query(query, graph, config):
    """
    Subject: agent
    Verb: executes
    Object: multi_strategy_query
    Via: ensemble_retrieval_with_result_fusion
    
    Analogous to ML ensemble prediction:
    - Multiple retrieval strategies (like diverse models)
    - Result fusion (like ensemble aggregation)
    - Confidence calibration (like probability calibration)
    """
    # Parse query into structured intent (analogous to ML feature extraction)
    query_features = {
        'focus_entities': extract_entity_mentions(query),
        'intent_type': classify_query_intent(query, config.intent_classifier),
        'expected_result_type': infer_result_type(query),
        'temporal_constraint': extract_temporal_bounds(query),
        'aggregation_required': detect_aggregation_keywords(query)
    }
    
    # Execute multiple retrieval strategies (analogous to ensemble models)
    retrieval_strategies = []
    
    if config.enable_graph_traversal:
        traversal_results = execute_graph_traversal(
            graph,
            focus_entities=query_features['focus_entities'],
            depth=config.default_traversal_depth,
            intent=query_features['intent_type']
        )
        retrieval_strategies.append({
            'method': 'graph_traversal',
            'results': traversal_results,
            'confidence': compute_traversal_confidence(traversal_results)
        })
    
    if config.enable_semantic_search:
        semantic_results = execute_semantic_search(
            graph,
            query_embedding=embed(query),
            top_k=config.semantic_search_top_k
        )
        retrieval_strategies.append({
            'method': 'semantic_search',
            'results': semantic_results,
            'confidence': compute_semantic_confidence(semantic_results)
        })
    
    if config.enable_pattern_matching:
        pattern_results = execute_pattern_matching(
            graph,
            patterns=extract_query_patterns(query),
            min_support=config.min_pattern_support
        )
        retrieval_strategies.append({
            'method': 'pattern_matching',
            'results': pattern_results,
            'confidence': compute_pattern_confidence(pattern_results)
        })
    
    # Fuse results (analogous to ensemble aggregation)
    fused_results = fuse_retrieval_results(
        retrieval_strategies,
        fusion_method=config.result_fusion_method,
        confidence_weights=config.strategy_confidence_weights
    )
    
    # Rank by relevance (analogous to ML prediction ranking)
    ranked_results = rank_by_query_relevance(
        fused_results,
        query_features=query_features,
        ranking_model=config.ranking_model
    )
    
    # Extract provenance chunks (analogous to ML feature attribution)
    context_chunks = extract_provenance_text(
        ranked_results,
        max_chunks=config.max_context_chunks,
        chunk_selection_strategy=config.chunk_selection_strategy
    )
    
    return {
        'results': ranked_results,
        'context_chunks': context_chunks,
        'retrieval_metadata': {
            'strategies_used': [s['method'] for s in retrieval_strategies],
            'confidence_scores': [s['confidence'] for s in retrieval_strategies],
            'fusion_method': config.result_fusion_method
        }
    }
```

#### **Configuration Schema**

```yaml
agentic_rag:
  retrieval_strategies:
    # Analogous to ML ensemble methods
    enable_graph_traversal: true
    enable_semantic_search: true
    enable_pattern_matching: true
    
    # Strategy-specific hyperparameters (externalized)
    graph_traversal:
      default_depth: 3
      max_depth: 7
      adaptive_depth_enabled: true
    
    semantic_search:
      top_k: 20
      embedding_model: sentence-transformers/all-MiniLM-L6-v2
      similarity_threshold: 0.7
    
    pattern_matching:
      min_support: 0.05
      max_pattern_length: 5
  
  result_fusion:
    # Analogous to ML ensemble aggregation
    fusion_method: weighted_voting  # weighted_voting | rank_fusion | borda_count
    
    # Strategy confidence weights (analogous to model performance weights)
    strategy_confidence_weights:
      graph_traversal: 0.5
      semantic_search: 0.3
      pattern_matching: 0.2
  
  ranking:
    # Analogous to ML reranking model
    ranking_model: cross_encoder  # cross_encoder | bm25 | learned_to_rank
    ranking_features:
      - result_confidence
      - provenance_authority
      - temporal_relevance
      - entity_centrality
```

In the concrete implementation:

- The `agentic_rag.retrieval_strategies`, `result_fusion`, and `ranking` keys appear in the universal orchestrator configuration at [knowgrph-universal-orchestrator-config.yaml](file:///Users/huijoohwee/Documents/GitHub/knowgrph/orchestrator-config/knowgrph-universal-orchestrator-config.yaml#L1-L40), where they can be tuned without code changes.
- The markdown pipeline encodes a runtime view of these settings in `metadata.retrievalStrategies` on the generated graph JSON-LD document, deriving defaults from `sem_defaults` and environment variables such as `KG_TRAVERSAL_DEFAULT_DEPTH`, `KG_TRAVERSAL_MAX_DEPTH`, `KG_SEMANTIC_SEARCH_TOP_K`, and `KG_PATTERN_MAX_LENGTH`.

---

## Neutrality Validation Framework (ML-Inspired Testing)

### Component: NeutralityValidator (Cross-Domain Testing)

#### **Validation Algorithm** (Analogous to ML Generalization Testing)

```python
def validate_pipeline_neutrality(pipeline, config):
    """
    Subject: validator
    Verb: validates
    Object: pipeline_neutrality
    Via: cross_domain_fixture_testing_with_statistical_assertions
    
    Analogous to ML generalization testing:
    - Test on diverse domains (like different datasets)
    - Assert statistical properties hold (like ML invariants)
    - Detect domain-specific behavior (like ML bias detection)
    """
    test_domains = [
        {'name': 'medical', 'corpus': load_medical_corpus()},
        {'name': 'legal', 'corpus': load_legal_corpus()},
        {'name': 'financial', 'corpus': load_financial_corpus()},
        {'name': 'technical', 'corpus': load_technical_corpus()}
    ]
    
    results = {}
    
    for domain in test_domains:
        logger.info(f"Testing neutrality on {domain['name']} domain")
        
        # Run pipeline (should behave identically across domains)
        entities = pipeline.extract_entities(domain['corpus'])
        edges = pipeline.extract_relationships(entities)
        graph = pipeline.build_graph(entities, edges)
        
        # Assert statistical properties (analogous to ML invariant checks)
        domain_results = {
            'entity_distribution': {
                'mean_entities_per_doc': np.mean([len(e) for e in entities]),
                'std_entities_per_doc': np.std([len(e) for e in entities]),
                'entity_coherence': compute_cluster_coherence(entities)
            },
            'edge_distribution': {
                'mean_edges_per_entity': len(edges) / len(entities),
                'edge_confidence_mean': np.mean([e.confidence for e in edges]),
                'edge_confidence_std': np.std([e.confidence for e in edges])
            },
            'graph_properties': {
                'density': nx.density(graph),
                'avg_clustering': nx.average_clustering(graph),
                'connected_components': nx.number_connected_components(graph)
            }
        }
        
        # Detect hardcoding violations (analogous to ML bias detection)
        violations = []
        
        # Check 1: No domain-specific entity types
        entity_types = set(e.type for e in entities)
        if any(domain['name'] in et.lower() for et in entity_types):
            violations.append(f"Domain-specific entity type detected: {entity_types}")
        
        # Check 2: No embedded vocabulary
        source_code = inspect.getsource(pipeline.__class__)
        if domain['name'].lower() in source_code.lower():
            violations.append(f"Domain name '{domain['name']}' found in source code")
        
        # Check 3: Statistical consistency across domains
        if domain_results['entity_distribution']['entity_coherence'] < 0.6:
            violations.append("Entity coherence below threshold, possible domain-specific logic")
        
        results[domain['name']] = {
            'metrics': domain_results,
            'violations': violations,
            'passed': len(violations) == 0
        }
    
    # Assert cross-domain consistency (analogous to ML fairness testing)
    metric_consistency = {}
    for metric_path in [
        'entity_distribution.entity_coherence',
        'edge_distribution.edge_confidence_mean',
        'graph_properties.density'
    ]:
        values = [
            get_nested_value(results[d['name']]['metrics'], metric_path)
            for d in test_domains
        ]
        metric_consistency[metric_path] = {
            'coefficient_of_variation': np.std(values) / np.mean(values),
            'passed': (np.std(values) / np.mean(values)) < config.max_cv_threshold
        }
    
    return {
        'domain_results': results,
        'metric_consistency': metric_consistency,
        'overall_passed': all(r['passed'] for r in results.values())
    }
```

#### **Configuration Schema**

```yaml
neutrality_validation:
  test_domains:
    - name: medical
      corpus_path: fixtures/medical_corpus.jsonl
      gold_standard: fixtures/medical_annotations.json
    - name: legal
      corpus_path: fixtures/legal_corpus.jsonl
      gold_standard: fixtures/legal_annotations.json
    - name: financial
      corpus_path: fixtures/financial_corpus.jsonl
      gold_standard: fixtures/financial_annotations.json
    - name: technical
      corpus_path: fixtures/technical_corpus.jsonl
      gold_standard: fixtures/technical_annotations.json
  
  consistency_checks:
    # Analogous to ML fairness metrics
    max_cv_threshold: 0.20  # coefficient of variation across domains
    min_entity_coherence: 0.60
    min_edge_confidence: 0.65
  
  violation_detection:
    check_source_code: true
    check_entity_types: true
    check_configuration: true
    forbidden_tokens:  # domain names should NEVER appear
      - medical
      - legal
      - financial
      - technical
```

In the running system, neutrality controls are wired as follows:

- The markdown pipeline exposes environment-driven guards via `KG_NEUTRALITY_FORBIDDEN_TOKENS` and `KG_NEUTRALITY_STRICT`, which are read by the markdown CLI to emit warnings or fail fast when forbidden tokens are detected in the generated graph JSON-LD.
- The universal orchestrator configuration captures these controls under `agentic_rag.neutrality_validation`, so UI and workflow tooling can surface which environment variables govern neutrality enforcement for a given graph.

---

## Reproducibility Guarantees (ML Pipeline Standards)

### Experiment Tracking Configuration

```yaml
experiment_tracking:
  # Analogous to ML experiment versioning
  enabled: true
  tracking_backend: mlflow  # mlflow | wandb | tensorboard | filesystem
  
  tracked_artifacts:
    - configuration_yaml
    - extracted_entities
    - constructed_graph
    - quality_metrics
    - threshold_history
    - provenance_mappings
  
  versioning:
    # Analogous to ML model versioning
    git_commit_hash: true
    configuration_hash: true
    data_hash: true
    dependency_versions: true
  
  reproducibility:
    # Analogous to ML random seeds
    random_seed: 42
    deterministic_mode: true
    freeze_embedding_cache: true
```

---

## Operational Configuration: Markdown Pipeline Env Variables

The Canvas markdown pipeline is configured via environment variables so that the same code can target different workflow documents and output locations without edits.

- `VITE_MARKDOWN_PIPELINE_INPUT_REL_PATH`  
  - Relative path (from repo root) to the entry markdown document.  
  - Default (in this repo): `docs/knowgrph-pipeline-document.md`.  
  - Controls which workflow document is parsed when you run the pipeline.

- `VITE_MARKDOWN_PIPELINE_OUTPUT_DIR`  
  - Relative path (from repo root) to the directory where pipeline artifacts are written.  
  - Default: `data/knowgrph-workflow-preview`.  
  - Controls where the graph JSON-LD, schema JSON-LD, and orchestrator YAML are generated.

- `VITE_MARKDOWN_PIPELINE_BASENAME`  
  - Basename used for all generated artifact filenames.  
  - Default: `knowgrph-pipeline-document`.  
  - Controls the prefixes of `*-graph-data.jsonld`, `*-schema-config.jsonld`, and `*-orchestrator-config.yaml`.

These variables feed into the Vite canvas configuration (for example, the `CODEBASE_INDEX_PIPELINE_COMMAND` and `CODEBASE_INDEX_PIPELINE_*_REL_PATH` values), ensuring that dev server hooks and UI loaders always respect the active markdown corpus and output directory.

---

### Graph and Ontology Outputs

When the markdown pipeline runs against a workflow document such as `docs/documents/knowgrph-pipeline-document.md`, it emits three primary artifacts into `VITE_MARKDOWN_PIPELINE_OUTPUT_DIR` using the `VITE_MARKDOWN_PIPELINE_BASENAME` prefix:

- `*-graph-data.jsonld`: a neutral node/edge graph in JSON-LD form, suitable for multi-ontology overlay and layer configuration in Canvas. The pipeline reads any `ontologies` and `polygonLayers` values from document frontmatter and records them under `graph_jsonld.metadata.ontologies` and `graph_jsonld.metadata.polygonLayers`, so ontology-aware presets can align layer behavior with the active document without changing code.
- `*-schema-config.jsonld`: an Agentic RAG schema-configuration document consumed by Canvas layers and ontology bundles (see `knowgrph-ontology-document.md` for multi-ontology details).
- `*-orchestrator-config.yaml`: a workflow orchestrator configuration describing pipeline stages, thresholds, and quality targets, aligned with the ML-inspired configuration schema defined earlier in this document.

These artifacts are consumed by:

- the codebase index pipeline tools in Canvas, which load the graph into the Graph Data Table, the schema-config into the Schema view, and the orchestrator YAML into the Workflow view; and
- ontology-aware presets (for example, the multi-ontology knowledge graph demo), which can merge the emitted graph with external ontologies via JSON-LD contexts while preserving neutrality and configuration-driven behavior.

---

### Dev Workflow: Running the Markdown Pipeline from Canvas

In dev mode, the pipeline env variables flow through Vite and Canvas as follows:

1. Canvas reads `VITE_MARKDOWN_PIPELINE_INPUT_REL_PATH`, `VITE_MARKDOWN_PIPELINE_OUTPUT_DIR`, and `VITE_MARKDOWN_PIPELINE_BASENAME` to construct:
   - `CODEBASE_INDEX_PIPELINE_COMMAND`
   - `CODEBASE_INDEX_PIPELINE_GRAPH_REL_PATH`
   - `CODEBASE_INDEX_PIPELINE_SCHEMA_REL_PATH`
   - `CODEBASE_INDEX_PIPELINE_ORCHESTRATOR_REL_PATH`
2. The Vite dev server registers a POST endpoint `/__run_markdown_pipeline` that runs `CODEBASE_INDEX_PIPELINE_COMMAND` once and writes artifacts to `CODEBASE_INDEX_PIPELINE_OUTPUT_DIR`.
3. On the client, Canvas exposes a dev-only `window.knowgrphRunMarkdownPipeline()` helper which calls `/__run_markdown_pipeline`, and `runMarkdownPipelineAndLoadArtifacts()` then:
   - fetches the generated graph, schema, and orchestrator files from the computed `CODEBASE_INDEX_PIPELINE_*_REL_PATH` values, and
   - loads them into the Graph Data Table, Schema view, and Workflow view.

Changing any of the `VITE_MARKDOWN_PIPELINE_*` variables therefore changes both the markdown document being parsed and the artifact locations that Canvas loads, without modifying any application code.

**How to run in the UI (dev mode):** open the floating Tools menu in Canvas and use the “Run codebase index pipeline” action, which calls `runMarkdownPipelineWithStatus` under the hood.

---

## Summary: ML Pipeline → GraphRAG Translation

| ML Pipeline Component | GraphRAG Component | Neutrality Enforcement | Configuration Driven |
|-----------------------|-------------------|----------------------|---------------------|
| `data_loader.py` | `DocumentLoader` | NO hardcoded paths | `source_config` |
| `feature_engineering.py` | `StatisticalFeatureComputer` | NO domain vocabularies | `feature_config` |
| `preprocessing.py` | `SemanticNormalizer` | NO feature names | `transform_config` |
| `data_splitter.py` | `CorpusPartitioner` | NO dataset logic | `split_config` |
| `pipeline_validator.py` | `GraphSchemaValidator` | NO entity types | `schema_config` |
| `models/` | `ExtractionStrategies` | NO domain heuristics | `strategy_config` |
| `evaluation.py` | `QualityMonitor` | NO hardcoded gates | `metrics_config` |
| `model_selector.py` | `ComponentOrchestrator` | NO embedded preferences | `selection_config` |
| `optimization.py` | `ThresholdTuner` | NO manual tuning | `optimization_config` |

**Result**: Production-grade GraphRAG pipeline inheriting ML best practices—stratified validation, threshold tuning, ensemble methods, continuous monitoring, cross-domain testing—all enforced through configuration, never hardcoding.
