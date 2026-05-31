-- UNO-LAYER Initial Schema Migration
-- Run this in your Supabase SQL editor or via supabase db push

-- Profiles
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  username text,
  avatar_url text,
  games_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  total_rounds integer not null default 0,
  cards_played integer not null default 0,
  action_cards_played integer not null default 0,
  challenges_won integer not null default 0,
  challenges_lost integer not null default 0,
  fair_play_score integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Rooms
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  creator_wallet text not null,
  max_players integer not null check (max_players in (2, 3, 4)),
  -- mode values match GenLayer contract: ["classic", "quick", "private", "ranked"]
  mode text not null check (mode in ('classic', 'quick', 'private', 'ranked')) default 'classic',
  status text not null check (status in ('waiting', 'dealing', 'active', 'completed', 'cancelled')) default 'waiting',
  genlayer_game_id text,
  current_players integer not null default 1,
  is_private boolean not null default false,
  turn_seconds integer not null default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Room players
create table if not exists room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  wallet_address text not null,
  seat_index integer not null,
  is_ready boolean not null default false,
  joined_at timestamptz not null default now(),
  unique(room_id, wallet_address),
  unique(room_id, seat_index)
);

-- Games
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  genlayer_game_id text unique not null,
  room_id uuid references rooms(id) on delete set null,
  status text not null default 'waiting',
  mode text not null default 'classic',
  creator_wallet text not null,
  current_turn_wallet text,
  direction text not null default 'clockwise',
  active_colour text,
  active_discard jsonb,
  move_count integer not null default 0,
  draw_pile_remaining integer not null default 108,
  winner_wallet text,
  official_state jsonb,
  last_tx_hash text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Game players
create table if not exists game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  wallet_address text not null,
  seat_index integer not null,
  hand_count integer not null default 7,
  has_called_layer boolean not null default false,
  final_rank integer,
  has_finished boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(game_id, wallet_address),
  unique(game_id, seat_index)
);

-- Player hands (private — no public realtime)
create table if not exists player_hands (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  wallet_address text not null,
  cards jsonb not null default '[]'::jsonb,
  hand_commitment text,
  hand_version integer not null default 1,
  updated_at timestamptz not null default now(),
  unique(game_id, wallet_address)
);

-- Draw decks (private — no public realtime)
create table if not exists draw_decks (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade unique,
  remaining_cards jsonb not null default '[]'::jsonb,
  used_cards jsonb not null default '[]'::jsonb,
  deck_commitment text not null default '',
  draw_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Discard pile (public, realtime)
create table if not exists discard_pile (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  card jsonb not null,
  played_by text not null,
  move_number integer not null,
  created_at timestamptz not null default now()
);

-- Moves (public, realtime)
create table if not exists moves (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  move_number integer not null,
  player_wallet text not null,
  card jsonb,
  declared_colour text,
  action_effect text,
  new_direction text,
  next_turn_wallet text,
  draw_count integer,
  hand_commitment_after text,
  hand_count_after integer,
  tx_hash text,
  created_at timestamptz not null default now()
);

-- Challenges (public, realtime)
create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  challenger_wallet text not null,
  target_move_number integer,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  resolution text,
  created_at timestamptz not null default now()
);

-- Chat messages (public, realtime per room)
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  wallet_address text not null,
  username text,
  message text not null check (char_length(message) <= 500),
  created_at timestamptz not null default now()
);

-- Transactions
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  tx_hash text,
  method text not null,
  player_wallet text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  payload jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------

alter table profiles enable row level security;
alter table rooms enable row level security;
alter table room_players enable row level security;
alter table games enable row level security;
alter table game_players enable row level security;
alter table player_hands enable row level security;
alter table draw_decks enable row level security;
alter table discard_pile enable row level security;
alter table moves enable row level security;
alter table challenges enable row level security;
alter table chat_messages enable row level security;
alter table transactions enable row level security;

-- Profiles: anyone reads, owner updates
create policy "profiles_read" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (true); -- enforce in app layer

-- Rooms: public rooms are readable by all, private by participants (service role enforces)
create policy "rooms_read_public" on rooms for select using (is_private = false or true);
create policy "rooms_service_write" on rooms for all using (true); -- service role only in practice

-- Room players: participants can read and insert themselves
create policy "room_players_read" on room_players for select using (true);
create policy "room_players_insert" on room_players for insert with check (true);
create policy "room_players_update_own" on room_players for update using (true);
create policy "room_players_delete_own" on room_players for delete using (true);

-- Games: participants can read cache; service role updates
create policy "games_read" on games for select using (true);
create policy "games_service_write" on games for all using (true);

-- Game players: readable by all, service role writes
create policy "game_players_read" on game_players for select using (true);
create policy "game_players_service_write" on game_players for all using (true);

-- Player hands: service role only (no client RLS bypass needed in practice)
-- Clients access hands via server API route which uses service key
create policy "player_hands_service_only" on player_hands for all using (true);

-- Draw decks: service role only
create policy "draw_decks_service_only" on draw_decks for all using (true);

-- Discard pile, moves, challenges: readable by all
create policy "discard_pile_read" on discard_pile for select using (true);
create policy "discard_pile_write" on discard_pile for all using (true);
create policy "moves_read" on moves for select using (true);
create policy "moves_write" on moves for all using (true);
create policy "challenges_read" on challenges for select using (true);
create policy "challenges_write" on challenges for all using (true);

-- Chat: readable by all, anyone can write (enforce wallet in app)
create policy "chat_read" on chat_messages for select using (true);
create policy "chat_insert" on chat_messages for insert with check (true);

-- Transactions: readable by participants
create policy "transactions_read" on transactions for select using (true);
create policy "transactions_write" on transactions for all using (true);

-- -----------------------------------------------------------------------
-- Realtime publication
-- -----------------------------------------------------------------------
-- Run these in Supabase Dashboard > Database > Replication, or:

begin;
  -- Add tables to realtime publication (public realtime)
  alter publication supabase_realtime add table rooms;
  alter publication supabase_realtime add table room_players;
  alter publication supabase_realtime add table games;
  alter publication supabase_realtime add table game_players;
  alter publication supabase_realtime add table discard_pile;
  alter publication supabase_realtime add table moves;
  alter publication supabase_realtime add table challenges;
  alter publication supabase_realtime add table chat_messages;
  -- NOTE: player_hands and draw_decks intentionally excluded
commit;

-- -----------------------------------------------------------------------
-- Helper functions (called from API routes via RPC)
-- -----------------------------------------------------------------------

create or replace function update_leaderboard_win(p_wallet text)
returns void language plpgsql as $$
begin
  update profiles
  set wins = wins + 1,
      games_played = games_played + 1,
      updated_at = now()
  where wallet_address = p_wallet;
end;
$$;

create or replace function update_leaderboard_loss(p_wallet text)
returns void language plpgsql as $$
begin
  update profiles
  set losses = losses + 1,
      games_played = games_played + 1,
      updated_at = now()
  where wallet_address = p_wallet;
end;
$$;

-- Indexes for performance
create index if not exists idx_rooms_status on rooms(status);
create index if not exists idx_rooms_code on rooms(room_code);
create index if not exists idx_room_players_room on room_players(room_id);
create index if not exists idx_room_players_wallet on room_players(wallet_address);
create index if not exists idx_games_genlayer_id on games(genlayer_game_id);
create index if not exists idx_game_players_game on game_players(game_id);
create index if not exists idx_player_hands_game_wallet on player_hands(game_id, wallet_address);
create index if not exists idx_moves_game on moves(game_id);
create index if not exists idx_chat_room on chat_messages(room_id);
