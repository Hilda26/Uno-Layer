/**
 * UNO-LAYER GenLayer Studio Client
 *
 * Contract : 0xcD8A89d489A45EB7e9883A716f0CD796F907a5F1
 * RPC      : https://studio.genlayer.com/api
 * Chain ID : 61999 (0xf22f)
 *
 * ─── Call format (discovered via RPC testing) ───────────────────────────────
 *   Method : gen_call
 *   Params : [{ type, to, from, data }]
 *     type : "read"  → view functions (no state change)
 *          : "write" → state-changing functions (needs signed tx)
 *     data : "0x" + hex(JSON.stringify({ method, args }))
 *            This is the format GenLayer's Python runtime expects.
 *            The calldata reaches the contract as the JSON string.
 *
 * ─── Signing ────────────────────────────────────────────────────────────────
 *   Write calls that go through GenLayer consensus need the `data` field
 *   to be an RLP-encoded signed Ethereum transaction (chainId = 61999).
 *   The embedded wallet's private key is used to sign client-side.
 *   Server-side API routes pass the `from` address; signing happens in
 *   the browser before calling the API, or skipped for MVP (mock fallback).
 *
 * ─── MVP behaviour ──────────────────────────────────────────────────────────
 *   - All calls are attempted against the live RPC.
 *   - On network error or execution failure the call returns a mock object
 *     so the game continues without blocking on GenLayer consensus.
 *   - Supabase is the primary real-time data source; GenLayer is the
 *     authoritative settlement layer.
 */

import { getSessionAddress, getSessionKey } from "@/lib/wallet/session";
import { getEnv } from "@/lib/utils/env";

// getEnv strips the UTF-8 BOM (U+FEFF) that PowerShell can inject into env vars
const RPC      = getEnv("NEXT_PUBLIC_GENLAYER_RPC_URL", "https://studio.genlayer.com/api");
const CONTRACT = getEnv(
  "NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS",
  "0xcD8A89d489A45EB7e9883A716f0CD796F907a5F1"
) as `0x${string}`;
const CHAIN_ID = 61999;

// ─── Encoding ────────────────────────────────────────────────────────────────

function encodeCalldata(method: string, args: unknown[]): string {
  const json  = JSON.stringify({ method, args });
  const bytes = new TextEncoder().encode(json);
  const hex   = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return "0x" + hex;
}

// ─── Transport ───────────────────────────────────────────────────────────────

async function jsonrpc(method: string, params: unknown[]): Promise<unknown> {
  try {
    const res = await fetch(RPC, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ jsonrpc: "2.0", method, id: Date.now(), params }),
    });
    const json = await res.json() as { result?: unknown; error?: { message: string } };
    if (json.error) {
      console.warn(`[GenLayer ${method}] RPC error:`, json.error.message);
      return { status: "error", error: json.error.message };
    }
    return json.result ?? json;
  } catch (err) {
    console.warn(`[GenLayer ${method}] unreachable:`, err);
    return { status: "mock", method };
  }
}

// ─── Read (view functions) ───────────────────────────────────────────────────

async function read(contractMethod: string, args: unknown[]): Promise<string> {
  const from = getSessionAddress() ?? "0x0000000000000000000000000000000000000001";
  const result = await jsonrpc("gen_call", [{
    type: "read",
    to  : CONTRACT,
    from,
    data: encodeCalldata(contractMethod, args),
  }]);

  // Try to decode the result as an ABI string or return raw
  if (typeof result === "string") return result;
  return JSON.stringify(result);
}

// ─── Write (state-changing functions) ────────────────────────────────────────

/**
 * For write calls we attempt to sign the transaction with the embedded wallet.
 * If no key is in session (e.g. called from a server API route), we fall back
 * to an unsigned submission — GenLayer Studio may still process it in dev mode.
 *
 * @param contractMethod  Contract function name
 * @param args            Function arguments
 * @param fromOverride    Explicit sender address (from API routes)
 */
async function write(
  contractMethod: string,
  args          : unknown[],
  fromOverride  ?: string
): Promise<unknown> {
  const from     = fromOverride ?? getSessionAddress() ?? "0x0000000000000000000000000000000000000000";
  const calldata = encodeCalldata(contractMethod, args);

  // Try to sign if the private key is available in session
  const pk = getSessionKey();
  if (pk) {
    try {
      const { privateKeyToAccount } = await import("viem/accounts");
      const account = privateKeyToAccount(pk);

      // Fetch nonce
      const nonceResult = await jsonrpc("eth_getTransactionCount", [account.address, "latest"]);
      const nonce = typeof nonceResult === "string"
        ? parseInt(nonceResult, 16)
        : 0;

      // Sign legacy transaction
      const signedTx = await account.signTransaction({
        to      : CONTRACT,
        data    : calldata as `0x${string}`,
        nonce,
        gasPrice: BigInt(0),
        gas     : BigInt(100_000),
        value   : BigInt(0),
        chainId : CHAIN_ID,
        type    : "legacy",
      });

      const result = await jsonrpc("gen_call", [{
        type: "write",
        to  : CONTRACT,
        from: account.address,
        data: signedTx,
      }]);

      if (typeof result === "object" && result !== null && "status" in result && (result as { status: string }).status === "error") {
        // Fall back to unsigned
        console.warn("[GenLayer] Signed write rejected, trying unsigned");
      } else {
        return result;
      }
    } catch (e) {
      console.warn("[GenLayer] Sign failed:", e);
    }
  }

  // Unsigned fallback — works in GenLayer Studio dev mode for some ops
  return jsonrpc("gen_call", [{
    type: "write",
    to  : CONTRACT,
    from,
    data: calldata,
  }]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Write functions
// ═══════════════════════════════════════════════════════════════════════════════

export const glCreateGame   = (gameId: string, maxPlayers: number, mode: string, from?: string) =>
  write("create_game", [gameId, maxPlayers, mode], from);

export const glJoinGame     = (gameId: string, from?: string) =>
  write("join_game", [gameId], from);

export const glCommitDeck   = (gameId: string, deckCommitment: string, from?: string) =>
  write("commit_deck", [gameId, deckCommitment], from);

export const glCommitHand   = (
  gameId: string, player: string, handCommitment: string, handCount: number, from?: string
) => write("commit_hand", [gameId, player, handCommitment, handCount], from);

export const glStartGame    = (
  gameId: string, firstDiscardJson: string, activeColour: string, from?: string
) => write("start_game", [gameId, firstDiscardJson, activeColour], from);

export const glSubmitCard   = (
  gameId: string, cardJson: string, declaredColour: string,
  handCommitmentAfter: string, handCountAfter: number, from?: string
) => write("submit_card", [gameId, cardJson, declaredColour, handCommitmentAfter, handCountAfter], from);

export const glRecordDraw   = (
  gameId: string, drawCount: number, handCommitmentAfter: string,
  handCountAfter: number, deckCommitmentAfter: string, from?: string
) => write("record_draw", [gameId, drawCount, handCommitmentAfter, handCountAfter, deckCommitmentAfter], from);

export const glPassTurn     = (gameId: string, from?: string) =>
  write("pass_turn", [gameId], from);

export const glCallLayer    = (gameId: string, from?: string) =>
  write("call_layer", [gameId], from);

export const glChallengeMove = (gameId: string, moveNumber: number, reason: string, from?: string) =>
  write("challenge_move", [gameId, moveNumber, reason], from);

export const glResolveChallenge = (
  gameId: string, challengeId: string, resolution: string, from?: string
) => write("resolve_challenge", [gameId, challengeId, resolution], from);

export const glForfeitGame  = (gameId: string, from?: string) =>
  write("forfeit_game", [gameId], from);

export const glEndGame      = (gameId: string, finalCommitment: string, from?: string) =>
  write("end_game", [gameId, finalCommitment], from);

// ═══════════════════════════════════════════════════════════════════════════════
// Read functions
// ═══════════════════════════════════════════════════════════════════════════════

export const glGetGame          = (gameId: string) => read("get_game",          [gameId]);
export const glGetPlayers       = (gameId: string) => read("get_players",       [gameId]);
export const glGetCurrentTurn   = (gameId: string) => read("get_current_turn",  [gameId]);
export const glGetActiveDiscard = (gameId: string) => read("get_active_discard",[gameId]);
export const glGetActiveColour  = (gameId: string) => read("get_active_colour", [gameId]);
export const glGetDirection     = (gameId: string) => read("get_direction",     [gameId]);
export const glGetHandCounts    = (gameId: string) => read("get_hand_counts",   [gameId]);
export const glGetMoveHistory   = (gameId: string) => read("get_move_history",  [gameId]);
export const glGetLastMove      = (gameId: string) => read("get_last_move",     [gameId]);
export const glGetChallenges    = (gameId: string) => read("get_challenges",    [gameId]);
export const glGetLayerCallers  = (gameId: string) => read("get_layer_callers", [gameId]);
export const glGetWinner        = (gameId: string) => read("get_winner",        [gameId]);
export const glGetTotalGames    = ()               => read("get_total_games",   []);
export const glGetMove = (gameId: string, moveId: string) =>
  read("get_move", [gameId, moveId]);
