-- ════════════════════════════════════════════════════════════════
-- $PKMN on Base — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

-- ── Holders / Trainers ───────────────────────────────────────────
create table if not exists holders (
  wallet              text primary key,
  balance             text not null default '0',        -- raw hex/decimal string
  balance_formatted   numeric not null default 0,       -- human readable
  seconds_held        integer not null default 0,
  pokemon_id          integer not null default 1,
  evolution_level     smallint not null default 1,
  score               bigint not null default 0,
  effective_multiplier numeric not null default 1,
  share_pct           numeric not null default 0,
  estimated_payout_usd numeric not null default 0,
  total_eth_earned    numeric not null default 0,
  callout_verified    boolean not null default false,
  updated_at          timestamptz not null default now()
);

create index if not exists holders_score_idx on holders (score desc);
create index if not exists holders_balance_idx on holders (balance_formatted desc);

-- ── Vault Rounds ─────────────────────────────────────────────────
create table if not exists vault_rounds (
  id                  bigserial primary key,
  starts_at           timestamptz not null default now(),
  ends_at             timestamptz not null,
  total_eth           numeric not null default 0,
  total_usd           numeric not null default 0,
  status              text not null default 'active'
                        check (status in ('active', 'settling', 'settled')),
  shifts_completed    integer not null default 0
);

create index if not exists vault_rounds_status_idx on vault_rounds (status);

-- ── Payouts ──────────────────────────────────────────────────────
create table if not exists payouts (
  id          bigserial primary key,
  wallet      text not null references holders(wallet),
  round_id    bigint not null references vault_rounds(id),
  share_pct   numeric not null default 0,
  amount_eth  numeric not null default 0,
  amount_usd  numeric not null default 0,
  won_at      timestamptz not null default now()
);

create index if not exists payouts_wallet_idx on payouts (wallet);
create index if not exists payouts_round_idx on payouts (round_id);
create index if not exists payouts_won_at_idx on payouts (won_at desc);

-- ── Enable Row Level Security ─────────────────────────────────────
alter table holders enable row level security;
alter table vault_rounds enable row level security;
alter table payouts enable row level security;

-- Public read access (anyone can see the leaderboard)
create policy "public read holders"
  on holders for select using (true);

create policy "public read vault_rounds"
  on vault_rounds for select using (true);

create policy "public read payouts"
  on payouts for select using (true);

-- Only service role can write (via API routes with service key)
-- No additional write policies needed for anon/authenticated role

-- ── Realtime ─────────────────────────────────────────────────────
-- Enable realtime for live leaderboard updates
-- In Supabase dashboard: Database → Replication → add holders, vault_rounds, payouts

-- ════════════════════════════════════════════════════════════════
-- Vault settlement function (called by cron / Edge Function)
-- ════════════════════════════════════════════════════════════════
create or replace function settle_vault(p_round_id bigint)
returns void
language plpgsql
security definer
as $$
declare
  v_round       vault_rounds%rowtype;
  v_total_score bigint;
  v_holder      holders%rowtype;
  v_share       numeric;
begin
  -- Get round
  select * into v_round from vault_rounds where id = p_round_id;
  if not found or v_round.status != 'settling' then
    raise exception 'Round % not in settling state', p_round_id;
  end if;

  -- Get total score
  select coalesce(sum(score), 0) into v_total_score from holders where balance_formatted > 0;
  if v_total_score = 0 then
    -- Nobody to pay, just settle
    update vault_rounds set status = 'settled' where id = p_round_id;
    return;
  end if;

  -- Distribute payouts
  for v_holder in
    select * from holders where balance_formatted > 0 and score > 0
  loop
    v_share := (v_holder.score::numeric / v_total_score::numeric) * 100;

    insert into payouts (wallet, round_id, share_pct, amount_eth, amount_usd, won_at)
    values (
      v_holder.wallet,
      p_round_id,
      v_share,
      (v_share / 100) * v_round.total_eth,
      (v_share / 100) * v_round.total_usd,
      now()
    );

    -- Update total earned
    update holders
    set
      total_eth_earned = total_eth_earned + (v_share / 100) * v_round.total_eth,
      estimated_payout_usd = 0  -- reset after payout
    where wallet = v_holder.wallet;
  end loop;

  -- Mark round settled
  update vault_rounds
  set status = 'settled', shifts_completed = shifts_completed + 1
  where id = p_round_id;
end;
$$;

-- ── Agent Strategies ─────────────────────────────────────────────────────────
create table if not exists agent_strategies (
  wallet      text primary key references holders(wallet),
  rules       jsonb not null default '[]',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table agent_strategies enable row level security;

create policy "public read agent_strategies"
  on agent_strategies for select using (true);
create table if not exists trainer_profiles (
  wallet           text primary key references holders(wallet),
  twitter_handle   text,                        -- @username sin el @
  callout_type     text,                        -- 'magic_phrase' | 'own_post' | null
  callout_tweet_url text,                       -- link al tweet enviado
  callout_status   text default 'none'          -- 'none' | 'pending' | 'approved' | 'rejected'
                     check (callout_status in ('none','pending','approved','rejected')),
  callout_multiplier integer default 1,         -- 1=sin bonus, 2=magic phrase, 4=own post
  registered_at    timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table trainer_profiles enable row level security;
create policy "public read trainer_profiles"
  on trainer_profiles for select using (true);
