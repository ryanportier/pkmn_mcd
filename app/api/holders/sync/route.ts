import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAllHolders, getVaultWalletInfo } from "@/lib/alchemy";
import { assignPokemon, getEvolutionLevel, calcScore } from "@/lib/pokemon";

const CONTRACT     = process.env.NEXT_PUBLIC_PKMN_CONTRACT!;
const VAULT_WALLET = process.env.VAULT_WALLET_ADDRESS;
const DECIMALS     = 18;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let lookback: "1h" | "1d" | "7d" = "1d";
  try {
    const body = await req.json().catch(() => ({}));
    if (["1h", "1d", "7d"].includes(body.lookback)) lookback = body.lookback;
  } catch {}

  const supabase = getSupabaseAdmin();
  const now = new Date();

  // ── 1. Fetch holders from Alchemy ─────────────────────────────────────────
  const rawHolders = await getAllHolders(CONTRACT, lookback);

  // ── 2. Vault balance — try wallet first, fallback to Supabase value ────────
  let vaultEth = 0;
  let vaultUsd = 0;

  if (VAULT_WALLET && VAULT_WALLET !== "0xTU_WALLET_FEES") {
    try {
      const info = await getVaultWalletInfo(VAULT_WALLET, CONTRACT);
      vaultEth = info.eth_balance;
      const priceRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CONTRACT}`)
        .then((r) => r.json()).catch(() => null);
      const basePair = (priceRes?.pairs ?? [])
        .filter((p: any) => p.chainId === "base")
        .sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
      const ethPriceUsd = basePair ? parseFloat(basePair?.priceNative ?? "0") || 3500 : 3500;
      vaultUsd = vaultEth * ethPriceUsd;
      await supabase.from("vault_rounds")
        .update({ total_eth: vaultEth, total_usd: vaultUsd })
        .eq("status", "active");
    } catch (e) {
      console.error("Vault wallet fetch failed:", e);
    }
  }

  // Fallback: read current vault total_usd from Supabase (set manually or from previous sync)
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
      vaultEth = Number(activeVault.total_eth ?? 0);
    }
  }

  // ── 3. Fetch existing holders + callout bonuses ───────────────────────────
  const [existingRes, calloutsRes] = await Promise.all([
    supabase.from("holders").select("wallet, seconds_held, balance_formatted, updated_at"),
    supabase.from("trainer_profiles")
      .select("wallet, callout_multiplier, callout_status")
      .eq("callout_status", "approved"),
  ]);

  const existingMap = new Map(
    (existingRes.data ?? []).map((h) => [h.wallet.toLowerCase(), h])
  );
  // trainer_profiles table may not exist yet — handle gracefully
  const calloutMap = new Map(
    (calloutsRes.data ?? []).map((p) => [
      p.wallet.toLowerCase(),
      Number(p.callout_multiplier ?? 1),
    ])
  );

  const upserts: any[] = [];
  let holdTimeUpdated = 0;

  for (const { address, rawBalance } of rawHolders) {
    const wallet            = address.toLowerCase();
    const balance_formatted = Number(BigInt(rawBalance)) / Math.pow(10, DECIMALS);

    const prev        = existingMap.get(wallet);
    const prevBalance = Number(prev?.balance_formatted ?? 0);
    const prevSeconds = Number(prev?.seconds_held ?? 0);
    let seconds_held  = prevSeconds;

    if (prev?.updated_at) {
      const prevTime = new Date(prev.updated_at).getTime();
      const diffSecs = Math.floor((now.getTime() - prevTime) / 1000);

      if (balance_formatted >= prevBalance * 0.99 && diffSecs > 0) {
        // Holding or bought more → accumulate time
        seconds_held = prevSeconds + diffSecs;
        holdTimeUpdated++;
      } else if (balance_formatted < prevBalance * 0.99) {
        // Sold → reset
        seconds_held = 0;
      }
      // else: same balance, same seconds (shouldn't happen but safe)
    } else {
      // Brand new holder
      seconds_held = 0;
    }

    const pokemonId        = assignPokemon(wallet);
    const evolution_level  = getEvolutionLevel(balance_formatted);
    const calloutBonus     = calloutMap.get(wallet) ?? 1;
    const callout_verified = calloutBonus > 1;
    const effective_multiplier = evolution_level * calloutBonus;
    const score = calcScore(balance_formatted, seconds_held, evolution_level, callout_verified);

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
    h.share_pct = totalScore > 0 ? ((h.score ?? 0) / totalScore) * 100 : 0;
    h.estimated_payout_usd = vaultUsd > 0 ? (h.share_pct / 100) * vaultUsd * 0.8 : 0;
  }

  // ── 5. Upsert in batches ──────────────────────────────────────────────────
  const BATCH = 100;
  for (let i = 0; i < upserts.length; i += BATCH) {
    const { error } = await supabase
      .from("holders")
      .upsert(upserts.slice(i, i + BATCH), {
        onConflict: "wallet",
        ignoreDuplicates: false, // IMPORTANT: must update existing rows
      });
    if (error) console.error("Upsert error:", error);
  }

  // ── 6. Zero out wallets no longer holding ────────────────────────────────
  const activeSet = new Set(rawHolders.map((h) => h.address.toLowerCase()));
  const toZero    = (existingRes.data ?? [])
    .filter((h) => !activeSet.has(h.wallet.toLowerCase()))
    .map((h) => h.wallet);

  if (toZero.length > 0) {
    await supabase.from("holders")
      .update({ balance_formatted: 0, score: 0, share_pct: 0, seconds_held: 0 })
      .in("wallet", toZero);
  }

  return NextResponse.json({
    synced: upserts.length,
    zeroed: toZero.length,
    hold_time_updated: holdTimeUpdated,
    avg_seconds: upserts.length > 0
      ? Math.floor(upserts.reduce((s, h) => s + h.seconds_held, 0) / upserts.length)
      : 0,
    lookback,
    vault_eth: vaultEth,
    vault_usd: vaultUsd.toFixed(2),
    timestamp: now.toISOString(),
  });
}