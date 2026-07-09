/**
 * UNO-LAYER Embedded Wallet
 *
 * Public API used by components and hooks.
 * Combines crypto + storage + session into one coherent interface.
 *
 * Key flow:
 *   createWallet(password) → generates secp256k1 private key
 *                          → derives AES key via PBKDF2
 *                          → encrypts with AES-256-GCM
 *                          → stores in IndexedDB
 *                          → loads decrypted key into session memory
 *
 *   unlockWallet(password) → loads encrypted blob from IndexedDB
 *                          → derives AES key via PBKDF2
 *                          → decrypts
 *                          → loads into session memory
 *
 *   getAddress()           → returns public address from session
 *   signMessage(msg)       → signs with session private key using viem
 *   lock()                 → clears session memory
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  deriveKey,
  aesEncrypt,
  aesDecrypt,
  hashPassword,
  generateBytes,
  bufToHex,
  hexToBuf,
} from "./crypto";
import {
  saveWallet,
  loadWallet,
  deleteWallet,
  walletExists,
  type StoredWallet,
} from "./storage";
import {
  setSession,
  getSessionKey,
  getSessionAddress,
  clearSession,
  isSessionActive,
  restoreFromStorage,
} from "./session";

// ─── Create ─────────────────────────────────────────────────────────────────

/**
 * Generate a brand-new secp256k1 wallet, encrypt it, and persist to IndexedDB.
 * The wallet is immediately unlocked into session memory.
 */
export async function createWallet(password: string): Promise<{ address: string }> {
  const privateKey = generatePrivateKey(); // 0x + 64 hex chars
  return _storeAndUnlock(privateKey, password);
}

/**
 * Import an existing private key (hex with or without 0x prefix).
 * Encrypts and persists to IndexedDB. Immediately unlocked into session.
 */
export async function importWallet(
  rawKey: string,
  password: string
): Promise<{ address: string }> {
  const privateKey = (
    rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
  ) as `0x${string}`;
  return _storeAndUnlock(privateKey, password);
}

// ─── Unlock ──────────────────────────────────────────────────────────────────

/**
 * Load encrypted wallet from IndexedDB, derive key from password, decrypt,
 * and store in session memory.
 * Returns false if password is wrong or no wallet exists.
 */
export async function unlockWallet(password: string): Promise<boolean> {
  const stored = await loadWallet();
  if (!stored) return false;

  // Quick hash check before doing full PBKDF2
  const quickHash = await hashPassword(password, hexToBuf(stored.salt));
  if (quickHash !== stored.passwordHash) return false;

  try {
    const salt = hexToBuf(stored.salt);
    const key = await deriveKey(password, salt);
    const privateKey = (await aesDecrypt(key, {
      ciphertext: stored.ciphertext,
      iv: stored.iv,
    })) as `0x${string}`;

    setSession(privateKey, stored.address);
    return true;
  } catch {
    return false;
  }
}

// ─── Lock ────────────────────────────────────────────────────────────────────

export function lockWallet(): void {
  clearSession();
}

// ─── Read ────────────────────────────────────────────────────────────────────

/** Returns the wallet address if unlocked, null otherwise. */
export function getAddress(): string | null {
  return getSessionAddress();
}

/** True when the private key is in session memory (wallet is unlocked). */
export function isUnlocked(): boolean {
  return isSessionActive();
}

/** True if an encrypted wallet exists in IndexedDB. */
export async function hasWallet(): Promise<boolean> {
  return walletExists();
}

/**
 * Restore the in-memory session from sessionStorage (survives page refresh).
 * Call this once on app init before checking isUnlocked().
 */
export function restoreSession(): boolean {
  return restoreFromStorage();
}

/**
 * Return the stored wallet address WITHOUT unlocking (reads IndexedDB only).
 * Useful for showing the address on the lock screen.
 */
export async function getStoredAddress(): Promise<string | null> {
  const stored = await loadWallet();
  return stored?.address ?? null;
}

// ─── Sign ────────────────────────────────────────────────────────────────────

/**
 * Sign an arbitrary message with the in-session private key.
 * Throws if the wallet is locked.
 */
export async function signMessage(message: string): Promise<`0x${string}`> {
  const pk = getSessionKey();
  if (!pk) throw new Error("Wallet is locked. Unlock before signing.");
  const account = privateKeyToAccount(pk);
  return account.signMessage({ message });
}

/**
 * Returns a viem account object for the unlocked key.
 * Use this to build signed GenLayer transactions.
 */
export function getAccount() {
  const pk = getSessionKey();
  if (!pk) return null;
  return privateKeyToAccount(pk);
}

// ─── Export / Delete ─────────────────────────────────────────────────────────

/**
 * Export the raw private key (hex, 0x-prefixed).
 * Only succeeds when wallet is unlocked.
 */
export function exportPrivateKey(): string | null {
  const pk = getSessionKey();
  return pk ?? null;
}

/** Wipe the encrypted wallet from IndexedDB and clear session. */
export async function deleteCurrentWallet(): Promise<void> {
  clearSession();
  await deleteWallet();
}

// ─── External wallet (advanced mode) ─────────────────────────────────────────

/**
 * Connect an injected browser wallet (MetaMask etc.) and return the address.
 * This is the "advanced mode" option — no private key management needed.
 * The address is stored in session as the "address" only (no private key).
 * Signing goes through window.ethereum.
 */
export async function connectExternalWallet(): Promise<string | null> {
  if (typeof window === "undefined" || !window.ethereum) return null;
  try {
    const accounts = (await window.ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];
    const address = accounts[0];
    if (address) {
      // Store address-only session (no private key)
      setSession("0x0000000000000000000000000000000000000000000000000000000000000000", address);
      return address;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Internal helper ─────────────────────────────────────────────────────────

async function _storeAndUnlock(
  privateKey: `0x${string}`,
  password: string
): Promise<{ address: string }> {
  const account = privateKeyToAccount(privateKey);
  const address = account.address;

  const salt = generateBytes(32);
  const key = await deriveKey(password, salt);
  const { ciphertext, iv } = await aesEncrypt(key, privateKey);
  const passwordHash = await hashPassword(password, salt);

  const stored: StoredWallet = {
    address,
    ciphertext,
    iv,
    salt: bufToHex(salt),
    passwordHash,
    createdAt: Date.now(),
  };

  await saveWallet(stored);
  setSession(privateKey, address);
  return { address };
}

// Type augmentation for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, cb: (...args: unknown[]) => void) => void;
    };
  }
}
