
import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'

// Minimal repro for token line mapping
async function main() {
  console.log('Running repro...')
  const text = '# Title\n\nParagraph\n\n- Item 1'
  const { tokens } = lexMarkdown(text)
  
  console.log('Tokens count:', tokens.length)
  
  let failed = false
  tokens.forEach((t, i) => {
     console.log(`Token ${i} [${t.type}]: startLine=${t.startLine}, endLine=${t.endLine}`)
     if (typeof t.startLine !== 'number' || t.startLine <= 0) {
       console.error(`ERROR: Token ${i} has invalid startLine: ${t.startLine}`)
       failed = true
     }
  })

  if (failed) {
    console.error('FAILED: Some tokens have missing/invalid startLine')
    process.exit(1)
  } else {
    console.log('SUCCESS: All tokens have valid startLine')
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
