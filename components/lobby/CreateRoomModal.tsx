"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import type { GameMode } from "@/types";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateRoomModal({ onClose, onCreated }: Props) {
  const { address } = useWallet();
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [mode, setMode] = useState<GameMode>("classic");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // After creation
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteLink = roomCode
    ? `${typeof window !== "undefined" ? window.location.origin : "https://uno-layer.vercel.app"}/lobby?join=${roomCode}`
    : "";

  const handleCreate = async () => {
    if (!address) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address.toLowerCase(), maxPlayers, mode, isPrivate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create room");
      setRoomCode(data.room.room_code);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "rgba(0,0,0,0.80)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
      <div className="glass rounded-2xl p-8 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black" style={{ color: "#FF5A3D" }}>
            {roomCode ? "Room Created!" : "Create Room"}
          </h2>
          <button onClick={onClose} style={{ color: "#94A3B8" }}>✕</button>
        </div>

        {roomCode ? (
          /* ── Success: show invite link ── */
          <div className="space-y-5">
            <div className="rounded-xl p-4 text-center" style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)" }}>
              <p className="text-xs mb-1" style={{ color: "#94A3B8" }}>Room Code</p>
              <p className="font-mono text-3xl font-black" style={{ color: "#22D3EE" }}>#{roomCode}</p>
            </div>

            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: "#94A3B8" }}>Invite Link</p>
              <div className="flex gap-2">
                <div
                  className="flex-1 px-3 py-2 rounded-xl font-mono text-xs truncate"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#F8FAFC" }}
                >
                  {inviteLink}
                </div>
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 rounded-xl font-bold text-sm transition-all hover:scale-105 whitespace-nowrap"
                  style={{ background: copied ? "rgba(34,197,94,0.2)" : "#FF5A3D", color: copied ? "#22C55E" : "white", minWidth: "80px" }}
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>

            <p className="text-xs text-center" style={{ color: "#94A3B8" }}>
              Share this link or the room code with friends to let them join.
            </p>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl font-bold transition-all hover:scale-105"
              style={{ background: "rgba(255,255,255,0.06)", color: "#F8FAFC", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              Go to Lobby
            </button>
          </div>
        ) : (
          /* ── Create form ── */
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "#94A3B8" }}>Max Players</label>
              <div className="flex gap-3">
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => setMaxPlayers(n)}
                    className="flex-1 py-2 rounded-xl font-bold text-sm transition-all"
                    style={{
                      background: maxPlayers === n ? "#FF5A3D" : "rgba(255,255,255,0.06)",
                      color: maxPlayers === n ? "white" : "#94A3B8",
                      border: maxPlayers === n ? "none" : "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    {n} Players
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "#94A3B8" }}>Mode</label>
              <div className="flex gap-3">
                {(["classic", "quick", "private", "ranked"] as GameMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className="flex-1 py-2 rounded-xl font-bold text-sm capitalize transition-all"
                    style={{
                      background: mode === m ? "#22D3EE" : "rgba(255,255,255,0.06)",
                      color: mode === m ? "#0B0F14" : "#94A3B8",
                      border: mode === m ? "none" : "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPrivate(!isPrivate)}
                className="w-12 h-6 rounded-full transition-all relative"
                style={{ background: isPrivate ? "#FF5A3D" : "rgba(255,255,255,0.12)" }}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all shadow"
                  style={{ left: isPrivate ? "calc(100% - 22px)" : "2px" }}
                />
              </button>
              <span className="text-sm" style={{ color: "#94A3B8" }}>Private room (join by code only)</span>
            </div>

            {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}

            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-white transition-all hover:scale-105 disabled:opacity-40"
              style={{ background: "#FF5A3D" }}
            >
              {loading ? "Creating…" : "Create Room"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
