"use client";

import { useEffect, useState, useCallback, use, useMemo } from "react";
import { useWallet } from "@/hooks/useWallet";
import { createClient } from "@/lib/supabase/client";
import { useGameStore } from "@/store/gameStore";
import { glChallengeMove } from "@/lib/genlayer/client";

import GameTable from "@/components/cards/GameTable";
import PlayerHand from "@/components/cards/PlayerHand";
import TurnPanel from "@/components/cards/TurnPanel";
import ActionPanel from "@/components/cards/ActionPanel";
import MoveHistory from "@/components/cards/MoveHistory";
import ChatPanel from "@/components/cards/ChatPanel";
import ColourPickerModal from "@/components/cards/ColourPickerModal";
import ChallengeModal from "@/components/cards/ChallengeModal";
import WinnerModal from "@/components/cards/WinnerModal";
import GenLayerProofPanel from "@/components/cards/GenLayerProofPanel";

import type { GameState, UnoLayerCard, CardColour, PlayerState } from "@/types";
import { mapChatMessage, mapMoveRecord, mapChallengeRecord } from "@/lib/utils/mappers";

export default function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const { address, isConnected } = useWallet();
  const supabase = useMemo(() => createClient(), []);

  const {
    gameState, setGameState,
    myHand, setMyHand,
    moveHistory, setMoveHistory,
    challenges, setChallenges, addChallenge,
    chatMessages, setChatMessages, addChatMessage,
    showColourPicker, closeColourPicker, pendingCard,
    showChallenge, openChallenge, closeChallenge,
    showWinner, closeWinner,
    lastTxHash,
    isSubmitting, setSubmitting,
    setSelectedCard,
  } = useGameStore();

  const [hasDrawn, setHasDrawn] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const activeGameId = gameState?.gameId;

  const loadGame = useCallback(async () => {
    const res = await fetch(`/api/games/${gameId}`);
    if (!res.ok) return;
    const { game } = await res.json();

    const players: PlayerState[] = (game.game_players ?? []).map((gp: {
      wallet_address: string; seat_index: number; hand_count: number; has_called_layer: boolean;
    }) => ({
      walletAddress: gp.wallet_address,
      seatIndex: gp.seat_index,
      handCount: gp.hand_count,
      isConnected: true,
      hasCalledLayer: gp.has_called_layer,
    }));

    const gs: GameState = {
      gameId: game.id,
      genlayerGameId: game.genlayer_game_id,
      status: game.status,
      mode: game.mode,
      players,
      currentTurnWallet: game.current_turn_wallet ?? "",
      direction: game.direction,
      activeColour: game.active_colour,
      activeDiscard: game.active_discard,
      handCounts: Object.fromEntries(players.map((p) => [p.walletAddress, p.handCount])),
      moveCount: game.move_count,
      drawPileRemaining: game.draw_pile_remaining,
      winnerWallet: game.winner_wallet ?? undefined,
      deckSeed: game.deck_seed ?? undefined,
      deckEntropy: game.deck_entropy ?? undefined,
    };

    setGameState(gs);
    setRoomId(game.room_id);
  }, [gameId, setGameState]);

  const loadHand = useCallback(async () => {
    if (!address) return;
    const res = await fetch(`/api/hands/${gameId}?wallet=${address.toLowerCase()}`);
    if (!res.ok) return;
    const { cards } = await res.json();
    setMyHand(cards ?? []);
  }, [gameId, address, setMyHand]);

  const loadMoves = useCallback(async () => {
    if (!activeGameId) return;
    const { data } = await supabase
      .from("moves")
      .select("*")
      .eq("game_id", activeGameId)
      .order("move_number", { ascending: false })
      .limit(30);
    if (data) setMoveHistory(data.map(mapMoveRecord));
  }, [supabase, activeGameId, setMoveHistory]);


  const loadChallenges = useCallback(async () => {
    if (!activeGameId) return;
    const { data } = await supabase
      .from("challenges")
      .select("*")
      .eq("game_id", activeGameId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setChallenges(data.map(mapChallengeRecord));
  }, [supabase, activeGameId, setChallenges]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadGame();
      void loadHand();
    });
  }, [loadGame, loadHand]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadMoves();
      void loadChallenges();
    });
  }, [loadMoves, loadChallenges]);

  // Realtime game updates
  useEffect(() => {
    const ch = supabase
      .channel(`game-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `genlayer_game_id=eq.${gameId}` }, () => {
        loadGame();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players" }, () => {
        loadGame();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "moves" }, (payload) => {
        const move = payload.new as { player_wallet: string };
        loadMoves();
        if (move.player_wallet !== address?.toLowerCase()) {
          loadHand();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges" }, () => {
        loadChallenges();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [gameId, supabase, address, loadGame, loadHand, loadMoves, loadChallenges]);

  // Realtime chat
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase
      .channel(`chat-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` }, (payload) => {
        addChatMessage(mapChatMessage(payload.new));
      })
      .subscribe();

    // Load initial chat
    supabase.from("chat_messages").select("*").eq("room_id", roomId).order("created_at").limit(50)
      .then(({ data }) => { if (data) setChatMessages(data.map(mapChatMessage)); });

    return () => { supabase.removeChannel(ch); };
  }, [roomId, supabase, addChatMessage, setChatMessages]);

  const playCard = useCallback(async (card: UnoLayerCard, declaredColour?: CardColour) => {
    if (!address || !gameState) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/cards/apply-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, walletAddress: address.toLowerCase(), card, declaredColour }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to play card");
      setSelectedCard(null);
      setHasDrawn(false);
      await loadGame();
      await loadHand();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }, [address, gameState, gameId, setSubmitting, setSelectedCard, loadGame, loadHand]);

  const handleColourPick = useCallback(async (colour: CardColour) => {
    closeColourPicker();
    if (pendingCard) await playCard(pendingCard, colour);
  }, [pendingCard, playCard, closeColourPicker]);

  const handleDraw = useCallback(async () => {
    if (!address || !gameState) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/cards/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, walletAddress: address.toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to draw");
      await loadHand();
      setHasDrawn(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }, [address, gameState, gameId, setSubmitting, loadHand]);

  const handlePass = useCallback(async () => {
    if (!address || !gameState) return;
    setSubmitting(true);
    try {
      await fetch("/api/cards/apply-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, walletAddress: address.toLowerCase(), card: null, pass: true }),
      });
      setHasDrawn(false);
      await loadGame();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }, [address, gameState, gameId, setSubmitting, loadGame]);

  const handleChallenge = useCallback(async (reason: string, moveNumber: number) => {
    if (!address || !gameState) return;
    const result = await glChallengeMove(gameId, moveNumber, reason, address) as Record<string, unknown>;
    const challengeId = String(result?.challenge_id ?? "");
    const { data, error } = await supabase
      .from("challenges")
      .insert({
        game_id: gameState.gameId,
        challenger_wallet: address.toLowerCase(),
        target_move_number: moveNumber,
        reason,
        status: "pending",
        resolution: challengeId ? `GenLayer challenge id: ${challengeId}` : null,
      })
      .select()
      .single();
    if (!error && data) addChallenge(mapChallengeRecord(data));
    closeChallenge();
  }, [address, gameState, gameId, supabase, addChallenge, closeChallenge]);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: "#94A3B8" }}>Please connect your wallet to play.</p>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: "#FF5A3D" }} />
          <p style={{ color: "#94A3B8" }}>Loading game…</p>
        </div>
      </div>
    );
  }

  const isMyTurn = gameState.currentTurnWallet?.toLowerCase() === address?.toLowerCase();

  return (
    <div className="max-w-7xl mx-auto px-3 py-4 space-y-4">
      {/* Turn Panel */}
      <TurnPanel gameState={gameState} myAddress={address ?? ""} />

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-4">
          {/* Game Table */}
          <GameTable
            gameState={gameState}
            myAddress={address ?? ""}
            onDraw={handleDraw}
            isSubmitting={isSubmitting}
          />

          {/* Player Hand */}
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-black" style={{ color: "#22D3EE" }}>
                Your Hand ({myHand.length} cards)
              </span>
              {myHand.length === 1 && (
                <span className="text-xs font-black px-3 py-1 rounded-full layer-badge"
                  style={{ background: "rgba(255,90,61,0.2)", color: "#FF5A3D", border: "1px solid rgba(255,90,61,0.4)" }}>
                  LAYER!
                </span>
              )}
            </div>
            <PlayerHand
              cards={myHand}
              activeColour={gameState.activeColour}
              activeDiscard={gameState.activeDiscard}
              isMyTurn={isMyTurn}
              onPlayCard={(card) => {
                if (card.colour === "wild") {
                  useGameStore.getState().openColourPicker(card);
                } else {
                  playCard(card);
                }
              }}
            />
          </div>

          {/* Action Panel */}
          <ActionPanel
            isMyTurn={isMyTurn}
            isSubmitting={isSubmitting}
            hasDrawn={hasDrawn}
            onDraw={handleDraw}
            onPass={handlePass}
            onChallenge={openChallenge}
          />
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          <MoveHistory moves={moveHistory} />
          {roomId && (
            <ChatPanel
              roomId={roomId}
              walletAddress={address ?? ""}
              messages={chatMessages}
            />
          )}
          <GenLayerProofPanel
            gameState={gameState}
            lastTxHash={lastTxHash}
            challenges={challenges}
          />
        </div>
      </div>

      {/* Modals */}
      {showColourPicker && <ColourPickerModal onPick={handleColourPick} onClose={closeColourPicker} />}
      {showChallenge && (
        <ChallengeModal
          gameState={gameState}
          myAddress={address ?? ""}
          onChallenge={handleChallenge}
          onClose={closeChallenge}
        />
      )}
      {showWinner && <WinnerModal gameState={gameState} myAddress={address ?? ""} onClose={closeWinner} />}
    </div>
  );
}
