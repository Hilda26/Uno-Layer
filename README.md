# UNO-LAYER

> A GenLayer-refereed multiplayer colour-card game. Players do not just play cards — they settle the game state.

**Internal project name: UNO-LAYER**
For public release, use an original name (e.g. Reverse Layer, LayerFlip, ColorStack).
Not affiliated with Mattel or UNO®.

---

## What UNO-LAYER is

UNO-LAYER is a private-hand multiplayer colour-and-action card game inspired by classic shedding card games. Players join rooms, receive private hands, take turns matching cards by colour, number, or action type, and race to empty their hand first.

- **Supabase** gives the game speed and privacy: realtime rooms, private hands, deck service, chat, profiles, cached state.
- **GenLayer** gives the game truth and settlement: move validation, action effects, turn order, challenge records, winner declaration.
- If Supabase and GenLayer disagree, **GenLayer wins**.

---

## Architecture

```
User / Browser
  → Next.js 16 (App Router, TypeScript, Tailwind CSS)
  → Embedded local browser wallet (AES-256-GCM encrypted key in IndexedDB)
  → genlayer-js 1.1.8 signed GenLayer calls
  → GenLayer Intelligent Contract (Python, py-genlayer)
     → Official match state, move validation, consensus randomness, AI adjudication, winner settlement

User / Browser
  → Supabase (Postgres + Realtime + RLS)
     → Rooms, private hands, deck service, chat, profiles, cached game state
```

### Supabase responsibilities

| Area | Tables |
|------|--------|
| Rooms & matchmaking | `rooms`, `room_players` |
| Private card state | `player_hands`, `draw_decks` |
| Public game cache | `games`, `game_players`, `discard_pile`, `moves` |
| Challenges | `challenges` |
| Chat | `chat_messages` |
| Profiles / leaderboard | `profiles` |
| TX references | `transactions` |

### GenLayer responsibilities

| Responsibility | Contract method |
|----------------|----------------|
| Game creation | `create_game` |
| Player joining | `join_game` |
| Deck commitment | `commit_deck` |
| Hand commitments | `commit_hand` |
| Game start | `start_game` |
| Move validation + action resolution | `submit_card` |
| Draw recording | `record_draw` |
| Pass turn | `pass_turn` |
| Layer call | `call_layer` |
| Consensus shuffle seed | `submit_shuffle_seed`, `request_shuffle_seed` |
| Challenges | `challenge_move`, `resolve_challenge` |
| Consensus Power Shift outcome | `resolve_power_shift` |
| Fair-play review | `judge_fair_play` |
| Winner declaration | `end_game` |

---

## GenLayer Consensus Usage

The reviewed contract is no longer only deterministic. Deterministic code still validates ordinary rule mechanics, but meaningful non-deterministic GenLayer consensus is used for:

- **Deck seeding**: players submit hidden shuffle contributions, then `request_shuffle_seed` combines them with external beacon entropy agreed by validators.
- **Challenge adjudication**: `resolve_challenge` asks validator consensus to review the disputed move record and return a verdict.
- **Power Shift resolution**: `resolve_power_shift` lets consensus choose the wild-card penalty from allowed outcomes instead of hardcoding one deterministic result.
- **Post-game fair-play**: `judge_fair_play` reviews the completed match and returns profile score adjustments.

These results are cached in Supabase so the frontend can show the consensus deck seed, challenge verdicts, Power Shift effects, and fair-play updates in real gameplay.

## MVP Trust Model

For MVP, Supabase privately manages deck order, player hands, draws, and realtime room state. GenLayer verifies public moves, action effects, turn order, hand counts, challenges, and final settlement. Deck and hand commitments are stored for auditability.

```
MVP = GenLayer-refereed private-card multiplayer
      with Supabase-managed hidden hands
      and auditable commitments.
```

**The code is clearly marked where the MVP trust boundary is.** Private hands are not stored on GenLayer — only hand count and commitment hash are on-chain. Full card ownership proofs require a later upgrade.

---

## Card System

| Card | Effect |
|------|--------|
| Red/Blue/Green/Yellow 0–9 | Number cards, match by colour or number |
| Flip Direction | Reverses turn order (2-player: extra turn) |
| Block Turn | Next player loses their turn |
| Pull Two | Next player draws 2 and loses turn |
| Colour Shift (wild) | Player chooses active colour |
| Power Shift (wild) | Player chooses colour; next player draws 4 and loses turn |

Deck: 108 cards total (1×0 + 2×1-9 + 2×Flip + 2×Block + 2×Pull per colour + 4×Colour Shift + 4×Power Shift).

---

## Setup Instructions

### 1. Clone and install

```bash
git clone <your-repo>
cd UNO-LAYER
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=61999
```

### 3. Supabase migration

Run the SQL in `supabase/migrations/001_initial_schema.sql`, then `supabase/migrations/002_consensus_features.sql`, in your Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).

Or with the Supabase CLI:

```bash
supabase db push
```

### 4. GenLayer contract deployment

1. Install GenLayer Studio or connect to Studionet.
2. Open `contracts/genlayer/uno_layer.py`.
3. Deploy via GenLayer Studio UI or CLI:

```bash
genlayer deploy contracts/genlayer/uno_layer.py
```

4. Copy the deployed contract address to `NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS`.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Build for production

```bash
npm run build
npm start
```

Next.js 16 uses Turbopack by default. This project uses the documented `next build --webpack` production path because it is currently more reliable on this Windows workspace. Build output is written to `.next-build`; set `NEXT_DIST_DIR` if you need an isolated verification directory.

---

## Project Structure

```
UNO-LAYER/
├── app/
│   ├── page.tsx                  # Landing page
│   ├── lobby/page.tsx            # Room creation / joining
│   ├── game/[gameId]/page.tsx    # Main game table
│   ├── leaderboard/page.tsx
│   ├── history/page.tsx
│   ├── profile/[wallet]/page.tsx
│   └── api/
│       ├── rooms/                # Room CRUD
│       ├── games/[gameId]/       # Game state
│       ├── hands/[gameId]/       # Private hand fetch (server-side)
│       ├── cards/deal            # Deal + GenLayer commit
│       ├── cards/draw            # Draw card + GenLayer record
│       ├── cards/apply-action    # Play card + GenLayer submit_card
│       ├── genlayer/sync-game    # Sync GenLayer → Supabase
│       ├── genlayer/record-tx    # Record TX hash
│       └── leaderboard/          # Leaderboard fetch
├── components/
│   ├── cards/                    # All game UI components
│   ├── lobby/                    # Room cards, create modal
│   ├── wallet/                   # WalletConnectButton
│   └── layout/                   # Navbar, Providers
├── lib/
│   ├── supabase/                 # client / server / admin
│   ├── genlayer/                 # genlayer-js contract call wrappers
│   ├── cards/deck.ts             # Deck builder, shuffle, isPlayable
│   └── crypto/commitment.ts      # SHA-256 commitments
├── store/
│   ├── gameStore.ts              # Zustand game state
│   └── walletStore.ts            # Wallet/username persistence
├── types/index.ts                # All TypeScript types
├── contracts/genlayer/
│   └── uno_layer.py              # Python GenLayer contract
└── supabase/migrations/
    └── 001_initial_schema.sql    # Full DB schema + RLS + realtime
```

---

## Known Limitations (MVP)

1. **Private hand trust**: Hands are stored in Supabase, not provably committed on-chain. GenLayer validates hand counts and commitments but cannot independently verify card contents without a commit-reveal scheme.
2. **GenLayer RPC**: `lib/genlayer/client.ts` uses `genlayer-js@1.1.8` first, with a JSON-RPC fallback for local/dev continuity. Configure `NEXT_PUBLIC_GENLAYER_RPC_URL` and `NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS` for live validation.
3. **No turn timer enforcement**: Turn timers are UI-side only in MVP.
4. **Stacking not implemented**: Pull Two / Power Shift stacking is a future rules mode.
5. **Layer! call**: Automatic badge shown at 1 card. Manual call + challenge penalty is Phase 2.
6. **No deck reshuffling**: When draw pile runs out, reshuffling discard pile is not yet implemented.

---

## Future Upgrade Path

| Feature | Description |
|---------|-------------|
| Commit-reveal hands | Zero-knowledge hand proofs via GenLayer LLM verification |
| Encrypted hands | Client-side encryption before Supabase storage |
| Multi-party shuffle | Provably fair deck generation |
| AI opponent | GenLayer LLM-powered AI player |
| Tournament mode | Bracket-based tournament rooms |
| Wager mode | Token stakes on game outcome |
| Anti-cheat proofs | Full card ownership proofs on-chain |
| Mobile app | React Native port |
| Stacking rules | Pull Two / Power Shift stack mode |
| Blitz mode | Per-turn countdown with auto-pass |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, TypeScript, Tailwind CSS v4 |
| Wallet | Embedded browser wallet, AES-256-GCM, PBKDF2, IndexedDB, viem account helpers |
| State | Zustand, TanStack Query |
| Animations | Framer Motion |
| Database | Supabase Postgres, Realtime, RLS |
| Contract | Python GenLayer Intelligent Contract (py-genlayer), genlayer-js 1.1.8 client |
| Commitment | SHA-256 for commitments/checks only; AES-256-GCM for private-key encryption |
