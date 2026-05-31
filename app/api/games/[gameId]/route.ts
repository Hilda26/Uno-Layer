import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const supabase = createAdminClient();

  const { data: game, error } = await supabase
    .from("games")
    .select("*, game_players(*)")
    .eq("genlayer_game_id", gameId)
    .single();

  if (error || !game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  return NextResponse.json({ game });
}
