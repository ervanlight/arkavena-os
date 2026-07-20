import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import type { Json } from '@/core/db/database.types';
import { InfraError } from '@/core/errors/app-error';
import type { AuditGateway } from './types';

/**
 * The real `AuditGateway` (ARCHITECTURE.md 5.2, channel 2).
 *
 * `core/audit/audit.ts` is written against the `AuditGateway` interface so its
 * rules -- the reason requirement, the diffing -- can be unit tested without a
 * database. This is the other half: the adapter that actually calls
 * `fn_record_audit`, the one and only application write path into
 * `audit_logs` (it has no INSERT policy for anyone, on purpose).
 *
 * Takes the caller's own RLS-bound server client, not a service-role one --
 * `fn_record_audit` is `security definer` and resolves the actor from
 * `auth.uid()` itself, so the ordinary per-request client is the correct one
 * to call it through. A repository never has a reason to reach for
 * `admin.server.ts` just to write an audit entry.
 */
export function createAuditGateway(supabase: ServerSupabase): AuditGateway {
  return {
    async write(entry) {
      const { data, error } = await supabase.rpc('fn_record_audit', {
        p_entity_table: entry.entityTable,
        p_entity_id: entry.entityId,
        p_action: entry.action,
        // Diffs are always JSON-serialisable (they come from diffRows'
        // Record<string, unknown>); Json's recursive union just can't express
        // that statically without this cast.
        p_previous: entry.previousValue as Json,
        p_new: entry.newValue as Json,
        // The RPC's generated Args type treats these as optional (they have SQL
        // defaults) with exactOptionalPropertyTypes on, so an absent key and a
        // key explicitly set to undefined are different things -- the keys must
        // be omitted entirely, not set to undefined.
        ...(entry.reason !== null ? { p_reason: entry.reason } : {}),
        ...(entry.requestId !== null ? { p_request_id: entry.requestId } : {}),
        ...(entry.projectId !== null ? { p_project_id: entry.projectId } : {}),
      });

      if (error !== null) {
        throw new InfraError(`fn_record_audit failed for ${entry.entityTable}/${entry.entityId}: ${error.message}`, {
          meta: { entityTable: entry.entityTable, entityId: entry.entityId, action: entry.action },
        });
      }

      return data as string;
    },
  };
}
