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

/**
 * Deterministic shuffle driven by the GenLayer consensus deck seed.
 *
 * The seed is a hex string returned by the contract's `request_shuffle_seed`
 * (sha256 of player commitments + game id + non-deterministic external
 * entropy agreed on by validator consensus). Given the same seed, this
 * function always produces the same card order — so the actual deck order,
 * hands, and first discard are tied to the GenLayer consensus result.
 */
export function seededShuffleDeck(deck: UnoLayerCard[], seedHex: string): UnoLayerCard[] {
  const arr = [...deck];
  const rng = mulberry32(seedToUint32(seedHex));

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function seedToUint32(seedHex: string): number {
  const hex = seedHex.startsWith("0x") ? seedHex.slice(2) : seedHex;
  let h = 0 >>> 0;

  for (let i = 0; i < hex.length; i += 8) {
    const chunk = parseInt(hex.slice(i, i + 8) || "0", 16) >>> 0;
    h = (h ^ chunk) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  }

  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
