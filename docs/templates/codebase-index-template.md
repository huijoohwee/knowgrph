# Codebase Index Template: Universal Repository Specification

## Repository Architecture

**Module Hierarchy**: [RootPackage] -> [SubPackage1] -> [SubPackage2] -> [ComponentN] -> [Implementation]

**Dependency Flow**: [core_layer] -> [service_layer] -> [interface_layer] -> [integration_layer]

**Design Principles**: Modularity-first design | explicit dependency injection | interface-contract adherence | version-controlled schemas

---

## Module Specification Template

### Module: [ModuleName]

**From [input_interface] to [output_contract]**: Module -> [receives/transforms/delivers] [data_type] via [pattern] -> exposes [interfaces] for [consumers].

**Configuration Schema**:
```yaml
parameter_name:
  scope: [module_local | system_global]
  type: [primitive_type]
  mutability: [immutable | runtime_configurable]
  binding: [compile_time | load_time | runtime]
  default: value
  validation: [constraint_expression]
  impact: [15-word description]
```

**Interface Pattern**: [Contract definition] -> accepts [parameters] -> returns [structure] -> O(complexity)

---

## Component Responsibility Matrix

**Principles**:
- one-entry-one-component
- Path-Class-Method maps to Location–Implementation–Behavior triad

| Layer | Path | Component | Interface/Method | Responsibility (S-V-O) | Dependencies | Contracts | LOC |
|-------|------|-----------|------------------|------------------------|--------------|-----------|-----|
| [Name] | `path/to/module` | `ComponentName` | `interface_name` | [subject verbs object] | `dep1`, `dep2` | [interface] | N–M |
| [Name] | `path/to/module` | — | `function_name` | [subject verbs object] | `dep1` | [contract] | N–M |

**Example Entries**:
| Layer | Path | Component | Interface/Method | Responsibility (S-V-O) | Dependencies | Contracts | LOC |
|-------|------|-----------|------------------|------------------------|--------------|-----------|-----|
| Core | `src/core/processor` | `DataProcessor` | `IProcessor.process` | processes input streams into normalized records | `logging`, `typing` | IProcessor | 120–185 |
| Service | `src/service/validator` | — | `validate_input` | validates request payloads against defined schemas | `jsonschema`, `pydantic` | ValidationResult | 45–67 |

---

## Dependency & Integration Standards

**Dependency Declaration**: 
- Explicit imports tracked in `dependencies.manifest`
- Version constraints via semantic versioning
- Transitive dependencies resolved at build time

**Integration Contracts**: 
- Define interfaces via [IDL/protocol buffers/abstract classes]
- Maintain backward compatibility guarantees
- Version all public APIs with deprecation lifecycle

**Coupling Metrics**: 
- Afferent coupling (Ca): incoming dependencies
- Efferent coupling (Ce): outgoing dependencies
- Instability (I = Ce / (Ca + Ce))

---

## Code Organization Framework

**Directory Structure**:
```
repository/
├── src/             # Source implementations
├── tests/           # Test suites mirroring src/
├── config/          # Configuration schemas
├── docs/            # Documentation artifacts
├── scripts/         # Build and deployment automation
└── schemas/         # Data contracts and interfaces
```

**Naming Conventions**: 
- Modules: `snake_case` for files, `PascalCase` for classes
- Functions: `verb_noun` pattern for clarity
- Constants: `SCREAMING_SNAKE_CASE` for immutables

**File Organization**: 
- Maximum 500 LOC per file
- Single responsibility per module
- Explicit exports via `__init__.py` or `index`

---

## Testing & Quality Standards

**Test Coverage Metrics**: line_coverage, branch_coverage, mutation_score

**Test Categories**: unit (isolated), integration (connected), contract (interface), performance (benchmarked)

**Quality Gates**: [coverage < 80%] -> [block_merge] | [complexity > 10] -> [refactor_trigger]

**Test Patterns**: Arrange-Act-Assert | Given-When-Then | Test fixtures via dependency injection

---

## Anti-Patterns (Forbidden)

❌ Circular dependencies between modules  
❌ Global mutable state without coordination  
❌ Implementation inheritance over composition  
❌ Implicit dependencies via side effects  
❌ Undocumented public interfaces  

---

## Repository Health Checklist

**Structural Health** (Required):
- [ ] Dependency graph acyclic
- [ ] Module boundaries well-defined
- [ ] Public interfaces documented
- [ ] Test coverage above threshold

**Maintainability** (Required):
- [ ] Consistent code style enforced
- [ ] Automated linting configured
- [ ] Breaking changes documented
- [ ] Migration guides provided

**Operations** (Required):
- [ ] Build process reproducible
- [ ] CI/CD pipeline functional
- [ ] Deployment runbooks current
- [ ] Monitoring instrumented

---

## Version Control Standards

**Branching Strategy**: trunk-based | git-flow | feature-branch

**Commit Conventions**: 
- Format: `type(scope): description`
- Types: feat, fix, docs, refactor, test, chore
- Breaking changes marked with `!` or `BREAKING CHANGE:`

**Code Review Requirements**:
- ✅ Automated checks pass
- ✅ Test coverage maintained
- ✅ Documentation updated
- ❌ Merge without approval

---

## Documentation Requirements

**API Documentation**: [Tool] auto-generates from [annotations/docstrings/comments]

**Architecture Diagrams**: Component diagrams, sequence diagrams, deployment diagrams

**Onboarding Materials**: 
- README with quick-start guide
- Architecture decision records (ADRs)
- Development environment setup
- Contribution guidelines

**Maintenance Documentation**: 
- Troubleshooting guides indexed by symptom
- Performance tuning parameters
- Security considerations
- Disaster recovery procedures

---

## Build & Deployment Configuration

**Build Artifacts**: [Type1]: [distribution_format] | [Type2]: [packaging_format] | [TypeN]: [delivery_mechanism]

**Environment Configuration**: Development | Staging | Production - isolated configurations

**Deployment Patterns**: Blue-green | Canary | Rolling | Feature flags