"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface HistoryRow {
  id: string;
  genlayer_game_id: string;
  status: string;
  mode: string;
  winner_wallet: string | null;
  move_count: number;
  created_at: string;
  last_tx_hash: string | null;
  game_players: { wallet_address: string }[];
}

export default function HistoryPage() {
  const [games, setGames] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("games")
      .select("id, genlayer_game_id, status, mode, winner_wallet, move_count, created_at, last_tx_hash, game_players(wallet_address)")
      .in("status", ["completed", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) setGames(data as HistoryRow[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-black mb-2" style={{ color: "#22D3EE" }}>Match History</h1>
      <p className="text-sm mb-8" style={{ color: "#94A3B8" }}>Past games with GenLayer settlement proofs.</p>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#FF5A3D" }} />
        </div>
      ) : games.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center" style={{ color: "#94A3B8" }}>
          No completed games yet.
        </div>
      ) : (
        <div className="space-y-3">
          {games.map((g) => (
            <div key={g.id} className="glass rounded-xl px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-mono text-xs mr-3" style={{ color: "#22D3EE" }}>
                    {g.genlayer_game_id.slice(0, 24)}…
                  </span>
                  <span className="text-xs capitalize px-2 py-0.5 rounded-full"
                    style={{ background: g.status === "completed" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: g.status === "completed" ? "#22C55E" : "#EF4444" }}>
                    {g.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-4 text-xs" style={{ color: "#94A3B8" }}>
                  <span className="capitalize">{g.mode}</span>
                  <span>{g.move_count} moves</span>
                  <span>{new Date(g.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 items-center">
                <div className="flex flex-wrap gap-1">
                  {g.game_players?.map((p) => (
                    <Link key={p.wallet_address} href={`/profile/${p.wallet_address}`}
                      className="font-mono text-xs px-2 py-0.5 rounded-lg hover:underline"
                      style={{
                        background: g.winner_wallet === p.wallet_address ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)",
                        color: g.winner_wallet === p.wallet_address ? "#22C55E" : "#94A3B8",
                        border: g.winner_wallet === p.wallet_address ? "1px solid rgba(34,197,94,0.3)" : "none",
                      }}>
                      {p.wallet_address.slice(0, 8)}… {g.winner_wallet === p.wallet_address ? "🏆" : ""}
                    </Link>
                  ))}
                </div>

                {g.last_tx_hash && (
                  <span className="text-xs font-mono ml-auto" style={{ color: "#22D3EE" }}>
                    TX: {g.last_tx_hash.slice(0, 16)}…
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
