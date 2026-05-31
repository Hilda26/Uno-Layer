/**
 * Safe environment variable reader.
 *
 * PowerShell's pipeline can prepend a UTF-8 BOM (U+FEFF, decimal 65279)
 * when env vars are set via `$val | vercel env add`. This strips it.
 */
export function getEnv(key: string, fallback = ""): string {
  const raw = process.env[key] ?? fallback;
  // Strip UTF-8 BOM (U+FEFF) and any surrounding whitespace
  return raw.replace(/^﻿/, "").trim();
}
