import type { Tables, TablesInsert } from '@/core/db/database.types';

/** `notifications` is core-level (ARCHITECTURE.md folder layout), not owned by any single domain module -- every module's "this needs attention" can feed it, the same way every module feeds `audit_logs`. */
export type Notification = Tables<'notifications'>;
export type NewNotification = TablesInsert<'notifications'>;
