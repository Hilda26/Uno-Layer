"use client";

import { create } from "zustand";
import type {
  GameState,
  UnoLayerCard,
  MoveRecord,
  ChallengeRecord,
  ChatMessage,
  CardColour,
} from "@/types";

interface GameStore {
  gameState: GameState | null;
  myHand: UnoLayerCard[];
  selectedCard: UnoLayerCard | null;
  moveHistory: MoveRecord[];
  challenges: ChallengeRecord[];
  chatMessages: ChatMessage[];
  showColourPicker: boolean;
  showChallenge: boolean;
  showWinner: boolean;
  pendingCard: UnoLayerCard | null;
  lastTxHash: string | null;
  isSubmitting: boolean;

  setGameState: (state: GameState) => void;
  setMyHand: (hand: UnoLayerCard[]) => void;
  setSelectedCard: (card: UnoLayerCard | null) => void;
  addMove: (move: MoveRecord) => void;
  setMoveHistory: (moves: MoveRecord[]) => void;
  addChallenge: (c: ChallengeRecord) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setChatMessages: (msgs: ChatMessage[]) => void;
  openColourPicker: (card: UnoLayerCard) => void;
  closeColourPicker: () => void;
  openChallenge: () => void;
  closeChallenge: () => void;
  closeWinner: () => void;
  setLastTxHash: (hash: string) => void;
  setSubmitting: (v: boolean) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  myHand: [],
  selectedCard: null,
  moveHistory: [],
  challenges: [],
  chatMessages: [],
  showColourPicker: false,
  showChallenge: false,
  showWinner: false,
  pendingCard: null,
  lastTxHash: null,
  isSubmitting: false,

  setGameState: (state) =>
    set({ gameState: state, showWinner: !!state.winnerWallet }),
  setMyHand: (hand) => set({ myHand: hand }),
  setSelectedCard: (card) => set({ selectedCard: card }),
  addMove: (move) =>
    set((s) => ({ moveHistory: [move, ...s.moveHistory].slice(0, 50) })),
  setMoveHistory: (moves) => set({ moveHistory: moves }),
  addChallenge: (c) =>
    set((s) => ({ challenges: [c, ...s.challenges].slice(0, 20) })),
  addChatMessage: (msg) =>
    set((s) => ({ chatMessages: [...s.chatMessages, msg].slice(-100) })),
  setChatMessages: (msgs) => set({ chatMessages: msgs }),
  openColourPicker: (card) =>
    set({ showColourPicker: true, pendingCard: card }),
  closeColourPicker: () =>
    set({ showColourPicker: false, pendingCard: null }),
  openChallenge: () => set({ showChallenge: true }),
  closeChallenge: () => set({ showChallenge: false }),
  closeWinner: () => set({ showWinner: false }),
  setLastTxHash: (hash) => set({ lastTxHash: hash }),
  setSubmitting: (v) => set({ isSubmitting: v }),
  reset: () =>
    set({
      gameState: null,
      myHand: [],
      selectedCard: null,
      moveHistory: [],
      challenges: [],
      chatMessages: [],
      showColourPicker: false,
      showChallenge: false,
      showWinner: false,
      pendingCard: null,
      lastTxHash: null,
      isSubmitting: false,
    }),
}));
