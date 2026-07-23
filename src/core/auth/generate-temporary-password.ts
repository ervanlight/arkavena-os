import { randomBytes } from 'node:crypto';

/**
 * 0/O and 1/l/I removed -- this password is meant to be read aloud or relayed
 * over WhatsApp by whoever provisions the account (ADR 0025 SS1), not typed
 * from a password manager, so visually-ambiguous characters are a real
 * failure mode here.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** A random initial password for a newly-provisioned account (ADR 0025). */
export function generateTemporaryPassword(length = 12): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}
