export const CHAT_TABLE_PERSISTENCE_CONTRACT_PROMPT = [
  'GENERATED TABLE PERSISTENCE CONTRACT (required):',
  '- Persist every generated table or multi-dimensional table in the owning Rich Media Panel `output` property as a YAML block scalar (`output: |-`) containing a GitHub-flavored Markdown pipe table.',
  '- For `response.structuredContent`, use `tables[]` records with neutral `columns` and `rows` data; shared projection serializes that data through the same Markdown pipe-table owner.',
  '- Never author or persist table HTML, `<table>`, `<br>`, `srcDoc`, or table-shaped `outputSrcDoc`; HTML table DOM is renderer-derived at runtime only.',
  '- Table dataflow uses the canonical `output` handle into the Rich Media Panel `output` handle, and the Markdown table remains the persisted source of truth.',
].join('\n')
