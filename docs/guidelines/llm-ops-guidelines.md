# LLM Operations Guidelines

## Core Principles

**Configuration-Driven Prompting**: All prompts constructed from templates, schemas, examples via config | Zero hardcoded instructions | Model-agnostic interfaces | Token-aware batching

**Neutrality Mandate**: No domain vocabularies in prompts | Schema-driven output structures | Metadata-parameterized behavior | Provenance for all LLM calls

---

## Prompt Construction

### Component: PromptBuilder

**From schema to instruction**: PromptBuilder -> loads template from config -> injects schema definitions -> adds few-shot examples -> assembles structured prompt -> delivers token-optimized instruction for LLM.

```
FUNCTION PromptBuilder.construct_extraction_prompt({ text, config }) -> { prompt }
  // PromptBuilder assembles extraction prompt via template and schema
  
  template <- load_template(config.prompt_templates.extraction)
  schema_def <- serialize_schema(config.extraction_schema)
  examples <- sample_examples(config.few_shot_pool, count: config.example_count)
  
  prompt <- template.format({
    input_text: text,
    schema: schema_def,
    examples: examples,
    constraints: config.extraction_constraints
  })
  
  ASSERT token_count(prompt) <= config.max_prompt_tokens
  
  RETURN {
    prompt: prompt,
    provenance: { template: template.id, schema_version: config.schema_version }
  }
END
```

| Module | Class/Object | Function/Method | Responsibility (S-V-O) | Dependencies | Artifacts/Outputs |
|--------|--------------|-----------------|------------------------|--------------|-------------------|
| `llm/prompt.ext` | `PromptBuilder` | `construct_extraction_prompt` | PromptBuilder assembles extraction prompt via template and schema | `config.templates`, `config.schema` | `Prompt{}` |

---

## Response Processing

### Component: ResponseParser

**From LLM output to validated data**: ResponseParser -> extracts structured content from response -> validates against schema -> computes confidence scores -> handles malformed outputs -> delivers parsed entities with quality metrics.

```
FUNCTION ResponseParser.parse_entities({ llm_response, config }) -> { entities }
  // ResponseParser extracts entities from LLM response via schema validation
  
  raw_json <- extract_json(llm_response, config.json_extraction_strategy)
  
  IF NOT valid_json(raw_json):
    metrics.increment("llm.parse.invalid_json")
    RETURN retry_or_fallback(llm_response, config)
  
  entities <- []
  FOR EACH item IN raw_json.items:
    validated <- config.schema_validator.check_compliance(item)
    
    IF validated.valid:
      entities.append({
        data: item,
        confidence: compute_llm_confidence(item, llm_response),
        provenance: { model: config.model_id, timestamp: now() }
      })
    ELSE:
      metrics.increment("llm.parse.schema_violation")
  
  RETURN { entities: entities, parse_rate: count(entities) / count(raw_json.items) }
END
```

| Module | Class/Object | Function/Method | Responsibility (S-V-O) | Dependencies | Artifacts/Outputs |
|--------|--------------|-----------------|------------------------|--------------|-------------------|
| `llm/parser.ext` | `ResponseParser` | `parse_entities` | ResponseParser extracts entities from LLM response via schema validation | `config.schema_validator`, `config.model_id` | `Entity[]` |

---

## Batch Management

### Component: BatchOrchestrator

**From corpus to optimized batches**: BatchOrchestrator -> segments input by token limits -> schedules parallel requests -> manages rate limits -> aggregates responses -> delivers processed results with throughput metrics.

```
FUNCTION BatchOrchestrator.process_corpus({ documents, config }) -> { results }
  // BatchOrchestrator segments documents into token-aware batches
  
  batches <- []
  current_batch <- []
  current_tokens <- 0
  
  FOR EACH doc IN documents:
    doc_tokens <- estimate_tokens(doc, config.tokenizer)
    
    IF current_tokens + doc_tokens > config.batch_token_limit:
      batches.append(current_batch)
      current_batch <- []
      current_tokens <- 0
    
    current_batch.append(doc)
    current_tokens += doc_tokens
  
  results <- parallel_map(batches, process_batch, config.max_concurrency)
  
  RETURN { results: flatten(results), batch_count: count(batches) }
END
```

| Module | Class/Object | Function/Method | Responsibility (S-V-O) | Dependencies | Artifacts/Outputs |
|--------|--------------|-----------------|------------------------|--------------|-------------------|
| `llm/batch.ext` | `BatchOrchestrator` | `process_corpus` | BatchOrchestrator segments documents into token-aware batches | `config.batch_token_limit`, `config.tokenizer` | `BatchResult[]` |

---

## Configuration Schema

**model_config**: `{ model_id, temperature, max_tokens, top_p }` - LLM sampling parameters  
**prompt_templates**: `{ extraction, reasoning, synthesis }` - Template registry paths  
**retry_strategy**: `{ max_attempts, backoff_multiplier, timeout_ms }` - Error handling  
**token_limits**: `{ max_prompt_tokens, batch_token_limit }` - Budget constraints

---

## Quality Metrics

**Parse Success Rate**: Valid outputs / Total responses  
**Schema Compliance**: Conforming entities / Parsed entities  
**Average Confidence**: Mean confidence across extractions  
**Token Efficiency**: Extracted entities / Input tokens