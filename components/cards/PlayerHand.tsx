"use client";

import Card from "./Card";
import type { UnoLayerCard, CardColour } from "@/types";
import { isPlayable } from "@/lib/cards/deck";
import { useGameStore } from "@/store/gameStore";

interface Props {
  cards: UnoLayerCard[];
  activeColour: CardColour;
  activeDiscard: UnoLayerCard;
  isMyTurn: boolean;
  onPlayCard: (card: UnoLayerCard) => void;
}

export default function PlayerHand({ cards, activeColour, activeDiscard, isMyTurn, onPlayCard }: Props) {
  const { openColourPicker } = useGameStore();

  const handleClick = (card: UnoLayerCard) => {
    if (!isMyTurn) return;
    if (!isPlayable(card, activeColour, activeDiscard)) return;

    if (card.colour === "wild") {
      openColourPicker(card);
    } else {
      onPlayCard(card);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2 justify-center items-end min-h-[7rem] py-2 px-2">
        {cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            playable={isMyTurn && isPlayable(card, activeColour, activeDiscard)}
            selected={false}
            onClick={() => handleClick(card)}
          />
        ))}
        {cards.length === 0 && (
          <div className="text-sm" style={{ color: "#22C55E" }}>No cards — you won! 🎉</div>
        )}
      </div>
    </div>
  );
}
