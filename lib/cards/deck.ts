import type { UnoLayerCard, CardColour, CardKind } from "@/types";

const COLOURS: CardColour[] = ["red", "blue", "green", "yellow"];

function makeId(colour: string, kind: string, suffix: string) {
  return `${colour}_${kind}_${suffix}`;
}

export function buildDeck(): UnoLayerCard[] {
  const deck: UnoLayerCard[] = [];

  for (const colour of COLOURS) {
    // 0 card
    deck.push({
      id: makeId(colour, "0", "a"),
      colour,
      kind: "number",
      value: 0,
      label: `${capitalise(colour)} 0`,
    });

    // 1-9 x2
    for (let v = 1; v <= 9; v++) {
      for (const s of ["a", "b"]) {
        deck.push({
          id: makeId(colour, String(v), s),
          colour,
          kind: "number",
          value: v,
          label: `${capitalise(colour)} ${v}`,
        });
      }
    }

    // Action cards x2 each
    const actions: { kind: CardKind; label: string }[] = [
      { kind: "flip_direction", label: "Flip Direction" },
      { kind: "block_turn", label: "Block Turn" },
      { kind: "pull_two", label: "Pull Two" },
    ];
    for (const action of actions) {
      for (const s of ["a", "b"]) {
        deck.push({
          id: makeId(colour, action.kind, s),
          colour,
          kind: action.kind,
          label: `${capitalise(colour)} ${action.label}`,
        });
      }
    }
  }

  // Wild cards x4 each
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: `wild_colour_shift_${i}`,
      colour: "wild",
      kind: "colour_shift",
      label: "Colour Shift",
    });
    deck.push({
      id: `wild_power_shift_${i}`,
      colour: "wild",
      kind: "power_shift",
      label: "Power Shift",
    });
  }

  return deck;
}

export function shuffleDeck(deck: UnoLayerCard[]): UnoLayerCard[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function isPlayable(
  card: UnoLayerCard,
  activeColour: CardColour,
  activeDiscard: UnoLayerCard
): boolean {
  if (card.colour === "wild") return true;
  if (card.colour === activeColour) return true;
  if (card.kind === "number" && activeDiscard.kind === "number") {
    return card.value === activeDiscard.value;
  }
  if (card.kind !== "number" && activeDiscard.kind !== "number") {
    return card.kind === activeDiscard.kind;
  }
  return false;
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function getFirstValidDiscard(deck: UnoLayerCard[]): {
  card: UnoLayerCard;
  remaining: UnoLayerCard[];
} {
  const idx = deck.findIndex((c) => c.colour !== "wild");
  const card = deck[idx];
  const remaining = [...deck.slice(0, idx), ...deck.slice(idx + 1)];
  return { card, remaining };
}
