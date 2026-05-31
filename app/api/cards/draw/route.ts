import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeHandCommitment, computeDeckCommitment, generateSecret } from "@/lib/crypto/commitment";
import { glRecordDraw } from "@/lib/genlayer/client";
import type { UnoLayerCard } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { gameId, walletAddress } = await req.json();
    if (!gameId || !walletAddress) {
      return NextResponse.json({ error: "gameId and walletAddress required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get game
    const { data: game, error: gameErr } = await supabase
      .from("games")
      .select("*")
      .eq("genlayer_game_id", gameId)
      .single();

    if (gameErr || !game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

    // Verify it's player's turn
    if (game.current_turn_wallet !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: "Not your turn" }, { status: 403 });
    }

    // Get draw deck
    const { data: drawDeck } = await supabase
      .from("draw_decks")
      .select("*")
      .eq("game_id", game.id)
      .single();

    if (!drawDeck || (drawDeck.remaining_cards as UnoLayerCard[]).length === 0) {
      return NextResponse.json({ error: "Draw pile empty" }, { status: 400 });
    }

    const remaining = drawDeck.remaining_cards as UnoLayerCard[];
    const drawnCard = remaining[0];
    const newRemaining = remaining.slice(1);

    // Get current hand
    const { data: handRow } = await supabase
      .from("player_hands")
      .select("*")
      .eq("game_id", game.id)
      .eq("wallet_address", walletAddress.toLowerCase())
      .single();

    if (!handRow) return NextResponse.json({ error: "Hand not found" }, { status: 404 });

    const newCards = [...(handRow.cards as UnoLayerCard[]), drawnCard];
    const secret = generateSecret();
    const newHandCommitment = await computeHandCommitment(walletAddress, newCards, handRow.hand_version + 1, secret);
    const newDeckCommitment = await computeDeckCommitment(newRemaining, secret);

    // Update hand
    await supabase
      .from("player_hands")
      .update({ cards: newCards, hand_commitment: newHandCommitment, hand_version: handRow.hand_version + 1 })
      .eq("game_id", game.id)
      .eq("wallet_address", walletAddress.toLowerCase());

    // Update deck
    await supabase
      .from("draw_decks")
      .update({
        remaining_cards: newRemaining,
        used_cards: [...(drawDeck.used_cards as UnoLayerCard[]), drawnCard],
        deck_commitment: newDeckCommitment,
        draw_count: drawDeck.draw_count + 1,
      })
      .eq("game_id", game.id);

    // Update game_players hand_count
    await supabase
      .from("game_players")
      .update({ hand_count: newCards.length })
      .eq("game_id", game.id)
      .eq("wallet_address", walletAddress.toLowerCase());

    // Update game draw_pile_remaining
    await supabase
      .from("games")
      .update({ draw_pile_remaining: newRemaining.length })
      .eq("id", game.id);

    // Record draw on GenLayer
    await glRecordDraw(gameId, 1, newHandCommitment, newCards.length, newDeckCommitment, walletAddress);

    return NextResponse.json({ drawnCard, handCount: newCards.length });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
