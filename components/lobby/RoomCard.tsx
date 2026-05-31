"use client";

import Link from "next/link";
import type { Room } from "@/types";

export default function RoomCard({ room }: { room: Room }) {
  const statusColor =
    room.status === "waiting"
      ? "#22C55E"
      : room.status === "active"
      ? "#FF5A3D"
      : "#94A3B8";

  return (
    <div className="glass rounded-xl p-4 hover:border-opacity-30 transition-all">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-sm font-bold" style={{ color: "#22D3EE" }}>
          #{room.roomCode}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ color: statusColor, background: `${statusColor}22` }}>
          {room.status}
        </span>
      </div>
      <div className="text-xs mb-3" style={{ color: "#94A3B8" }}>
        <span>{room.currentPlayers}/{room.maxPlayers} players</span>
        <span className="mx-2">·</span>
        <span className="capitalize">{room.mode}</span>
        {room.isPrivate && <span className="ml-2">🔒</span>}
      </div>
      <Link
        href={`/lobby?join=${room.roomCode}`}
        className="block text-center text-xs py-2 rounded-lg font-semibold transition-all hover:scale-105"
        style={{ background: "rgba(255,90,61,0.15)", color: "#FF5A3D", border: "1px solid rgba(255,90,61,0.3)" }}
      >
        Join Room
      </Link>
    </div>
  );
}
