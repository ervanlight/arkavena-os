import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import type { Enums, Json } from '@/core/db/database.types';

/**
 * A single event in a project's activity journal, resolved from `audit_logs`.
 *
 * `audit_logs` is the one place every mutation is recorded (ARCHITECTURE.md
 * 5.2, both channels), already carries `project_id` with a dedicated
 * `(project_id, occurred_at desc)` index, and its `audit_logs_select_staff`
 * RLS policy is staff-only -- so reading it here needs no new table, no new
 * policy, and external users (client/supplier, no org_role) are excluded
 * automatically. This turns the trail that already exists into the "what
 * happened on this project" feed the Command Center never surfaced.
 */
export type ProjectActivityRow = {
  id: string;
  occurredAt: string;
  entityTable: string;
  entityId: string | null;
  action: Enums<'audit_action'>;
  reason: string | null;
  source: Enums<'audit_source'>;
  actorName: string | null;
  newValue: Json;
};

/**
 * Lists a project's recent audit events, newest first, with the actor's name
 * resolved. Two queries rather than a PostgREST embed on `actor_user_id`:
 * the FK-embed hint is ambiguous to spell without the exact constraint name,
 * and for a bounded `limit` a second lookup keyed by a small id set is both
 * robust and cheap.
 */
export async function listProjectActivity(
  supabase: ServerSupabase,
  projectId: string,
  limit = 50,
): Promise<ProjectActivityRow[]> {
  const { data: rows, error } = await supabase
    .from('audit_logs')
    .select('id, occurred_at, entity_table, entity_id, action, reason, source, actor_user_id, new_value')
    .eq('project_id', projectId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error !== null) throw error;
  if (rows === null || rows.length === 0) return [];

  const actorIds = [...new Set(rows.map((r) => r.actor_user_id).filter((id): id is string => id !== null))];
  const namesById = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: users, error: usersError } = await supabase.from('users').select('id, full_name').in('id', actorIds);
    if (usersError !== null) throw usersError;
    for (const u of users ?? []) namesById.set(u.id, u.full_name);
  }

  return rows.map((r) => ({
    id: r.id,
    occurredAt: r.occurred_at,
    entityTable: r.entity_table,
    entityId: r.entity_id,
    action: r.action,
    reason: r.reason,
    source: r.source,
    actorName: r.actor_user_id !== null ? (namesById.get(r.actor_user_id) ?? null) : null,
    newValue: r.new_value,
  }));
}
