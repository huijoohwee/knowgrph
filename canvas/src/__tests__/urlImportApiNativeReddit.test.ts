import { convertRedditListingJsonToMarkdown } from '@/features/markdown-workspace/workspaceImport/apiNative'

export function testUrlImportApiNativeRedditConvertsListingJsonToMarkdown() {
  const json = JSON.stringify([
    {
      kind: 'Listing',
      data: {
        children: [
          {
            kind: 't3',
            data: {
              title: 'Hello World',
              selftext: 'This is the post body.',
              url: 'https://example.invalid/link',
              permalink: '/r/test/comments/abc123/hello_world/',
              author: 'alice',
              subreddit_name_prefixed: 'r/test',
              score: 42,
              created_utc: 1700000000,
            },
          },
        ],
      },
    },
    {
      kind: 'Listing',
      data: {
        children: [
          {
            kind: 't1',
            data: {
              body: 'First comment',
              author: 'bob',
              score: 7,
              created_utc: 1700000001,
              replies: {
                kind: 'Listing',
                data: {
                  children: [
                    {
                      kind: 't1',
                      data: {
                        body: 'Reply comment',
                        author: 'carol',
                        score: 3,
                        created_utc: 1700000002,
                        replies: '',
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    },
  ])

  const converted = convertRedditListingJsonToMarkdown({
    jsonText: json,
    sourceUrl: 'https://www.reddit.com/r/test/comments/abc123/hello_world/',
    maxChars: 120_000,
    maxComments: 10,
  })
  if (converted.ok === false) throw new Error(`expected ok, got error: ${converted.error}`)
  if (!converted.markdown.includes('# Hello World')) throw new Error('expected title heading')
  if (!converted.markdown.includes('This is the post body.')) throw new Error('expected post body')
  if (!converted.markdown.includes('## Comments')) throw new Error('expected comments section')
  if (!converted.markdown.includes('- First comment')) throw new Error('expected first comment')
  if (!converted.markdown.includes('  - Reply comment')) throw new Error('expected reply indentation')
}
