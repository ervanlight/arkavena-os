/**
 * Structured logging (ARCHITECTURE.md 5.1 rule 5).
 *
 * JSON on one line per event, so logs can be queried rather than grepped, and
 * so `request_id` links a toast in the browser to a row in audit_logs.
 *
 * Deliberately minimal: no transport, no log service, no dependency. Owner
 * decision D9 puts us on free tiers, where the platform captures stdout. When
 * that stops being enough, the change is confined to this file.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

/**
 * Keys whose values are never written to a log, wherever they appear.
 *
 * A structured logger makes it easy to pass a whole object through, and that is
 * exactly how a token ends up in a log file that outlives the incident.
 */
const REDACTED_KEYS = new Set([
  'password',
  'token',
  'access_token',
  'refresh_token',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'secret',
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = REDACTED_KEYS.has(key) ? '[redacted]' : redact(item, depth + 1);
  }
  return output;
}

function emit(level: LogLevel, event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    ...(redact(fields) as LogFields),
  });

  if (level === 'error') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export const logger = {
  debug: (event: string, fields?: LogFields) => emit('debug', event, fields),
  info: (event: string, fields?: LogFields) => emit('info', event, fields),
  warn: (event: string, fields?: LogFields) => emit('warn', event, fields),
  error: (event: string, fields?: LogFields) => emit('error', event, fields),
};

/** A correlation id for one request, carried through logs and into audit_logs. */
export function newRequestId(): string {
  return crypto.randomUUID();
}
