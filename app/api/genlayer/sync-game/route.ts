import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { glGetGame } from "@/lib/genlayer/client";

export async function POST(req: NextRequest) {
  try {
    const { gameId } = await req.json();
    if (!gameId) return NextResponse.json({ error: "gameId required" }, { status: 400 });

    const glState = await glGetGame(gameId);
    const supabase = createAdminClient();

    await supabase
      .from("games")
      .update({ official_state: typeof glState === "string" ? JSON.parse(glState) : glState, last_synced_at: new Date().toISOString() })
      .eq("genlayer_game_id", gameId);

    return NextResponse.json({ synced: true, state: glState });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
