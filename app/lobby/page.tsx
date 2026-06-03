"use client";

import { useEffect, useState, useCallback, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { createClient } from "@/lib/supabase/client";
import { mapRoom, mapRoomPlayer } from "@/lib/utils/mappers";
import type { Room, RoomPlayer } from "@/types";
import RoomCard from "@/components/lobby/RoomCard";
import CreateRoomModal from "@/components/lobby/CreateRoomModal";
import WalletButton from "@/components/wallet/WalletButton";

function LobbyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected } = useWallet();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClient(), []);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [myRoom, setMyRoom] = useState<Room | null>(null);
  const [myRoomPlayers, setMyRoomPlayers] = useState<RoomPlayer[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState(searchParams.get("join") ?? "");
  const [joining, setJoining] = useState(false);
  const [isMeReady, setIsMeReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const loadPublicRooms = useCallback(async () => {
    const { data } = await supabase
      .from("rooms")
      .select("*")
      .in("status", ["waiting"])
      .eq("is_private", false)
      .order("created_at", { ascending: false })
      .limit(12);
    if (data) setRooms(data.map(mapRoom));
  }, [supabase]);

  const loadMyRoom = useCallback(async () => {
    if (!address) return;

    const { data: rp } = await supabase
      .from("room_players")
      .select("room_id")
      .eq("wallet_address", address.toLowerCase())
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!rp) { setMyRoom(null); return; }

    const { data: room } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", rp.room_id)
      .in("status", ["waiting", "dealing"])
      .maybeSingle();

    if (room) {
      const mapped = mapRoom(room);
      setMyRoom(mapped);

      const { data: players } = await supabase
        .from("room_players")
        .select("*")
        .eq("room_id", room.id)
        .order("seat_index");

      const mappedPlayers = (players ?? []).map(mapRoomPlayer);
      setMyRoomPlayers(mappedPlayers);

      // Sync my own ready state
      const me = mappedPlayers.find(
        (p) => p.walletAddress === address.toLowerCase()
      );
      if (me) setIsMeReady(me.isReady);
    } else {
      setMyRoom(null);
      setMyRoomPlayers([]);
    }
  }, [address, supabase]);

  useEffect(() => {
    loadPublicRooms();
    loadMyRoom();
  }, [loadPublicRooms, loadMyRoom]);

  // Realtime: lobby list + my room players
  useEffect(() => {
    const ch = supabase
      .channel("lobby-global")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => {
        loadPublicRooms();
        loadMyRoom();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_players" }, () => {
        loadMyRoom();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, loadPublicRooms, loadMyRoom]);

  // Watch for game start on my room
  useEffect(() => {
    if (!myRoom) return;
    const ch = supabase
      .channel(`room-watch-${myRoom.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${myRoom.id}` },
        (payload) => {
          const updated = payload.new as { status: string; genlayer_game_id?: string };
          if (updated.status === "active" && updated.genlayer_game_id) {
            router.push(`/game/${updated.genlayer_game_id}`);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [myRoom, router, supabase]);

  const handleJoin = async () => {
    if (!address || !joinCode.trim()) return;
    setJoining(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${joinCode.trim().toUpperCase()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address.toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to join");
      setJoinCode("");
      await loadMyRoom();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to join");
    } finally {
      setJoining(false);
    }
  };

  const handleReady = async () => {
    if (!address || !myRoom) return;
    const newReady = !isMeReady;
    setIsMeReady(newReady);
    await supabase
      .from("room_players")
      .update({ is_ready: newReady })
      .eq("room_id", myRoom.id)
      .eq("wallet_address", address.toLowerCase());
  };

  const handleStart = async () => {
    if (!address || !myRoom) return;
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/cards/deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: myRoom.id, creatorWallet: address.toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start");
      if (data.genlayerGameId) {
        router.push(`/game/${data.genlayerGameId}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start");
      setStarting(false);
    }
  };

  const handleLeave = async () => {
    if (!address || !myRoom) return;
    await supabase
      .from("room_players")
      .delete()
      .eq("room_id", myRoom.id)
      .eq("wallet_address", address.toLowerCase());
    setMyRoom(null);
    setMyRoomPlayers([]);
    setIsMeReady(false);
  };

  // Creator is the first player by seat_index (seat 0)
  const isCreator =
    myRoom?.creatorWallet?.toLowerCase() === address?.toLowerCase();

  // All ready = at least 2 players, everyone has is_ready = true
  const allReady =
    myRoomPlayers.length >= 2 && myRoomPlayers.every((p) => p.isReady);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <h2 className="text-2xl font-black" style={{ color: "#22D3EE" }}>
          Connect your wallet to play
        </h2>
        <WalletButton />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black mb-8" style={{ color: "#22D3EE" }}>
        Game Lobby
      </h1>

      {/* ── My current room ── */}
      {myRoom ? (
        <div className="glass rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="font-mono text-xl font-black" style={{ color: "#FF5A3D" }}>
                #{myRoom.roomCode}
              </span>
              <span className="ml-3 text-sm" style={{ color: "#94A3B8" }}>
                {myRoom.currentPlayers}/{myRoom.maxPlayers} players · {myRoom.mode}
                {myRoom.isPrivate && " 🔒"}
              </span>
            </div>
            <button
              onClick={handleLeave}
              className="text-xs px-3 py-1 rounded-lg"
              style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}
            >
              Leave
            </button>
          </div>

          {/* Player seats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {Array.from({ length: myRoom.maxPlayers }).map((_, i) => {
              const p = myRoomPlayers[i];
              const isMe = p?.walletAddress === address?.toLowerCase();
              return (
                <div
                  key={i}
                  className="rounded-xl p-3 text-center text-sm"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: isMe
                      ? "1px solid rgba(255,90,61,0.3)"
                      : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {p ? (
                    <>
                      <div
                        className="font-mono text-xs mb-1 truncate"
                        style={{ color: isMe ? "#FF5A3D" : "#22D3EE" }}
                      >
                        {isMe ? "You" : `${p.walletAddress.slice(0, 6)}…${p.walletAddress.slice(-4)}`}
                      </div>
                      <div
                        className={`text-xs font-semibold ${
                          p.isReady ? "text-green-400" : "text-yellow-400"
                        }`}
                      >
                        {p.isReady ? "Ready ✓" : "Not ready"}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: "#94A3B8" }}>Waiting…</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleReady}
              className="px-5 py-2 rounded-xl font-bold text-sm transition-all hover:scale-105"
              style={{
                background: isMeReady ? "rgba(34,197,94,0.25)" : "rgba(34,197,94,0.1)",
                color: "#22C55E",
                border: "1px solid rgba(34,197,94,0.3)",
              }}
            >
              {isMeReady ? "✓ Ready" : "Mark Ready"}
            </button>

            {isCreator && (
              <button
                onClick={handleStart}
                disabled={!allReady || starting}
                className="px-5 py-2 rounded-xl font-bold text-sm text-white transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "#FF5A3D" }}
              >
                {starting ? "Starting…" : "Start Game"}
              </button>
            )}
          </div>

          {error && (
            <p className="mt-3 text-sm" style={{ color: "#EF4444" }}>
              {error}
            </p>
          )}
          {!allReady && myRoomPlayers.length < 2 && (
            <p className="mt-2 text-xs" style={{ color: "#94A3B8" }}>
              Need at least 2 players to start.
            </p>
          )}
          {myRoomPlayers.length >= 2 && !allReady && (
            <p className="mt-2 text-xs" style={{ color: "#94A3B8" }}>
              Waiting for all players to mark ready.
            </p>
          )}
        </div>
      ) : (
        /* ── Create / Join ── */
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="glass rounded-2xl p-6">
            <h2 className="font-black text-lg mb-3" style={{ color: "#FF5A3D" }}>
              Create Room
            </h2>
            <p className="text-sm mb-4" style={{ color: "#94A3B8" }}>
              Start a new game and invite friends with a room code.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="w-full py-3 rounded-xl font-bold text-white transition-all hover:scale-105"
              style={{ background: "#FF5A3D" }}
            >
              Create Room
            </button>
          </div>

          <div className="glass rounded-2xl p-6">
            <h2 className="font-black text-lg mb-3" style={{ color: "#22D3EE" }}>
              Join Room
            </h2>
            <p className="text-sm mb-4" style={{ color: "#94A3B8" }}>
              Enter a room code shared by a friend.
            </p>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="ROOM CODE"
                className="flex-1 px-3 py-2 rounded-xl font-mono text-sm uppercase"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#F8FAFC",
                  outline: "none",
                }}
                maxLength={8}
              />
              <button
                onClick={handleJoin}
                disabled={joining || !joinCode.trim()}
                className="px-4 py-2 rounded-xl font-bold text-sm transition-all hover:scale-105 disabled:opacity-40"
                style={{ background: "#22D3EE", color: "#0B0F14" }}
              >
                {joining ? "…" : "Join"}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-xs" style={{ color: "#EF4444" }}>
                {error}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Public rooms ── */}
      <div>
        <h2 className="font-black text-lg mb-4" style={{ color: "#22D3EE" }}>
          Public Rooms
        </h2>
        {rooms.length === 0 ? (
          <div
            className="glass rounded-xl p-8 text-center"
            style={{ color: "#94A3B8" }}
          >
            No public rooms right now.{" "}
            <button
              onClick={() => setShowCreate(true)}
              className="underline"
              style={{ color: "#FF5A3D" }}
            >
              Create one!
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {rooms.map((r) => (
              <RoomCard key={r.id} room={r} />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { loadMyRoom(); setShowCreate(false); }}
        />
      )}
    </div>
  );
}

export default function LobbyPage() {
  return (
    <Suspense>
      <LobbyContent />
    </Suspense>
  );
}
