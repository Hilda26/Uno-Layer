"use client";

import type { MoveRecord } from "@/types";

interface Props {
  moves: MoveRecord[];
}

const COLOUR_DOT: Record<string, string> = {
  red: "#EF4444",
  blue: "#2563EB",
  green: "#22C55E",
  yellow: "#FACC15",
  wild: "#FF5A3D",
};

export default function MoveHistory({ moves }: Props) {
  return (
    <div className="glass rounded-xl p-4 h-full overflow-hidden flex flex-col">
      <h3 className="text-sm font-black mb-3" style={{ color: "#22D3EE" }}>Move History</h3>
      <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin">
        {moves.length === 0 && (
          <p className="text-xs" style={{ color: "#94A3B8" }}>No moves yet.</p>
        )}
        {moves.map((m) => (
          <div key={m.id} className="flex items-center gap-2 text-xs">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: m.card ? COLOUR_DOT[m.card.colour] : "#94A3B8" }} />
            <span style={{ color: "#94A3B8" }}>#{m.moveNumber}</span>
            <span className="font-mono" style={{ color: "#22D3EE" }}>
              {m.playerWallet.slice(0, 6)}…
            </span>
            <span style={{ color: "#F8FAFC" }}>
              {m.card ? m.card.label : "Drew"}
            </span>
            {m.actionEffect && (
              <span className="px-1 rounded text-xs" style={{ background: "rgba(255,90,61,0.15)", color: "#FF5A3D" }}>
                {m.actionEffect.replace(/_/g, " ")}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
