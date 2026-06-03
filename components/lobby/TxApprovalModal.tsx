"use client";

import { useState } from "react";
import { glPayEntryFee } from "@/lib/genlayer/client";

interface Props {
  gameId: string;
  roomCode: string;
  playerCount: number;
  onApproved: () => void;
  onCancel: () => void;
}

type Step = "pending" | "signing" | "confirmed" | "error";

export default function TxApprovalModal({ gameId, roomCode, playerCount, onApproved, onCancel }: Props) {
  const [step, setStep] = useState<Step>("pending");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState("");

  const handleApprove = async () => {
    setStep("signing");
    try {
      const result = await glPayEntryFee(gameId) as Record<string, unknown>;

      // Extract tx hash if GenLayer returned one
      const hash =
        (result?.result as string) ??
        (result?.tx_hash as string) ??
        (result?.hash as string) ??
        null;

      setTxHash(hash);
      setStep("confirmed");

      // Brief pause so user sees the confirmation, then proceed
      setTimeout(onApproved, 1200);
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : "Transaction failed");
      setStep("error");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <div className="glass rounded-2xl p-8 w-full max-w-md">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
            style={{ background: "rgba(255,90,61,0.15)", border: "1px solid rgba(255,90,61,0.3)" }}>
            ⛓️
          </div>
          <div>
            <h2 className="text-lg font-black" style={{ color: "#FF5A3D" }}>Approve Transaction</h2>
            <p className="text-xs" style={{ color: "#94A3B8" }}>GenLayer · Chain ID 61999</p>
          </div>
        </div>

        {/* Transaction details */}
        <div className="rounded-xl p-4 mb-5 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: "#94A3B8" }}>Action</span>
            <span className="font-semibold" style={{ color: "#F8FAFC" }}>pay_entry_fee</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: "#94A3B8" }}>Room</span>
            <span className="font-mono font-bold" style={{ color: "#22D3EE" }}>#{roomCode}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: "#94A3B8" }}>Players</span>
            <span style={{ color: "#F8FAFC" }}>{playerCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: "#94A3B8" }}>Game ID</span>
            <span className="font-mono text-xs" style={{ color: "#94A3B8" }}>{gameId.slice(0, 20)}…</span>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "0.75rem" }} className="flex justify-between">
            <span className="font-bold" style={{ color: "#94A3B8" }}>Entry Fee</span>
            <span className="font-black text-base" style={{ color: "#FACC15" }}>0.01 GEN</span>
          </div>
        </div>

        {/* State-specific content */}
        {step === "pending" && (
          <div className="space-y-3">
            <p className="text-xs text-center" style={{ color: "#94A3B8" }}>
              Your embedded wallet will sign and submit this transaction to GenLayer before the game starts.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                style={{ background: "rgba(255,255,255,0.06)", color: "#94A3B8", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-105"
                style={{ background: "#FF5A3D", boxShadow: "0 0 20px rgba(255,90,61,0.3)" }}
              >
                Sign & Approve
              </button>
            </div>
          </div>
        )}

        {step === "signing" && (
          <div className="text-center py-2">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
              style={{ borderColor: "#FF5A3D" }} />
            <p className="text-sm font-semibold" style={{ color: "#F8FAFC" }}>Signing transaction…</p>
            <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>Broadcasting to GenLayer network</p>
          </div>
        )}

        {step === "confirmed" && (
          <div className="text-center py-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl mx-auto mb-3"
              style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
              ✓
            </div>
            <p className="text-sm font-black" style={{ color: "#22C55E" }}>Transaction Approved</p>
            {txHash && (
              <p className="font-mono text-xs mt-1 break-all" style={{ color: "#94A3B8" }}>
                {String(txHash).slice(0, 32)}…
              </p>
            )}
            <p className="text-xs mt-2" style={{ color: "#94A3B8" }}>Starting game…</p>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-3">
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <p className="text-sm font-semibold" style={{ color: "#EF4444" }}>Transaction Failed</p>
              {errMsg && <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>{errMsg}</p>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-2 rounded-xl text-sm font-bold"
                style={{ background: "rgba(255,255,255,0.06)", color: "#94A3B8" }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setStep("pending"); setErrMsg(""); }}
                className="flex-1 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: "#FF5A3D" }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
