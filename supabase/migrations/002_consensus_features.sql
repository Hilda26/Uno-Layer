-- UNO-LAYER Consensus Features Migration
-- Adds GenLayer consensus shuffle, AI challenge referee, consensus power
-- shift, and post-game fair-play judge support.

-- Deck seed produced by GenLayer consensus (request_shuffle_seed) and the
-- external entropy source it was derived from.
alter table games add column if not exists deck_seed text;
alter table games add column if not exists deck_entropy text;
alter table games add column if not exists fair_play_judged boolean not null default false;

-- Track AI referee verdicts for challenges raised during a game.
alter table challenges add column if not exists genlayer_verdict text;
alter table challenges add column if not exists penalty_player text;

-- Consensus Wild Power Card: the effect GenLayer chose for a Power Shift play.
alter table moves add column if not exists power_shift_effect text;
alter table moves add column if not exists power_shift_target text;

-- Track per-game fair-play score adjustments returned by judge_fair_play.
create table if not exists fair_play_adjustments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  wallet_address text not null,
  adjustment integer not null,
  created_at timestamptz not null default now(),
  unique(game_id, wallet_address)
);

alter table fair_play_adjustments enable row level security;
create policy "fair_play_adjustments_read" on fair_play_adjustments for select using (true);
create policy "fair_play_adjustments_service_write" on fair_play_adjustments for all using (true);

-- Apply a fair-play score adjustment to a player's profile, clamped to [0, 200].
create or replace function apply_fair_play_adjustment(p_wallet text, p_adjustment integer)
returns void language plpgsql as $$
begin
  update profiles
  set fair_play_score = greatest(0, least(200, fair_play_score + p_adjustment)),
      updated_at = now()
  where wallet_address = p_wallet;
end;
$$;
