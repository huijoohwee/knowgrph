# Code Reading Mantra

## 1. Trace responsibility, not lines

**Subject-Verb-Object first**: Identify what component does what to which data
- Start with entry points -> follow data flow -> map transformations -> verify outputs
- Ask: "Can I explain this module's purpose in one SVO sentence?"
- Red flag: Multiple responsibilities blur the answer

## 2. Configuration reveals intent, hardcoding hides it

**Scan for hardcoded values**: Domain names, paths, thresholds, magic numbers, entity types
- Search: string literals, numeric constants, conditional branches on fixed values
- Valid: schema-driven identifiers, centralized constants (COPY_*, LS_KEY_*)
- Invalid: `if entity_type == "Person"`, embedded paths, inline hex colors

## 3. Schema alignment = semantic consistency

**Cross-reference /schema/AgenticRAG**: Component names, state fields, API identifiers, storage keys
- Mismatch signals: drift, technical debt, refactor incomplete
- Verify: naming follows schema -> types match definitions -> provenance links exist

## 4. Performance patterns, not afterthoughts

**Required optimizations present**: Batching, caching, memoization, virtualization, code splitting
- Lists >100 items -> virtualized
- Expensive computations -> memoized (useMemo, React.memo)
- Routes/features -> lazy loaded
- Missing optimizations = velocity killer

## 5. Provenance threads from source to synthesis

**Bidirectional linking intact**: Nodes reference source documents, edges track confidence decay
- Metadata includes: documentPath, lineStart, lineEnd, extractionMethod
- Transitive edges decay: parent_confidence * 0.8
- Broken threads = untraceable outputs

## 6. Observability embedded, not bolted

**Three pillars present**: Metrics (RED), Logs (structured JSON + correlation IDs), Traces (distributed spans)
- Every service boundary -> instrumented
- Critical paths -> traced end-to-end
- Alert on symptoms (user impact), not causes (resource exhaustion)

## 7. Size limits enforce modularity

**Hard boundaries**: <600 lines per file, <500kB chunks post-minification
- Exceeding limits signals: God classes, feature creep, missing abstractions
- Refactor triggers: extract utilities, split features, compose components

## 8. Anti-patterns signal technical debt

**Forbidden code**: Duplicate logic, prop drilling >3 levels, direct state mutation, race conditions
**Forbidden architecture**: Distributed monoliths, shared databases, synchronous chains >3 hops
**Forbidden semantics**: Fixed ontologies, embedded relationships, language-specific assumptions
- Single violation = review blocker

## 9. Tests validate behavior, not implementation

**Coverage targets**: Critical paths 100%, edge cases 80%, integration workflows end-to-end
- Tests use schema-compliant fixtures
- Mock external dependencies, not internal modules
- Assertions verify outcomes, not internal state

## 10. Documentation lives with code

**Inline context required**: Complex algorithms, non-obvious optimizations, schema mappings
- Pattern template comments: "From [input] to [output]: Component -> [process] via [method]"
- README per feature: purpose, dependencies, configuration, metrics
- Stale docs worse than none

---

**Read with questions**:
- Can this adapt to new domains without changes?
- Is responsibility singular and traceable?
- Are optimizations present by default?
- Does provenance flow unbroken?
- Would metrics catch regressions?