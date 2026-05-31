"use client";

import Link from "next/link";
import { useState } from "react";
import WalletButton from "@/components/wallet/WalletButton";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-[100] glass border-b" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1">
          <span className="text-xl font-black tracking-tight" style={{ color: "#FF5A3D" }}>UNO</span>
          <span className="text-xl font-black tracking-tight" style={{ color: "#22D3EE" }}>LAYER</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          {[
            { href: "/lobby", label: "Lobby" },
            { href: "/leaderboard", label: "Leaderboard" },
            { href: "/history", label: "History" },
          ].map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-white transition-colors" style={{ color: "#94A3B8" }}>
              {label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <WalletButton />

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg"
            style={{ color: "#94A3B8" }}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t px-4 py-3 space-y-1" style={{ borderColor: "rgba(255,255,255,0.06)", background: "#111827" }}>
          {[
            { href: "/lobby", label: "Lobby" },
            { href: "/leaderboard", label: "Leaderboard" },
            { href: "/history", label: "History" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="block py-2 px-3 rounded-lg text-sm font-medium hover:bg-white hover:bg-opacity-5 transition-colors"
              style={{ color: "#94A3B8" }}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
