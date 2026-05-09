import { KNOWGRPH_VIDEO_DEMO_BASENAME, readDocsSsotFixtureText } from '@/tests/lib/docsSsotFixture'

export async function testKnowgrphVideoDemoFixtureForbidsHardcodedEndpointLiterals() {
  const fixtureText = readDocsSsotFixtureText(KNOWGRPH_VIDEO_DEMO_BASENAME)
  if (!fixtureText.trim()) {
    throw new Error('expected knowgrph-video-demo docs fixture text')
  }
  const forbiddenLiterals = [
    'http://localhost:8000/api/llm/chat/completions',
    'http://localhost:8001/api/llm/chat/completions',
    'https://abcxyz.trycloudflare.com/api/llm/chat/completions',
  ]
  const matched = forbiddenLiterals.filter((literal) => fixtureText.includes(literal))
  if (matched.length > 0) {
    throw new Error(
      `expected docs fixture to avoid hardcoded DeerFlow endpoint URLs; found: ${matched.join(', ')}`,
    )
  }
}
