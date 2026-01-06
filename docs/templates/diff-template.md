# Diff Template: Universal Change Specification

## Change Architecture

**Change Flow**: [Detection] -> [Classification] -> [Impact Analysis] -> [Resolution] -> [Validation]

**State Transformations**: [baseline_state] -> [intermediate_state] -> [target_state]

**Design Principles**: Atomic change units | bidirectional traceability | conflict-aware merging | provenance preservation

---

## Change Specification Template

### Change: [ChangeName]

**From [old_state] to [new_state]**: Change -> [adds/modifies/removes] [artifact_type] via [method] -> delivers [updated_artifacts] for [downstream_validation].

**Change Schema**:
```yaml
change_identifier:
  type: [addition | modification | deletion | relocation]
  scope: [file | function | class | module | system]
  reason: [feature | bugfix | refactor | optimization | deprecation]
  impact: [breaking | compatible | internal]
  affected_lines: [start-end]
  confidence: 0.95
  author: [identifier]
  timestamp: [ISO8601]
  risk_level: [15-word description]
```

**Change Pattern**: [Operation type] -> input [old_artifact] -> output [new_artifact] -> O(complexity)

---

## Change Classification Matrix

**Principles**:
- one-row-one-change
- Change-Type-Impact maps to What—How—Effect structure

| Change ID | File/Module | Change Type | Scope | Lines Changed | Impact | Dependencies | Conflicts | Review Status |
|-----------|-------------|-------------|-------|---------------|--------|--------------|-----------|---------------|
| CHG-[001] | `path/file.ext` | modification | function | +15/-8 | compatible | CHG-003 | none | approved |
| CHG-[002] | `path/file.ext` | addition | class | +42/-0 | breaking | none | CHG-005 | pending |

**Example Rows**:
| Change ID | File/Module | Change Type | Scope | Lines Changed | Impact | Dependencies | Conflicts | Review Status |
|-----------|-------------|-------------|-------|---------------|--------|--------------|-----------|---------------|
| CHG-042 | `src/parser.py` | modification | function | +23/-17 | compatible | CHG-038 | none | approved |
| CHG-043 | `src/config.yaml` | addition | parameter | +5/-0 | breaking | CHG-040, CHG-042 | CHG-039 | review |

---

## Change Impact Analysis

**Direct Impact**:
- Modified functions/classes with signatures
- Added/removed dependencies
- Changed API contracts
- Updated configuration schemas

**Transitive Impact**:
- Downstream consumers requiring updates
- Test suites needing modification
- Documentation requiring revision
- Breaking changes propagating to dependents

**Impact Scoring**:
```yaml
impact_score: change_magnitude × consumer_count × criticality_weight
change_magnitude: {breaking: 10, signature: 7, behavior: 4, cosmetic: 1}
consumer_count: number_of_dependent_modules
criticality_weight: {core: 3.0, feature: 1.5, utility: 1.0}
```

---

## Conflict Detection & Resolution

**Conflict Types**:
- **Textual**: Overlapping line modifications
- **Semantic**: Logically incompatible changes
- **Structural**: Schema/interface violations
- **Temporal**: Race conditions in parallel changes

**Resolution Strategies**:
- **Auto-Merge**: Non-overlapping changes, compatible intents
- **Manual Review**: Conflicting logic, breaking changes
- **Rebase**: Sequential dependency resolution
- **Reject**: Violates architectural constraints

**Conflict Pattern**:

**From [conflicting_changes] to [resolved_state]**: Resolver -> detects overlap via diff analysis -> classifies conflict type using semantic rules -> proposes resolution strategy through heuristics -> validates merged result against constraints -> delivers conflict-free state for [integration_stage].

---

## Provenance & Lineage Tracking

**Change Origin**:
- Track source via `change.metadata.origin` (commit, PR, issue)
- Preserve authorship metadata (`author`, `timestamp`, `reason`)
- Maintain causal links between related changes

**Change Propagation**:
- Compute impact scores via dependency graph traversal
- Apply decay for indirect dependencies (multiply by 0.9 per hop)
- Track change chains through multi-stage transformations

**Method Tracking**:
- Label with `change_method` (automated | manual | AI-assisted)
- Enable quality analysis by change method
- Support selective rollback by origin

---

## Quality Metrics Framework

**Correctness Metrics**: test_pass_rate, regression_count, bug_introduction_rate

**Maintainability Metrics**: code_churn, cyclomatic_complexity_delta, coupling_change

**Safety Metrics**: breaking_change_rate, rollback_frequency, incident_correlation

**Triggers**: [metric > threshold] -> [block merge | require review | flag risk]

---

## Anti-Patterns (Forbidden)

❌ God commits (>500 lines, multiple unrelated changes)  
❌ Silent breaking changes without version bump  
❌ Undocumented API modifications  
❌ Orphaned changes without issue/PR links  
❌ Mixed refactor and feature in single commit  
❌ Missing migration scripts for schema changes  

---

## Validation Checklist

**Structural Validation** (Required):
- [ ] Change scope clearly defined (file, function, class)
- [ ] All modified files listed with line ranges
- [ ] Dependencies identified and validated
- [ ] Conflicts detected and resolved

**Impact Validation** (Required):
- [ ] Breaking changes flagged and versioned
- [ ] Affected consumers notified
- [ ] Migration paths documented
- [ ] Rollback procedure tested

**Quality Validation** (Required):
- [ ] Tests updated for modified behavior
- [ ] Documentation reflects changes
- [ ] Code review completed and approved
- [ ] CI/CD pipeline passes all gates

**Provenance Validation** (Required):
- [ ] Change reason documented (issue/ticket reference)
- [ ] Author and timestamp recorded
- [ ] Change method labeled (automated/manual/AI)
- [ ] Causal links to related changes maintained

---

## Change Evolution Strategy

**Versioning Rules**: Follow semantic versioning for breaking/compatible/patch changes

**Compatibility Matrix**:
- ✅ Backward-compatible additions (minor version)
- ❌ Breaking removals/modifications (major version)
- ✅ Internal refactors without API changes (patch)

**Migration Strategy**:
- Provide deprecation warnings 2 versions ahead
- Supply automated transformation scripts
- Document migration steps in CHANGELOG
- Maintain compatibility shims temporarily

---

## Diff Formats & Representations

**Unified Diff**: Line-by-line changes with context | **Structural Diff**: AST-based semantic changes | **Schema Diff**: Configuration/data model evolution | **Visual Diff**: Side-by-side or inline rendering

**Export Templates**:
```yaml
diff_output:
  format: [unified | structural | schema | visual]
  context_lines: 3
  ignore_whitespace: true
  show_metadata: true
  include_provenance: true
```

---

## Change Aggregation Patterns

### Pattern: ChangeSet

**From [atomic_changes] to [logical_unit]**: ChangeSet -> groups related changes via semantic clustering -> validates consistency using cross-change rules -> computes aggregate impact through dependency analysis -> delivers cohesive unit for [merge_strategy].

### Pattern: ChangeStream

**From [sequential_commits] to [temporal_narrative]**: ChangeStream -> orders changes via timestamp -> tracks evolution through state transitions -> identifies patterns using time-series analysis -> delivers change history for [audit_trail].

---

## Change Review Protocol

**Review Criteria**:
- Code quality: adherence to style guide, complexity limits
- Functional correctness: test coverage, edge case handling
- Architecture alignment: follows design principles, no anti-patterns
- Security: no vulnerabilities introduced, secrets excluded

**Approval Gates**:
```yaml
review_gates:
  automated_checks: [lint, typecheck, tests, security_scan]
  human_review: {reviewers: 2, approvals: 1}
  domain_expert: {required_for: [breaking_changes, security, performance]}
  bypass_conditions: [hotfix, owner_override]
```

**Review Pattern**:

**From [change_submission] to [merge_ready]**: Reviewer -> validates structure via automated checks -> assesses logic through code inspection -> evaluates impact using dependency graphs -> approves or requests modifications with feedback -> delivers reviewed change for [integration_pipeline].