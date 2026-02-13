import { buildWireframeEnhancedMarkdownFromMarkdown } from '@/lib/websites/wireframeEnhanced'

export const testWireframeEnhancedIncludesLayoutAndMotionFrames = () => {
  const md = [
    '# Make videos programmatically',
    '',
    '[Docs](https://example.com/docs)',
    '',
    '[Get started](https://example.com/start)',
    '',
    '## Compose with code',
    '',
    'compose.webm',
    '',
    'Use React to create sophisticated videos with code.',
    '',
    '<div style="animation: spin 1s linear infinite">x</div>',
    '',
    'Uses lottie animations',
    '',
    '## Demo',
    '',
    'Drag and drop the cards to reorder them.',
    'Dark mode toggle',
    'Export the video!',
    '0:00',
    '',
    '## Use Cases',
    '',
    '- Music visualization',
    '- Captions',
    '- Screencast',
    '- Year in review',
    '',
    '[Showcase page](https://example.com/showcase)',
    '',
    '## Pricing',
    '',
    'Free License',
    'Company License',
    'Enterprise License',
    '',
    'Pricing: $100/mo',
    '',
    '## Trusted by',
    '',
    'Book a call',
    'Write an email',
    'Support',
    '',
  ].join('\n')

  const out = buildWireframeEnhancedMarkdownFromMarkdown({ markdown: md, url: 'https://localhost/' })
  if (!out.includes('## 📊 Page Statistics')) throw new Error('missing Page Statistics')
  if (!out.includes('## 📐 Layout Structure')) throw new Error('missing Layout Structure')
  if (!out.includes('GLOBAL NAVIGATION')) throw new Error('missing GLOBAL NAVIGATION block')
  if (!out.includes('HERO SECTION')) throw new Error('missing HERO SECTION block')
  if (!out.includes('INTERACTIVE DEMO')) throw new Error('missing INTERACTIVE DEMO block')
  if (!out.includes('PRICING TIERS')) throw new Error('missing PRICING TIERS block')
  if (!out.includes('Color Scheme & Theme')) throw new Error('missing Color Scheme & Theme')
  if (!out.includes('### Navigation Menu Structure')) throw new Error('missing Navigation Menu Structure')
  if (!out.includes('### Hero Content Breakdown')) throw new Error('missing Hero Content Breakdown')
  if (!out.includes('Feature Section 1')) throw new Error('missing Feature Section')
  if (!out.includes('### Section Statistics')) throw new Error('missing Section Statistics')
  if (!out.includes('## 🎯 Use Cases Section')) throw new Error('missing Use Cases Section')
  if (!out.includes('## 🎮 Interactive Demo Section')) throw new Error('missing Interactive Demo Section')
  if (!out.includes('## 💰 Pricing Section')) throw new Error('missing Pricing Section')
  if (!out.includes('## 🤝 Trust & Support Section')) throw new Error('missing Trust & Support Section')
}
