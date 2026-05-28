import { looksLowFidelityWebpageMarkdown, looksSyntheticWebpageArtifactMarkdown } from '@/lib/websites/webpageClientConvert'

export function testWebpageClientConvertQualityGateDetectsSyntheticArtifactMarkers() {
  const synthetic = [
    '# Title',
    '',
    '## 📋 TABLE OF CONTENTS',
    '',
    '### Icons',
    '',
    '## 🗂️ ASSET CATALOG',
    '',
    '**Fidelity Level:** 100% Source-Faithful (No Invented Content)',
    '',
  ].join('\n')
  if (!looksSyntheticWebpageArtifactMarkdown(synthetic)) {
    throw new Error('expected synthetic artifact markdown to be detected')
  }
}

export function testWebpageClientConvertQualityGateDoesNotFlagNormalMarkdown() {
  const normal = [
    '# Pencil',
    '',
    '| [Pencil Logo](/) | [Downloads](/downloads) | [Pricing](/pricing) | [Prompt Gallery](/gallery) | [Docs](/docs) | [Download Pencil](/download) |',
    '| --- | --- | --- | --- | --- | --- |',
    '',
    'Backed by',
    '',
    'Dream on canvas.',
    'Land in code.',
    '',
  ].join('\n')
  if (looksSyntheticWebpageArtifactMarkdown(normal)) {
    throw new Error('expected normal markdown not to be flagged as synthetic')
  }
  if (looksLowFidelityWebpageMarkdown(normal)) {
    throw new Error('expected normal markdown not to be flagged as low fidelity')
  }
}

export function testWebpageClientConvertQualityGateDetectsLoadingShellMarkdown() {
  const shell = [
    '# Shared Chat - Example',
    '',
    '[Get App](https://example.com/app) [Open App](https://example.com/open)',
    '',
    'Loading shared chat...',
    '',
    '[Sign in](https://example.com/sign-in) [Install App](https://example.com/install)',
    '',
  ].join('\n')
  if (!looksLowFidelityWebpageMarkdown(shell)) {
    throw new Error('expected loading-shell markdown to be rejected by the quality gate')
  }
}

export function testWebpageClientConvertQualityGateDetectsHtmlHeavyLoadingChrome() {
  const shortcutChrome = Array.from(
    { length: 18 },
    (_, index) => `<a href="/shortcut-${index + 1}">Open App Shortcut ${index + 1}</a>`,
  ).join('')
  const shell = [
    '<main>',
    '<header><a href="/app">Get App</a><a href="/open">Open App</a><a href="/website">Visit Website</a><a href="/signin">Sign in</a><a href="/install">Install App</a></header>',
    '<section>',
    '<h1>Shared Conversation</h1>',
    '<p>Loading shared chat...</p>',
    `<nav>${shortcutChrome}</nav>`,
    '</section>',
    '</main>',
  ].join('\n')
  if (!looksLowFidelityWebpageMarkdown(shell)) {
    throw new Error('expected html-heavy loading chrome to be rejected by the quality gate')
  }
}
