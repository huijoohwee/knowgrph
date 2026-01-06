# PRD-Codebase Gap Report Template

## Gap Analysis Framework

**Analysis Flow**: [Requirements] -> [Current State] -> [Gap Identification] -> [Prioritization] -> [Roadmap]

**State Comparison**: [expected_capability] ↔ [actual_implementation] -> [gap_type]

**Design Principles**: Evidence-based assessment | MECE gap classification | risk-weighted prioritization | incremental closure strategy

---

## Requirement-Codebase Mapping Template

### Feature: [FeatureName]

**From [requirement_spec] to [implementation_state]**: Analysis -> compares expected behavior via acceptance criteria -> evaluates current implementation using code inspection -> identifies discrepancies through differential analysis -> delivers gap classification for [prioritization_stage].

**Gap Assessment Schema**:
```yaml
gap_identifier:
  requirement: [PRD specification]
  current_state: [actual implementation]
  gap_type: [missing | partial | misaligned | deprecated]
  severity: [critical | high | medium | low]
  impact: [user_experience | performance | security | maintainability]
  effort: [story_points | hours]
  dependencies: [prerequisite_gaps]
  risk: [15-word description]
```

**Mapping Pattern**: [PRD section] -> current [module/component] -> gap [classification] -> complexity O(effort)

---

## Gap Classification Matrix

**Principles**:
- one-row-one-gap
- Requirement-Implementation-Gap maps to Expected—Actual—Discrepancy structure

| Feature | PRD Section | Current Module | Gap Type | Severity | Impact Dimension | Effort | Dependencies | Priority |
|---------|-------------|----------------|----------|----------|------------------|--------|--------------|----------|
| [Name] | PRD-[ref] | `path/module.ext` | missing | critical | user_experience | 13 SP | `gap-002` | P0 |
| [Name] | PRD-[ref] | `path/module.ext` | partial | high | performance | 8 SP | none | P1 |

**Example Rows**:
| Feature | PRD Section | Current Module | Gap Type | Severity | Impact Dimension | Effort | Dependencies | Priority |
|---------|-------------|----------------|----------|----------|------------------|--------|--------------|----------|
| GraphRAG Query | PRD-3.2 | `src/retriever.py` | partial | high | accuracy | 21 SP | gap-015, gap-023 | P0 |
| Theme System | PRD-5.1 | — | missing | medium | user_experience | 13 SP | none | P1 |

---

## Gap Taxonomy

**Functional Gaps**:
- **Missing**: Required feature not implemented
- **Partial**: Feature exists but incomplete (coverage <80%)
- **Misaligned**: Implementation diverges from specification
- **Deprecated**: Legacy approach conflicts with new requirements

**Non-Functional Gaps**:
- **Performance**: Fails to meet latency/throughput targets
- **Scalability**: Cannot handle specified load/volume
- **Security**: Missing authentication/authorization/encryption
- **Accessibility**: WCAG compliance violations
- **Maintainability**: Technical debt blocking evolution

**Configuration Gaps**:
- **Hardcoded**: Values should be externalized to config
- **Non-Composable**: Monolithic where modular required
- **Schema-Misaligned**: Structure diverges from standard
- **Provenance-Blind**: Missing traceability requirements

---

## Risk Assessment Framework

**Risk Scoring**:
```yaml
risk_score: severity_weight × impact_multiplier × probability
severity_weight: {critical: 10, high: 7, medium: 4, low: 1}
impact_multiplier: {multiple_domains: 3, single_domain: 1.5, isolated: 1}
probability: {certain: 1.0, likely: 0.7, possible: 0.4, unlikely: 0.1}
```

**Mitigation Strategies**:
- [risk_score > 50] -> immediate escalation + dedicated sprint
- [risk_score 20-50] -> prioritize in next release cycle
- [risk_score < 20] -> backlog with monitoring

**Dependency Tracking**:
- Map gap dependencies via directed acyclic graph (DAG)
- Identify critical path for sequential gaps
- Flag circular dependencies as architecture issues

---

## Implementation Roadmap Template

### Phase: [PhaseName]

**From [gap_state] to [resolved_state]**: Phase -> selects gaps via prioritization algorithm -> groups by dependency clusters -> sequences implementation using topological sort -> delivers working features for [validation_stage].

**Phase Configuration**:
```yaml
phase_identifier:
  goals: [capability_1, capability_2]
  gap_closures: [gap-001, gap-003, gap-007]
  duration: [weeks]
  success_criteria: [metric > threshold]
  acceptance_tests: [test_suite_references]
  rollback_plan: [contingency_steps]
```

**Sequencing**: [Phase1: Foundation] -> [Phase2: Core Features] -> [Phase3: Optimization] -> [Phase4: Polish]

---

## Acceptance Criteria Validation

**Functional Validation**:
- [ ] Feature implements 100% of PRD acceptance criteria
- [ ] Edge cases documented in PRD handled correctly
- [ ] Error states match specification
- [ ] User workflows complete end-to-end

**Technical Validation**:
- [ ] Performance meets SLA targets (latency, throughput)
- [ ] Security requirements satisfied (auth, encryption)
- [ ] Accessibility standards met (WCAG 2.1 AA)
- [ ] Configuration-driven (zero hardcoded assumptions)

**Quality Validation**:
- [ ] Test coverage ≥80% for new code
- [ ] Documentation updated (API docs, user guides)
- [ ] Provenance tracking implemented
- [ ] Schema versioning applied

---

## Anti-Patterns in Gap Analysis

❌ Cherry-picking convenient gaps while ignoring systemic issues  
❌ Severity inflation to manipulate prioritization  
❌ Ignoring non-functional gaps (performance, security)  
❌ Missing dependency analysis leading to blocked work  
❌ Vague gap descriptions without measurable criteria  
❌ Conflating gaps with feature requests (scope creep)  

---

## Gap Report Checklist

**Completeness** (Required):
- [ ] All PRD sections mapped to codebase modules
- [ ] Gap taxonomy applied consistently
- [ ] Severity and effort estimated with evidence
- [ ] Dependencies identified and visualized (DAG)
- [ ] Risk scores calculated per framework

**Actionability** (Required):
- [ ] Each gap has acceptance criteria
- [ ] Implementation roadmap phases defined
- [ ] Resource estimates included (team, time, budget)
- [ ] Stakeholder sign-off obtained
- [ ] Monitoring plan for gap closure tracking

**Traceability** (Required):
- [ ] PRD references linked bidirectionally
- [ ] Code module paths specified precisely
- [ ] Version control tags for baseline state
- [ ] Gap closure tracked with commit/PR references

---

## Gap Evolution Strategy

**Versioning**: Track gap report versions with semantic versioning (`report-MAJOR.MINOR.PATCH`)

**Update Triggers**:
- ✅ PRD amendments (new requirements added)
- ✅ Code refactors (gaps auto-resolved)
- ✅ Priority shifts (business needs change)
- ❌ Individual developer preferences

**Closure Workflow**: Gap identified -> implementation planned -> PR merged -> validation passed -> gap archived with metadata

---

## Reporting Formats

**Executive Summary**: High-level metrics, P0/P1 counts, timeline | **Detailed Analysis**: Full gap matrix, risk heatmap, dependency graph | **Sprint Planning**: Prioritized backlog, story cards, acceptance tests