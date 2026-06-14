import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAllHolders, getVaultWalletInfo } from "@/lib/alchemy";
import { getSolPriceUsd } from "@/lib/dexscreener";
import { assignPokemon, getEvolutionLevel, calcScore } from "@/lib/pokemon";

const MINT         = process.env.NEXT_PUBLIC_PKMN_MINT!;
const VAULT_WALLET = process.env.VAULT_WALLET_ADDRESS;
const DECIMALS     = 9;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const now      = new Date();

  // ── 1. Fetch all SPL token holders via Alchemy ────────────────────────────
  // No lookback needed on Solana — getTokenAccounts returns all current holders
  const rawHolders = await getAllHolders(MINT);

  // ── 2. Vault SOL balance ──────────────────────────────────────────────────
  let vaultSol = 0;
  let vaultUsd = 0;

  if (VAULT_WALLET) {
    try {
      const info     = await getVaultWalletInfo(VAULT_WALLET, MINT);
      const solPrice = await getSolPriceUsd();
      vaultSol       = info.total_sol_value;
      vaultUsd       = vaultSol * solPrice;

      await supabase
        .from("vault_rounds")
        .update({ total_eth: vaultSol, total_usd: vaultUsd })
        .eq("status", "active");
    } catch (e) {
      console.error("Vault SOL fetch failed:", e);
    }
  }

  // Fallback: read from Supabase
  if (vaultUsd === 0) {
    const { data: activeVault } = await supabase
      .from("vault_rounds")
      .select("total_usd, total_eth")
      .eq("status", "active")
      .order("id", { ascending: false })
      .limit(1)
      .single();
    if (activeVault) {
      vaultUsd = Number(activeVault.total_usd ?? 0);
      vaultSol = Number(activeVault.total_eth ?? 0);
    }
  }

  // ── 3. Fetch existing holders + callout bonuses ───────────────────────────
  const [existingRes, calloutsRes] = await Promise.all([
    supabase.from("holders").select("wallet, seconds_held, balance_formatted, updated_at"),
    supabase
      .from("trainer_profiles")
      .select("wallet, callout_multiplier, callout_status")
      .eq("callout_status", "approved"),
  ]);

  const existingMap = new Map(
    (existingRes.data ?? []).map((h) => [h.wallet, h])
  );
  const calloutMap = new Map(
    (calloutsRes.data ?? []).map((p) => [
      p.wallet,
      Number(p.callout_multiplier ?? 1),
    ])
  );

  const upserts: any[] = [];
  let holdTimeUpdated = 0;

  for (const { address, rawBalance } of rawHolders) {
    const wallet            = address; // base58, no lowercasing needed
    const balance_formatted = Number(rawBalance) / Math.pow(10, DECIMALS);

    const prev        = existingMap.get(wallet);
    const prevBalance = Number(prev?.balance_formatted ?? 0);
    const prevSeconds = Number(prev?.seconds_held ?? 0);
    let seconds_held  = prevSeconds;

    if (prev?.updated_at) {
      const diffSecs = Math.floor(
        (now.getTime() - new Date(prev.updated_at).getTime()) / 1000
      );
      if (balance_formatted >= prevBalance * 0.99 && diffSecs > 0) {
        seconds_held = prevSeconds + diffSecs;
        holdTimeUpdated++;
      } else if (balance_formatted < prevBalance * 0.99) {
        seconds_held = 0;
      }
    } else {
      seconds_held = 0;
    }

    const pokemonId           = assignPokemon(wallet);
    const evolution_level     = getEvolutionLevel(balance_formatted);
    const calloutBonus        = calloutMap.get(wallet) ?? 1;
    const callout_verified    = calloutBonus > 1;
    const effective_multiplier = evolution_level * calloutBonus;
    const score               = calcScore(balance_formatted, seconds_held, evolution_level, callout_verified);

    upserts.push({
      wallet,
      balance: rawBalance,
      balance_formatted,
      seconds_held,
      pokemon_id: pokemonId,
      evolution_level,
      score,
      effective_multiplier,
      share_pct: 0,
      estimated_payout_usd: 0,
      callout_verified,
      updated_at: now.toISOString(),
    });
  }

  // ── 4. Share % and estimated payout ──────────────────────────────────────
  const totalScore = upserts.reduce((sum, h) => sum + (h.score ?? 0), 0);
  for (const h of upserts) {
    h.share_pct           = totalScore > 0 ? ((h.score ?? 0) / totalScore) * 100 : 0;
    h.estimated_payout_usd = vaultUsd > 0 ? (h.share_pct / 100) * vaultUsd * 0.8 : 0;
  }

  // ── 5. Upsert in batches ──────────────────────────────────────────────────
  const BATCH = 100;
  for (let i = 0; i < upserts.length; i += BATCH) {
    const { error } = await supabase
      .from("holders")
      .upsert(upserts.slice(i, i + BATCH), {
        onConflict: "wallet",
        ignoreDuplicates: false,
      });
    if (error) console.error("Upsert error:", error);
  }

  // ── 6. Zero out wallets no longer holding ─────────────────────────────────
  const activeSet = new Set(rawHolders.map((h) => h.address));
  const toZero    = (existingRes.data ?? [])
    .filter((h) => !activeSet.has(h.wallet))
    .map((h) => h.wallet);

  if (toZero.length > 0) {
    await supabase
      .from("holders")
      .update({ balance_formatted: 0, score: 0, share_pct: 0, seconds_held: 0 })
      .in("wallet", toZero);
  }

  return NextResponse.json({
    synced: upserts.length,
    zeroed: toZero.length,
    hold_time_updated: holdTimeUpdated,
    avg_seconds:
      upserts.length > 0
        ? Math.floor(upserts.reduce((s, h) => s + h.seconds_held, 0) / upserts.length)
        : 0,
    vault_sol: vaultSol,
    vault_usd: vaultUsd.toFixed(2),
    timestamp: now.toISOString(),
  });
}
