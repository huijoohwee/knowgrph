import type { TestCaseTuple } from '../runner/testRunnerTypes'
import { TEST_CASES_POST_PARSER_0 } from './postParserCases0'
import { TEST_CASES_POST_PARSER_1 } from './postParserCases1'
import { TEST_CASES_POST_PARSER_2 } from './postParserCases2'
import { TEST_CASES_POST_PARSER_3 } from './postParserCases3'
import { TEST_CASES_POST_PARSER_4 } from './postParserCases4'
import { TEST_CASES_POST_PARSER_5 } from './postParserCases5'
import { TEST_CASES_POST_PARSER_6 } from './postParserCases6'

export const ALL_POST_PARSER_CASES: TestCaseTuple[] = [
  ...TEST_CASES_POST_PARSER_0,
  ...TEST_CASES_POST_PARSER_5,
  ...TEST_CASES_POST_PARSER_6,
  ...TEST_CASES_POST_PARSER_1,
  ...TEST_CASES_POST_PARSER_4,
  ...TEST_CASES_POST_PARSER_2,
  ...TEST_CASES_POST_PARSER_3,
]
