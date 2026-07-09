// Matches contract: create_game mode validation ["classic", "quick", "private", "ranked"]
export type GameMode = "classic" | "quick" | "private" | "ranked";

export type GameStatus =
  | "waiting"
  | "dealing"
  | "active"
  | "challenge_pending"
  | "completed"
  | "cancelled";

export type Direction = "clockwise" | "counterclockwise";

export type CardColour = "red" | "blue" | "green" | "yellow" | "wild";

export type CardKind =
  | "number"
  | "flip_direction"
  | "block_turn"
  | "pull_two"
  | "colour_shift"
  | "power_shift";

export type UnoLayerCard = {
  id: string;
  colour: CardColour;
  kind: CardKind;
  value?: number;
  label: string;
};

export type PlayerState = {
  walletAddress: string;
  seatIndex: number;
  handCount: number;
  isConnected: boolean;
  hasCalledLayer: boolean;
};

export type GameState = {
  gameId: string;
  genlayerGameId: string;
  status: GameStatus;
  mode: GameMode;
  players: PlayerState[];
  currentTurnWallet: string;
  direction: Direction;
  activeColour: CardColour;
  activeDiscard: UnoLayerCard;
  handCounts: Record<string, number>;
  moveCount: number;
  drawPileRemaining: number;
  winnerWallet?: string;
  deckSeed?: string;
  deckEntropy?: string;
};

export type MoveRecord = {
  id: string;
  gameId: string;
  moveNumber: number;
  playerWallet: string;
  card: UnoLayerCard | null;
  declaredColour?: CardColour;
  actionEffect?: string;
  newDirection?: Direction;
  nextTurnWallet?: string;
  drawCount?: number;
  handCommitmentAfter: string;
  handCountAfter: number;
  powerShiftEffect?: string;
  powerShiftTarget?: string;
  txHash?: string;
  createdAt: string;
};

export type ChallengeRecord = {
  id: string;
  gameId: string;
  challengerWallet: string;
  targetMoveNumber: number;
  reason: string;
  status: "pending" | "resolved" | "dismissed";
  resolution?: string;
  genlayerVerdict?: string;
  penaltyPlayer?: string;
  createdAt: string;
};

export type Room = {
  id: string;
  roomCode: string;
  creatorWallet: string;
  maxPlayers: number;
  mode: GameMode;
  status: "waiting" | "dealing" | "active" | "completed" | "cancelled";
  genlayerGameId?: string;
  currentPlayers: number;
  isPrivate: boolean;
  turnSeconds: number;
  createdAt: string;
};

export type RoomPlayer = {
  id: string;
  roomId: string;
  walletAddress: string;
  seatIndex: number;
  isReady: boolean;
  joinedAt: string;
};

export type Profile = {
  id: string;
  walletAddress: string;
  username?: string;
  avatarUrl?: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  totalRounds: number;
  cardsPlayed: number;
  actionCardsPlayed: number;
  challengesWon: number;
  challengesLost: number;
  fairPlayScore: number;
  createdAt: string;
};

export type TransactionRecord = {
  id: string;
  gameId: string;
  txHash: string;
  method: string;
  playerWallet: string;
  status: "pending" | "confirmed" | "failed";
  payload?: Record<string, unknown>;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  walletAddress: string;
  username?: string;
  message: string;
  createdAt: string;
};

export type LeaderboardEntry = {
  walletAddress: string;
  username?: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number;
  cardsPlayed: number;
  actionCardsPlayed: number;
  challengesWon: number;
  challengesLost: number;
  fairPlayScore: number;
};

export type MatchHistory = {
  id: string;
  genlayerGameId: string;
  roomId?: string;
  status: GameStatus;
  mode: GameMode;
  players: string[];
  winnerWallet?: string;
  moveCount: number;
  createdAt: string;
  updatedAt: string;
  lastTxHash?: string;
};
