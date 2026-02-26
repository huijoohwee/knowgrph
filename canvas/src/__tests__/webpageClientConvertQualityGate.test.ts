import { looksSyntheticWebpageArtifactMarkdown } from '@/lib/websites/webpageClientConvert'

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
}

