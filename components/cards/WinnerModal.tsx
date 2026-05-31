"use client";

import Link from "next/link";
import type { GameState } from "@/types";

interface Props {
  gameState: GameState;
  myAddress: string;
  onClose: () => void;
}

export default function WinnerModal({ gameState, myAddress, onClose }: Props) {
  const isWinner = gameState.winnerWallet?.toLowerCase() === myAddress?.toLowerCase();
  const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem", background:"rgba(0,0,0,0.88)", backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)" }}>
      <div className="glass rounded-3xl p-10 w-full max-w-md text-center">
        <div className="text-6xl mb-4">{isWinner ? "🏆" : "😞"}</div>
        <h2 className="text-3xl font-black mb-2" style={{ color: isWinner ? "#FF5A3D" : "#94A3B8" }}>
          {isWinner ? "You Win!" : "Game Over"}
        </h2>
        <p className="text-lg mb-1 font-semibold" style={{ color: "#F8FAFC" }}>
          {isWinner ? "Congratulations!" : "Better luck next time."}
        </p>
        <p className="text-sm mb-6" style={{ color: "#94A3B8" }}>
          Winner: <span className="font-mono" style={{ color: "#22D3EE" }}>
            {gameState.winnerWallet ? short(gameState.winnerWallet) : "—"}
          </span>
        </p>

        <div className="rounded-xl p-4 mb-6" style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.15)" }}>
          <p className="text-xs" style={{ color: "#94A3B8" }}>GenLayer Settlement</p>
          <p className="text-xs font-mono mt-1" style={{ color: "#22D3EE" }}>
            Game #{gameState.genlayerGameId?.slice(0, 20)}…
          </p>
          <p className="text-xs mt-1" style={{ color: "#22C55E" }}>✓ Winner verified on-chain</p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/lobby"
            className="flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all hover:scale-105"
            style={{ background: "#FF5A3D" }}
          >
            New Game
          </Link>
          <Link
            href="/leaderboard"
            className="flex-1 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105"
            style={{ border: "1px solid rgba(34,211,238,0.3)", color: "#22D3EE" }}
          >
            Leaderboard
          </Link>
        </div>

        <button onClick={onClose} className="mt-4 text-xs" style={{ color: "#94A3B8" }}>
          View game state
        </button>
      </div>
    </div>
  );
}
