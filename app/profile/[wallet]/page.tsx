"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapProfile } from "@/lib/utils/mappers";
import { useWallet } from "@/hooks/useWallet";
import Link from "next/link";
import type { Profile } from "@/types";

interface RecentGame {
  id: string;
  genlayer_game_id: string;
  status: string;
  winner_wallet: string | null;
  created_at: string;
}

export default function ProfilePage({ params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = use(params);
  const { address } = useWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const supabase = createClient();

  const isMe = address?.toLowerCase() === wallet.toLowerCase();

  useEffect(() => {
    // Load profile
    supabase
      .from("profiles")
      .select("*")
      .eq("wallet_address", wallet.toLowerCase())
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const mapped = mapProfile(data);
          setProfile(mapped);
          setUsername(mapped.username ?? "");
        }
      });

    // Load recent games via game_players join
    supabase
      .from("game_players")
      .select("game_id, games(id, genlayer_game_id, status, winner_wallet, created_at)")
      .eq("wallet_address", wallet.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) {
          const games = data
            .map((row: { games: RecentGame | RecentGame[] | null }) => {
              const g = Array.isArray(row.games) ? row.games[0] : row.games;
              return g;
            })
            .filter(Boolean) as RecentGame[];
          setRecentGames(games);
        }
      });
  }, [wallet, supabase]);

  // Auto-create profile if doesn't exist (for own wallet)
  useEffect(() => {
    if (!isMe || !address || profile !== null) return;
    supabase
      .from("profiles")
      .upsert({ wallet_address: address.toLowerCase() }, { onConflict: "wallet_address", ignoreDuplicates: true })
      .then(() => {
        supabase
          .from("profiles")
          .select("*")
          .eq("wallet_address", address.toLowerCase())
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              const mapped = mapProfile(data);
              setProfile(mapped);
              setUsername(mapped.username ?? "");
            }
          });
      });
  }, [isMe, address, profile, supabase]);

  const saveUsername = async () => {
    if (!isMe || !address) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ username, updated_at: new Date().toISOString() })
      .eq("wallet_address", wallet.toLowerCase());
    setEditMode(false);
    setSaving(false);
    setProfile((p) => (p ? { ...p, username } : p));
  };

  if (!profile) {
    return (
      <div className="flex justify-center py-20">
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "#FF5A3D" }}
        />
      </div>
    );
  }

  const winRate =
    profile.gamesPlayed > 0
      ? Math.round((profile.wins / profile.gamesPlayed) * 100)
      : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="glass rounded-2xl p-8 mb-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            {editMode ? (
              <div className="flex gap-2 mb-1 flex-wrap">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="px-3 py-1 rounded-lg text-lg font-black"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#F8FAFC",
                    outline: "none",
                  }}
                  maxLength={24}
                />
                <button
                  onClick={saveUsername}
                  disabled={saving}
                  className="px-4 py-1 rounded-lg font-bold text-white text-sm"
                  style={{ background: "#FF5A3D" }}
                >
                  {saving ? "…" : "Save"}
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="text-sm"
                  style={{ color: "#94A3B8" }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-black" style={{ color: "#F8FAFC" }}>
                  {profile.username || "Anonymous"}
                </h1>
                {isMe && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="text-xs px-2 py-0.5 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.08)", color: "#94A3B8" }}
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
            <div className="font-mono text-sm" style={{ color: "#22D3EE" }}>
              {wallet.slice(0, 10)}…{wallet.slice(-6)}
            </div>
          </div>

          <div className="text-right">
            <div
              className="text-3xl font-black"
              style={{ color: profile.fairPlayScore >= 80 ? "#22C55E" : "#FACC15" }}
            >
              {profile.fairPlayScore}
            </div>
            <div className="text-xs" style={{ color: "#94A3B8" }}>
              Fair Play
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          {[
            { label: "Wins", value: profile.wins, color: "#22C55E" },
            { label: "Losses", value: profile.losses, color: "#EF4444" },
            { label: "Win Rate", value: `${winRate}%`, color: "#FACC15" },
            { label: "Games", value: profile.gamesPlayed, color: "#22D3EE" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-4 text-center"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="text-2xl font-black" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="text-xs mt-1" style={{ color: "#94A3B8" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Cards Played", value: profile.cardsPlayed },
            { label: "Action Cards", value: profile.actionCardsPlayed },
            { label: "Challenges Won", value: profile.challengesWon },
            { label: "Challenges Lost", value: profile.challengesLost },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl px-3 py-2 flex justify-between items-center"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span className="text-xs" style={{ color: "#94A3B8" }}>
                {s.label}
              </span>
              <span className="font-bold text-sm" style={{ color: "#F8FAFC" }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent games */}
      {recentGames.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-black mb-4" style={{ color: "#22D3EE" }}>
            Recent Games
          </h2>
          <div className="space-y-2">
            {recentGames.map((g) => {
              const isWinner = g.winner_wallet === wallet.toLowerCase();
              return (
                <Link
                  key={g.id}
                  href={`/game/${g.genlayer_game_id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-xl transition-all hover:bg-white hover:bg-opacity-5"
                >
                  <span className="font-mono text-xs" style={{ color: "#22D3EE" }}>
                    {g.genlayer_game_id.slice(0, 22)}…
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs" style={{ color: "#94A3B8" }}>
                      {new Date(g.created_at).toLocaleDateString()}
                    </span>
                    <span
                      className="text-xs font-bold"
                      style={{ color: isWinner ? "#22C55E" : "#EF4444" }}
                    >
                      {g.status === "completed"
                        ? isWinner
                          ? "Win 🏆"
                          : "Loss"
                        : g.status}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
