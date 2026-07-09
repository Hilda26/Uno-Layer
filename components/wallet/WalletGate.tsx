"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useWalletStore } from "@/store/walletStore";
import UnlockWalletModal from "./UnlockWalletModal";

/**
 * Mounted at the layout level.
 * - Initialises wallet state from IndexedDB on first render.
 * - Shows the unlock modal (portaled to document.body) when a wallet
 *   exists but is locked, ensuring it renders above ALL stacking contexts.
 */
export default function WalletGate({ children }: { children: React.ReactNode }) {
  const { init, hasWallet, isUnlocked, loading } = useWalletStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
    void init();
  }, [init]);

  const showUnlock = !loading && hasWallet && !isUnlocked;

  return (
    <>
      {children}
      {showUnlock && mounted && createPortal(<UnlockWalletModal />, document.body)}
    </>
  );
}
