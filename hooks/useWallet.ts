"use client";

import { useEffect } from "react";
import { useWalletStore } from "@/store/walletStore";

/**
 * Primary wallet hook — replaces wagmi's useAccount().
 *
 * Usage:
 *   const { address, isConnected } = useWallet();
 */
export function useWallet() {
  const store = useWalletStore();

  useEffect(() => {
    // Hydrate from IndexedDB + session on first mount
    if (!store.loading && !store.address && store.hasWallet === false) {
      store.init();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    address: store.address,
    isConnected: store.isUnlocked && !!store.address,
    isUnlocked: store.isUnlocked,
    hasWallet: store.hasWallet,
    mode: store.mode,
    username: store.username,
    loading: store.loading,
    error: store.error,
    // Actions
    createWallet: store.createWallet,
    importWallet: store.importWallet,
    unlock: store.unlock,
    lock: store.lock,
    deleteWallet: store.deleteWallet,
    connectExternal: store.connectExternal,
    setUsername: store.setUsername,
    clearError: store.clearError,
  };
}
