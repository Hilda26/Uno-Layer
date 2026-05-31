import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const walletAddress = req.nextUrl.searchParams.get("wallet");
  if (!walletAddress) return NextResponse.json({ error: "wallet required" }, { status: 400 });

  const supabase = createAdminClient();

  // Get game to verify player
  const { data: game } = await supabase
    .from("games")
    .select("id")
    .eq("genlayer_game_id", gameId)
    .single();

  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const { data: hand, error } = await supabase
    .from("player_hands")
    .select("cards, hand_commitment, hand_version")
    .eq("game_id", game.id)
    .eq("wallet_address", walletAddress.toLowerCase())
    .single();

  if (error || !hand) return NextResponse.json({ error: "Hand not found" }, { status: 404 });

  return NextResponse.json({ cards: hand.cards, handCommitment: hand.hand_commitment, handVersion: hand.hand_version });
}
