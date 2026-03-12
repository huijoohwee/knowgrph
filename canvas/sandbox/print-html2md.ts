import { convertHtmlToMarkdownUnified } from '../src/lib/markdown/htmlToMarkdownUnified'

const s = '通过 ChatGPT 免费套餐和 Go 套餐免费试用 Codex；其他所有套餐的用户可限时享受双倍速率额度。'

const run = async () => {
  const res = await convertHtmlToMarkdownUnified({ html: `<p>${s}</p>` })
  console.log(JSON.stringify(res, null, 2))
}

run().catch(e => {
  console.error(e)
  process.exitCode = 1
})

