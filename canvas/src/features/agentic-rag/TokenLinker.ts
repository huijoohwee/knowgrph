import { AgenticRagConfig, EntitySpan, Token } from './types'

export class TokenLinker {
  private config: AgenticRagConfig

  constructor(config: AgenticRagConfig) {
    this.config = config
  }

  process(text: string): EntitySpan[] {
    const tokens = this.tokenize(text)
    const candidates = this.identifyCandidates(tokens)
    const entities = this.filterAndScore(candidates)
    return entities
  }

  private tokenize(text: string): Token[] {
    // Simple whitespace tokenization for MVP
    // In a real implementation, this would use a proper tokenizer
    return text.split(/(\s+|[.,;!?])/).map((t, i) => ({
      text: t,
      index: i,
    })).filter(t => t.text.trim().length > 0)
  }

  private identifyCandidates(tokens: Token[]): EntitySpan[] {
    const candidates: EntitySpan[] = []
    let currentSpan: Token[] = []
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      
      // Heuristic: Capitalized words are potential entities
      const isCapitalized = /^[A-Z]/.test(token.text)
      
      if (isCapitalized) {
        currentSpan.push(token)
      } else {
        if (currentSpan.length > 0) {
          this.addCandidate(candidates, currentSpan)
          currentSpan = []
        }
      }
    }
    
    // Flush last
    if (currentSpan.length > 0) {
      this.addCandidate(candidates, currentSpan)
    }

    return candidates
  }

  private addCandidate(candidates: EntitySpan[], tokens: Token[]) {
    if (tokens.length > this.config.max_entity_span_tokens) return
    
    const text = tokens.map(t => t.text).join(' ')
    candidates.push({
      id: `entity-${Math.random().toString(36).substr(2, 9)}`,
      text,
      startIndex: tokens[0].index,
      endIndex: tokens[tokens.length - 1].index,
      type: 'Concept', // Default type
      confidence: 0.8, // Placeholder
      provenance: {
        lineStart: 0, // Needs line mapping logic
        lineEnd: 0,
        sourceText: text
      }
    })
  }

  private filterAndScore(candidates: EntitySpan[]): EntitySpan[] {
    // Apply phrase_boundary_threshold
    return candidates.filter(c => c.confidence >= this.config.phrase_boundary_threshold)
  }
}
