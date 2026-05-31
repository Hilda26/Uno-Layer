"use client";

import Card from "./Card";

interface Props {
  count: number;
  isMyTurn: boolean;
  onDraw: () => void;
  isSubmitting: boolean;
}

const DUMMY = { id: "back", colour: "wild" as const, kind: "number" as const, label: "", value: 0 };

export default function DrawPile({ count, isMyTurn, onDraw, isSubmitting }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-xs font-semibold" style={{ color: "#94A3B8" }}>Draw ({count})</div>
      <button
        onClick={onDraw}
        disabled={!isMyTurn || isSubmitting}
        className="transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Card card={DUMMY} faceDown />
      </button>
    </div>
  );
}
