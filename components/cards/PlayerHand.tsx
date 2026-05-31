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
  const { selectedCard, setSelectedCard, openColourPicker } = useGameStore();

  const handleClick = (card: UnoLayerCard) => {
    if (!isMyTurn) return;
    if (!isPlayable(card, activeColour, activeDiscard)) return;

    if (selectedCard?.id === card.id) {
      // Double-click to play (or wild opens colour picker)
      if (card.colour === "wild") {
        openColourPicker(card);
      } else {
        onPlayCard(card);
        setSelectedCard(null);
      }
    } else {
      setSelectedCard(card);
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
            selected={selectedCard?.id === card.id}
            onClick={() => handleClick(card)}
          />
        ))}
        {cards.length === 0 && (
          <div className="text-sm" style={{ color: "#22C55E" }}>No cards — you won! 🎉</div>
        )}
      </div>
      {selectedCard && isMyTurn && (
        <div className="text-center text-xs mt-1" style={{ color: "#94A3B8" }}>
          Click again to play · {selectedCard.colour === "wild" ? "Choose colour" : ""}
        </div>
      )}
    </div>
  );
}
