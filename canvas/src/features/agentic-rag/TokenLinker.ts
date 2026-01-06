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
    // Advanced tokenization preserving line info
    const tokens: Token[] = []
    let index = 0
    
    // Split by lines first to track line numbers
    const lines = text.split('\n')
    
    const verbs = new Set(['is', 'are', 'was', 'were', 'has', 'have', 'had', 'releases', 'announces', 'features', 'caused', 'leads', 'wait', 'do', 'does'])
    const dets = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those'])
    const preps = new Set(['in', 'on', 'at', 'by', 'for', 'with', 'to', 'from', 'because'])

    lines.forEach((lineText, lineIdx) => {
      // Split by whitespace and punctuation but keep punctuation
      const matches = lineText.matchAll(/([a-zA-Z0-9]+)|([.,;!?])/g)
      
      for (const match of matches) {
        if (match.index === undefined) continue
        
        const word = match[0]
        const lower = word.toLowerCase()
        let pos = 'NOUN' // Default
        
        if (verbs.has(lower)) pos = 'VERB'
        else if (dets.has(lower)) pos = 'DET'
        else if (preps.has(lower)) pos = 'ADP'
        
        tokens.push({
          text: word,
          index: index++,
          line: lineIdx + 1, // 1-based
          col: match.index,
          pos, 
          dep: 'root'
        })
      }
    })
    
    return tokens
  }

  private identifyCandidates(tokens: Token[]): EntitySpan[] {
    const candidates: EntitySpan[] = []
    let currentSpan: Token[] = []
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      
      // Improved Heuristic
      const isCapitalized = /^[A-Z]/.test(token.text)
      const isNoun = token.pos === 'NOUN'
      const isBoundary = [',', '.', ';', '!', '?'].includes(token.text) || token.pos === 'VERB' || token.pos === 'ADP'
      
      // Start a new span if Capitalized
      // Continue span if Noun (and not too long)
      
      if (isCapitalized) {
        // If we were building a span and hit another capitalized word, 
        // check if they should be merged (e.g. New York) or split (Apple releases).
        // For simplicity: Merge if adjacent.
        // But if previous was not capitalized (e.g. "the iPhone"), we might want to keep it?
        // Let's stick to: Entities are sequences of Nouns/Caps.
        
        if (currentSpan.length > 0 && !this.isCompatible(currentSpan, token)) {
             this.addCandidate(candidates, currentSpan)
             currentSpan = []
        }
        currentSpan.push(token)
      } else if (isNoun && currentSpan.length > 0) {
        // Continue span if it's a noun
        currentSpan.push(token)
      } else {
        // Break span
        if (currentSpan.length > 0) {
          this.addCandidate(candidates, currentSpan)
          currentSpan = []
        }
      }
      
      // Handle punctuation explicitly to clear any lingering span (already handled by else logic mostly)
      if (isBoundary && currentSpan.length > 0) {
          this.addCandidate(candidates, currentSpan)
          currentSpan = []
      }
    }
    
    // Flush last
    if (currentSpan.length > 0) {
      this.addCandidate(candidates, currentSpan)
    }

    return candidates
  }
  
  private isCompatible(span: Token[], next: Token): boolean {
    // Merge if next is Capitalized (e.g. "Steve Jobs")
    if (/^[A-Z]/.test(next.text)) return true
    return false
  }

  private addCandidate(candidates: EntitySpan[], tokens: Token[]) {
    if (tokens.length > this.config.max_entity_span_tokens) return
    if (tokens.length === 0) return

    const text = tokens.map(t => t.text).join(' ')
    
    // Simulate embedding coherence score
    const coherence = 0.85 + (Math.random() * 0.1) 
    
    // Only add if meets threshold
    if (coherence < this.config.phrase_boundary_threshold) return

    candidates.push({
      id: `entity-${Math.random().toString(36).substr(2, 9)}`,
      text,
      startIndex: tokens[0].index,
      endIndex: tokens[tokens.length - 1].index,
      type: 'Concept', // Default type, could be refined
      confidence: coherence,
      provenance: {
        lineStart: tokens[0].line || 0,
        lineEnd: tokens[tokens.length - 1].line || 0,
        sourceText: text
      }
    })
  }

  private filterAndScore(candidates: EntitySpan[]): EntitySpan[] {
    // Apply phrase_boundary_threshold
    return candidates.filter(c => c.confidence >= this.config.phrase_boundary_threshold)
  }
}
