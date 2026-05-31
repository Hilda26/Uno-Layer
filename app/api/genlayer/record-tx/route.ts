import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { gameId, txHash, method, playerWallet, payload } = await req.json();
    const supabase = createAdminClient();

    const { data: game } = await supabase
      .from("games")
      .select("id")
      .eq("genlayer_game_id", gameId)
      .single();

    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

    try {
      await supabase.from("transactions").insert({
        game_id: game.id,
        tx_hash: txHash,
        method,
        player_wallet: playerWallet,
        status: "confirmed",
        payload: payload ?? null,
      });
    } catch {}

    await supabase.from("games").update({ last_tx_hash: txHash }).eq("id", game.id);

    return NextResponse.json({ recorded: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
