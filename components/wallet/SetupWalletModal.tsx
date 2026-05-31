"use client";

import { useState } from "react";
import { useWalletStore } from "@/store/walletStore";

interface Props {
  onClose?: () => void;
}

type Tab = "create" | "import" | "external";

export default function SetupWalletModal({ onClose }: Props) {
  const { createWallet, importWallet, connectExternal, loading, error, clearError } = useWalletStore();
  const [tab, setTab] = useState<Tab>("create");

  // Create tab
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Import tab
  const [importKey, setImportKey] = useState("");
  const [importPw, setImportPw] = useState("");

  const passwordStrength = (pw: string) => {
    if (pw.length === 0) return null;
    if (pw.length < 8) return { label: "Too short", color: "#EF4444" };
    if (pw.length < 12) return { label: "Moderate", color: "#FACC15" };
    return { label: "Strong", color: "#22C55E" };
  };
  const strength = passwordStrength(password);

  const handleCreate = async () => {
    clearError();
    if (password !== confirm) return;
    await createWallet(password);
    onClose?.();
  };

  const handleImport = async () => {
    clearError();
    await importWallet(importKey.trim(), importPw);
    onClose?.();
  };

  const handleExternal = async () => {
    clearError();
    await connectExternal();
    onClose?.();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "create", label: "Create Wallet" },
    { id: "import", label: "Import Key" },
    { id: "external", label: "MetaMask" },
  ];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem", overflowY: "auto",
        background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div className="glass rounded-2xl w-full max-w-md overflow-hidden" style={{ flexShrink: 0 }}>
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <h2 className="text-2xl font-black mb-1" style={{ color: "#FF5A3D" }}>
            Sign In
          </h2>
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            Your key stays in your browser — encrypted, never shared.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-8" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); clearError(); }}
              className="px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px"
              style={{
                borderColor: tab === t.id ? "#FF5A3D" : "transparent",
                color: tab === t.id ? "#FF5A3D" : "#94A3B8",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-8 py-6 space-y-4">
          {/* ── Create ── */}
          {tab === "create" && (
            <>
              <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(34,211,238,0.08)", color: "#22D3EE", border: "1px solid rgba(34,211,238,0.15)" }}>
                A new private key will be generated and encrypted in your browser using AES-256-GCM. Set a strong password — it cannot be recovered.
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#94A3B8" }}>Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 12 characters…"
                    className="w-full px-3 py-2.5 rounded-xl text-sm pr-10"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F8FAFC", outline: "none" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                    style={{ color: "#94A3B8" }}
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
                {strength && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: strength.label === "Too short" ? "30%" : strength.label === "Moderate" ? "60%" : "100%", background: strength.color }} />
                    </div>
                    <span className="text-xs" style={{ color: strength.color }}>{strength.label}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#94A3B8" }}>Confirm Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password…"
                  className="w-full px-3 py-2.5 rounded-xl text-sm"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${confirm && confirm !== password ? "#EF4444" : "rgba(255,255,255,0.12)"}`,
                    color: "#F8FAFC",
                    outline: "none",
                  }}
                />
                {confirm && confirm !== password && (
                  <p className="text-xs mt-1" style={{ color: "#EF4444" }}>Passwords do not match</p>
                )}
              </div>

              {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}

              <button
                onClick={handleCreate}
                disabled={loading || !password || password !== confirm || password.length < 8}
                className="w-full py-3 rounded-xl font-bold text-white transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "#FF5A3D" }}
              >
                {loading ? "Creating…" : "Create Wallet"}
              </button>
            </>
          )}

          {/* ── Import ── */}
          {tab === "import" && (
            <>
              <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(250,204,21,0.08)", color: "#FACC15", border: "1px solid rgba(250,204,21,0.15)" }}>
                ⚠️ Only import keys you own. Never enter a seed phrase here — only a raw private key (64 hex chars).
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#94A3B8" }}>Private Key (hex)</label>
                <textarea
                  value={importKey}
                  onChange={(e) => setImportKey(e.target.value)}
                  placeholder="0x... or 64 hex characters"
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-mono resize-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F8FAFC", outline: "none" }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#94A3B8" }}>Encryption Password</label>
                <input
                  type="password"
                  value={importPw}
                  onChange={(e) => setImportPw(e.target.value)}
                  placeholder="Password to encrypt your key locally"
                  className="w-full px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F8FAFC", outline: "none" }}
                />
              </div>

              {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}

              <button
                onClick={handleImport}
                disabled={loading || !importKey.trim() || importPw.length < 8}
                className="w-full py-3 rounded-xl font-bold text-white transition-all hover:scale-105 disabled:opacity-40"
                style={{ background: "#FF5A3D" }}
              >
                {loading ? "Importing…" : "Import & Encrypt"}
              </button>
            </>
          )}

          {/* ── External ── */}
          {tab === "external" && (
            <>
              <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(255,255,255,0.04)", color: "#94A3B8", border: "1px solid rgba(255,255,255,0.08)" }}>
                Advanced mode: use MetaMask or another injected wallet. Your private key never enters this app.
              </div>

              {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}

              <button
                onClick={handleExternal}
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-sm transition-all hover:scale-105 disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.06)", color: "#F8FAFC", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                {loading ? "Connecting…" : "🦊  Connect MetaMask"}
              </button>

              <p className="text-xs text-center" style={{ color: "#94A3B8" }}>
                Requires an Ethereum-compatible browser extension.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
