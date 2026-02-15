import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { convertWebpageHtmlToMarkdownArtifact } from '@/lib/websites/webpageHtmlToMarkdownArtifact'

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
