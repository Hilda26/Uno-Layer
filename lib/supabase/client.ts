import { createBrowserClient } from "@supabase/ssr";

// IMPORTANT: Must use STATIC process.env.NEXT_PUBLIC_* references here.
// Next.js only substitutes NEXT_PUBLIC_ vars at build time for STATIC access.
// getEnv() / process.env[key] (dynamic) returns undefined in the browser bundle
// because the substitution only works on literal property names.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
