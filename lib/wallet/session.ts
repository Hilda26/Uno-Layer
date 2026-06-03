/**
 * Session memory — the decrypted private key lives here while the
 * game is in progress.
 *
 * The key is mirrored to sessionStorage so it survives page refreshes.
 * sessionStorage is automatically cleared when the tab/browser closes,
 * so the user never needs to re-enter their password on refresh, but
 * the key is gone when they fully close the tab.
 */

type HexKey = `0x${string}`;

const SS_KEY = "uno_layer_session";

let _privateKey: HexKey | null = null;
let _address: string | null = null;

export function setSession(privateKey: HexKey, address: string): void {
  _privateKey = privateKey;
  _address = address;
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(SS_KEY, JSON.stringify({ privateKey, address }));
  }
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
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(SS_KEY);
  }
}

export function isSessionActive(): boolean {
  return _privateKey !== null;
}

/**
 * Called on app init — restores the in-memory session from sessionStorage
 * if the user refreshed the page. Returns true if a session was restored.
 * External wallet sessions (dummy key 0x000…) are skipped since MetaMask
 * manages its own connection state.
 */
export function restoreFromStorage(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return false;
    const { privateKey, address } = JSON.parse(raw) as { privateKey: string; address: string };
    // Skip external-wallet dummy sessions — MetaMask handles those itself
    if (!privateKey || !address) return false;
    if (privateKey === "0x0000000000000000000000000000000000000000000000000000000000000000") return false;
    _privateKey = privateKey as HexKey;
    _address = address;
    return true;
  } catch {
    return false;
  }
}
