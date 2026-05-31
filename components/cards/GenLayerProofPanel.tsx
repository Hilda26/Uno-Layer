"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import type { GameState, ChallengeRecord } from "@/types";
import { glResolveChallenge } from "@/lib/genlayer/client";

interface Props {
  gameState: GameState;
  lastTxHash: string | null;
  challenges?: ChallengeRecord[];
}

export default function GenLayerProofPanel({ gameState, lastTxHash, challenges = [] }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const { address } = useWallet();

  const isCreator =
    gameState.players.length > 0 &&
    gameState.players[0]?.walletAddress?.toLowerCase() === address?.toLowerCase();

  const handleResolve = async (challengeId: string) => {
    if (!address || !resolution.trim()) return;
    try {
      // Contract: resolve_challenge(game_id, challenge_id, resolution: str)
      await glResolveChallenge(
        gameState.genlayerGameId,
        challengeId,
        resolution.trim(),
        address
      );
      setResolvingId(null);
      setResolution("");
    } catch (e) {
      console.error("resolve_challenge failed", e);
    }
  };

  return (
    <div className="glass rounded-xl p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full"
      >
        <span className="text-sm font-black" style={{ color: "#22D3EE" }}>
          GenLayer Proof
        </span>
        <span style={{ color: "#94A3B8" }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 text-xs">
          <div className="flex justify-between">
            <span style={{ color: "#94A3B8" }}>Game ID</span>
            <span className="font-mono truncate max-w-[140px]" style={{ color: "#22D3EE" }}>
              {gameState.genlayerGameId}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "#94A3B8" }}>Status</span>
            <span className="capitalize font-semibold" style={{ color: "#22C55E" }}>{gameState.status}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "#94A3B8" }}>Move count</span>
            <span style={{ color: "#F8FAFC" }}>{gameState.moveCount}</span>
          </div>
          {lastTxHash && (
            <div>
              <span style={{ color: "#94A3B8" }}>Last TX</span>
              <div className="font-mono text-xs mt-0.5 break-all" style={{ color: "#22D3EE" }}>
                {lastTxHash}
              </div>
            </div>
          )}

          {/* Hand counts per player */}
          <div className="flex gap-1 flex-wrap pt-1">
            {gameState.players.map((p) => (
              <div key={p.walletAddress} className="px-2 py-1 rounded-lg text-xs"
                style={{ background: "rgba(255,255,255,0.04)", color: "#94A3B8" }}>
                {p.walletAddress.slice(0, 6)}… — {p.handCount} cards
              </div>
            ))}
          </div>

          {/* Pending challenges — creator can resolve with resolution string */}
          {challenges.filter((c) => c.status === "pending").length > 0 && (
            <div className="pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "#EF4444" }}>
                Pending Challenges
              </p>
              {challenges
                .filter((c) => c.status === "pending")
                .map((c) => (
                  <div key={c.id} className="rounded-lg p-2 mb-2"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <div className="font-mono text-xs mb-1" style={{ color: "#EF4444" }}>{c.id}</div>
                    <div style={{ color: "#94A3B8" }}>
                      Move #{c.targetMoveNumber} — {c.reason}
                    </div>
                    {isCreator && (
                      resolvingId === c.id ? (
                        <div className="mt-2 flex gap-1">
                          <input
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value)}
                            placeholder="Resolution note…"
                            className="flex-1 px-2 py-1 rounded text-xs"
                            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#F8FAFC", outline: "none" }}
                          />
                          <button
                            onClick={() => handleResolve(c.id)}
                            disabled={!resolution.trim()}
                            className="px-2 py-1 rounded text-xs font-bold disabled:opacity-40"
                            style={{ background: "#22C55E", color: "#0B0F14" }}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => { setResolvingId(null); setResolution(""); }}
                            className="px-2 py-1 rounded text-xs"
                            style={{ color: "#94A3B8" }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setResolvingId(c.id)}
                          className="mt-1 text-xs px-2 py-0.5 rounded"
                          style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}
                        >
                          Resolve
                        </button>
                      )
                    )}
                  </div>
                ))}
            </div>
          )}

          <div className="pt-2 border-t text-xs" style={{ borderColor: "rgba(255,255,255,0.06)", color: "#94A3B8" }}>
            MVP trust model: GenLayer verifies public moves, action effects, turn order, and winner.
            Private hands stored in Supabase with auditable SHA-256 commitments.
            resolve_challenge requires a non-empty resolution string (contract v0.2.17).
          </div>
        </div>
      )}
    </div>
  );
}
