import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { glJoinGame } from "@/lib/genlayer/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rooms")
    .select("*, room_players(*)")
    .eq("room_code", roomId)
    .single();
  if (error) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  return NextResponse.json({ room: data });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  try {
    const { walletAddress } = await req.json();
    if (!walletAddress) return NextResponse.json({ error: "walletAddress required" }, { status: 400 });

    const supabase = createAdminClient();

    // Get room by code
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("*")
      .eq("room_code", roomId.toUpperCase())
      .eq("status", "waiting")
      .single();

    if (roomErr || !room) return NextResponse.json({ error: "Room not found or not accepting players" }, { status: 404 });

    // Check if already joined
    const { data: existing } = await supabase
      .from("room_players")
      .select("id")
      .eq("room_id", room.id)
      .eq("wallet_address", walletAddress)
      .single();

    if (existing) return NextResponse.json({ room, alreadyJoined: true });

    // Check capacity
    const { count } = await supabase
      .from("room_players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);

    if ((count ?? 0) >= room.max_players) {
      return NextResponse.json({ error: "Room is full" }, { status: 400 });
    }

    const seatIndex = count ?? 0;

    // Join GenLayer
    if (room.genlayer_game_id) {
      await glJoinGame(room.genlayer_game_id, walletAddress);
    }

    // Add to room_players
    await supabase.from("room_players").insert({
      room_id: room.id,
      wallet_address: walletAddress,
      seat_index: seatIndex,
      is_ready: false,
    });

    // Update current_players count
    await supabase
      .from("rooms")
      .update({ current_players: seatIndex + 1 })
      .eq("id", room.id);

    // Upsert profile
    await supabase.from("profiles").upsert(
      { wallet_address: walletAddress },
      { onConflict: "wallet_address", ignoreDuplicates: true }
    );

    return NextResponse.json({ room, joined: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
