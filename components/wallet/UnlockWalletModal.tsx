"use client";

import { useState, useEffect } from "react";
import { useWalletStore } from "@/store/walletStore";
import { getStoredAddress } from "@/lib/wallet";

export default function UnlockWalletModal() {
  const { unlock, loading, error, clearError } = useWalletStore();
  const [password, setPassword] = useState("");
  const [storedAddr, setStoredAddr] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    getStoredAddress().then(setStoredAddr);
  }, []);

  const handleUnlock = async () => {
    clearError();
    const ok = await unlock(password);
    if (!ok) {
      setAttempts((a) => a + 1);
      setPassword("");
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
        background: "rgba(0,0,0,0.92)", backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div className="glass rounded-2xl w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🔐</div>
          <h2 className="text-xl font-black mb-1" style={{ color: "#FF5A3D" }}>
            Unlock Wallet
          </h2>
          {storedAddr && (
            <p className="text-xs font-mono" style={{ color: "#94A3B8" }}>
              {storedAddr.slice(0, 10)}…{storedAddr.slice(-6)}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            placeholder="Enter your password"
            autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm text-center"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${error ? "#EF4444" : "rgba(255,255,255,0.12)"}`,
              color: "#F8FAFC",
              outline: "none",
              letterSpacing: "0.15em",
            }}
          />

          {error && (
            <p className="text-xs text-center" style={{ color: "#EF4444" }}>
              {error} {attempts > 1 && `(${attempts} attempts)`}
            </p>
          )}

          <button
            onClick={handleUnlock}
            disabled={loading || !password}
            className="w-full py-3 rounded-xl font-bold text-white transition-all hover:scale-105 disabled:opacity-40"
            style={{ background: "#FF5A3D" }}
          >
            {loading ? "Unlocking…" : "Unlock"}
          </button>
        </div>

        <div className="mt-6 pt-4 border-t text-center space-y-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="text-xs" style={{ color: "#94A3B8" }}>
            Forgot password? You&apos;ll need to import your private key backup.
          </p>
          <button
            onClick={async () => {
              const { deleteWallet } = useWalletStore.getState();
              await deleteWallet();
            }}
            className="text-xs hover:underline"
            style={{ color: "#EF4444" }}
          >
            Reset wallet (requires backup)
          </button>
        </div>
      </div>
    </div>
  );
}
