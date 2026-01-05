# Codebase Neutrality Guidelines

## Intent-Directives

**Core Mandate**: Code remains neutral, context-aware, domain-agnostic, project-agnostic, dataset-agnostic, metadata-driven.

**Forbidden**: Project-specific hardcoding, embedding, presets, file paths, dataset assumptions.

---

## Single-Responsibility Principle (SRP)

**Module Design**: Feature-scoped | detection-heuristics | schema-aware | semantic-aware | provenance-aware

---

## Subject-Verb-Object Structure

**Component verbs data via configuration**  
**Heuristic detects patterns from metadata**  
**Algorithm processes inputs without dataset dependencies**

**Rule**: All algorithms remain general-purpose; adaptation via configuration only.

---

## Specification Pattern

### Example: PatternDetector

**From raw input to structured semantics**: PatternDetector → extracts features via configurable heuristics → matches patterns against schema definitions → assigns confidence scores using metadata thresholds → delivers typed entities for downstream stages.

### Example: RelationshipBuilder

**From isolated entities to connected graph**: RelationshipBuilder → computes similarity via embedding distance → filters candidates using provenance metadata → validates connections through schema constraints → outputs relationship triples with confidence metrics.