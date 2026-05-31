import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/layout/Providers";
import Navbar from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "UNO-LAYER | GenLayer Card Game",
  description:
    "Multiplayer colour-card game where Supabase gives speed and privacy, GenLayer gives truth and settlement.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className="min-h-full flex flex-col"
        style={{ background: "#0B0F14", color: "#F8FAFC" }}
      >
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
