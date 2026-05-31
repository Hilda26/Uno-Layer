"use client";

import type { CardColour } from "@/types";

interface Props {
  onPick: (colour: CardColour) => void;
  onClose: () => void;
}

const COLOURS: { colour: CardColour; bg: string; label: string }[] = [
  { colour: "red", bg: "#EF4444", label: "Red" },
  { colour: "blue", bg: "#2563EB", label: "Blue" },
  { colour: "green", bg: "#22C55E", label: "Green" },
  { colour: "yellow", bg: "#FACC15", label: "Yellow" },
];

export default function ColourPickerModal({ onPick, onClose }: Props) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem", background:"rgba(0,0,0,0.80)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)" }}>
      <div className="glass rounded-2xl p-8 w-full max-w-sm text-center">
        <h2 className="text-xl font-black mb-2" style={{ color: "#22D3EE" }}>Choose Colour</h2>
        <p className="text-sm mb-6" style={{ color: "#94A3B8" }}>Pick the active colour for your wild card</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {COLOURS.map(({ colour, bg, label }) => (
            <button
              key={colour}
              onClick={() => onPick(colour)}
              className="py-4 rounded-2xl font-black text-white text-lg transition-all hover:scale-105"
              style={{ background: bg, boxShadow: `0 4px 20px ${bg}66` }}
            >
              {label}
            </button>
          ))}
        </div>

        <button onClick={onClose} className="text-sm" style={{ color: "#94A3B8" }}>Cancel</button>
      </div>
    </div>
  );
}
