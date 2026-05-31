"use client";

import { cn } from "@/lib/utils/cn";
import type { UnoLayerCard, CardColour } from "@/types";

const COLOUR_CLASS: Record<CardColour, string> = {
  red: "card-red",
  blue: "card-blue",
  green: "card-green",
  yellow: "card-yellow",
  wild: "card-wild",
};

const SYMBOL: Record<string, string> = {
  flip_direction: "↺",
  block_turn: "⊘",
  pull_two: "+2",
  colour_shift: "★",
  power_shift: "+4",
};

interface Props {
  card: UnoLayerCard;
  playable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  faceDown?: boolean;
}

export default function Card({ card, playable, selected, onClick, small, faceDown }: Props) {
  if (faceDown) {
    return (
      <div
        className={cn(
          "rounded-xl flex items-center justify-center font-black select-none",
          small ? "w-10 h-14" : "w-16 h-24 md:w-20 md:h-28"
        )}
        style={{
          background: "linear-gradient(135deg, #1F2937 0%, #111827 100%)",
          border: "2px solid rgba(255,255,255,0.12)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        }}
      >
        <span className="text-lg" style={{ color: "#FF5A3D" }}>UL</span>
      </div>
    );
  }

  const symbol = card.kind !== "number" ? SYMBOL[card.kind] : undefined;
  const valueLabel = card.kind === "number" ? String(card.value ?? 0) : symbol;
  const colourCls = COLOUR_CLASS[card.colour];

  return (
    <div
      onClick={onClick}
      className={cn(
        colourCls,
        "rounded-xl flex flex-col items-center justify-center font-black text-white select-none transition-all",
        small ? "w-10 h-14 text-sm" : "w-16 h-24 md:w-20 md:h-28 text-xl",
        playable && !selected && "cursor-pointer hover:-translate-y-3 hover:shadow-2xl",
        playable && selected && "-translate-y-4 shadow-2xl",
        !playable && !selected && "opacity-60",
        selected && "ring-2 ring-white"
      )}
      style={{
        boxShadow: selected
          ? "0 0 24px rgba(255,255,255,0.4), 0 8px 24px rgba(0,0,0,0.4)"
          : "0 4px 16px rgba(0,0,0,0.4)",
        cursor: playable ? "pointer" : "default",
      }}
    >
      <div className="text-xs opacity-70 mb-0.5 px-1 text-center leading-tight" style={{ fontSize: small ? "8px" : "10px" }}>
        {card.label}
      </div>
      <div className={small ? "text-base" : "text-2xl"}>{valueLabel}</div>
    </div>
  );
}
