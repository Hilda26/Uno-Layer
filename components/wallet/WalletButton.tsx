"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useWallet } from "@/hooks/useWallet";
import SetupWalletModal from "./SetupWalletModal";
import { exportPrivateKey } from "@/lib/wallet";

/**
 * WalletButton — lives inside the Navbar.
 *
 * IMPORTANT: Any modal rendered here must use createPortal(…, document.body).
 * The Navbar has `backdrop-filter` (glass class) which creates a CSS stacking
 * context that traps position:fixed children inside it. Portaling to document.body
 * bypasses this and makes the modal render over the full viewport.
 */
export default function WalletButton() {
  const { address, isConnected, hasWallet, isUnlocked, mode, loading, lock } = useWallet();

  const [showSetup,    setShowSetup]    = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showExport,   setShowExport]   = useState(false);
  const [exportKey,    setExportKey]    = useState<string | null>(null);
  const [copied,       setCopied]       = useState(false);
  // Track mount so createPortal isn't called on the server
  const [mounted,      setMounted]      = useState(false);

  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleExport = () => {
    const key = exportPrivateKey();
    setExportKey(key);
    setShowExport(true);
    setShowDropdown(false);
  };

  // ── Overlay style (portaled to document.body) ────────────────────────────
  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 9999,
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "1rem",
    background: "rgba(0,0,0,0.88)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="h-9 w-28 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />;
  }

  // ── No wallet yet ────────────────────────────────────────────────────────
  if (!hasWallet && !isConnected) {
    return (
      <>
        <button
          onClick={() => setShowSetup(true)}
          className="px-4 py-2 rounded-xl font-bold text-white text-sm transition-all hover:scale-105"
          style={{ background: "#FF5A3D", boxShadow: "0 0 16px rgba(255,90,61,0.3)" }}
        >
          Sign In
        </button>

        {/* Portal → renders at document.body, above all stacking contexts */}
        {showSetup && mounted && createPortal(
          <SetupWalletModal onClose={() => setShowSetup(false)} />,
          document.body
        )}
      </>
    );
  }

  // ── Wallet locked ────────────────────────────────────────────────────────
  if (hasWallet && !isUnlocked) {
    return (
      <button
        onClick={() => setShowSetup(true)}
        className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        style={{ background: "rgba(255,255,255,0.06)", color: "#94A3B8", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        🔒 Locked
      </button>
    );
  }

  // ── Connected & unlocked ─────────────────────────────────────────────────
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  return (
    <>
      <div className="relative" ref={dropRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{ background: "rgba(255,90,61,0.12)", color: "#FF5A3D", border: "1px solid rgba(255,90,61,0.3)" }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: "#22C55E" }} />
          <span className="font-mono">{short}</span>
          {mode === "external" && <span className="text-xs">🦊</span>}
          <span style={{ color: "#94A3B8" }}>▾</span>
        </button>

        {showDropdown && (
          <div
            className="absolute right-0 top-12 rounded-xl overflow-hidden min-w-[200px]"
            style={{ zIndex: 200, background: "#111827", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}
          >
            <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <p className="text-xs" style={{ color: "#94A3B8" }}>Connected as</p>
              <p className="font-mono text-xs mt-0.5 break-all" style={{ color: "#22D3EE" }}>
                {address?.slice(0, 12)}…{address?.slice(-6)}
              </p>
            </div>
            <div className="py-1">
              <button onClick={copyAddress} className="w-full text-left px-4 py-2.5 text-sm hover:bg-white hover:bg-opacity-5 transition-colors" style={{ color: "#F8FAFC" }}>
                {copied ? "✓ Copied!" : "Copy Address"}
              </button>
              {mode === "embedded" && (
                <button onClick={handleExport} className="w-full text-left px-4 py-2.5 text-sm hover:bg-white hover:bg-opacity-5 transition-colors" style={{ color: "#FACC15" }}>
                  Export Private Key
                </button>
              )}
              <button
                onClick={() => { lock(); setShowDropdown(false); }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-white hover:bg-opacity-5 transition-colors"
                style={{ color: "#94A3B8" }}
              >
                Lock Wallet
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Export private key — portaled to body */}
      {showExport && exportKey && mounted && createPortal(
        <div style={overlayStyle}>
          <div className="glass rounded-2xl p-8 w-full max-w-sm">
            <h3 className="text-lg font-black mb-3" style={{ color: "#FACC15" }}>⚠️ Private Key</h3>
            <p className="text-xs mb-4" style={{ color: "#94A3B8" }}>
              Store this somewhere safe. Anyone with this key controls your wallet.
            </p>
            <div className="rounded-xl p-3 mb-4 font-mono text-xs break-all"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F8FAFC" }}>
              {exportKey}
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => { await navigator.clipboard.writeText(exportKey); }}
                className="flex-1 py-2 rounded-xl text-sm font-bold"
                style={{ background: "rgba(250,204,21,0.15)", color: "#FACC15", border: "1px solid rgba(250,204,21,0.3)" }}
              >
                Copy
              </button>
              <button
                onClick={() => { setShowExport(false); setExportKey(null); }}
                className="flex-1 py-2 rounded-xl text-sm font-bold"
                style={{ background: "rgba(255,255,255,0.06)", color: "#94A3B8" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
