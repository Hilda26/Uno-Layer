/**
 * IndexedDB storage for the encrypted UNO-LAYER wallet.
 *
 * Schema:
 *   DB:    "uno-layer-wallet"   version 1
 *   Store: "wallet"
 *   Key:   "v1"
 *   Value: StoredWallet
 */

const DB_NAME = "uno-layer-wallet";
const DB_VERSION = 1;
const STORE = "wallet";
const RECORD_KEY = "v1";

export interface StoredWallet {
  address: string;         // checksummed 0x… address (public)
  ciphertext: string;      // AES-256-GCM encrypted private key (hex)
  iv: string;              // GCM nonce (hex)
  salt: string;            // PBKDF2 salt (hex)
  passwordHash: string;    // SHA-256 hash for fast validation
  createdAt: number;       // epoch ms
}

// ─── open / init ────────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function saveWallet(wallet: StoredWallet): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.put(wallet, RECORD_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function loadWallet(): Promise<StoredWallet | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.get(RECORD_KEY);
      req.onsuccess = () => resolve((req.result as StoredWallet) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteWallet(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.delete(RECORD_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function walletExists(): Promise<boolean> {
  const w = await loadWallet();
  return w !== null;
}
