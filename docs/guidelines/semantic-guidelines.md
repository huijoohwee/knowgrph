# Semantic Guidelines

## Intent-Directives

**Core Mandate**: Semantic operations remain meaning-preserving, context-sensitive, interpretation-agnostic, schema-driven, vocabulary-neutral.

**Forbidden**: Hard-coded ontologies, embedded taxonomies, fixed semantic hierarchies, language-specific assumptions, domain vocabularies.

---

## Semantic Single-Responsibility

**Module Design**: Meaning-extraction | context-resolution | relationship-inference | entity-disambiguation | semantic-validation

**Rule**: Each component handles one semantic concern; composition yields complex understanding.

---

## Subject-Verb-Object Semantic Structure

**Extractor discovers meaning from annotated inputs**  
**Resolver disambiguates entities via context metadata**  
**Inferencer derives relationships through configurable rules**

**Principle**: Semantic operations consume configuration, emit structured meaning; no embedded domain knowledge.

---

## Semantic Specification Patterns

### Example: EntityExtractor

**From raw text to semantic entities**: EntityExtractor -> tokenizes input via language-agnostic rules -> identifies candidates using schema-defined patterns -> validates against vocabulary metadata -> assigns semantic types from configuration -> outputs typed entity mentions with provenance.

### Example: ContextResolver

**From ambiguous references to resolved entities**: ContextResolver -> gathers context window via configurable scope -> computes semantic similarity through embedding space -> ranks candidates using metadata-driven scoring -> applies disambiguation rules from schema -> resolves entity with confidence and context trace.

### Example: RelationshipInferencer

**From isolated facts to semantic graph**: RelationshipInferencer -> extracts entity pairs from structured input -> computes semantic distance via configured metrics -> matches patterns against relationship ontology -> validates constraints through schema rules -> infers relationship type with evidence chain -> outputs semantic triple with confidence.

---

## Semantic Neutrality Requirements

**Vocabulary Independence**: Load terminologies from external configuration  
**Schema Flexibility**: Accept arbitrary semantic schemas as parameters  
**Context Awareness**: Derive meaning from provided metadata, not assumptions  
**Language Agnosticism**: Process semantic structures independent of natural language  
**Domain Neutrality**: Adapt to any knowledge domain via configuration injection

---

## Anti-Patterns

❌ **Hard-coded ontologies**: `if entity_type == "Person"`  
✅ **Schema-driven**: `if entity_type in schema.get_types()`

❌ **Embedded relationships**: `PARENT_OF = "parentOf"`  
✅ **Configuration-loaded**: `rel_type = config.relationships["hierarchical"]["parent"]`

❌ **Fixed semantic rules**: `if is_organization() and is_location()`  
✅ **Rule-injected**: `if rule_engine.evaluate(entities, ruleset)`

---

## Validation Criteria

- Can semantic components process arbitrary schemas without code changes?
- Are all semantic interpretations traceable to configuration sources?
- Do semantic operations emit provenance metadata for downstream verification?
- Can the system handle novel semantic domains without redeployment?