import type { TestCaseTuple } from '../runner/testRunnerTypes'

export const TEST_CASES_PRE_PARSER: TestCaseTuple[] = [
  ['canvas.shortcuts.arrangeAndNudge', '../__tests__/arrangeShortcuts.test', 'testArrangeShortcutsParseAndNudge'],
  [
    'flowCollisionSticking: testCorrectlyNestsH2InsideH1AndEnforcesContainmentSeparation',
    '../__tests__/flowCollisionSticking.test',
    'testCorrectlyNestsH2InsideH1AndEnforcesContainmentSeparation',
  ],
  [
    'markdownDocumentPathNormalization: testMarkdownDocumentPathNormalization',
    '../__tests__/markdownDocumentPathNormalization.test',
    'testMarkdownDocumentPathNormalization',
  ],
  [
    'codebasePathCoercion.absoluteUnderRoot.toRel',
    '../__tests__/codebaseRelPathFromAbsolute.test',
    'testCodebaseRelPathCoercionFromAbsoluteUnderRoot',
  ],
]
