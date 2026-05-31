"use client";

interface Props {
  isMyTurn: boolean;
  isSubmitting: boolean;
  hasDrawn: boolean;
  onDraw: () => void;
  onPass: () => void;
  onChallenge: () => void;
}

export default function ActionPanel({ isMyTurn, isSubmitting, hasDrawn, onDraw, onPass, onChallenge }: Props) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {isMyTurn && !hasDrawn && (
        <button
          onClick={onDraw}
          disabled={isSubmitting}
          className="px-5 py-2 rounded-xl font-bold text-sm transition-all hover:scale-105 disabled:opacity-40"
          style={{ background: "rgba(34,211,238,0.15)", color: "#22D3EE", border: "1px solid rgba(34,211,238,0.3)" }}
        >
          Draw Card
        </button>
      )}
      {isMyTurn && hasDrawn && (
        <button
          onClick={onPass}
          disabled={isSubmitting}
          className="px-5 py-2 rounded-xl font-bold text-sm transition-all hover:scale-105 disabled:opacity-40"
          style={{ background: "rgba(148,163,184,0.15)", color: "#94A3B8", border: "1px solid rgba(148,163,184,0.2)" }}
        >
          Pass Turn
        </button>
      )}
      <button
        onClick={onChallenge}
        className="px-5 py-2 rounded-xl font-bold text-sm transition-all hover:scale-105"
        style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.25)" }}
      >
        Challenge
      </button>
    </div>
  );
}
