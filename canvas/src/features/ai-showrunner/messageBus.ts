import type { ICreativeStateStore, IMessageBus, MessageBusMessage, ShowrunnerBriefSpec, ShowrunnerError } from './showrunnerTypes'
import { deriveShowrunnerContentHash, normalizeShowrunnerString } from './showrunnerShared'

const unregisteredRoleError = (role: string): ShowrunnerError => ({
  code: 'UNREGISTERED_ROLE',
  message: `Message target_role is not registered for this Pipeline_Run: ${role}`,
  field: 'target_role',
})

export class ShowrunnerMessageBus implements IMessageBus {
  private readonly inboxByRunRole = new Map<string, MessageBusMessage[]>()
  private readonly registeredRolesByRun = new Map<string, Set<string>>()

  constructor(private readonly creativeStateStore: ICreativeStateStore) {}

  registerBrief(brief: ShowrunnerBriefSpec): void {
    this.registeredRolesByRun.set(
      normalizeShowrunnerString(brief.run_id),
      new Set((brief.agent_roles || []).map(role => normalizeShowrunnerString(role.role)).filter(Boolean)),
    )
  }

  async publish(msg: MessageBusMessage): Promise<{ ok: true } | { ok: false; error: ShowrunnerError }> {
    const runId = normalizeShowrunnerString(msg.run_id)
    const targetRole = normalizeShowrunnerString(msg.target_role)
    const registeredRoles = this.registeredRolesByRun.get(runId)
    if (registeredRoles && !registeredRoles.has(targetRole)) return { ok: false, error: unregisteredRoleError(targetRole) }

    const key = this.inboxKey(runId, targetRole)
    const list = this.inboxByRunRole.get(key) || []
    list.push({ ...msg, run_id: runId, target_role: targetRole, delivered: false })
    this.inboxByRunRole.set(key, list)
    return { ok: true }
  }

  async drainInbox(runId: string, role: string): Promise<MessageBusMessage[]> {
    const normalizedRunId = normalizeShowrunnerString(runId)
    const normalizedRole = normalizeShowrunnerString(role)
    const key = this.inboxKey(normalizedRunId, normalizedRole)
    const pending = this.inboxByRunRole.get(key) || []
    this.inboxByRunRole.delete(key)
    const delivered = pending.map(message => ({ ...message, delivered: true }))
    for (const message of delivered) {
      await this.creativeStateStore.append({
        run_id: normalizedRunId,
        agent_role: normalizedRole,
        turn_index: message.turn_index,
        content_hash: deriveShowrunnerContentHash(JSON.stringify(message)),
        entry_type: 'message',
        content: JSON.stringify(message, null, 2),
        timestamp_iso: message.timestamp_iso,
      })
    }
    return delivered
  }

  async flush(runId: string): Promise<void> {
    const normalizedRunId = normalizeShowrunnerString(runId)
    const keys = Array.from(this.inboxByRunRole.keys()).filter(key => key.startsWith(`${normalizedRunId}:`))
    for (const key of keys) {
      const role = key.slice(normalizedRunId.length + 1)
      await this.drainInbox(normalizedRunId, role)
    }
  }

  private inboxKey(runId: string, role: string): string {
    return `${runId}:${role}`
  }
}
