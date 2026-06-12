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
  const [verdicts, setVerdicts] = useState<Record<string, { verdict: string; penaltyPlayer: string; reasoning: string }>>({});
  const { address } = useWallet();

  const handleResolve = async (challengeId: string) => {
    if (!address) return;
    setResolvingId(challengeId);
    try {
      // Contract: resolve_challenge(game_id, challenge_id) — GenLayer
      // consensus (LLM referee) evaluates the challenged move and returns
      // valid_move, invalid_move, or unclear.
      const result = await glResolveChallenge(gameState.genlayerGameId, challengeId, address) as Record<string, unknown>;
      const parsed = typeof result === "string" ? JSON.parse(result) : result;
      setVerdicts((v) => ({
        ...v,
        [challengeId]: {
          verdict: String(parsed?.verdict ?? "unclear"),
          penaltyPlayer: String(parsed?.penalty_player ?? ""),
          reasoning: String(parsed?.reasoning ?? ""),
        },
      }));
    } catch (e) {
      console.error("resolve_challenge failed", e);
    } finally {
      setResolvingId(null);
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
                .map((c) => {
                  const verdict = verdicts[c.id];
                  return (
                    <div key={c.id} className="rounded-lg p-2 mb-2"
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <div className="font-mono text-xs mb-1" style={{ color: "#EF4444" }}>{c.id}</div>
                      <div style={{ color: "#94A3B8" }}>
                        Move #{c.targetMoveNumber} — {c.reason}
                      </div>
                      {verdict ? (
                        <div className="mt-2 rounded p-2 text-xs"
                          style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)" }}>
                          <div className="font-black uppercase" style={{ color: "#22D3EE" }}>
                            GenLayer verdict: {verdict.verdict.replace("_", " ")}
                          </div>
                          {verdict.reasoning && (
                            <div className="mt-1" style={{ color: "#94A3B8" }}>{verdict.reasoning}</div>
                          )}
                          {verdict.penaltyPlayer && (
                            <div className="mt-1" style={{ color: "#FACC15" }}>
                              Penalty (+2 cards): {verdict.penaltyPlayer.slice(0, 6)}…
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleResolve(c.id)}
                          disabled={resolvingId === c.id}
                          className="mt-1 text-xs px-2 py-0.5 rounded disabled:opacity-40"
                          style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}
                        >
                          {resolvingId === c.id ? "Asking GenLayer…" : "Resolve via GenLayer AI"}
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          <div className="pt-2 border-t text-xs" style={{ borderColor: "rgba(255,255,255,0.06)", color: "#94A3B8" }}>
            GenLayer verifies public moves, action effects, turn order, and winner.
            Deck order is derived from a GenLayer consensus seed, and challenges
            are resolved by a GenLayer AI referee. Private hands stored in
            Supabase with auditable SHA-256 commitments.
          </div>
        </div>
      )}
    </div>
  );
}
