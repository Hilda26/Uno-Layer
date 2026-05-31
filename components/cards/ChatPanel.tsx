"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/types";

interface Props {
  roomId: string;
  walletAddress: string;
  messages: ChatMessage[];
}

export default function ChatPanel({ roomId, walletAddress, messages }: Props) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    await supabase.from("chat_messages").insert({
      room_id: roomId,
      wallet_address: walletAddress,
      message: text,
    });
    setInput("");
    setSending(false);
  };

  return (
    <div className="glass rounded-xl p-3 flex flex-col h-full">
      <h3 className="text-sm font-black mb-2" style={{ color: "#22D3EE" }}>Chat</h3>
      <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin mb-2" style={{ minHeight: "100px" }}>
        {messages.map((m) => (
          <div key={m.id} className="text-xs">
            <span className="font-mono" style={{ color: "#22D3EE" }}>
              {m.walletAddress.slice(0, 6)}…
            </span>
            {m.walletAddress.toLowerCase() === walletAddress.toLowerCase() && (
              <span className="ml-1 text-xs" style={{ color: "#FF5A3D" }}>(you)</span>
            )}
            <span className="ml-1" style={{ color: "#F8FAFC" }}>{m.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Message…"
          className="flex-1 px-2 py-1.5 rounded-lg text-xs"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#F8FAFC", outline: "none" }}
          maxLength={200}
        />
        <button
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 disabled:opacity-40"
          style={{ background: "#FF5A3D", color: "white" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
