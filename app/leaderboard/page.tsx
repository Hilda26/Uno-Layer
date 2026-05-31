"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LeaderboardEntry } from "@/types";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => { setEntries(d.leaderboard ?? []); setLoading(false); });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-black mb-2" style={{ color: "#22D3EE" }}>Leaderboard</h1>
      <p className="text-sm mb-8" style={{ color: "#94A3B8" }}>GenLayer-verified win records.</p>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#FF5A3D" }} />
        </div>
      ) : entries.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center" style={{ color: "#94A3B8" }}>
          No games played yet. <Link href="/lobby" className="underline" style={{ color: "#FF5A3D" }}>Start a game!</Link>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["#", "Player", "Wins", "Losses", "Win%", "Cards", "Actions", "Challenges W/L", "Fair Play"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-bold text-xs" style={{ color: "#94A3B8" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.walletAddress} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    className="hover:bg-white hover:bg-opacity-5 transition-colors">
                    <td className="px-4 py-3 font-bold" style={{ color: i === 0 ? "#FACC15" : i === 1 ? "#94A3B8" : i === 2 ? "#CD7F32" : "#6B7280" }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/profile/${e.walletAddress}`} className="hover:underline">
                        <div className="font-semibold" style={{ color: "#F8FAFC" }}>{e.username ?? "—"}</div>
                        <div className="font-mono text-xs" style={{ color: "#94A3B8" }}>
                          {e.walletAddress.slice(0, 8)}…{e.walletAddress.slice(-4)}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-bold" style={{ color: "#22C55E" }}>{e.wins}</td>
                    <td className="px-4 py-3" style={{ color: "#EF4444" }}>{e.losses}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: "#FACC15" }}>{e.winRate}%</td>
                    <td className="px-4 py-3" style={{ color: "#94A3B8" }}>{e.cardsPlayed}</td>
                    <td className="px-4 py-3" style={{ color: "#94A3B8" }}>{e.actionCardsPlayed}</td>
                    <td className="px-4 py-3" style={{ color: "#94A3B8" }}>{e.challengesWon}/{e.challengesLost}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold" style={{ color: e.fairPlayScore >= 80 ? "#22C55E" : e.fairPlayScore >= 60 ? "#FACC15" : "#EF4444" }}>
                        {e.fairPlayScore}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
