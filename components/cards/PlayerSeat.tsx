"use client";

import type { PlayerState } from "@/types";
import Card from "./Card";

interface Props {
  player: PlayerState;
  isCurrentTurn: boolean;
  isMe: boolean;
}

const DUMMY_CARD = { id: "back", colour: "wild" as const, kind: "number" as const, label: "", value: 0 };

export default function PlayerSeat({ player, isCurrentTurn, isMe }: Props) {
  const short = `${player.walletAddress.slice(0, 5)}…${player.walletAddress.slice(-3)}`;

  return (
    <div
      className="flex flex-col items-center gap-2 p-3 rounded-2xl transition-all"
      style={{
        background: isCurrentTurn ? "rgba(255,90,61,0.1)" : "rgba(255,255,255,0.03)",
        border: isCurrentTurn ? "2px solid rgba(255,90,61,0.5)" : "1px solid rgba(255,255,255,0.08)",
        boxShadow: isCurrentTurn ? "0 0 20px rgba(255,90,61,0.2)" : "none",
        minWidth: "80px",
      }}
    >
      {/* Hand cards (face-down for others) */}
      <div className="flex gap-0.5">
        {Array.from({ length: Math.min(player.handCount, 7) }).map((_, i) => (
          <div key={i} style={{ marginLeft: i > 0 ? "-20px" : "0" }}>
            <Card card={DUMMY_CARD} faceDown small />
          </div>
        ))}
        {player.handCount > 7 && (
          <span className="text-xs self-center ml-1" style={{ color: "#94A3B8" }}>+{player.handCount - 7}</span>
        )}
      </div>

      <div className="text-xs font-mono text-center" style={{ color: isMe ? "#22D3EE" : "#94A3B8" }}>
        {isMe ? "You" : short}
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs font-bold" style={{ color: "#F8FAFC" }}>{player.handCount}</span>
        <span className="text-xs" style={{ color: "#94A3B8" }}>cards</span>
      </div>

      {player.hasCalledLayer && (
        <div className="text-xs font-black px-2 py-0.5 rounded-full layer-badge"
          style={{ background: "rgba(255,90,61,0.2)", color: "#FF5A3D", border: "1px solid rgba(255,90,61,0.4)" }}>
          LAYER!
        </div>
      )}

      {isCurrentTurn && (
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#FF5A3D" }} />
      )}
    </div>
  );
}
