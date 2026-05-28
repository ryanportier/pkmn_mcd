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

const CONTRACT = process.env.NEXT_PUBLIC_PKMN_CONTRACT!;

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
          description: "The trainer's wallet address (0x...)",
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
      "Calculate how many ETH the trainer would need to swap to reach a target evolution level or a target leaderboard rank.",
    input_schema: {
      type: "object" as const,
      properties: {
        wallet: { type: "string", description: "Trainer wallet address" },
        target_level: {
          type: "number",
          description: "Target evolution level (1-5)",
        },
        target_rank: {
          type: "number",
          description: "Target leaderboard rank (1 = first place)",
        },
      },
      required: ["wallet"],
    },
  },
  {
    name: "save_strategy",
    description:
      "Save a training strategy / set of rules for the trainer. This stores their goals so the agent can monitor and alert them.",
    input_schema: {
      type: "object" as const,
      properties: {
        wallet: { type: "string" },
        rules: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              params: { type: "object" },
              description: { type: "string" },
            },
          },
          description: "Array of strategy rules to save",
        },
      },
      required: ["wallet", "rules"],
    },
  },
  {
    name: "get_payout_history",
    description: "Get the payout history for a specific trainer wallet.",
    input_schema: {
      type: "object" as const,
      properties: {
        wallet: { type: "string" },
        limit: { type: "number", description: "Number of payouts to return (default 5)" },
      },
      required: ["wallet"],
    },
  },
] as const;

// ─── Tool executor ────────────────────────────────────────────────────────────
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  switch (toolName) {
    case "get_trainer_status": {
      const wallet = (input.wallet as string).toLowerCase();

      // Get from Supabase first
      const { data: holder } = await supabase
        .from("holders")
        .select("*")
        .eq("wallet", wallet)
        .single();

      // Also get live onchain balance
      let onchainBalance = "0";
      try {
        onchainBalance = await getWalletTokenBalance(wallet, CONTRACT);
      } catch {}

      // Get rank
      let rank = null;
      if (holder?.score) {
        const { count } = await supabase
          .from("holders")
          .select("*", { count: "exact", head: true })
          .gt("score", holder.score);
        rank = (count ?? 0) + 1;
      }

      const pokemonId = holder?.pokemon_id ?? assignPokemon(wallet);
      const pk = POKEMON[pokemonId];
      const level = holder?.evolution_level ?? 1;
      const balance = holder?.balance_formatted ?? 0;
      const progress = getEvolutionProgress(balance, level);
      const nextThreshold = level < 5 ? EVOLUTION_THRESHOLDS[level] : null;

      return {
        wallet,
        pokemon: {
          name: pk?.name ?? "Unknown",
          type: pk?.type ?? "unknown",
          level,
          evolution_progress_pct: progress.toFixed(1),
          next_evolution_threshold: nextThreshold
            ? fmtBalance(nextThreshold)
            : "MAX LEVEL",
        },
        balance: fmtBalance(balance),
        balance_raw: balance,
        seconds_held: holder?.seconds_held ?? 0,
        hold_time_formatted: fmtSeconds(holder?.seconds_held ?? 0),
        score: holder?.score ?? 0,
        multiplier: holder?.effective_multiplier ?? 1,
        rank,
        share_pct: holder?.share_pct ?? 0,
        estimated_payout_usd: holder?.estimated_payout_usd ?? 0,
        total_eth_earned: holder?.total_eth_earned ?? 0,
        onchain_balance_raw: onchainBalance,
      };
    }

    case "get_vault_status": {
      const wallet = input.wallet
        ? (input.wallet as string).toLowerCase()
        : null;

      const { data: vault } = await supabase
        .from("vault_rounds")
        .select("*")
        .eq("status", "active")
        .order("id", { ascending: false })
        .limit(1)
        .single();

      const { count: totalHolders } = await supabase
        .from("holders")
        .select("*", { count: "exact", head: true })
        .gt("balance_formatted", 0);

      let myShare = null;
      if (wallet) {
        const { data: holder } = await supabase
          .from("holders")
          .select("share_pct, estimated_payout_usd")
          .eq("wallet", wallet)
          .single();
        myShare = holder;
      }

      const endsAt = vault?.ends_at ? new Date(vault.ends_at) : null;
      const msRemaining = endsAt
        ? Math.max(0, endsAt.getTime() - Date.now())
        : null;
      const minutesRemaining = msRemaining
        ? Math.floor(msRemaining / 60000)
        : null;

      return {
        round_id: vault?.id ?? null,
        status: vault?.status ?? "no active round",
        ends_at: vault?.ends_at ?? null,
        minutes_remaining: minutesRemaining,
        total_vault_usd: vault?.total_usd ?? 0,
        total_vault_eth: vault?.total_eth ?? 0,
        total_eligible_trainers: totalHolders ?? 0,
        my_share_pct: myShare?.share_pct ?? null,
        my_estimated_payout_usd: myShare?.estimated_payout_usd ?? null,
      };
    }

    case "get_leaderboard": {
      const limit = Math.min((input.limit as number) ?? 10, 20);

      const { data: holders } = await supabase
        .from("holders")
        .select("*")
        .gt("balance_formatted", 0)
        .order("score", { ascending: false })
        .limit(limit);

      return {
        leaderboard: (holders ?? []).map((h, i) => {
          const pk = POKEMON[h.pokemon_id ?? assignPokemon(h.wallet)];
          return {
            rank: i + 1,
            wallet: h.wallet,
            wallet_short: `${h.wallet.slice(0, 6)}…${h.wallet.slice(-4)}`,
            pokemon: pk?.name ?? "Unknown",
            pokemon_type: pk?.type ?? "unknown",
            level: h.evolution_level,
            balance: fmtBalance(h.balance_formatted),
            score: h.score,
            share_pct: h.share_pct?.toFixed(2),
            estimated_payout_usd: h.estimated_payout_usd?.toFixed(2),
          };
        }),
      };
    }

    case "get_token_price": {
      const price = await getTokenPrice(CONTRACT);
      return {
        price_usd: price.priceUsd,
        price_change_24h_pct: price.priceChange24h,
        market_cap_usd: price.marketCapUsd,
        volume_24h_usd: price.volume24hUsd,
        liquidity_usd: price.liquidity,
        dexscreener_url: price.pairAddress
          ? `https://dexscreener.com/base/${price.pairAddress}`
          : null,
      };
    }

    case "calculate_swap_needed": {
      const wallet = (input.wallet as string).toLowerCase();
      const targetLevel = input.target_level as number | undefined;
      const targetRank = input.target_rank as number | undefined;

      const price = await getTokenPrice(CONTRACT);
      const { data: holder } = await supabase
        .from("holders")
        .select("balance_formatted, evolution_level")
        .eq("wallet", wallet)
        .single();

      const currentBalance = holder?.balance_formatted ?? 0;
      const results: Record<string, unknown> = { current_balance: fmtBalance(currentBalance) };

      if (targetLevel && targetLevel > 1 && targetLevel <= 5) {
        const needed = EVOLUTION_THRESHOLDS[targetLevel - 1];
        const deficit = Math.max(0, needed - currentBalance);
        const ethNeeded =
          price.priceUsd > 0 ? (deficit * price.priceUsd) / 1 : null;
        results.to_reach_level = {
          target_level: targetLevel,
          tokens_needed: fmtBalance(deficit),
          approx_eth_needed: ethNeeded
            ? (ethNeeded / (1 / price.priceUsd)).toFixed(6)
            : "price unavailable",
        };
      }

      if (targetRank) {
        const { data: rankHolder } = await supabase
          .from("holders")
          .select("score, balance_formatted")
          .order("score", { ascending: false })
          .range(targetRank - 1, targetRank - 1)
          .single();

        if (rankHolder) {
          const scoreDeficit = Math.max(0, rankHolder.score - (holder?.balance_formatted ?? 0));
          results.to_reach_rank = {
            target_rank: targetRank,
            their_score: rankHolder.score,
            approx_tokens_needed: fmtBalance(scoreDeficit),
            note: "Estimate based on current scores — hold time also affects score",
          };
        }
      }

      return results;
    }

    case "save_strategy": {
      const wallet = (input.wallet as string).toLowerCase();
      const rules = input.rules as unknown[];

      await supabase.from("agent_strategies").upsert(
        {
          wallet,
          rules: JSON.stringify(rules),
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "wallet" }
      );

      return {
        saved: true,
        wallet,
        rules_count: rules.length,
        message: "Strategy saved. I'll monitor your position according to these rules.",
      };
    }

    case "get_payout_history": {
      const wallet = (input.wallet as string).toLowerCase();
      const limit = Math.min((input.limit as number) ?? 5, 20);

      const { data: payouts } = await supabase
        .from("payouts")
        .select("*")
        .eq("wallet", wallet)
        .order("won_at", { ascending: false })
        .limit(limit);

      const totalEth = (payouts ?? []).reduce(
        (sum, p) => sum + (p.amount_eth ?? 0),
        0
      );

      return {
        payouts: (payouts ?? []).map((p) => ({
          round: p.round_id,
          share_pct: p.share_pct?.toFixed(2),
          eth: p.amount_eth?.toFixed(6),
          usd: p.amount_usd?.toFixed(2),
          date: new Date(p.won_at).toLocaleDateString(),
        })),
        total_eth_earned: totalEth.toFixed(6),
        rounds_won: payouts?.length ?? 0,
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
