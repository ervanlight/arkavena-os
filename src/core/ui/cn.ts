/** Joins class names, dropping falsy values -- no dependency added for this alone (CLAUDE.md 12). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
