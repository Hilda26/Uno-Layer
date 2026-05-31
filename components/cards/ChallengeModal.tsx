"use client";

import { useState } from "react";
import type { GameState } from "@/types";

interface Props {
  gameState: GameState;
  myAddress: string;
  onChallenge: (reason: string, moveNumber: number) => void;
  onClose: () => void;
}

const REASONS = [
  "Invalid card played",
  "Wrong active colour",
  "Action effect wrong",
  "Draw penalty incorrect",
  "Wrong turn order",
  "Power Shift dispute",
];

export default function ChallengeModal({ gameState, onChallenge, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const finalReason = reason || custom;
    if (!finalReason.trim()) return;
    setSubmitting(true);
    onChallenge(finalReason, gameState.moveCount);
    setSubmitting(false);
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem", background:"rgba(0,0,0,0.80)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)" }}>
      <div className="glass rounded-2xl p-8 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black" style={{ color: "#EF4444" }}>Challenge Move</h2>
          <button onClick={onClose} style={{ color: "#94A3B8" }}>✕</button>
        </div>

        <p className="text-sm mb-4" style={{ color: "#94A3B8" }}>
          Challenges are recorded on GenLayer. Only challenge if you believe a rule was broken.
        </p>

        <div className="space-y-2 mb-4">
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className="w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all"
              style={{
                background: reason === r ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
                color: reason === r ? "#EF4444" : "#94A3B8",
                border: reason === r ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {r}
            </button>
          ))}
        </div>

        <textarea
          value={custom}
          onChange={(e) => { setCustom(e.target.value); setReason(""); }}
          placeholder="Or describe the issue…"
          rows={2}
          className="w-full px-3 py-2 rounded-xl text-sm mb-4 resize-none"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F8FAFC", outline: "none" }}
        />

        <button
          onClick={handleSubmit}
          disabled={submitting || (!reason && !custom.trim())}
          className="w-full py-3 rounded-xl font-bold text-white transition-all hover:scale-105 disabled:opacity-40"
          style={{ background: "#EF4444" }}
        >
          {submitting ? "Submitting…" : "Submit Challenge"}
        </button>
      </div>
    </div>
  );
}
