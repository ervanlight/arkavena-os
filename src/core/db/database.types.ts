/**
 * PLACEHOLDER. GENERATED file, never edit by hand -- CLAUDE.md law 4.
 *
 * The real version comes from `pnpm db:types`, which requires the CLI to be
 * linked to the Supabase Cloud dev project (`pnpm db:link`) and needs
 * SUPABASE_DB_URL / dashboard credentials that are not yet available in this
 * environment (see ADR 0006). This stands in only so that `core/db/client.*`
 * has a `Database` type to compile against in the meantime.
 *
 * It intentionally asserts no table shapes -- an empty schema, not guessed
 * columns -- because a hand-written guess here would be exactly the type
 * duplication ARCHITECTURE.md 3 exists to prevent. It will be overwritten
 * wholesale the moment `pnpm db:types` runs against the linked project.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
