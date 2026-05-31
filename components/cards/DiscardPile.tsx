"use client";

import Card from "./Card";
import type { UnoLayerCard, CardColour } from "@/types";

interface Props {
  topCard: UnoLayerCard;
  activeColour: CardColour;
}

const COLOUR_SWATCH: Record<CardColour, string> = {
  red: "#EF4444",
  blue: "#2563EB",
  green: "#22C55E",
  yellow: "#FACC15",
  wild: "#FF5A3D",
};

export default function DiscardPile({ topCard, activeColour }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-xs font-semibold" style={{ color: "#94A3B8" }}>Discard</div>
      <div className="relative">
        <Card card={topCard} />
        {/* Active colour indicator ring */}
        <div
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-2 rounded-full"
          style={{ background: COLOUR_SWATCH[activeColour], boxShadow: `0 0 12px ${COLOUR_SWATCH[activeColour]}` }}
        />
      </div>
      <div className="text-xs mt-2 px-2 py-0.5 rounded-full font-semibold capitalize"
        style={{ background: `${COLOUR_SWATCH[activeColour]}22`, color: COLOUR_SWATCH[activeColour], border: `1px solid ${COLOUR_SWATCH[activeColour]}44` }}>
        {activeColour}
      </div>
    </div>
  );
}
