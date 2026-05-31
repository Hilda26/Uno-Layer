"use client";

import type { GameState } from "@/types";

interface Props {
  gameState: GameState;
  myAddress: string;
}

export default function TurnPanel({ gameState, myAddress }: Props) {
  const isMyTurn = gameState.currentTurnWallet?.toLowerCase() === myAddress?.toLowerCase();
  const shortAddr = (addr: string) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
  const dirArrow = gameState.direction === "clockwise" ? "→" : "←";

  return (
    <div className="glass rounded-xl px-4 py-3 flex flex-wrap gap-4 items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${isMyTurn ? "animate-pulse" : ""}`}
          style={{
            background: isMyTurn ? "rgba(255,90,61,0.2)" : "rgba(255,255,255,0.05)",
            color: isMyTurn ? "#FF5A3D" : "#94A3B8",
            border: isMyTurn ? "1px solid rgba(255,90,61,0.4)" : "1px solid rgba(255,255,255,0.08)",
          }}>
          {isMyTurn ? "Your Turn!" : `${shortAddr(gameState.currentTurnWallet)}'s turn`}
        </div>

        <div className="text-sm" style={{ color: "#94A3B8" }}>
          {dirArrow} <span className="capitalize">{gameState.direction}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs" style={{ color: "#94A3B8" }}>
        <span>Move #{gameState.moveCount}</span>
        <span>·</span>
        <span>{gameState.drawPileRemaining} in deck</span>
        <span>·</span>
        <span className="capitalize">{gameState.mode}</span>
      </div>
    </div>
  );
}
