"use client";

import { useMemo, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { createClient } from "@/lib/supabase/client";
import type { GameState, ChallengeRecord } from "@/types";
import { glResolveChallenge } from "@/lib/genlayer/client";

interface Props {
  gameState: GameState;
  lastTxHash: string | null;
  challenges?: ChallengeRecord[];
}

function short(addr?: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

export default function GenLayerProofPanel({ gameState, lastTxHash, challenges = [] }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [localVerdicts, setLocalVerdicts] = useState<Record<string, { verdict: string; penaltyPlayer: string; reasoning: string }>>({});
  const { address } = useWallet();
  const supabase = useMemo(() => createClient(), []);

  const handleResolve = async (challenge: ChallengeRecord) => {
    if (!address) return;
    setResolvingId(challenge.id);
    try {
      const result = await glResolveChallenge(gameState.genlayerGameId, challenge.id, address) as Record<string, unknown>;
      const parsed = typeof result === "string" ? JSON.parse(result) : result;
      const verdict = String(parsed?.verdict ?? "unclear");
      const penaltyPlayer = String(parsed?.penalty_player ?? "");
      const reasoning = String(parsed?.reasoning ?? "GenLayer consensus returned a challenge verdict.");

      setLocalVerdicts((v) => ({
        ...v,
        [challenge.id]: { verdict, penaltyPlayer, reasoning },
      }));

      await supabase
        .from("challenges")
        .update({
          status: "resolved",
          resolution: reasoning,
          genlayer_verdict: verdict,
          penalty_player: penaltyPlayer || null,
        })
        .eq("id", challenge.id);
    } catch (e) {
      console.error("resolve_challenge failed", e);
    } finally {
      setResolvingId(null);
    }
  };

  const pending = challenges.filter((c) => c.status === "pending");
  const resolved = challenges.filter((c) => c.status !== "pending" || c.genlayerVerdict);

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
        <div className="mt-3 space-y-3 text-xs">
          <div className="flex justify-between gap-3">
            <span style={{ color: "#94A3B8" }}>Game ID</span>
            <span className="font-mono truncate max-w-[160px]" style={{ color: "#22D3EE" }}>
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
          {gameState.deckSeed && (
            <div className="rounded-lg p-2" style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.18)" }}>
              <div className="font-black mb-1" style={{ color: "#22D3EE" }}>Consensus Deck Seed</div>
              <div className="font-mono break-all" style={{ color: "#94A3B8" }}>{gameState.deckSeed}</div>
            </div>
          )}
          {lastTxHash && (
            <div>
              <span style={{ color: "#94A3B8" }}>Last TX</span>
              <div className="font-mono text-xs mt-0.5 break-all" style={{ color: "#22D3EE" }}>
                {lastTxHash}
              </div>
            </div>
          )}

          <div className="flex gap-1 flex-wrap pt-1">
            {gameState.players.map((p) => (
              <div key={p.walletAddress} className="px-2 py-1 rounded-lg text-xs"
                style={{ background: "rgba(255,255,255,0.04)", color: "#94A3B8" }}>
                {short(p.walletAddress)} — {p.handCount} cards
              </div>
            ))}
          </div>

          {pending.length > 0 && (
            <div className="pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "#EF4444" }}>
                Pending Consensus Challenges
              </p>
              {pending.map((c) => {
                const local = localVerdicts[c.id];
                return (
                  <div key={c.id} className="rounded-lg p-2 mb-2"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <div className="font-mono text-xs mb-1" style={{ color: "#EF4444" }}>{c.id}</div>
                    <div style={{ color: "#94A3B8" }}>Move #{c.targetMoveNumber} — {c.reason}</div>
                    {local ? (
                      <div className="mt-2 rounded p-2" style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)" }}>
                        <div className="font-black uppercase" style={{ color: "#22D3EE" }}>
                          GenLayer verdict: {local.verdict.replace(/_/g, " ")}
                        </div>
                        <div className="mt-1" style={{ color: "#94A3B8" }}>{local.reasoning}</div>
                        {local.penaltyPlayer && (
                          <div className="mt-1" style={{ color: "#FACC15" }}>Penalty: {short(local.penaltyPlayer)}</div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleResolve(c)}
                        disabled={resolvingId === c.id}
                        className="mt-2 text-xs px-2 py-1 rounded disabled:opacity-40"
                        style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}
                      >
                        {resolvingId === c.id ? "Asking GenLayer consensus…" : "Resolve via GenLayer Consensus"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {resolved.length > 0 && (
            <div className="pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "#22D3EE" }}>
                Resolved Challenge Verdicts
              </p>
              {resolved.map((c) => (
                <div key={c.id} className="rounded-lg p-2 mb-2"
                  style={{ background: "rgba(34,211,238,0.07)", border: "1px solid rgba(34,211,238,0.18)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ color: "#94A3B8" }}>Move #{c.targetMoveNumber}</span>
                    <span className="uppercase font-black" style={{ color: "#22D3EE" }}>
                      {(c.genlayerVerdict ?? c.resolution ?? "resolved").replace(/_/g, " ")}
                    </span>
                  </div>
                  {c.penaltyPlayer && (
                    <div className="mt-1" style={{ color: "#FACC15" }}>Penalty: {short(c.penaltyPlayer)}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t text-xs" style={{ borderColor: "rgba(255,255,255,0.06)", color: "#94A3B8" }}>
            Deterministic logic validates ordinary moves. GenLayer consensus is used for
            non-deterministic deck seeding, disputed move adjudication, Power Shift outcomes,
            and post-game fair-play scoring. Private hands remain in Supabase with auditable
            SHA-256 commitments.
          </div>
        </div>
      )}
    </div>
  );
}