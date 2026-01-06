# Codebase Maintainability Guidelines

## Design Principles

**Consistency-First Architecture**: Schema-aligned semantics | single-source-of-truth | reusable primitives | performance-by-default | domain-agnostic patterns

**Module Boundaries**: <600 lines per file | feature-scoped utilities | single-responsibility classes | configuration-driven behavior

---

## Semantic Consistency Standards

**Schema Alignment**: Maintain consistency with `/schema/AgenticRAG` jsonld schema across:
- API identifiers, catalogs, code identifiers, components, declarations
- File names, handlers, hooks, import paths, keyboard shortcuts
- LocalStorage keys, naming conventions, render patterns
- Settings keys/registry, state fields, store selectors

**Copy Centralization**:
- Identify repeated UI phrases -> create copy helper constants (`COPY_*`)
- Anchor LocalStorage keys to shared constants (`LS_KEY_*`)
- Single source of truth for wording (e.g., `getOrchestratorSectionListLabel`)
- Expand to error/empty states, user-facing messages

---

## Module Organization (SRP + SVO)

### Pattern: ComponentFactory

**From configuration to instances**: ComponentFactory -> parses schema definitions via metadata validation -> instantiates components using registered builders -> injects dependencies through configuration mapping -> delivers initialized instances for application runtime.

### Pattern: CacheManager

**From requests to optimized responses**: CacheManager -> computes cache keys via content hashing -> retrieves data using LRU eviction policy -> validates freshness through TTL checking -> serves cached results with performance metrics.

---

## Anti-Patterns (Forbidden)

❌ Competing/conflicting code, corrupted logic, deadlock  
❌ Duplicate code, hardcoded values, stray strings  
❌ Memory leaks, race conditions, redundant computation  
❌ Stale code, unclear intent, unreferenced code  
❌ Project-specific presets, dataset assumptions, file path hardcoding

---

## Quality Requirements

**Performance**:
- Chunks <500kB post-minification | batching/sharding enabled
- Memoization optimized | virtualization for lists
- Reduce DOM complexity | avoid style recalc on mousemove/hover

**Validation**: Lint + typecheck pre-commit | verify key alignment post-refactor

**Stability**: Preserve APIs, behavior, UI affordances