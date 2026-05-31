import type { UnoLayerCard } from "@/types";

async function sha256(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeDeckCommitment(
  deck: UnoLayerCard[],
  secret: string
): Promise<string> {
  const payload = JSON.stringify(deck.map((c) => c.id)) + secret;
  return "0x" + (await sha256(payload));
}

export async function computeHandCommitment(
  walletAddress: string,
  cards: UnoLayerCard[],
  version: number,
  secret: string
): Promise<string> {
  const payload =
    walletAddress + JSON.stringify(cards.map((c) => c.id)) + version + secret;
  return "0x" + (await sha256(payload));
}

export function generateSecret(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
