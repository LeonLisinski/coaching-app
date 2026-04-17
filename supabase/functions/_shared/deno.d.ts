/**
 * Supabase Edge Functions run on Deno; IDE TypeScript has no Deno globals by default.
 * Runtime provides `Deno`; this file is for editor/typecheck only.
 */
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}
