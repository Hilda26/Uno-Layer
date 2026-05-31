/**
 * UNO-LAYER Embedded Wallet Cryptography
 *
 * - PBKDF2      → derive 256-bit AES key from password + random salt
 * - AES-256-GCM → encrypt / decrypt private key
 * - SHA-256     → hashing only (NOT encryption)
 *
 * All operations use the browser's native Web Crypto API.
 * We always back Uint8Array with a plain ArrayBuffer (not SharedArrayBuffer)
 * so TypeScript's strict BufferSource checks pass cleanly.
 */

// ── Buffer helpers ────────────────────────────────────────────────────────────

/** Convert a Uint8Array to lowercase hex string. */
export function bufToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Convert a hex string (with or without 0x prefix) to Uint8Array. */
export function hexToBuf(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const pairs = clean.match(/.{1,2}/g) ?? [];
  return new Uint8Array(pairs.map((b) => parseInt(b, 16)));
}

/**
 * Generate cryptographically random bytes.
 * Explicitly backed by ArrayBuffer (not SharedArrayBuffer) so the
 * result is always assignable to Web Crypto's BufferSource.
 */
export function generateBytes(length: number): Uint8Array {
  // Use new ArrayBuffer explicitly — avoids SharedArrayBuffer ambiguity.
  const ab = new ArrayBuffer(length);
  const view = new Uint8Array(ab);
  crypto.getRandomValues(view);
  return view;
}

/** Ensure any Uint8Array is backed by a plain ArrayBuffer copy. */
function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

// ── PBKDF2 key derivation ─────────────────────────────────────────────────────

/**
 * Derive a 256-bit AES-GCM key from a user password + salt.
 * 250 000 PBKDF2-SHA-256 iterations.
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: 250_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ── AES-256-GCM ───────────────────────────────────────────────────────────────

export interface Cipherpack {
  ciphertext: string; // hex-encoded ciphertext + GCM auth tag
  iv: string;         // hex-encoded 12-byte nonce
}

/** Encrypt a plain-text string with an AES-256-GCM CryptoKey. */
export async function aesEncrypt(
  key: CryptoKey,
  plaintext: string
): Promise<Cipherpack> {
  const iv = generateBytes(12); // 96-bit nonce

  const cipherbuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    new TextEncoder().encode(plaintext)
  );

  return {
    ciphertext: bufToHex(new Uint8Array(cipherbuf)),
    iv: bufToHex(iv),
  };
}

/** Decrypt a Cipherpack back to the original plain-text string. */
export async function aesDecrypt(
  key: CryptoKey,
  pack: Cipherpack
): Promise<string> {
  const iv = hexToBuf(pack.iv);
  const ct = hexToBuf(pack.ciphertext);

  const plainbuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ct)
  );

  return new TextDecoder().decode(plainbuf);
}

// ── SHA-256 (hashing only) ────────────────────────────────────────────────────

/** SHA-256 of a string → lowercase hex. Used for verification, NOT encryption. */
export async function sha256(data: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data)
  );
  return bufToHex(new Uint8Array(hash));
}

/**
 * Quick password-verification hash.
 * SHA-256(password + hex(salt) + pepper) — cheap fast-reject before
 * running the full 250 000-iteration PBKDF2.
 */
export async function hashPassword(
  password: string,
  salt: Uint8Array
): Promise<string> {
  return sha256(`${password}${bufToHex(salt)}uno-layer-v1`);
}
