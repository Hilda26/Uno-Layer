import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { glCreateGame } from "@/lib/genlayer/client";
import type { GameMode } from "@/types";

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, maxPlayers, mode, isPrivate } = await req.json();
    if (!walletAddress) return NextResponse.json({ error: "walletAddress required" }, { status: 400 });

    // Validate mode against contract: ["classic", "quick", "private", "ranked"]
    const validModes = ["classic", "quick", "private", "ranked"];
    const resolvedMode = validModes.includes(mode) ? mode : "classic";

    const supabase = createAdminClient();
    const roomCode = generateRoomCode();
    const genlayerGameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Create GenLayer game — mode must be one of ["classic", "quick", "private", "ranked"]
    await glCreateGame(genlayerGameId, maxPlayers ?? 2, resolvedMode, walletAddress);

    // Create room
    const { data: room, error } = await supabase
      .from("rooms")
      .insert({
        room_code: roomCode,
        creator_wallet: walletAddress,
        max_players: maxPlayers ?? 2,
        mode: resolvedMode as GameMode,
        status: "waiting",
        genlayer_game_id: genlayerGameId,
        current_players: 1,
        is_private: isPrivate ?? false,
        turn_seconds: 60,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Add creator to room_players
    await supabase.from("room_players").insert({
      room_id: room.id,
      wallet_address: walletAddress,
      seat_index: 0,
      is_ready: false,
    });

    // Upsert profile
    await supabase.from("profiles").upsert(
      { wallet_address: walletAddress },
      { onConflict: "wallet_address", ignoreDuplicates: true }
    );

    return NextResponse.json({ room, genlayerGameId });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

export async function GET() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("rooms")
    .select("*")
    .eq("status", "waiting")
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(20);
  return NextResponse.json({ rooms: data ?? [] });
}
