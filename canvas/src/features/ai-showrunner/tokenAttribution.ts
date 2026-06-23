import { estimateMemoryTokens } from '@/features/memory/aiAgentsMemoryLayerContract.mjs'
import type { CostLogEntry, ITokenAttribution, ShowrunnerSourceFileStore } from './showrunnerTypes'
import { normalizeShowrunnerString, showrunnerCostLogPath } from './showrunnerShared'

export class ShowrunnerTokenAttribution implements ITokenAttribution {
  private readonly entriesByRun = new Map<string, CostLogEntry[]>()
  private readonly budgetByRun = new Map<string, number>()

  constructor(private readonly sourceFileStore: ShowrunnerSourceFileStore) {}

  registerBudget(runId: string, tokenBudget: number): void {
    this.budgetByRun.set(normalizeShowrunnerString(runId), Math.max(0, Math.floor(Number(tokenBudget) || 0)))
  }

  async record(entry: CostLogEntry): Promise<void> {
    const runId = normalizeShowrunnerString(entry.run_id)
    const entries = this.entriesByRun.get(runId) || []
    entries.push({ ...entry, run_id: runId })
    this.entriesByRun.set(runId, entries)
    await this.sourceFileStore.writeSourceFile(
      showrunnerCostLogPath(runId),
      `${entries.map(item => JSON.stringify(item)).join('\n')}\n`,
    )
  }

  async checkBudget(runId: string, estimatedTokens: number): Promise<boolean> {
    const normalizedRunId = normalizeShowrunnerString(runId)
    const budget = this.budgetByRun.get(normalizedRunId) || 0
    if (budget <= 0) return false
    return this.getRunTotal(normalizedRunId) + Math.max(0, Math.floor(Number(estimatedTokens) || 0)) <= budget
  }

  estimate(text: string): number {
    return estimateMemoryTokens(text)
  }

  getRunTotal(runId: string): number {
    return (this.entriesByRun.get(normalizeShowrunnerString(runId)) || [])
      .reduce((total, entry) => total + Math.max(0, Number(entry.input_tokens) || 0) + Math.max(0, Number(entry.output_tokens) || 0), 0)
  }
}
