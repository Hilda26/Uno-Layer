/**
 * Session memory — the decrypted private key lives here while the
 * game is in progress.  It is NEVER written to localStorage, cookies,
 * or any persistent store.  The page unload listener clears it.
 *
 * This module is a plain JS singleton so it works across React renders
 * without triggering re-renders itself.
 */

type HexKey = `0x${string}`;

let _privateKey: HexKey | null = null;
let _address: string | null = null;

export function setSession(privateKey: HexKey, address: string): void {
  _privateKey = privateKey;
  _address = address;
}

export function getSessionKey(): HexKey | null {
  return _privateKey;
}

export function getSessionAddress(): string | null {
  return _address;
}

export function clearSession(): void {
  _privateKey = null;
  _address = null;
}

export function isSessionActive(): boolean {
  return _privateKey !== null;
}

// Wipe on page unload / tab close
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", clearSession);
}
