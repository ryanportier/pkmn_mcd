import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getTokenPrice } from "@/lib/dexscreener";
import type { DashboardData } from "@/types";

const CONTRACT = process.env.NEXT_PUBLIC_PKMN_CONTRACT!;

const MAGIC_PHRASES = [
  "i choose you",
  "gotta catch em all",
  "ethereum is power",
  "evolve or die",
  "hold for glory",
];

export async function GET(_req: NextRequest) {
  const supabase = getSupabaseAdmin();

  const [holdersRes, vaultRes, payoutsRes, priceData] = await Promise.all([
    supabase
      .from("holders")
      .select("*")
      .gt("balance_formatted", 0)
      .order("score", { ascending: false })
      .limit(200),
    supabase
      .from("vault_rounds")
      .select("*")
      .eq("status", "active")
      .order("id", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("payouts")
      .select("*")
      .order("won_at", { ascending: false })
      .limit(20),
    getTokenPrice(CONTRACT),
  ]);

  // Get shifts completed count
  const { count: shiftsCount } = await supabase
    .from("vault_rounds")
    .select("*", { count: "exact", head: true })
    .eq("status", "settled");

  const phraseIdx =
    Math.floor(Date.now() / (1000 * 60 * 5)) % MAGIC_PHRASES.length;

  const data: DashboardData = {
    vault: vaultRes.data ?? null,
    holders: holdersRes.data ?? [],
    recent_payouts: payoutsRes.data ?? [],
    token_price_usd: priceData.priceUsd,
    token_price_change_24h: priceData.priceChange24h,
    market_cap_usd: priceData.marketCapUsd,
    volume_24h_usd: priceData.volume24hUsd,
    magic_phrase: MAGIC_PHRASES[phraseIdx],
    shifts_completed: shiftsCount ?? 0,
  };

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
