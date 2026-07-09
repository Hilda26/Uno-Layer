/**
 * UNO-LAYER GenLayer Studio Client
 *
 * Uses genlayer-js 1.1.8 as the primary transport. A lightweight JSON-RPC
 * fallback remains so the Supabase-backed game can continue in local/dev mode
 * if Studio rejects a transaction or a server route cannot access the browser's
 * unlocked embedded wallet key.
 */

import { getSessionAddress, getSessionKey } from "@/lib/wallet/session";

function clean(value: string | undefined, fallback: string): string {
  return (value ?? fallback).replace(/^\uFEFF/, "").trim();
}

const RPC = clean(
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL,
  "https://studio.genlayer.com/api"
);

const CONTRACT = clean(
  process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS,
  "0xe9D921c7998197C27a6f79Bf16b6a9A8180a9016"
) as `0x${string}`;

const ZERO_FROM = "0x0000000000000000000000000000000000000001" as `0x${string}`;

type JsonRpcError = { message?: string };
type JsonRpcResponse = { result?: unknown; error?: JsonRpcError };

function normalize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalize(v)])
    );
  }
  return value;
}

function encodeCalldata(method: string, args: unknown[]): string {
  const json = JSON.stringify({ method, args });
  const bytes = new TextEncoder().encode(json);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}`;
}

async function jsonrpc(method: string, params: unknown[]): Promise<unknown> {
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method, id: Date.now(), params }),
    });
    const json = (await res.json()) as JsonRpcResponse;
    if (json.error) return { status: "error", error: json.error.message ?? "GenLayer RPC error" };
    return json.result ?? json;
  } catch (error) {
    return { status: "mock", error: error instanceof Error ? error.message : "GenLayer unavailable" };
  }
}

async function getSdkClient(account?: `0x${string}`) {
  const [{ createClient, createAccount }, { studionet }] = await Promise.all([
    import("genlayer-js"),
    import("genlayer-js/chains"),
  ]);

  const pk = getSessionKey();
  const sdkAccount = pk ? createAccount(pk) : account;

  return createClient({
    chain: studionet,
    endpoint: RPC,
    account: sdkAccount,
  });
}

async function fallbackRead(contractMethod: string, args: unknown[]): Promise<string> {
  const from = (getSessionAddress() ?? ZERO_FROM) as `0x${string}`;
  const result = await jsonrpc("gen_call", [{
    type: "read",
    to: CONTRACT,
    from,
    data: encodeCalldata(contractMethod, args),
  }]);
  return typeof result === "string" ? result : JSON.stringify(normalize(result));
}

async function read(contractMethod: string, args: unknown[]): Promise<string> {
  try {
    const client = await getSdkClient();
    const result = await client.readContract({
      address: CONTRACT,
      functionName: contractMethod,
      args: args as never[],
      jsonSafeReturn: true,
    });
    return typeof result === "string" ? result : JSON.stringify(normalize(result));
  } catch (error) {
    console.warn(`[GenLayer SDK read:${contractMethod}] falling back`, error);
    return fallbackRead(contractMethod, args);
  }
}

async function fallbackWrite(contractMethod: string, args: unknown[], fromOverride?: string): Promise<unknown> {
  const from = (fromOverride ?? getSessionAddress() ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
  return jsonrpc("gen_call", [{
    type: "write",
    to: CONTRACT,
    from,
    data: encodeCalldata(contractMethod, args),
  }]);
}

async function write(contractMethod: string, args: unknown[], fromOverride?: string): Promise<unknown> {
  try {
    const account = (getSessionAddress() ?? fromOverride) as `0x${string}` | undefined;
    const client = await getSdkClient(account);
    const txHash = await client.writeContract({
      address: CONTRACT,
      functionName: contractMethod,
      args: args as never[],
      value: BigInt(0),
      leaderOnly: false,
      consensusMaxRotations: 3,
    });

    return {
      status: "submitted",
      method: contractMethod,
      txHash,
      hash: txHash,
    };
  } catch (error) {
    console.warn(`[GenLayer SDK write:${contractMethod}] falling back`, error);
    const fallback = await fallbackWrite(contractMethod, args, fromOverride);
    if (fallback && typeof fallback === "object" && "status" in fallback) {
      return fallback;
    }
    return {
      status: "submitted",
      method: contractMethod,
      result: fallback,
    };
  }
}

export const glPayEntryFee = (gameId: string, from?: string) =>
  write("pay_entry_fee", [gameId, "0.01"], from);

export const glCreateGame = (gameId: string, maxPlayers: number, mode: string, from?: string) =>
  write("create_game", [gameId, maxPlayers, mode], from);

export const glJoinGame = (gameId: string, from?: string) =>
  write("join_game", [gameId], from);

export const glCommitDeck = (gameId: string, deckCommitment: string, from?: string) =>
  write("commit_deck", [gameId, deckCommitment], from);

export const glSubmitShuffleSeed = (gameId: string, contribution: string, from?: string) =>
  write("submit_shuffle_seed", [gameId, contribution], from);

export const glRequestShuffleSeed = (gameId: string, from?: string) =>
  write("request_shuffle_seed", [gameId], from);

export const glCommitHand = (
  gameId: string, player: string, handCommitment: string, handCount: number, from?: string
) => write("commit_hand", [gameId, player, handCommitment, handCount], from);

export const glStartGame = (
  gameId: string, firstDiscardJson: string, activeColour: string, from?: string
) => write("start_game", [gameId, firstDiscardJson, activeColour], from);

export const glSubmitCard = (
  gameId: string,
  cardJson: string,
  declaredColour: string,
  handCommitmentAfter: string,
  handCountAfter: number,
  from?: string
) => write("submit_card", [gameId, cardJson, declaredColour, handCommitmentAfter, handCountAfter], from);

export const glRecordDraw = (
  gameId: string,
  drawCount: number,
  handCommitmentAfter: string,
  handCountAfter: number,
  deckCommitmentAfter: string,
  from?: string
) => write("record_draw", [gameId, drawCount, handCommitmentAfter, handCountAfter, deckCommitmentAfter], from);

export const glPassTurn = (gameId: string, from?: string) =>
  write("pass_turn", [gameId], from);

export const glCallLayer = (gameId: string, from?: string) =>
  write("call_layer", [gameId], from);

export const glChallengeMove = (gameId: string, moveNumber: number, reason: string, from?: string) =>
  write("challenge_move", [gameId, moveNumber, reason], from);

export const glResolveChallenge = (gameId: string, challengeId: string, from?: string) =>
  write("resolve_challenge", [gameId, challengeId], from);

export const glResolvePowerShift = (gameId: string, moveNumber: number, from?: string) =>
  write("resolve_power_shift", [gameId, moveNumber], from);

export const glJudgeFairPlay = (gameId: string, from?: string) =>
  write("judge_fair_play", [gameId], from);

export const glForfeitGame = (gameId: string, from?: string) =>
  write("forfeit_game", [gameId], from);

export const glEndGame = (gameId: string, finalCommitment: string, from?: string) =>
  write("end_game", [gameId, finalCommitment], from);

export const glGetGame = (gameId: string) => read("get_game", [gameId]);
export const glGetPlayers = (gameId: string) => read("get_players", [gameId]);
export const glGetCurrentTurn = (gameId: string) => read("get_current_turn", [gameId]);
export const glGetActiveDiscard = (gameId: string) => read("get_active_discard", [gameId]);
export const glGetActiveColour = (gameId: string) => read("get_active_colour", [gameId]);
export const glGetDirection = (gameId: string) => read("get_direction", [gameId]);
export const glGetHandCounts = (gameId: string) => read("get_hand_counts", [gameId]);
export const glGetMoveHistory = (gameId: string) => read("get_move_history", [gameId]);
export const glGetLastMove = (gameId: string) => read("get_last_move", [gameId]);
export const glGetChallenges = (gameId: string) => read("get_challenges", [gameId]);
export const glGetLayerCallers = (gameId: string) => read("get_layer_callers", [gameId]);
export const glGetWinner = (gameId: string) => read("get_winner", [gameId]);
export const glGetDeckSeed = (gameId: string) => read("get_deck_seed", [gameId]);
export const glGetFairPlayResults = (gameId: string) => read("get_fair_play_results", [gameId]);
export const glGetTotalGames = () => read("get_total_games", []);
export const glGetMove = (gameId: string, moveId: string) => read("get_move", [gameId, moveId]);