import type { Room, RoomPlayer, Profile, ChatMessage, MoveRecord, ChallengeRecord } from "@/types";

// Supabase returns snake_case columns.
// These mappers convert DB rows → our camelCase types.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRoom(r: any): Room {
  return {
    id: r.id,
    roomCode: r.room_code,
    creatorWallet: r.creator_wallet,
    maxPlayers: r.max_players,
    mode: r.mode,
    status: r.status,
    genlayerGameId: r.genlayer_game_id ?? undefined,
    currentPlayers: r.current_players,
    isPrivate: r.is_private,
    turnSeconds: r.turn_seconds,
    createdAt: r.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRoomPlayer(p: any): RoomPlayer {
  return {
    id: p.id,
    roomId: p.room_id,
    walletAddress: p.wallet_address,
    seatIndex: p.seat_index,
    isReady: p.is_ready,
    joinedAt: p.joined_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapChatMessage(m: any): ChatMessage {
  return {
    id: m.id,
    roomId: m.room_id,
    walletAddress: m.wallet_address,
    username: m.username ?? undefined,
    message: m.message,
    createdAt: m.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapProfile(p: any): Profile {
  return {
    id: p.id,
    walletAddress: p.wallet_address,
    username: p.username ?? undefined,
    avatarUrl: p.avatar_url ?? undefined,
    gamesPlayed: p.games_played,
    wins: p.wins,
    losses: p.losses,
    totalRounds: p.total_rounds,
    cardsPlayed: p.cards_played,
    actionCardsPlayed: p.action_cards_played,
    challengesWon: p.challenges_won,
    challengesLost: p.challenges_lost,
    fairPlayScore: p.fair_play_score,
    createdAt: p.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapMoveRecord(m: any): MoveRecord {
  return {
    id: m.id,
    gameId: m.game_id,
    moveNumber: m.move_number,
    playerWallet: m.player_wallet,
    card: m.card ?? null,
    declaredColour: m.declared_colour ?? undefined,
    actionEffect: m.action_effect ?? undefined,
    newDirection: m.new_direction ?? undefined,
    nextTurnWallet: m.next_turn_wallet ?? undefined,
    drawCount: m.draw_count ?? undefined,
    handCommitmentAfter: m.hand_commitment_after ?? "",
    handCountAfter: m.hand_count_after ?? 0,
    powerShiftEffect: m.power_shift_effect ?? undefined,
    powerShiftTarget: m.power_shift_target ?? undefined,
    txHash: m.tx_hash ?? undefined,
    createdAt: m.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapChallengeRecord(c: any): ChallengeRecord {
  return {
    id: c.id,
    gameId: c.game_id,
    challengerWallet: c.challenger_wallet,
    targetMoveNumber: c.target_move_number,
    reason: c.reason,
    status: c.status,
    resolution: c.resolution ?? undefined,
    genlayerVerdict: c.genlayer_verdict ?? undefined,
    penaltyPlayer: c.penalty_player ?? undefined,
    createdAt: c.created_at,
  };
}