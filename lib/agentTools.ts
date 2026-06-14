import { getSupabaseAdmin } from "@/lib/supabase";
import { getTokenPrice } from "@/lib/dexscreener";
import { getWalletTokenBalance } from "@/lib/alchemy";
import {
  assignPokemon,
  POKEMON,
  getEvolutionLevel,
  getEvolutionProgress,
  EVOLUTION_THRESHOLDS,
  fmtBalance,
  fmtSeconds,
} from "@/lib/pokemon";

const MINT     = process.env.NEXT_PUBLIC_PKMN_MINT!;
const DECIMALS = 9;

// ─── Tool definitions for Claude API ─────────────────────────────────────────
export const AGENT_TOOLS = [
  {
    name: "get_trainer_status",
    description:
      "Get the current status of a trainer: their $PKMN balance, Pokémon, evolution level, score, rank in the leaderboard, hold time, and estimated payout for the current round.",
    input_schema: {
      type: "object" as const,
      properties: {
        wallet: {
          type: "string",
          description: "The trainer's Solana wallet address (base58 pubkey)",
        },
      },
      required: ["wallet"],
    },
  },
  {
    name: "get_vault_status",
    description:
      "Get the current vault round status: time remaining until payout, total vault size in USD, number of eligible trainers, and the trainer's estimated share.",
    input_schema: {
      type: "object" as const,
      properties: {
        wallet: {
          type: "string",
          description: "Optional wallet to include personal share estimate",
        },
      },
      required: [],
    },
  },
  {
    name: "get_leaderboard",
    description:
      "Get the current top trainers leaderboard. Returns rank, wallet, Pokémon, balance, score and estimated payout for the top holders.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "How many trainers to return (default 10, max 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_token_price",
    description:
      "Get the current $PKMN token price in USD, 24h price change percentage, market cap, and 24h trading volume from DexScreener.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "calculate_swap_needed",
    description:
      "Calculate how many SOL the trainer would need to swap to reach a target evolution level or a target leaderboard rank.",
    input_schema: {
      type: "object" as const,
      properties: {
        wallet: { type: "string", description: "Trainer wallet address (base58)" },
        target_level: { type: "number", description: "Target evolution level (1-5)" },
        target_rank: { type: "number", description: "Target leaderboard rank" },
      },
      required: ["wallet"],
    },
  },
  {
    name: "open_tweet_intent",
    description:
      "Generate a Twitter/X intent URL so the trainer can tweet the magic phrase or a custom $PKMN post to earn their score multiplier bonus.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["magic_phrase", "own_post"],
          description: "Type of tweet: magic_phrase gets ×2, own_post gets ×4",
        },
        magic_phrase: {
          type: "string",
          description: "The current magic phrase to include in the tweet",
        },
        contract_address: {
          type: "string",
          description: "The $PKMN mint address to include",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "open_swap_link",
    description:
      "Generate a swap link so the trainer can buy more $PKMN on Solana to evolve their Pokémon. Returns Jupiter and Raydium swap links.",
    input_schema: {
      type: "object" as const,
      properties: {
        wallet: { type: "string", description: "Trainer wallet address (base58)" },
        sol_amount: {
          type: "number",
          description: "Amount of SOL to swap for $PKMN",
        },
        reason: {
          type: "string",
          description: "Why the trainer should swap (e.g. 'reach LV.3', 'overtake rank #2')",
        },
      },
      required: ["wallet", "sol_amount"],
    },
  },
  {
    name: "check_claimable_payout",
    description:
      "Check if the trainer has any claimable payouts from past vault rounds.",
    input_schema: {
      type: "object" as const,
      properties: {
        wallet: { type: "string", description: "Trainer wallet address (base58)" },
      },
      required: ["wallet"],
    },
  },
] as const;

// ─── Tool executors ───────────────────────────────────────────────────────────
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  switch (toolName) {
    case "get_trainer_status": {
      const wallet = input.wallet as string;

      const { data: holder } = await supabase
        .from("holders")
        .select("*")
        .eq("wallet", wallet)
        .single();

      let onchainBalance = "0";
      try {
        onchainBalance = await getWalletTokenBalance(wallet, MINT);
      } catch {}

      const { data: allHolders } = await supabase
        .from("holders")
        .select("wallet, score")
        .order("score", { ascending: false });

      const rank =
        (allHolders?.findIndex((h) => h.wallet === wallet) ?? -1) + 1;

      const onchainFormatted = Number(onchainBalance) / Math.pow(10, DECIMALS);
      const pokemonId        = assignPokemon(wallet);
      const pk               = POKEMON[pokemonId];
      const level            = holder ? holder.evolution_level : getEvolutionLevel(onchainFormatted);
      const progress         = getEvolutionProgress(holder?.balance_formatted ?? onchainFormatted, level);
      const nextThreshold    = EVOLUTION_THRESHOLDS[level] ?? null;

      return {
        wallet,
        pokemon: pk?.name ?? "Unknown",
        type: pk?.type ?? "?",
        level,
        evolution_progress: `${progress.toFixed(1)}%`,
        next_level_at: nextThreshold ? `${fmtBalance(nextThreshold)} $PKMN` : "MAX",
        balance: fmtBalance(holder?.balance_formatted ?? onchainFormatted),
        balance_formatted: holder?.balance_formatted ?? onchainFormatted,
        onchain_balance: fmtBalance(onchainFormatted),
        hold_time: fmtSeconds(holder?.seconds_held ?? 0),
        score: holder?.score ?? 0,
        rank: rank > 0 ? rank : "Unranked",
        multiplier: holder?.effective_multiplier ?? 1,
        share_pct: holder ? `${Number(holder.share_pct).toFixed(4)}%` : "0%",
        estimated_payout_usd: holder
          ? `$${Number(holder.estimated_payout_usd).toFixed(4)}`
          : "$0",
        callout_verified: holder?.callout_verified ?? false,
      };
    }

    case "get_vault_status": {
      const wallet = input.wallet as string | undefined;

      const { data: round } = await supabase
        .from("vault_rounds")
        .select("*")
        .eq("status", "active")
        .order("id", { ascending: false })
        .limit(1)
        .single();

      const { count } = await supabase
        .from("holders")
        .select("*", { count: "exact", head: true })
        .gt("balance_formatted", 0);

      let personalShare = null;
      if (wallet) {
        const { data: h } = await supabase
          .from("holders")
          .select("share_pct, estimated_payout_usd")
          .eq("wallet", wallet)
          .single();
        if (h) {
          personalShare = {
            share_pct: `${Number(h.share_pct).toFixed(4)}%`,
            estimated_payout_usd: `$${Number(h.estimated_payout_usd).toFixed(4)}`,
          };
        }
      }

      const endsAt     = round ? new Date(round.ends_at) : null;
      const msLeft     = endsAt ? Math.max(0, endsAt.getTime() - Date.now()) : 0;
      const minsLeft   = Math.floor(msLeft / 60000);
      const secsLeft   = Math.floor((msLeft % 60000) / 1000);

      return {
        round_id: round?.id ?? null,
        status: round?.status ?? "none",
        total_sol: round ? Number(round.total_eth).toFixed(4) : "0",
        total_usd: round ? `$${Number(round.total_usd).toFixed(2)}` : "$0",
        payout_percent: "80%",
        time_remaining: round ? `${minsLeft}m ${secsLeft}s` : "N/A",
        eligible_trainers: count ?? 0,
        shifts_completed: round?.shifts_completed ?? 0,
        personal: personalShare,
      };
    }

    case "get_leaderboard": {
      const limit = Math.min(Number(input.limit ?? 10), 20);

      const { data: holders } = await supabase
        .from("holders")
        .select("*")
        .order("score", { ascending: false })
        .limit(limit);

      return {
        leaderboard: (holders ?? []).map((h, i) => {
          const pk = POKEMON[h.pokemon_id];
          return {
            rank: i + 1,
            wallet: `${h.wallet.slice(0, 6)}...${h.wallet.slice(-4)}`,
            pokemon: pk?.name ?? "?",
            level: h.evolution_level,
            balance: fmtBalance(h.balance_formatted),
            multiplier: `×${h.effective_multiplier}`,
            score: h.score,
            estimated_payout: `$${Number(h.estimated_payout_usd).toFixed(4)}`,
          };
        }),
        total_ranked: holders?.length ?? 0,
      };
    }

    case "get_token_price": {
      const price = await getTokenPrice(MINT);
      return {
        price_usd: `$${price.priceUsd.toFixed(8)}`,
        price_change_24h: `${price.priceChange24h.toFixed(2)}%`,
        market_cap: price.marketCapUsd > 0 ? `$${(price.marketCapUsd / 1000).toFixed(1)}K` : "N/A",
        volume_24h: `$${(price.volume24hUsd / 1000).toFixed(1)}K`,
        liquidity: `$${(price.liquidity / 1000).toFixed(1)}K`,
        dex_pair: price.pairAddress,
      };
    }

    case "calculate_swap_needed": {
      const wallet       = input.wallet as string;
      const targetLevel  = input.target_level as number | undefined;
      const targetRank   = input.target_rank as number | undefined;

      const { data: holder } = await supabase
        .from("holders")
        .select("balance_formatted")
        .eq("wallet", wallet)
        .single();

      const currentBalance = Number(holder?.balance_formatted ?? 0);
      const price          = await getTokenPrice(MINT);

      let targetBalance = 0;
      let reason        = "";

      if (targetLevel) {
        targetBalance = EVOLUTION_THRESHOLDS[targetLevel - 1] ?? 0;
        reason        = `reach LV.${targetLevel}`;
      } else if (targetRank) {
        const { data: ranked } = await supabase
          .from("holders")
          .select("balance_formatted")
          .order("score", { ascending: false })
          .range(targetRank - 2, targetRank - 1);
        targetBalance = Number(ranked?.[0]?.balance_formatted ?? 0) + 1;
        reason        = `reach rank #${targetRank}`;
      }

      const needed       = Math.max(0, targetBalance - currentBalance);
      const neededUsd    = needed * price.priceUsd;
      const { getSolPriceUsd } = await import("@/lib/dexscreener");
      const solPrice     = await getSolPriceUsd();
      const neededSol    = solPrice > 0 ? neededUsd / solPrice : 0;

      return {
        current_balance: fmtBalance(currentBalance),
        target_balance: fmtBalance(targetBalance),
        needed_pkmn: fmtBalance(needed),
        needed_usd: `$${neededUsd.toFixed(2)}`,
        needed_sol: `${neededSol.toFixed(4)} SOL`,
        reason,
        pkmn_price: `$${price.priceUsd.toFixed(8)}`,
      };
    }

    case "open_tweet_intent": {
      const MINT_ADDR  = MINT ?? "";
      const type       = input.type as string;
      const phrase     = (input.magic_phrase as string) ?? "gotta catch em all";
      const ca         = (input.contract_address as string) ?? MINT_ADDR;
      const multiplier = type === "own_post" ? 4 : 2;
      const text       = type === "magic_phrase"
        ? `"${phrase}" $PKMN 🎮\n\nCA: ${ca}`
        : `🔥 Holding $PKMN on Solana — Gotta catch em all! 🎮\n\nCA: ${ca}\n\n#PKMN #Solana`;
      const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
      return {
        tweet_url: url,
        multiplier,
        type,
        instructions: `Click this link to tweet and earn your ×${multiplier} score bonus: ${url}\n\nAfter tweeting, submit the tweet URL in the Register section.`,
      };
    }

    case "open_swap_link": {
      const solAmount = Number(input.sol_amount ?? 0.1);
      const reason    = (input.reason as string) ?? "evolve your Pokémon";
      const jupiterUrl = `https://jup.ag/swap/SOL-${MINT}`;
      const raydiumUrl = `https://raydium.io/swap/?inputMint=So11111111111111111111111111111111111111112&outputMint=${MINT}&inputAmount=${solAmount}`;
      return {
        sol_amount: solAmount,
        reason,
        jupiter_url: jupiterUrl,
        raydium_url: raydiumUrl,
        instructions: `To ${reason}:\n👉 Swap on Jupiter (recommended): ${jupiterUrl}\n👉 Or Raydium: ${raydiumUrl}\n\nYour Pokémon will evolve in the next sync (~5 min).`,
      };
    }

    case "check_claimable_payout": {
      const walletAddr = input.wallet as string;
      const { data: payoutsData } = await supabase
        .from("payouts")
        .select("*")
        .eq("wallet", walletAddr)
        .order("won_at", { ascending: false })
        .limit(5);

      const total = (payoutsData ?? []).reduce(
        (sum, p) => sum + Number(p.amount_usd ?? 0),
        0
      );
      return {
        wallet: walletAddr,
        recent_payouts: payoutsData ?? [],
        total_earned_usd: `$${total.toFixed(4)}`,
        count: payoutsData?.length ?? 0,
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
