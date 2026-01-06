# User-AI Interaction Rules

This document complements **Universal Project Rules** by defining **human-AI collaboration standards** for AI-assisted development. While project-rules.md establishes technical mandates (architecture, code quality, validation), this file governs prompt engineering, response validation, workflow integration, and ethical practices to ensure productive, consistent human-AI partnership.

---

## 1. Prompt Engineering Standards

### Structure & Clarity

**Pattern**: Use SVO (Subject-Verb-Object) phrasing aligned with project patterns

**Template**:
```
Context: [domain, constraints, schema reference]
Task: [component verbs data via method]
Output: [format, artifacts, success criteria]
Constraints: [anti-patterns to avoid, token limits]
```

**Examples**:
- "Refactor `CacheManager` to compute keys via content hashing under 300 lines"
- "Implement GraphRAG traverser that retrieves subgraphs using embeddings with provenance tracking"

### Context Provision

**Required Context**:
- Schema definitions from `/schema/AgenticRAG`
- Relevant module paths, class names, function signatures
- Configuration files, error messages, performance metrics
- Prior conversation references for multi-turn tasks

**Progressive Refinement**: Start with high-level intent -> validate approach -> drill into implementation details -> iterate based on feedback

### Chain of Thought Guidance

**For Complex Tasks**: Request "step-by-step reasoning with intermediate outputs"

**For Domain-Agnostic Code**: Specify "explain how this remains configuration-driven and processes 3+ domains without code changes"

---

## 2. Response Quality Enforcement

### Alignment with Project Standards

**Validation Checklist for AI Outputs**:
- [ ] Follows SVO responsibility pattern
- [ ] Zero hardcoded domain entities
- [ ] Adheres to <600 lines per file
- [ ] Uses centralized constants (`LS_KEY_*`, `COPY_*`)
- [ ] Includes provenance tracking
- [ ] Avoids anti-patterns from project rules

### Accuracy & Grounding

**Requirements**:
- Ground responses in provided schema/context
- Use web search for current information (library versions, best practices)
- Mark proposed/invented code clearly
- Admit uncertainty; never hallucinate API details

**Format Adherence**: Match requested output format (markdown tables, code blocks, diffs, configuration YAML)

### Token Efficiency

**Balance**: Comprehensive coverage within specified limits | prioritize signal over noise | use structured formatting (tables, headings) for scannability

---

## 3. Workflow Integration Patterns

### Lean Startup Support

**From hypothesis to validation**: AI assists -> define MVP scope via constraint analysis -> generate instrumented code with telemetry hooks -> propose metrics collection strategy -> suggest A/B test design -> analyze feedback data.

**Prompt Pattern**:
```
Hypothesis: [user assumption]
MVP Scope: [minimal feature set]
Task: Generate implementation with metrics instrumentation
Success Criteria: [OKR key results]
```

### MCP-Aware Development

**When implementing MCP components**: AI provides -> interface definitions following protocol spec -> context propagation mechanisms with metadata -> error cascade patterns with traceability -> versioning strategy aligned with semantic rules.

**Validation**: Ensure all tool integrations expose MCP-compliant interfaces

### EDA -> LLM Ops Pipeline Support

**AI assists across pipeline stages**:
- **EDA**: Statistical profiling code, data drift detection algorithms
- **Feature Engineering**: Transformation DAG generation, schema validation
- **Training**: Hyperparameter optimization suggestions, evaluation metrics
- **Monitoring**: Dashboard queries, alert threshold calculations
- **Feedback**: Root cause analysis, improvement recommendations

**Quality Gate Checks**: AI validates outputs against thresholds (KL divergence < 0.15, F1 > baseline + 5%, p99 < 500ms)

---

## 4. Multi-Turn Collaboration

### Context Maintenance

**Requirements**:
- Reference previous outputs by artifact ID or conversation turn
- Track evolving requirements across iterations
- Maintain consistency with established patterns/decisions

**State Tracking**: For complex refactors, maintain "what changed" summary across turns

### Feedback Loop Protocol

**User Provides**:
- Specific error messages, unexpected behavior
- Performance metrics (actual vs. expected)
- Validation failures from lint/typecheck

**AI Responds**:
- Root cause analysis with code references
- Proposed fix with diff format
- Impact assessment (affected modules, downstream dependencies)
- Validation confirmation (how fix addresses anti-patterns)

### Edge Case Handling

**On Ambiguity**: AI asks clarifying questions before implementation:
- "Should this handle N domains or remain fully generic?"
- "Confidence threshold: use default 0.8 or customize per use case?"
- "Provenance tracking: bidirectional or unidirectional here?"

---

## 5. Tool Usage Guidelines

### Proactive Tool Invocation

**Search**: For library compatibility, API documentation, best practices
**Code Execution**: For validation of algorithms, performance benchmarks
**File Analysis**: For schema conformance, dependency mapping

**Pattern**: AI searches before implementing to ensure current best practices

### Artifact Management

**Creation**: Use artifacts for code >20 lines, documents >1500 chars, structured reference content
**Updates**: Use `update` for <20 line changes, `rewrite` for structural refactors
**Validation**: Run lint/typecheck equivalent logic before delivery

---

## 6. Ethical & Safety Standards

### Domain-Agnostic Ethics

**Forbidden**: 
- Generating code with hardcoded sensitive data (credentials, PII)
- Bypassing configuration-driven design for expedience
- Introducing non-configurable domain assumptions

**Required**:
- Transparency about limitations (e.g., "This requires manual schema migration")
- Bias mitigation in example data, naming conventions
- Accessibility considerations in UI components

### Alignment with Project Anti-Patterns

**AI refuses**:
- Requests to violate MECE principles
- Introducing duplicate code when refactoring exists
- Creating files >600 lines without explicit justification
- Implementing without provenance tracking

---

## 7. Integration & Governance

**Usage Context**: Embed in custom instructions for Claude, Cursor, Windsurf, or similar tools

**Review Cadence**: Quarterly updates aligned with project-rules.md evolution

**Feedback Mechanism**: Track AI-generated code quality via OKR metrics (bug rate, refactor frequency, schema compliance)

**Training**: New team members onboard with paired user-rules.md + project-rules.md walkthroughs

---

## Complementarity with Universal Project Rules (MECE)

| Concern | Project Rules Coverage | User Rules Coverage |
|---------|------------------------|---------------------|
| Architecture | Technical patterns, standards | How to prompt for patterns |
| Code Quality | Metrics, anti-patterns | How to validate AI outputs |
| Methodology | Lean Startup, OKRs defined | How AI assists each stage |
| Validation | Checklists, gates | How to enforce via prompts |
| Ethics | Domain agnosticism principle | Human-AI interaction ethics |
| Workflow | Pipeline architecture | Collaboration protocols |