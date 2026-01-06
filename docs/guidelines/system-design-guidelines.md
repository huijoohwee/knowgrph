# System Design Guidelines

## Core System Principles

**Distributed-First Architecture**: Stateless services | event-driven communication | schema-mediated contracts | observable by default

**Bounded Contexts**: Clear service boundaries | independent deployment | data ownership | backward-compatible interfaces

**Resilience Patterns**: Graceful degradation | circuit breakers | retry with exponential backoff | bulkhead isolation

---

## System Architecture Patterns

### Service Orchestration

**From request to response**: API Gateway -> authenticates request via token validation -> routes to service mesh using load balancing -> orchestrates workflow through event bus -> aggregates responses with timeout handling -> returns unified result with correlation ID.

### Event-Driven Integration

**Pattern**: Publisher -> emits events to message broker -> subscribers consume via topic filters -> process idempotently using deduplication keys -> update state with eventual consistency.

**Requirements**:
- Schema registry for event contracts
- Dead letter queues for failed processing
- Correlation IDs for distributed tracing
- Idempotency keys for retry safety

---

## Data Architecture

### Storage Strategy

| Pattern | Use Case | Consistency | Scalability |
|---------|----------|-------------|-------------|
| RDBMS | Transactional data | Strong | Vertical |
| Document Store | Semi-structured entities | Eventual | Horizontal |
| Graph DB | Relationship-heavy | Tunable | Horizontal |
| Object Storage | Binary artifacts | Eventual | Unlimited |

**Rule**: Select storage by access pattern, not convenience | denormalize for read-heavy | normalize for write-heavy

### Caching Layers

**Hierarchy**: CDN -> API Gateway cache -> Application cache -> Database query cache

**Invalidation**: Event-driven purge | TTL-based expiry | write-through on updates

---

## API Design Principles

**RESTful Contracts**:
- Resource-oriented URLs (`/users/{id}/posts`)
- HTTP verbs map to CRUD operations
- Hypermedia links (HATEOAS) for discoverability
- Versioning via headers (`Accept: application/vnd.api+json; version=2`)

**GraphQL Patterns**:
- Schema-first development
- Resolver batching/caching (DataLoader)
- Query complexity limits
- Subscription for real-time updates

---

## Security Architecture

**Defense in Depth**:
- Perimeter: WAF, DDoS protection, rate limiting
- Network: Service mesh mTLS, zero-trust segmentation
- Application: OWASP compliance, input validation, output encoding
- Data: Encryption at rest/transit, field-level encryption for PII

**Pattern**: Authenticate at edge -> authorize at service -> audit everywhere

---

## Observability Requirements

**Three Pillars**:
- **Metrics**: RED (Rate, Errors, Duration) per service | SLI/SLO tracking
- **Logs**: Structured JSON | correlation IDs | log levels (ERROR, WARN, INFO, DEBUG)
- **Traces**: Distributed tracing spans | critical path identification

**Alerting**: Symptom-based alerts (user impact) > cause-based (disk full)

---

## Anti-Patterns (Forbidden)

- Distributed monoliths (shared databases across services)  
- Synchronous chains >3 hops  
- Implicit contracts (no schema definitions)  
- Single points of failure  
- Unbounded queues/thread pools

---

## System Validation Checklist

**Architecture** (Required):
- [ ] Services independently deployable
- [ ] All integrations have SLAs defined
- [ ] Failure modes documented (chaos engineering tested)
- [ ] Data flows comply with GDPR/privacy requirements

**Performance** (Required):
- [ ] Load testing at 2x expected peak
- [ ] p99 latency <500ms for critical paths
- [ ] Database queries have explain plans reviewed
- [ ] CDN coverage for static assets

**Resilience** (Required):
- [ ] Circuit breakers on external dependencies
- [ ] Retry logic with jitter
- [ ] Timeouts set at all network boundaries
- [ ] Graceful shutdown implemented