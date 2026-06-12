import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDeck, shuffleDeck, seededShuffleDeck, getFirstValidDiscard } from "@/lib/cards/deck";
import { computeDeckCommitment, computeHandCommitment, generateSecret } from "@/lib/crypto/commitment";
import { glCommitDeck, glCommitHand, glStartGame, glGetDeckSeed } from "@/lib/genlayer/client";

export async function POST(req: NextRequest) {
  try {
    const { roomId, creatorWallet, deckSeed } = await req.json();
    if (!roomId || !creatorWallet) {
      return NextResponse.json({ error: "roomId and creatorWallet required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify creator and room
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("*, room_players(*)")
      .eq("id", roomId)
      .eq("creator_wallet", creatorWallet)
      .eq("status", "waiting")
      .single();

    if (roomErr || !room) {
      return NextResponse.json({ error: "Room not found or not authorised" }, { status: 403 });
    }

    const players = room.room_players as { wallet_address: string; seat_index: number }[];
    if (players.length < 2) {
      return NextResponse.json({ error: "Need at least 2 players" }, { status: 400 });
    }

    // Set room to dealing
    await supabase.from("rooms").update({ status: "dealing" }).eq("id", roomId);

    // Build & shuffle deck. When GenLayer consensus produced a deck seed
    // (sha256 of player commitments + game id + non-deterministic external
    // entropy, agreed on by validators), the actual card order is derived
    // deterministically from that seed. Falls back to a local shuffle only
    // if the consensus seed could not be obtained.
    let deck = typeof deckSeed === "string" && deckSeed.length > 0
      ? seededShuffleDeck(buildDeck(), deckSeed)
      : shuffleDeck(buildDeck());
    const secret = generateSecret();
    const deckCommitment = await computeDeckCommitment(deck, secret);

    // Deal 7 cards per player
    const sortedPlayers = [...players].sort((a, b) => a.seat_index - b.seat_index);
    const handMap: Record<string, ReturnType<typeof buildDeck>> = {};
    for (const p of sortedPlayers) {
      handMap[p.wallet_address] = deck.splice(0, 7);
    }

    // Flip first valid discard
    const { card: firstDiscard, remaining } = getFirstValidDiscard(deck);
    deck = remaining;

    // Create GenLayer game record
    const genlayerGameId = room.genlayer_game_id ?? `game_${Date.now()}`;

    // Commit deck to GenLayer
    await glCommitDeck(genlayerGameId, deckCommitment, creatorWallet);

    // Create game row in Supabase
    const { data: gameRow, error: gameErr } = await supabase
      .from("games")
      .insert({
        genlayer_game_id: genlayerGameId,
        room_id: roomId,
        status: "active",
        mode: room.mode,
        creator_wallet: creatorWallet,
        current_turn_wallet: sortedPlayers[0].wallet_address,
        direction: "clockwise",
        active_colour: firstDiscard.colour === "wild" ? "red" : firstDiscard.colour,
        active_discard: firstDiscard,
        move_count: 0,
        draw_pile_remaining: deck.length,
        deck_seed: typeof deckSeed === "string" && deckSeed.length > 0 ? deckSeed : null,
        deck_entropy: null,
      })
      .select()
      .single();

    if (gameErr) throw new Error(gameErr.message);

    // Insert game_players
    for (const p of sortedPlayers) {
      await supabase.from("game_players").insert({
        game_id: gameRow.id,
        wallet_address: p.wallet_address,
        seat_index: p.seat_index,
        hand_count: 7,
      });

      // Compute hand commitment
      const handCommitment = await computeHandCommitment(
        p.wallet_address,
        handMap[p.wallet_address],
        1,
        secret
      );

      // Store private hand
      await supabase.from("player_hands").insert({
        game_id: gameRow.id,
        wallet_address: p.wallet_address,
        cards: handMap[p.wallet_address],
        hand_commitment: handCommitment,
        hand_version: 1,
      });

      // Commit hand to GenLayer
      await glCommitHand(
        genlayerGameId,
        p.wallet_address,
        handCommitment,
        7,
        creatorWallet
      );
    }

    // Store draw deck privately
    await supabase.from("draw_decks").insert({
      game_id: gameRow.id,
      remaining_cards: deck,
      used_cards: [firstDiscard],
      deck_commitment: deckCommitment,
      draw_count: 0,
    });

    // Start game on GenLayer
    await glStartGame(
      genlayerGameId,
      JSON.stringify(firstDiscard),
      firstDiscard.colour === "wild" ? "red" : firstDiscard.colour,
      creatorWallet
    );

    // Record the consensus entropy source alongside the deck seed for display
    if (typeof deckSeed === "string" && deckSeed.length > 0) {
      try {
        const seedInfo = await glGetDeckSeed(genlayerGameId);
        const parsed = JSON.parse(seedInfo) as Record<string, unknown>;
        if (parsed?.deck_entropy) {
          await supabase.from("games").update({ deck_entropy: parsed.deck_entropy }).eq("id", gameRow.id);
        }
      } catch (e) {
        console.warn("get_deck_seed failed", e);
      }
    }

    // Mark room as active
    await supabase.from("rooms").update({
      status: "active",
      genlayer_game_id: genlayerGameId,
    }).eq("id", roomId);

    return NextResponse.json({ genlayerGameId, gameId: gameRow.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
