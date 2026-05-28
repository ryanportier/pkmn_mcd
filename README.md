# $PKMN — Catch. Evolve. Earn.

$PKMN is a meme token on Base (Ethereum L2) that turns holding crypto into a Pokémon game. Every wallet that holds $PKMN gets assigned a starter Pokémon, evolves it by accumulating balance and hold time, competes on a live leaderboard, and earns ETH from a vault that fills with trading fees each round.

The token solves a real problem in meme coin culture: there's no reason to hold. $PKMN creates one — the longer you hold and the more you hold, the stronger your Pokémon and the bigger your cut of the vault. Selling resets your progress. Tweeting about it multiplies your score.

---

## How it works

### 1. Buy $PKMN on Base
Get $PKMN on any Base DEX (Uniswap, Aerodrome). Your wallet address deterministically assigns you one of three starter Pokémon — Bulbasaur, Charmander, or Squirtle — no randomness, no gas, same wallet always gets the same Pokémon.

### 2. Hold to Evolve
Your score grows every 5 minutes the sync runs:

```
score = balance × (seconds_held / 3600) × evolution_multiplier
```

Evolution levels unlock as your balance grows:

| Level | Balance needed | Score multiplier |
|-------|---------------|-----------------|
| LV.1  | Any           | ×1              |
| LV.2  | 1K $PKMN      | ×2              |
| LV.3  | 10K $PKMN     | ×3              |
| LV.4  | 100K $PKMN    | ×4              |
| LV.5  | 1M $PKMN      | ×5              |

Selling drops your balance and **resets your hold time to zero**. The game punishes paper hands.

### 3. Tweet & Boost
Register your wallet (no signature required — just paste your address) and link your X handle. Then tweet to multiply your score:

- **Tweet the magic phrase** → `×2` to your multiplier
- **Post your own call with the CA** → `×4` to your multiplier

Magic phrases rotate every 5 minutes. The boost stacks on top of your evolution level — a LV.3 trainer with an own-post bonus becomes `×3 × 4 = ×12`.

### 4. Earn from the Vault
Every hour, the vault pays out. Trading fees from $PKMN swaps accumulate in the vault wallet. When the countdown hits zero, holders split the vault proportional to their score:

```
your_payout = (your_score / total_scores) × vault_total × 0.80
```

80% goes to holders. The higher your score, the bigger your slice.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, CSS Modules) |
| Database | Supabase (Postgres + Realtime) |
| Blockchain reads | Viem (Base L2 client) |
| Holder indexing | Alchemy (`eth_getLogs` — free tier) |
| Token price | DexScreener API (no key needed) |
| AI Trainer Agent | Bankr LLM Gateway → Claude Sonnet |
| Auth | SIWE (Sign-In With Ethereum) |
| Cron | GitHub Actions (free, every 5 min) |

---

## Project structure

```
app/
├── api/
│   ├── agent/chat/        # Streaming AI agent (Prof Oak)
│   ├── auth/              # SIWE nonce + verify
│   ├── dashboard/         # Main data endpoint (polled every 5s)
│   ├── holders/sync/      # Cron: Alchemy → Supabase
│   ├── trainer/           # Trainer profile + callout submit
│   └── vault/             # Vault round state
├── profile/               # Public trainer profile page
└── trainer/               # Legacy trainer page

components/
├── Hero/                  # Landing hero with CA + magic phrase
├── StarterSelection/      # 3 Pokémon cards with evolution state
├── VaultCountdown/        # Live countdown + evolution table
├── Leaderboard/           # Paginated live rankings (20/page)
├── RegisterTrainer/       # Wallet registration + tweet bonus flow
├── TrainerAgent/          # Prof Oak AI chat (streaming)
├── PriceBar/              # Live price ticker (DexScreener)
├── PayoutsPanel/          # Recent vault distributions
├── Nav/ Footer/           # Navigation with custom logo

lib/
├── alchemy.ts             # eth_getLogs holder scanner
├── agentTools.ts          # Claude tools: balance, leaderboard, vault…
├── pokemon.ts             # Evolution logic, score calc, formatters
├── dexscreener.ts         # Token price fetcher
├── auth.ts                # SIWE + JWT helpers
└── supabase.ts            # Browser + admin clients
```

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Required variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Alchemy (free plan works)
ALCHEMY_API_KEY=
NEXT_PUBLIC_BASE_RPC=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY

# Token contract on Base
NEXT_PUBLIC_PKMN_CONTRACT=0x...

# Auth
JWT_SECRET=                    # openssl rand -hex 32

# Cron auth
CRON_SECRET=                   # any random string
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Vault wallet (where trading fees land)
VAULT_WALLET_ADDRESS=0x...

# AI Agent (Bankr LLM Gateway — covers Claude costs from token fees)
BANKR_API_KEY=bk_...
```

### 3. Database

Run `supabase/schema.sql` in the Supabase SQL Editor. It creates:

- `holders` — wallet balances, hold times, scores, evolution levels
- `vault_rounds` — active round with countdown and vault size
- `payouts` — historical distributions per wallet per round
- `trainer_profiles` — registered wallets, X handles, callout status
- `agent_strategies` — saved trainer strategies for Prof Oak

Enable Realtime on `holders`, `vault_rounds`, `payouts` in Supabase → Database → Replication.

### 4. Run

```bash
npm run dev
```

### 5. First sync

With the dev server running, sync holders from the blockchain:

```bash
$env:CRON_SECRET="your_secret"; $env:NEXT_PUBLIC_APP_URL="http://localhost:3000"; npm run sync-holders
```

Or with lookback control:

```bash
npm run sync-holders -- --lookback 1h   # new token
npm run sync-holders -- --lookback 1d   # default
npm run sync-holders -- --lookback 7d   # established token
```

---

## Automated sync (GitHub Actions)

The sync runs every 5 minutes via `.github/workflows/sync-holders.yml`. No Vercel Pro required.

Add two secrets to your GitHub repo (**Settings → Secrets and variables → Actions**):

| Secret | Value |
|---|---|
| `APP_URL` | `https://your-production-domain.vercel.app` |
| `CRON_SECRET` | same value as in your `.env.local` |

The workflow calls `POST /api/holders/sync` on schedule. Each run:
1. Scans `eth_getLogs` for Transfer events on your contract
2. Checks current balance of every address that ever received tokens
3. Increments hold time for wallets that haven't sold
4. Resets hold time for wallets that dropped below 99% of previous balance
5. Recalculates scores, shares, and estimated payouts
6. Reads your vault wallet ETH balance via Alchemy and updates the vault round
7. Applies tweet bonus multipliers from approved callouts

---

## Approving tweet bonuses

When a trainer submits a tweet for review, `trainer_profiles.callout_status` becomes `'pending'`. To approve manually in Supabase SQL Editor:

```sql
-- Magic phrase tweet (×2)
UPDATE trainer_profiles
SET callout_status = 'approved', callout_multiplier = 2
WHERE twitter_handle = 'theirhandle';

-- Own post with CA (×4)
UPDATE trainer_profiles
SET callout_status = 'approved', callout_multiplier = 4
WHERE twitter_handle = 'theirhandle';
```

The multiplier activates on the next sync run.

---

## Prof Oak — AI Trainer Agent

Prof Oak is an in-app AI agent powered by Claude via Bankr LLM Gateway. He reads real on-chain data through tools and answers questions about the trainer's position in character.

Available tools:
- `get_trainer_status` — balance, evolution level, score, rank, hold time
- `get_vault_status` — time remaining, vault size, estimated payout
- `get_leaderboard` — top N trainers by score
- `get_token_price` — live price from DexScreener
- `calculate_swap_needed` — ETH needed to reach a target level or rank
- `save_strategy` — store trainer goals in Supabase
- `get_payout_history` — all-time earnings for a wallet

Oak streams responses in real time. The Bankr LLM Gateway lets token trading fees fund the compute cost automatically.

---

## Deploying to Vercel

```bash
vercel --prod
```

Add all `.env.local` variables to **Vercel → Settings → Environment Variables**. The `vercel.json` is intentionally empty — no Vercel cron jobs (Hobby plan limitation). Use GitHub Actions instead.

---

## Vault settlement

The vault settlement function (`settle_vault()`) is defined in `supabase/schema.sql`. It distributes the vault pro-rata by score when called. In production, trigger it via a Supabase Edge Function or a second GitHub Action workflow scheduled at the end of each round.

---

## Key formulas

```
# Score
score = balance × (seconds_held / 3600) × (evolution_level × callout_multiplier)

# Share
share_pct = score / sum(all_scores) × 100

# Estimated payout
est_payout = (share_pct / 100) × vault_total_usd × 0.80

# Evolution threshold
LV.2 = 1,000    LV.3 = 10,000    LV.4 = 100,000    LV.5 = 1,000,000
```

---

## Disclaimer

$PKMN is a meme token created for entertainment. Nothing in this project constitutes financial advice. Never invest more than you can afford to lose.
