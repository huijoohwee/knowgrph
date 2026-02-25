import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { convertWebpageHtmlToMarkdownArtifact, convertWebpageHtmlToMarkdownArtifactAsync } from '@/lib/websites/webpageHtmlToMarkdownArtifact'

export async function testWebpageHtmlToMarkdownArtifactExtractsNavMenusAndTables() {
  const { restore } = initJsdomHarness()
  try {
    const html = [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<meta name="generator" content="WordPress 6.5" />',
      '<title>AIAP Field Guide - AIAP</title>',
      '</head>',
      '<body>',
      '<a class="skip-link" href="#main">Skip to content</a>',
      '<header>',
      '  <a href="/"><img alt="AIAP" src="/logo.png" /></a>',
      '  <nav>',
      '    <ul>',
      '      <li>',
      '        <a href="/programmes">OUR PROGRAMMES</a>',
      '        <ul>',
      '          <li><a href="/apprenticeship/">AI Apprenticeship Programme®</a></li>',
      '          <li><a href="/industry/">AIAP For Industry</a></li>',
      '        </ul>',
      '      </li>',
      '      <li><a href="/about">About AISG</a></li>',
      '    </ul>',
      '  </nav>',
      '  <button aria-label="Toggle Menu"></button>',
      '</header>',
      '<main id="main">',
      '  <h1>The AIAP Field Guide (Version 4.0)</h1>',
      '  <p><em>A 12 months self-directed AI/ML learning journey</em>.</p>',
      '  <h2>Contributors</h2>',
      '  <table>',
      '    <tr><th>Team</th><th>Contributors</th></tr>',
      '    <tr><td>AIAP Team</td><td>Laurence Liew, Kevin Chng</td></tr>',
      '  </table>',
      '</main>',
      '<footer><a href="/privacy">Privacy</a></footer>',
      '</body>',
      '</html>',
    ].join('')

    const md = convertWebpageHtmlToMarkdownArtifact({ html, url: 'https://aiap.sg/aiap-field-guide/' })
    if (!md.includes('# AIAP Field Guide - AIAP')) throw new Error('expected page title')
    if (!md.includes('## 📋 TABLE OF CONTENTS')) throw new Error('expected TOC')
    if (!md.includes('## ♿ ACCESSIBILITY FEATURES')) throw new Error('expected accessibility section')
    if (!md.includes('Skip to content')) throw new Error('expected skip link')
    if (!md.includes('## 🧭 NAVIGATION HEADER')) throw new Error('expected navigation header')
    if (!md.includes('OUR PROGRAMMES')) throw new Error('expected nav label')
    if (!md.includes('AI Apprenticeship Programme®')) throw new Error('expected dropdown item')
    if (!md.includes('https://aiap.sg/logo.png')) throw new Error('expected resolved logo url')
    if (!md.includes('┌') || !md.includes('┐')) throw new Error('expected box-drawing')
    if (!md.includes('| Team | Contributors |')) throw new Error('expected markdown table from HTML table')
    if (!md.includes('## 🗂️ ASSET CATALOG')) throw new Error('expected asset catalog')
  } finally {
    restore()
  }
}

export async function testWebpageHtmlToMarkdownArtifactSupportsMenuDivAndOgImageWithoutNoisyScripts() {
  const { restore } = initJsdomHarness()
  try {
    const html = [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<title>Example Landing</title>',
      '<meta property="og:image" content="/hero.png" />',
      '</head>',
      '<body>',
      '<div id="top-menu" data-menu="yes" aria-label="Navigation menu">',
      '  <img alt="Company" src="/logo.svg" />',
      '  <a href="#about">ABOUT</a>',
      '  <a href="#faq">FAQ</a>',
      '</div>',
      '<div id="content">',
      '  <div id="about">',
      '    <div>What is the programme?</div>',
      '    <div>This programme connects innovators with organisations to pilot solutions.</div>',
      '    <style>#rec123 .t396{height:70px;}</style>',
      '    <script>var injected = true; console.log(injected)</script>',
      '  </div>',
      '</div>',
      '<div id="footer" class="footer"><a href="/privacy">Privacy</a></div>',
      '</body>',
      '</html>',
    ].join('')

    const md = convertWebpageHtmlToMarkdownArtifact({ html, url: 'https://example.com/' })
    if (!md.includes('## 🧭 NAVIGATION HEADER')) throw new Error('expected navigation header')
    if (!md.includes('[ABOUT]') || !md.includes('[FAQ]')) throw new Error('expected menu labels')
    if (!md.includes('**Image URL:** https://example.com/hero.png')) throw new Error('expected OG image as header image')
    if (!md.includes('What is the programme?')) throw new Error('expected div text to be extracted')
    if (md.includes('var injected')) throw new Error('should not include script contents')
    if (md.includes('#rec123')) throw new Error('should not include style contents')
  } finally {
    restore()
  }
}

export async function testWebpageHtmlToMarkdownArtifactAvoidsSyntheticContentDuplicateAndRendersCardGridAsTable() {
  const { restore } = initJsdomHarness()
  try {
    const html = [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<title>Example Pricing</title>',
      '</head>',
      '<body>',
      '<main>',
      '  <div>',
      '    <div>For individuals and companies of up to 3 people</div>',
      '    <div>Free License</div>',
      '    <div>Create and automate</div>',
      '    <div>Commercial use allowed</div>',
      '    <div>Unlimited use</div>',
      '    <div>Must upgrade when your team grows</div>',
      '    <div>No sign up needed - get started</div>',
      '  </div>',
      '  <div>',
      '    <div>For collaborations and companies of 4+ people</div>',
      '    <div>Company License</div>',
      '    <div>Create and automate</div>',
      '    <div>Commercial use allowed</div>',
      '    <div>Pay according to usage</div>',
      '    <div>Prioritized Support</div>',
      '  </div>',
      '</main>',
      '</body>',
      '</html>',
    ].join('')

    const md = convertWebpageHtmlToMarkdownArtifact({ html, url: 'https://example.com/' })
    if (!md.includes('### Content')) throw new Error('expected synthetic Content section')
    if (md.includes('```\n## Content\n```')) throw new Error('should not emit original heading echo for Content')
    if (!md.includes('| Free License | Company License |')) throw new Error('expected pricing cards to render as markdown table')
    if (!md.includes('- Create and automate')) throw new Error('expected pricing cell bullets')
  } finally {
    restore()
  }
}

export async function testWebpageHtmlToMarkdownArtifactRendersLinkListsAndListItemLinks() {
  const { restore } = initJsdomHarness()
  try {
    const html = [
      '<!doctype html>',
      '<html>',
      '<head><title>Links</title></head>',
      '<body>',
      '<main>',
      '  <h1>Example</h1>',
      '  <h2>Companies</h2>',
      '  <div>',
      '    <a href="/openai">OpenAI</a>',
      '    <a href="/airbnb">Airbnb</a>',
      '    <a href="/stripe">Stripe</a>',
      '    <a href="/coinbase">Coinbase</a>',
      '  </div>',
      '  <h2>Stories</h2>',
      '  <ul>',
      '    <li><a href="/s05">During YC</a> Sam was part of YC\'s inaugural batch.</li>',
      '    <li><a href="/w09">During YC</a> Brian, Joe, and Nate did YC.</li>',
      '  </ul>',
      '</main>',
      '</body>',
      '</html>',
    ].join('')

    const md = convertWebpageHtmlToMarkdownArtifact({ html, url: 'https://example.com/' })
    if (!md.includes('- [OpenAI](https://example.com/openai)')) throw new Error('expected links list rendering')
    if (!md.includes('* [During YC](https://example.com/s05) Sam was part of YC\'s inaugural batch.')) {
      throw new Error('expected list item to preserve link markdown')
    }
  } finally {
    restore()
  }
}

export async function testWebpageHtmlToMarkdownArtifactAsyncAvoidsHtmlCodeFenceForSnapshot() {
  const { restore } = initJsdomHarness()
  try {
    const html = [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<title>Test</title>',
      '<meta name="referrer" content="no-referrer" />',
      '<base href="https://example.com/" />',
      '<link rel="canonical" href="/docs" />',
      '</head>',
      '<body>',
      '<main><h1>Hello</h1><p>World</p></main>',
      '<script>console.log("x")</script>',
      '</body>',
      '</html>',
    ].join('')

    const md = await convertWebpageHtmlToMarkdownArtifactAsync({
      html,
      url: 'https://example.com/',
      includeImages: true,
      fidelityLevel: 4,
      includeHtmlSnapshot: true,
    })
    if (!md.includes('## RAW HTML SNAPSHOT (Sanitized, No Scripts)')) throw new Error('expected raw html snapshot section')
    if (md.includes('```html')) throw new Error('expected snapshot to not be an html fenced block')
    if (!md.includes('- meta:')) throw new Error('expected snapshot markdown structure')
    if (!md.includes('name: referrer')) throw new Error('expected snapshot meta to render')
    if (!md.includes('content: no-referrer')) throw new Error('expected snapshot meta content to render')
    if (!md.includes('- link:')) throw new Error('expected snapshot link section')
    if (!md.includes('rel: canonical')) throw new Error('expected snapshot link rel to render')
    if (!md.includes('href: https://example.com/docs')) throw new Error('expected snapshot link href resolved against base')
    if (md.includes('console.log("x")')) throw new Error('expected scripts removed from snapshot')
  } finally {
    restore()
  }
}

export async function testWebpageHtmlToMarkdownArtifactAsyncUsesDataPageEmbeddedMarkdown() {
  const { restore } = initJsdomHarness()
  try {
    const embeddedMd = ['Demo Day', '', '![slide](https://example.com/slide.png)', '', '[Link](https://example.com)', ''].join('\n')
    const json = JSON.stringify({ props: { article: { title: 'Seed Deck', content: embeddedMd } } })
    const dataPageAttr = json.replace(/"/g, '&quot;')
    const html = ['<!doctype html>', '<html>', '<head><title>Ignored</title></head>', '<body>', `<div data-page="${dataPageAttr}"></div>`, '</body>', '</html>'].join('')

    const md = await convertWebpageHtmlToMarkdownArtifactAsync({ html, url: 'https://example.com/' })
    if (!md.includes('Demo Day')) throw new Error('expected embedded markdown content')
    if (!md.includes('![slide](https://example.com/slide.png)')) throw new Error('expected embedded image markdown')
    if (!md.includes('[Link](https://example.com)')) throw new Error('expected embedded link markdown')
    if (md.includes('TABLE OF CONTENTS')) throw new Error('expected ssot markdown, not artifact doc')
    if (md.includes('## HTML Head')) throw new Error('expected no HTML head section in ssot output')
  } finally {
    restore()
  }
}
