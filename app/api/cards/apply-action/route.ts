import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeHandCommitment, generateSecret } from "@/lib/crypto/commitment";
import { glSubmitCard, glEndGame } from "@/lib/genlayer/client";
import { isPlayable } from "@/lib/cards/deck";
import type { UnoLayerCard, CardColour, Direction } from "@/types";

function nextPlayerIndex(
  currentIndex: number,
  playerCount: number,
  direction: Direction
): number {
  if (direction === "clockwise") {
    return (currentIndex + 1) % playerCount;
  }
  return (currentIndex - 1 + playerCount) % playerCount;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      gameId: string;
      walletAddress: string;
      card: UnoLayerCard | null;
      declaredColour?: CardColour;
      pass?: boolean;
    };
    const { gameId, walletAddress, card, declaredColour, pass } = body;

    if (!gameId || !walletAddress) {
      return NextResponse.json({ error: "gameId and walletAddress required" }, { status: 400 });
    }

    // Handle pass turn (after draw)
    if (pass || card === null) {
      const supabase = createAdminClient();
      const { data: game } = await supabase.from("games").select("*").eq("genlayer_game_id", gameId).single();
      if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
      if (game.current_turn_wallet !== walletAddress.toLowerCase()) {
        return NextResponse.json({ error: "Not your turn" }, { status: 403 });
      }
      const { data: gps } = await supabase.from("game_players").select("wallet_address, seat_index").eq("game_id", game.id).order("seat_index");
      const players = (gps ?? []) as { wallet_address: string; seat_index: number }[];
      const idx = players.findIndex((p) => p.wallet_address === walletAddress.toLowerCase());
      const step = game.direction === "clockwise" ? 1 : -1;
      const nextIdx = ((idx + step) % players.length + players.length) % players.length;
      await supabase.from("games").update({ current_turn_wallet: players[nextIdx].wallet_address }).eq("id", game.id);
      return NextResponse.json({ passed: true, nextTurnWallet: players[nextIdx].wallet_address });
    }

    if (!card) {
      return NextResponse.json({ error: "card required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get game
    const { data: game, error: gameErr } = await supabase
      .from("games")
      .select("*")
      .eq("genlayer_game_id", gameId)
      .single();

    if (gameErr || !game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
    if (game.status !== "active") return NextResponse.json({ error: "Game not active" }, { status: 400 });
    if (game.current_turn_wallet !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: "Not your turn" }, { status: 403 });
    }

    const activeDiscard = game.active_discard as UnoLayerCard;
    const activeColour = game.active_colour as CardColour;

    // Validate card is playable
    if (!isPlayable(card, activeColour, activeDiscard)) {
      return NextResponse.json({ error: "Card is not playable" }, { status: 400 });
    }

    // Get player's hand
    const { data: handRow } = await supabase
      .from("player_hands")
      .select("*")
      .eq("game_id", game.id)
      .eq("wallet_address", walletAddress.toLowerCase())
      .single();

    if (!handRow) return NextResponse.json({ error: "Hand not found" }, { status: 404 });

    const currentCards = handRow.cards as UnoLayerCard[];
    const cardIdx = currentCards.findIndex((c) => c.id === card.id);
    if (cardIdx === -1) return NextResponse.json({ error: "Card not in hand" }, { status: 400 });

    const newCards = currentCards.filter((_, i) => i !== cardIdx);
    const secret = generateSecret();
    const newHandCommitment = await computeHandCommitment(
      walletAddress,
      newCards,
      handRow.hand_version + 1,
      secret
    );

    // Determine new active colour
    const newActiveColour: CardColour =
      card.colour === "wild"
        ? (declaredColour ?? "red")
        : card.colour;

    // Determine direction and next turn
    let newDirection: Direction = game.direction as Direction;
    const { data: gamePlayers } = await supabase
      .from("game_players")
      .select("*")
      .eq("game_id", game.id)
      .order("seat_index");

    const players = gamePlayers ?? [];
    const currentIdx = players.findIndex(
      (p: { wallet_address: string }) => p.wallet_address === walletAddress.toLowerCase()
    );

    let skipNext = false;
    let drawPenalty = 0;

    if (card.kind === "flip_direction") {
      if (players.length === 2) {
        // In 2-player: flip_direction = extra turn (no direction change)
        skipNext = false; // handled below: we'll set next to same player
      } else {
        newDirection =
          newDirection === "clockwise" ? "counterclockwise" : "clockwise";
      }
    } else if (card.kind === "block_turn") {
      skipNext = true;
    } else if (card.kind === "pull_two") {
      skipNext = true;
      drawPenalty = 2;
    } else if (card.kind === "power_shift") {
      skipNext = true;
      drawPenalty = 4;
    }

    // Compute next player
    let nextIdx: number;
    if (card.kind === "flip_direction" && players.length === 2) {
      // Same player gets another turn
      nextIdx = currentIdx;
    } else if (skipNext) {
      const afterSkip = nextPlayerIndex(currentIdx, players.length, newDirection);
      nextIdx = nextPlayerIndex(afterSkip, players.length, newDirection);
    } else {
      nextIdx = nextPlayerIndex(currentIdx, players.length, newDirection);
    }

    const nextPlayer = players[nextIdx] as { wallet_address: string };

    // Apply draw penalty to next player if needed
    if (drawPenalty > 0) {
      const { data: deckRow } = await supabase
        .from("draw_decks")
        .select("*")
        .eq("game_id", game.id)
        .single();

      if (deckRow) {
        const remaining = deckRow.remaining_cards as UnoLayerCard[];
        const penaltyCards = remaining.slice(0, drawPenalty);
        const newRemaining = remaining.slice(drawPenalty);

        const { data: targetHand } = await supabase
          .from("player_hands")
          .select("*")
          .eq("game_id", game.id)
          .eq("wallet_address", nextPlayer.wallet_address)
          .single();

        if (targetHand) {
          const targetCards = [...(targetHand.cards as UnoLayerCard[]), ...penaltyCards];
          const penaltyCommitment = await computeHandCommitment(
            nextPlayer.wallet_address,
            targetCards,
            targetHand.hand_version + 1,
            secret
          );
          await supabase
            .from("player_hands")
            .update({ cards: targetCards, hand_commitment: penaltyCommitment, hand_version: targetHand.hand_version + 1 })
            .eq("game_id", game.id)
            .eq("wallet_address", nextPlayer.wallet_address);

          await supabase
            .from("game_players")
            .update({ hand_count: targetCards.length })
            .eq("game_id", game.id)
            .eq("wallet_address", nextPlayer.wallet_address);
        }

        await supabase
          .from("draw_decks")
          .update({ remaining_cards: newRemaining, draw_pile_remaining: newRemaining.length })
          .eq("game_id", game.id);

        await supabase
          .from("games")
          .update({ draw_pile_remaining: newRemaining.length })
          .eq("id", game.id);
      }
    }

    // Submit to GenLayer (client reads sender address from session automatically)
    await glSubmitCard(
      gameId,
      JSON.stringify(card),
      declaredColour ?? "",
      newHandCommitment,
      newCards.length
    );

    // Check winner
    const isWinner = newCards.length === 0;

    // Update hand in Supabase
    await supabase
      .from("player_hands")
      .update({ cards: newCards, hand_commitment: newHandCommitment, hand_version: handRow.hand_version + 1 })
      .eq("game_id", game.id)
      .eq("wallet_address", walletAddress.toLowerCase());

    // Update game_players hand_count and layer call
    await supabase
      .from("game_players")
      .update({
        hand_count: newCards.length,
        has_called_layer: newCards.length === 1,
        has_finished: isWinner,
        final_rank: isWinner ? 1 : undefined,
      })
      .eq("game_id", game.id)
      .eq("wallet_address", walletAddress.toLowerCase());

    // Update discard pile
    try {
      await supabase.from("discard_pile").insert({
        game_id: game.id,
        card: card,
        played_by: walletAddress.toLowerCase(),
        move_number: game.move_count + 1,
      });
    } catch {}

    // Record move
    const moveRecord = {
      game_id: game.id,
      move_number: game.move_count + 1,
      player_wallet: walletAddress.toLowerCase(),
      card,
      declared_colour: declaredColour ?? null,
      action_effect: card.kind !== "number" ? card.kind : null,
      new_direction: newDirection,
      next_turn_wallet: nextPlayer.wallet_address,
      hand_commitment_after: newHandCommitment,
      hand_count_after: newCards.length,
    };
    try { await supabase.from("moves").insert(moveRecord); } catch {}

    // Update game state
    const gameUpdate: Record<string, unknown> = {
      active_discard: card,
      active_colour: newActiveColour,
      direction: newDirection,
      move_count: game.move_count + 1,
      current_turn_wallet: isWinner ? null : nextPlayer.wallet_address,
    };

    if (isWinner) {
      gameUpdate.status = "completed";
      gameUpdate.winner_wallet = walletAddress.toLowerCase();
      await glEndGame(gameId, newHandCommitment, walletAddress);

      // Update leaderboard
      try { await supabase.rpc("update_leaderboard_win", { p_wallet: walletAddress.toLowerCase() }); } catch {}
      for (const p of players) {
        const pw = (p as { wallet_address: string }).wallet_address;
        if (pw !== walletAddress.toLowerCase()) {
          try { await supabase.rpc("update_leaderboard_loss", { p_wallet: pw }); } catch {}
        }
      }
    }

    await supabase.from("games").update(gameUpdate).eq("id", game.id);

    return NextResponse.json({
      accepted: true,
      newActiveColour,
      newDirection,
      nextTurnWallet: isWinner ? null : nextPlayer.wallet_address,
      isWinner,
      handCount: newCards.length,
      drawPenalty,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
