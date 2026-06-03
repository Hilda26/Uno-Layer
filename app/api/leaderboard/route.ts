import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("wallet_address, username, wins, losses, games_played, cards_played, action_cards_played, challenges_won, challenges_lost, fair_play_score")
    .order("wins", { ascending: false })
    .limit(50);

  const entries = (data ?? []).map((p) => ({
    walletAddress: p.wallet_address,
    username: p.username,
    wins: p.wins,
    losses: p.losses,
    gamesPlayed: p.games_played,
    winRate: p.games_played > 0 ? Math.round((p.wins / p.games_played) * 100) : 0,
    cardsPlayed: p.cards_played,
    actionCardsPlayed: p.action_cards_played,
    challengesWon: p.challenges_won,
    challengesLost: p.challenges_lost,
    fairPlayScore: p.fair_play_score,
  }));

  return NextResponse.json({ leaderboard: entries });
}
