import { buildWebpageMarkdownArtifactDoc } from '@/lib/websites/webpageMarkdownArtifact'

export const testWebpageMarkdownArtifactIncludesLayoutAndMotionFrames = () => {
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

  const out = buildWebpageMarkdownArtifactDoc({ markdown: md, url: 'https://localhost/' })
  if (!out.includes('## 📋 TABLE OF CONTENTS')) throw new Error('missing Table of Contents')
  if (!out.includes('## 🏗️ Page Structure Overview')) throw new Error('missing Page Structure Overview')
  if (!out.includes('NAVIGATION HEADER')) throw new Error('missing NAVIGATION HEADER frame')
  if (!out.includes('HERO SECTION')) throw new Error('missing HERO SECTION frame')
  if (!out.includes('## 🧱 Document Structure')) throw new Error('missing Document Structure')
  if (!out.includes('## 🧭 Navigation Header')) throw new Error('missing Navigation Header section')
  if (!out.includes('### Navigation Menu Structure')) throw new Error('missing Navigation Menu Structure')
  if (!out.includes('## 🦸 Hero Section')) throw new Error('missing Hero Section')
  if (!out.includes('## 📊 Page Statistics')) throw new Error('missing Page Statistics')
  if (!out.includes('## 💰 Pricing')) throw new Error('missing Pricing section')
  if (!out.includes('## 🗂️ Asset Catalog')) throw new Error('missing Asset Catalog')
}
