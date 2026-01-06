# Project Mantra

## 1. Ship small, learn fast, iterate always

**Lean Startup cycle**: hypothesis → MVP (<2 weeks) → metrics → analyze → pivot or persevere
- MVP = one critical journey + instrumentation + config-driven + schema-compliant + provenance
- **Forbidden in MVP**: edge cases, polish, multiple roles, scale optimization, comprehensive errors
- RICE prioritization: (Reach × Impact × Confidence) / Effort
- End every session with: validated learning + clear next action + updated OKRs

## 2. Metrics before magic, OKRs before opinions

**Quality gates** (non-negotiable):
- Data drift: KL divergence <0.15
- Model performance: F1 > baseline +5%
- Latency: p99 <500ms
- Schema compliance: 100%

**Triggers**: `[metric < threshold] → [reprocess | review | retrain]`

**Track relentlessly**: precision, recall, coverage, processing_time, resource_utilization

## 3. Zero hardcoding, single truth, semantic alignment

**Domain agnosticism**: Code remains project-agnostic, dataset-agnostic, metadata-driven
- Adaptation via configuration ONLY
- Schema alignment: `/schema/AgenticRAG` drives ALL identifiers (APIs, components, files, LocalStorage keys, state fields)
- Centralized constants: `COPY_*` for UI text, `LS_KEY_*` for storage

**Single Responsibility**: One component = one semantic concern
- Modules <600 lines | chunks <500kB post-minification
- SVO pattern: **Subject verbs object** → traceable responsibility

## 4. Configuration orchestrates, components compose

**From static to adaptive**:
- Behavior controlled via external config, not code
- Load schemas/vocabularies/rules at runtime
- Theme tokens (never `#FF5733` or `16px` inline)
- i18n keys (zero hardcoded strings)

**Validation**: Can system process 3+ domains without code changes?

## 5. Pipeline feeds itself, observability embedded

**EDA → LLM Ops loop**:
```
Ingest → Profile → Engineer → Train → Validate → Deploy → Monitor → Feed back to EDA
```

**Three pillars always**:
- Metrics: RED (Rate, Errors, Duration) per service
- Logs: structured JSON + correlation IDs
- Traces: distributed spans + critical path

**Alert on symptoms** (user impact), not causes (disk full)

## 6. Performance by default, optimize early

**Required optimizations**:
- Batching | caching | chunking | memoization | sharding | virtualization
- Memoize: `React.memo`, `useMemo`, `useCallback`
- Virtualize: lists >100 items
- Code split: routes/features via dynamic imports
- Lazy load: below-fold content

**Core Web Vitals targets**: FCP <1.8s | LCP <2.5s | CLS <0.1 | TTI <3.8s

## 7. Provenance everywhere, confidence tracked

**Bidirectional linking**: nodes → source documents (metadata.documentPath, lineStart, lineEnd)
- Confidence decay: transitive edges = parent confidence × 0.8
- Extraction method: tag every node/edge (dependency_parsing | pattern_mining | user_curated)

**From query to grounded answer**: AgenticGraphRAG → decompose → retrieve subgraphs → multi-hop inference → synthesize with citations → deliver with provenance

## 8. Architecture resilient, contracts explicit

**Event-driven**: Publisher → broker → subscribers (idempotent processing + dead letter queues)
- Correlation IDs for distributed tracing
- Circuit breakers on external dependencies
- Retry with exponential backoff + jitter
- Timeouts at ALL network boundaries

**MCP compliance**: Tools expose standard interfaces | context propagates with metadata | errors cascade with traceability

## 9. Accessibility and i18n non-negotiable

**A11y requirements**:
- Semantic HTML (`<button>` not `<div onclick>`)
- ARIA labels for dynamic content
- Keyboard nav: Tab, Enter, Escape
- Color contrast ≥4.5:1

**i18n**: `t('namespace.key')` not "hardcoded text" | RTL support via CSS logical properties

## 10. Forbidden patterns kill velocity

❌ **Code anti-patterns**: Hardcoded domains/paths, duplicate code, files >600 lines, chunks >500kB, memory leaks, race conditions, multi-responsibility modules

❌ **Architecture anti-patterns**: Distributed monoliths, shared databases, synchronous chains >3 hops, single points of failure, unbounded queues

❌ **Design anti-patterns**: Prop drilling >3 levels, inline styles with magic numbers, direct state mutation, non-serializable state

❌ **Semantic anti-patterns**: Hard-coded ontologies (`if entity_type == "Person"`), embedded relationships, fixed rules, language-specific assumptions

---

**Remember**: Every line of code should answer "yes" to:
- Can this adapt to new domains without code changes?
- Is this responsibility single and clear?
- Can I validate this hypothesis with metrics in <2 weeks?
- Does this maintain provenance and traceability?
- Have I optimized for performance by default?