# Product Guidelines

## Core Product Principles

**User-Centric Development**: Evidence-based decisions | rapid experimentation | continuous feedback | metric-driven iteration

**Value-First Delivery**: Minimal viable features | incremental complexity | measurable outcomes | validated learning

**LLM-Native Product Design**: Prompt engineering as UX | context-aware interactions | probabilistic outputs | human-in-the-loop validation

---

## Lean Startup Methodology

### Build-Measure-Learn Cycle

**From hypothesis to pivot/persevere**: Team -> defines falsifiable hypothesis via problem statement -> builds MVP with instrumentation -> deploys to target cohort using feature flags -> measures behavior through analytics pipeline -> analyzes results against success criteria -> decides pivot or persevere based on statistical significance.

**Cycle Time**: <2 weeks per iteration | minimize time to validated learning

### Hypothesis Framework

**Structure**:
```yaml
hypothesis: "Users will [behavior] when [condition]"
success_metric: [quantifiable_kpi]
baseline: [current_value]
target: [minimum_viable_improvement]
sample_size: [statistical_power_calculation]
duration: [test_timeframe]
```

**Validation**: p-value <0.05 | effect size >10% | retention analysis

---

## Agile Practices

### Sprint Structure

**Cadence**: 2-week sprints | daily standups | sprint planning/review/retro

**From backlog to production**: Product Owner -> prioritizes stories via RICE scoring -> team commits to sprint scope during planning -> developers implement with TDD -> QA validates against acceptance criteria -> deploy via CI/CD pipeline -> monitor production metrics.

**Story Format**: "As [user_type], I want [capability] so that [benefit]"

**Acceptance Criteria**:
- Given [precondition]
- When [action]
- Then [expected_outcome]

---

## MVP Standards

### Definition

**Minimum Viable Product**: Smallest feature set validating core hypothesis | delivers measurable user value | enables learning with minimal investment

**Required Components**:
- One critical user journey (happy path only)
- Instrumentation for key metrics
- Feedback collection mechanism
- Schema-compliant data models
- Configuration-driven behavior

**Forbidden in MVP**: Edge case handling | polish/animations | multiple user roles | scalability optimization | comprehensive error states

### Feature Prioritization (RICE)

**Score = (Reach × Impact × Confidence) / Effort**

- **Reach**: Users affected per period
- **Impact**: Value per user (0.25=minimal, 3=massive)
- **Confidence**: Certainty % (100%=high, 50%=low)
- **Effort**: Person-months

---

## LLM Ops Practices

### Prompt Engineering as Product

**Version Control**: Prompt templates in Git | A/B test variations | rollback capability

**Evaluation Pipeline**:
```
[Prompt v1] -> [Model] -> [Output] -> [Eval Metrics] -> [Human Review]
     ↓                                        ↓
[Prompt v2] -> [Optimize] -> [Compare] -> [Threshold Gate]
```

**Metrics**: Task success rate | output coherence | hallucination frequency | latency p99 | cost per request

### Context Management

**Pattern**: RAG (Retrieval-Augmented Generation) -> retrieves relevant context via embeddings -> ranks by relevance using reranker -> constructs prompt with top-k chunks -> generates response with citations -> validates against source material.

**Quality Gates**:
- Groundedness score >0.9
- Citation accuracy 100%
- Context token budget <4k
- Response latency <2s

### Human-in-the-Loop Workflows

**Critical Decisions**: Require human approval before execution | log provenance for audit

**Feedback Collection**: Thumbs up/down | correction interface | edge case flagging

---

## Anti-Patterns (Forbidden)

- Building without validated problem statement  
- Feature bloat in MVP  
- Vanity metrics over actionable KPIs  
- Skipping user research  
- Deploying LLMs without evaluation framework  
- Ignoring prompt injection vulnerabilities

---

## Product Validation Checklist

**Pre-Launch** (Required):
- [ ] Hypothesis documented with success criteria
- [ ] MVP scope meets minimality test
- [ ] User stories have acceptance criteria
- [ ] Analytics instrumentation active
- [ ] LLM eval pipeline operational
- [ ] Rollback strategy defined

**Post-Launch** (Continuous):
- [ ] Review OKRs weekly
- [ ] Run retrospectives each sprint
- [ ] Monitor LLM quality metrics daily
- [ ] Collect user feedback systematically