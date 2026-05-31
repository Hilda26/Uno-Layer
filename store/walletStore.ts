"use client";

import { create } from "zustand";
import * as W from "@/lib/wallet";

export type WalletMode = "embedded" | "external" | "none";

interface WalletStore {
  // ── state ──────────────────────────────────────────────────────
  address: string | null;
  isUnlocked: boolean;
  hasWallet: boolean;        // wallet exists in IndexedDB
  mode: WalletMode;
  username: string | null;
  loading: boolean;
  error: string | null;

  // ── lifecycle ──────────────────────────────────────────────────
  /** Call once on mount to hydrate from IndexedDB + session. */
  init: () => Promise<void>;

  // ── embedded wallet actions ────────────────────────────────────
  createWallet: (password: string) => Promise<void>;
  importWallet: (privateKey: string, password: string) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  deleteWallet: () => Promise<void>;

  // ── external wallet (MetaMask etc.) ───────────────────────────
  connectExternal: () => Promise<void>;

  // ── misc ───────────────────────────────────────────────────────
  setUsername: (name: string | null) => void;
  clearError: () => void;
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  address: null,
  isUnlocked: false,
  hasWallet: false,
  mode: "none",
  username: null,
  loading: false,
  error: null,

  // ── init ──────────────────────────────────────────────────────
  init: async () => {
    set({ loading: true });
    const exists = await W.hasWallet();
    // If already unlocked in session (e.g. hot-reload) restore address
    const sessionAddr = W.getAddress();
    set({
      hasWallet: exists,
      isUnlocked: W.isUnlocked(),
      address: sessionAddr,
      mode: sessionAddr ? (exists ? "embedded" : "external") : "none",
      loading: false,
    });
  },

  // ── embedded ──────────────────────────────────────────────────
  createWallet: async (password) => {
    set({ loading: true, error: null });
    try {
      const { address } = await W.createWallet(password);
      set({ address, isUnlocked: true, hasWallet: true, mode: "embedded", loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to create wallet", loading: false });
    }
  },

  importWallet: async (privateKey, password) => {
    set({ loading: true, error: null });
    try {
      const { address } = await W.importWallet(privateKey, password);
      set({ address, isUnlocked: true, hasWallet: true, mode: "embedded", loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Invalid private key", loading: false });
    }
  },

  unlock: async (password) => {
    set({ loading: true, error: null });
    const ok = await W.unlockWallet(password);
    if (ok) {
      set({ isUnlocked: true, address: W.getAddress(), mode: "embedded", loading: false });
    } else {
      set({ error: "Wrong password", loading: false });
    }
    return ok;
  },

  lock: () => {
    W.lockWallet();
    set({ isUnlocked: false, address: null });
  },

  deleteWallet: async () => {
    await W.deleteCurrentWallet();
    set({ address: null, isUnlocked: false, hasWallet: false, mode: "none" });
  },

  // ── external ──────────────────────────────────────────────────
  connectExternal: async () => {
    set({ loading: true, error: null });
    const address = await W.connectExternalWallet();
    if (address) {
      set({ address, isUnlocked: true, mode: "external", loading: false });
    } else {
      set({ error: "No wallet detected. Install MetaMask or another injected wallet.", loading: false });
    }
  },

  // ── misc ──────────────────────────────────────────────────────
  setUsername: (name) => set({ username: name }),
  clearError: () => set({ error: null }),
}));
