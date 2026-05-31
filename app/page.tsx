"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapRoom } from "@/lib/utils/mappers";
import type { Room } from "@/types";
import RoomCard from "@/components/lobby/RoomCard";

const FEATURES = [
  { icon: "🃏", title: "Private Hands", desc: "Your cards stay private in Supabase. Only you see them." },
  { icon: "⛓️", title: "GenLayer Referee", desc: "Every move, action, and winner is verified on GenLayer." },
  { icon: "🔄", title: "Action Cards", desc: "Flip Direction, Block Turn, Pull Two, Colour Shift, Power Shift." },
  { icon: "⚡", title: "Realtime", desc: "Supabase Realtime keeps all players in sync instantly." },
  { icon: "🏆", title: "Fair Settlement", desc: "GenLayer declares the official winner — no disputes." },
  { icon: "🔍", title: "Audit Trail", desc: "Every move is recorded on-chain. Inspect proof anytime." },
];

const CARD_PREVIEW = [
  { label: "Red 7", cls: "card-red" },
  { label: "Blue Flip Direction", cls: "card-blue" },
  { label: "Green Block Turn", cls: "card-green" },
  { label: "Yellow Pull Two", cls: "card-yellow" },
  { label: "Colour Shift", cls: "card-wild" },
];

export default function LandingPage() {
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("rooms")
      .select("*")
      .eq("status", "waiting")
      .eq("is_private", false)
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (data) setRooms(data.map(mapRoom));
      });
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#0B0F14" }}>
      <section className="relative overflow-hidden py-20 px-4 text-center">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,90,61,0.12) 0%, transparent 70%)" }} />
        <div className="relative max-w-4xl mx-auto">
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(255,90,61,0.15)", color: "#FF5A3D", border: "1px solid rgba(255,90,61,0.3)" }}>
            GenLayer × Supabase Multiplayer
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-4 leading-tight">
            <span style={{ color: "#FF5A3D" }}>UNO</span><span style={{ color: "#22D3EE" }}>LAYER</span>
          </h1>
          <p className="text-xl md:text-2xl mb-4 font-medium" style={{ color: "#94A3B8" }}>Players do not just play cards.</p>
          <p className="text-lg mb-2 font-semibold" style={{ color: "#F8FAFC" }}>They settle the game state.</p>
          <p className="text-base mb-10 max-w-2xl mx-auto" style={{ color: "#94A3B8" }}>
            A private-hand multiplayer colour-card game where Supabase gives speed and privacy, while GenLayer gives truth and settlement.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/lobby" className="px-8 py-3 rounded-xl font-bold text-white text-lg transition-all hover:scale-105" style={{ background: "#FF5A3D", boxShadow: "0 0 24px rgba(255,90,61,0.4)" }}>
              Create Room
            </Link>
            <Link href="/lobby" className="px-8 py-3 rounded-xl font-bold text-lg transition-all hover:scale-105" style={{ border: "2px solid #22D3EE", color: "#22D3EE", background: "rgba(34,211,238,0.08)" }}>
              Join Room
            </Link>
          </div>
        </div>
      </section>

      <section className="py-8 px-4 overflow-hidden">
        <div className="max-w-5xl mx-auto flex gap-4 justify-center flex-wrap">
          {CARD_PREVIEW.map((c, i) => (
            <div key={i} className={`${c.cls} rounded-2xl w-20 h-28 flex items-center justify-center text-white font-bold text-xs text-center shadow-xl`} style={{ transform: `rotate(${(i - 2) * 6}deg)`, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
              {c.label}
            </div>
          ))}
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-4">
          {[
            { label: "Supabase", color: "#22D3EE", desc: "Speed + Privacy\nRealtime rooms, private hands, deck service, chat, profiles" },
            { label: "GenLayer", color: "#FF5A3D", desc: "Truth + Settlement\nMove validation, action effects, turn order, winner" },
            { label: "Frontend", color: "#FACC15", desc: "Experience\nSmooth realtime card game — wallet-connected, mobile-friendly" },
          ].map((item) => (
            <div key={item.label} className="glass rounded-2xl p-6 text-center">
              <div className="text-lg font-black mb-2" style={{ color: item.color }}>{item.label}</div>
              <p className="text-sm whitespace-pre-line" style={{ color: "#94A3B8" }}>{item.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-center mt-6 text-sm font-semibold" style={{ color: "#FF5A3D" }}>
          If Supabase and GenLayer disagree — GenLayer wins.
        </p>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-black text-center mb-8" style={{ color: "#22D3EE" }}>Why UNO-LAYER?</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="glass rounded-xl p-5">
                <div className="text-2xl mb-2">{f.icon}</div>
                <div className="font-bold mb-1">{f.title}</div>
                <p className="text-sm" style={{ color: "#94A3B8" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {rooms.length > 0 && (
        <section className="py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-black mb-6" style={{ color: "#22D3EE" }}>Live Public Rooms</h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {rooms.map((r) => <RoomCard key={r.id} room={r} />)}
            </div>
            <div className="text-center mt-6">
              <Link href="/lobby" className="text-sm font-semibold hover:underline" style={{ color: "#FF5A3D" }}>See all rooms →</Link>
            </div>
          </div>
        </section>
      )}

      <footer className="py-8 px-4 text-center text-xs" style={{ color: "#94A3B8", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <p>UNO-LAYER — Original colour-card game inspired by classic shedding games. Not affiliated with Mattel or UNO®.</p>
      </footer>
    </div>
  );
}
