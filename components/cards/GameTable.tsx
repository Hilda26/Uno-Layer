"use client";

import type { GameState, UnoLayerCard, CardColour } from "@/types";
import PlayerSeat from "./PlayerSeat";
import DiscardPile from "./DiscardPile";
import DrawPile from "./DrawPile";

interface Props {
  gameState: GameState;
  myAddress: string;
  onDraw: () => void;
  isSubmitting: boolean;
}

export default function GameTable({ gameState, myAddress, onDraw, isSubmitting }: Props) {
  const { players, currentTurnWallet, activeColour, activeDiscard, drawPileRemaining } = gameState;
  const myPlayer = players.find((p) => p.walletAddress.toLowerCase() === myAddress?.toLowerCase());
  const others = players.filter((p) => p.walletAddress.toLowerCase() !== myAddress?.toLowerCase());

  return (
    <div
      className="relative rounded-3xl overflow-hidden"
      style={{
        background: "radial-gradient(ellipse 100% 80% at 50% 50%, rgba(255,90,61,0.06) 0%, rgba(17,24,39,0.95) 60%)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "inset 0 0 80px rgba(0,0,0,0.5), 0 0 40px rgba(0,0,0,0.4)",
        minHeight: "320px",
        padding: "2rem",
      }}
    >
      {/* Other players at top */}
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        {others.map((p) => (
          <PlayerSeat
            key={p.walletAddress}
            player={p}
            isCurrentTurn={currentTurnWallet?.toLowerCase() === p.walletAddress.toLowerCase()}
            isMe={false}
          />
        ))}
      </div>

      {/* Centre: Discard + Draw */}
      <div className="flex items-center justify-center gap-8 mb-8">
        <DiscardPile topCard={activeDiscard} activeColour={activeColour} />

        <div className="text-3xl font-black" style={{ color: "rgba(255,255,255,0.08)" }}>VS</div>

        <DrawPile
          count={drawPileRemaining}
          isMyTurn={currentTurnWallet?.toLowerCase() === myAddress?.toLowerCase()}
          onDraw={onDraw}
          isSubmitting={isSubmitting}
        />
      </div>

      {/* My seat */}
      {myPlayer && (
        <div className="flex justify-center">
          <PlayerSeat
            player={myPlayer}
            isCurrentTurn={currentTurnWallet?.toLowerCase() === myAddress?.toLowerCase()}
            isMe
          />
        </div>
      )}
    </div>
  );
}
